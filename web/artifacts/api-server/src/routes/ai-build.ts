import { Router } from "express";
import { randomBytes } from "crypto";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { mkdirSync, writeFileSync, createReadStream, existsSync, unlinkSync } from "fs";
import archiver from "archiver";
import { gameDnaSchema } from "@workspace/game-dna-schema";
import {
  generateProjectGodot,
  generatePlayerRigScene,
  generateLocomotionScript,
  generateMainScene,
  generateEntityScene,
  generateGrabScript,
  generateNpcPatrolScript,
  generateTriggerScript,
  generateWorldConfigScript,
} from "../godot-generators";
import { processLogicRecipes } from "../ai-agent";
import type { AgentLogEntry, ScriptBinding } from "../ai-agent";

const router = Router();

interface AiBuildJob {
  status: "processing" | "complete" | "error";
  zipPath: string | null;
  error: string | null;
  filesGenerated: number;
  createdAt: number;
  userId: string;
  logs: AgentLogEntry[];
  sseClients: Set<(data: string) => void>;
}

const jobs = new Map<string, AiBuildJob>();
const OUTPUT_DIR = join(tmpdir(), "ai-build-output");
mkdirSync(OUTPUT_DIR, { recursive: true });

const MAX_JOBS = 20;
const JOB_TTL_MS = 30 * 60 * 1000;

function cleanupStaleJobs(): void {
  const now = Date.now();
  for (const [jobId, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) {
      if (job.zipPath && existsSync(job.zipPath)) {
        try { unlinkSync(job.zipPath); } catch {}
      }
      jobs.delete(jobId);
    }
  }
}

function writeFile(baseDir: string, relPath: string, content: string): void {
  const safePath = relPath.replace(/[^a-zA-Z0-9_\-/.]/g, "_");
  const fullPath = join(baseDir, safePath);
  const resolved = require("path").resolve(fullPath);
  const resolvedBase = require("path").resolve(baseDir);
  if (!resolved.startsWith(resolvedBase + "/") && resolved !== resolvedBase) {
    throw new Error(`Path traversal blocked: ${relPath}`);
  }
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

async function zipDirectory(sourceDir: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const { createWriteStream } = require("fs");
    const output = createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", (err: Error) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function integrateAiOutputs(
  projectDir: string,
  scriptBindings: ScriptBinding[],
  allAiScripts: string[],
): void {
  const { readFileSync } = require("fs");
  const boundPaths = new Set<string>();

  for (const binding of scriptBindings) {
    const entityScenePath = join(projectDir, `entities/${binding.targetEntityId}.tscn`);
    const resolvedScenePath = resolve(entityScenePath);
    const entitiesDir = resolve(join(projectDir, "entities"));
    if (!resolvedScenePath.startsWith(entitiesDir + "/")) continue;
    if (!existsSync(entityScenePath)) continue;

    let sceneContent = readFileSync(entityScenePath, "utf-8") as string;
    if (sceneContent.includes(binding.scriptPath)) {
      boundPaths.add(binding.scriptPath);
      continue;
    }

    const extResCount = (sceneContent.match(/\[ext_resource/g) || []).length;
    const extResId = String(extResCount + 1);
    const newExtRes = `[ext_resource type="Script" path="res://${binding.scriptPath}" id="${extResId}"]\n`;

    const lastExtResMatch = sceneContent.match(/(\[ext_resource[^\]]*\]\n)/g);
    if (lastExtResMatch) {
      const lastEntry = lastExtResMatch[lastExtResMatch.length - 1];
      sceneContent = sceneContent.replace(lastEntry, lastEntry + newExtRes);
    } else {
      const headerEnd = sceneContent.indexOf("\n") + 1;
      sceneContent = sceneContent.substring(0, headerEnd) + newExtRes + sceneContent.substring(headerEnd);
    }

    if (binding.attachMode === "root") {
      const rootNodeMatch = sceneContent.match(/(\[node name="[^"]*" type="[^"]*"(?:\s+parent="[^"]*")?)\]/);
      if (rootNodeMatch) {
        const rootNodeLine = rootNodeMatch[0];
        if (rootNodeLine.includes("script =")) {
          sceneContent = sceneContent.replace(
            /script = ExtResource\("[^"]*"\)/,
            `script = ExtResource("${extResId}")`,
          );
        } else {
          sceneContent = sceneContent.replace(
            rootNodeLine,
            `${rootNodeLine}\nscript = ExtResource("${extResId}")`,
          );
        }
      }
    } else {
      const scriptBaseName = binding.scriptPath.replace(/.*\//, "").replace(".gd", "");
      sceneContent += `\n[node name="${scriptBaseName}" type="${binding.nodeType}" parent="."]\nscript = ExtResource("${extResId}")\n`;
    }

    writeFileSync(entityScenePath, sceneContent, "utf-8");
    boundPaths.add(binding.scriptPath);
  }

  const unboundScripts = allAiScripts.filter((s) => !boundPaths.has(s));
  if (unboundScripts.length === 0) return;

  const projectGodotPath = join(projectDir, "project.godot");
  if (!existsSync(projectGodotPath)) return;

  let godotContent = readFileSync(projectGodotPath, "utf-8") as string;
  const autoloadLines: string[] = [];
  for (const scriptPath of unboundScripts) {
    const baseName = scriptPath.replace(/.*\//, "").replace(".gd", "");
    const className = baseName
      .split("_")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
    const entry = `${className}="*res://${scriptPath}"`;
    if (!godotContent.includes(entry)) {
      autoloadLines.push(entry);
    }
  }
  if (autoloadLines.length > 0) {
    if (!godotContent.includes("[autoload]")) {
      godotContent += `\n[autoload]\n\n${autoloadLines.join("\n")}\n`;
    } else {
      godotContent = godotContent.replace("[autoload]", `[autoload]\n${autoloadLines.join("\n")}`);
    }
    writeFile(projectDir, "project.godot", godotContent);
  }
}

interface ValidationWarning {
  recipe: string;
  issue: string;
}

function validateAiOutputs(
  agentFiles: Map<string, string>,
  scriptBindings: ScriptBinding[],
  recipes: Array<{ name: string; type: string }>,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const generatedPaths = new Set(agentFiles.keys());

  for (const recipe of recipes) {
    const recipeScripts = [...generatedPaths].filter((p) => p.endsWith(".gd"));
    const hasScript = recipeScripts.length > 0;

    if (!hasScript) {
      warnings.push({ recipe: recipe.name, issue: "No GDScript files generated" });
      continue;
    }

    const recipeBindings = scriptBindings.filter((b) => {
      const scriptContent = agentFiles.get(b.scriptPath) || "";
      return scriptContent.toLowerCase().includes(recipe.name.toLowerCase().replace(/[_-]/g, ""));
    });

    switch (recipe.type) {
      case "behavior_tree": {
        const hasRootBinding = recipeBindings.some((b) => b.attachMode === "root");
        if (!hasRootBinding) {
          warnings.push({ recipe: recipe.name, issue: "behavior_tree recipe has no root-attached script — NPC may not be controlled correctly" });
        }
        let hasMovementLogic = false;
        for (const [, content] of agentFiles) {
          if (content.includes("velocity") || content.includes("move_and_slide") || content.includes("navigate") || content.includes("look_at")) {
            hasMovementLogic = true;
            break;
          }
        }
        if (!hasMovementLogic) {
          warnings.push({ recipe: recipe.name, issue: "behavior_tree scripts lack movement/navigation logic (velocity, move_and_slide, navigate)" });
        }
        break;
      }
      case "crafting": {
        let hasCraftingLogic = false;
        for (const [, content] of agentFiles) {
          if ((content.includes("ingredient") || content.includes("recipe")) && (content.includes("queue_free") || content.includes("instance") || content.includes("spawn"))) {
            hasCraftingLogic = true;
            break;
          }
        }
        if (!hasCraftingLogic) {
          warnings.push({ recipe: recipe.name, issue: "crafting scripts lack ingredient consumption/result spawning logic" });
        }
        break;
      }
      case "trigger": {
        let hasTriggerLogic = false;
        for (const [, content] of agentFiles) {
          if (content.includes("body_entered") || content.includes("area_entered") || content.includes("signal")) {
            hasTriggerLogic = true;
            break;
          }
        }
        if (!hasTriggerLogic) {
          warnings.push({ recipe: recipe.name, issue: "trigger scripts lack signal wiring (body_entered, area_entered)" });
        }
        break;
      }
      case "spawning": {
        let hasSpawnLogic = false;
        for (const [, content] of agentFiles) {
          if (content.includes("instantiate") || content.includes("instance") || content.includes("add_child")) {
            hasSpawnLogic = true;
            break;
          }
        }
        if (!hasSpawnLogic) {
          warnings.push({ recipe: recipe.name, issue: "spawning scripts lack instantiation logic (instantiate, add_child)" });
        }
        break;
      }
    }
  }

  const unboundScripts = [...generatedPaths].filter((p) => p.endsWith(".gd") && !scriptBindings.some((b) => b.scriptPath === p));
  if (unboundScripts.length > 0) {
    warnings.push({ recipe: "(global)", issue: `${unboundScripts.length} script(s) not bound to any entity: ${unboundScripts.join(", ")}` });
  }

  return warnings;
}

async function processAiBuild(jobId: string, data: Record<string, unknown>, recipeIds?: string[]): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    const projectDir = join(OUTPUT_DIR, jobId);
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(join(projectDir, "scripts"), { recursive: true });
    mkdirSync(join(projectDir, "entities"), { recursive: true });
    mkdirSync(join(projectDir, "scenes"), { recursive: true });

    let filesGenerated = 0;

    writeFile(projectDir, "project.godot", generateProjectGodot(data));
    filesGenerated++;

    writeFile(projectDir, "scripts/world_config.gd", generateWorldConfigScript(data));
    filesGenerated++;

    const rig = (data.player_rig || {}) as Record<string, unknown>;
    writeFile(projectDir, "scripts/locomotion.gd", generateLocomotionScript(rig));
    filesGenerated++;

    writeFile(projectDir, "player_rig.tscn", generatePlayerRigScene(rig));
    filesGenerated++;

    writeFile(projectDir, "main.tscn", generateMainScene(data));
    filesGenerated++;

    const entityRegistry = (data.entity_registry || []) as Array<Record<string, unknown>>;
    const scriptsWritten = new Set<string>();

    for (const entity of entityRegistry) {
      const rawId = String(entity.id || "entity");
      const entityId = rawId.replace(/[^a-zA-Z0-9_-]/g, "_");
      const entityType = String(entity.type || "static_prop");
      const modelPrompt = entity.model_prompt as string | undefined;

      const entityData = {
        id: entityId,
        type: entityType,
        mass_kg: typeof entity.mass_kg === "number" ? entity.mass_kg : undefined,
        physics_material: entity.physics_material as { friction?: number; bounce?: number } | undefined,
        speed: typeof entity.speed === "number" ? entity.speed : undefined,
        health: typeof entity.health === "number" ? entity.health : undefined,
        grab_offset: Array.isArray(entity.grab_offset) ? entity.grab_offset as number[] : undefined,
        haptic_on_hit: Array.isArray(entity.haptic_on_hit) ? entity.haptic_on_hit as number[] : undefined,
        navmesh_layer: typeof entity.navmesh_layer === "string" ? entity.navmesh_layer : undefined,
      };

      let tscnContent = generateEntityScene(entityData);
      if (modelPrompt) {
        tscnContent = `; MODEL_PROMPT: "${modelPrompt}"\n; Use with Meshy, Luma, or similar AI 3D model generators\n\n${tscnContent}`;
      }
      writeFile(projectDir, `entities/${entityId}.tscn`, tscnContent);
      filesGenerated++;

      if (entityType === "grabbable" && !scriptsWritten.has("grab")) {
        writeFile(projectDir, "scripts/grab.gd", generateGrabScript());
        scriptsWritten.add("grab");
        filesGenerated++;
      }
      if (entityType === "npc" && !scriptsWritten.has("npc_patrol")) {
        writeFile(projectDir, "scripts/npc_patrol.gd", generateNpcPatrolScript());
        scriptsWritten.add("npc_patrol");
        filesGenerated++;
      }
      if (entityType === "trigger" && !scriptsWritten.has("trigger_zone")) {
        writeFile(projectDir, "scripts/trigger_zone.gd", generateTriggerScript());
        scriptsWritten.add("trigger_zone");
        filesGenerated++;
      }
    }

    const emitToClients = (entry: AgentLogEntry) => {
      const eventData = JSON.stringify(entry);
      for (const send of job.sseClients) {
        try { send(eventData); } catch {}
      }
    };

    const agentResult = await processLogicRecipes(data, (entry) => {
      job.logs.push(entry);
      emitToClients(entry);
    }, recipeIds);

    const logicRecipes = (data.logic_recipes || []) as Array<Record<string, unknown>>;
    if (agentResult.failedRecipes.length > 0 && agentResult.failedRecipes.length === logicRecipes.length && logicRecipes.length > 0) {
      const { rmSync } = require("fs");
      rmSync(projectDir, { recursive: true, force: true });
      job.status = "error";
      job.error = `All ${logicRecipes.length} recipe(s) failed AI generation: ${agentResult.failedRecipes.join(", ")}`;
      emitToClients({ timestamp: Date.now(), type: "error", message: job.error });
      for (const send of job.sseClients) {
        try { send("[DONE]"); } catch {}
      }
      job.sseClients.clear();
      return;
    }

    const aiScriptPaths: string[] = [];
    for (const [filePath, content] of agentResult.files) {
      writeFile(projectDir, filePath, content);
      filesGenerated++;
      if (filePath.endsWith(".gd")) {
        aiScriptPaths.push(filePath);
      }
    }

    integrateAiOutputs(projectDir, agentResult.scriptBindings, aiScriptPaths);

    const processedRecipes = (recipeIds && recipeIds.length > 0
      ? (data.logic_recipes as Array<Record<string, unknown>> || []).filter((r) => recipeIds.includes(String(r.name)))
      : (data.logic_recipes as Array<Record<string, unknown>> || [])
    ).map((r) => ({ name: String(r.name), type: String(r.type) }));

    const validationWarnings = validateAiOutputs(agentResult.files, agentResult.scriptBindings, processedRecipes);
    for (const w of validationWarnings) {
      emitToClients({ timestamp: Date.now(), type: "error", message: `[Validation] ${w.recipe}: ${w.issue}` });
      job.logs.push({ timestamp: Date.now(), type: "error", message: `[Validation] ${w.recipe}: ${w.issue}` });
    }

    const zipPath = join(OUTPUT_DIR, `${jobId}.zip`);
    await zipDirectory(projectDir, zipPath);

    const { rmSync } = require("fs");
    rmSync(projectDir, { recursive: true, force: true });

    job.status = "complete";
    job.zipPath = zipPath;
    job.filesGenerated = filesGenerated;

    const warningMsg = agentResult.failedRecipes.length > 0
      ? ` (${agentResult.failedRecipes.length} recipe(s) failed: ${agentResult.failedRecipes.join(", ")})`
      : (validationWarnings.length > 0 ? ` (${validationWarnings.length} validation warning(s))` : "");
    emitToClients({ timestamp: Date.now(), type: "status", message: `Build complete! Download ready.${warningMsg}` });

    for (const send of job.sseClients) {
      try { send("[DONE]"); } catch {}
    }
    job.sseClients.clear();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    job.status = "error";
    job.error = message;

    const errorEntry: AgentLogEntry = { timestamp: Date.now(), type: "error", message };
    for (const send of job.sseClients) {
      try {
        send(JSON.stringify(errorEntry));
        send("[DONE]");
      } catch {}
    }
    job.sseClients.clear();
  }
}

router.post("/ai-build", (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required for AI Build" });
    return;
  }

  cleanupStaleJobs();

  if (jobs.size >= MAX_JOBS) {
    res.status(429).json({ error: "Too many concurrent AI builds. Please try again later." });
    return;
  }

  const { schemaData, recipeIds } = req.body;
  if (!schemaData || typeof schemaData !== "object") {
    res.status(400).json({ error: "schemaData is required" });
    return;
  }

  if (recipeIds !== undefined && (!Array.isArray(recipeIds) || !recipeIds.every((id: unknown) => typeof id === "string"))) {
    res.status(400).json({ error: "recipeIds must be an array of strings if provided" });
    return;
  }

  const validation = gameDnaSchema.safeParse(schemaData);
  if (!validation.success) {
    res.status(400).json({ error: "Invalid GameDNA schema", details: validation.error.issues });
    return;
  }

  const jobId = randomBytes(4).toString("hex");
  jobs.set(jobId, {
    status: "processing",
    zipPath: null,
    error: null,
    filesGenerated: 0,
    createdAt: Date.now(),
    userId: req.user.id,
    logs: [],
    sseClients: new Set(),
  });

  res.json({ jobId, status: "processing" });

  processAiBuild(jobId, schemaData as Record<string, unknown>, recipeIds as string[] | undefined);
});

router.get("/ai-build/stream/:jobId", (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.userId !== req.user.id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  for (const entry of job.logs) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }

  if (job.status === "complete" || job.status === "error") {
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  const send = (data: string) => {
    res.write(`data: ${data}\n\n`);
    if (data === "[DONE]") {
      res.end();
    }
  };

  job.sseClients.add(send);

  req.on("close", () => {
    job.sseClients.delete(send);
  });
});

router.get("/ai-build/status/:jobId", (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.userId !== req.user.id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const downloadUrl = job.status === "complete" ? `/api/ai-build/download/${jobId}` : null;
  res.json({
    jobId,
    status: job.status,
    downloadUrl,
    error: job.error,
    filesGenerated: job.filesGenerated,
    logCount: job.logs.length,
  });
});

router.get("/ai-build/download/:jobId", (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.userId !== req.user.id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  if (job.status !== "complete" || !job.zipPath) {
    res.status(400).json({ error: "Build not ready" });
    return;
  }
  if (!existsSync(job.zipPath)) {
    res.status(404).json({ error: "Build file not found" });
    return;
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="godot-ai-build-${jobId}.zip"`);
  createReadStream(job.zipPath).pipe(res);
});

export default router;
