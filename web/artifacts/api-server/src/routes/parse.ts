import { Router } from "express";
import { randomBytes } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
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

const router = Router();

interface Job {
  status: "processing" | "complete" | "error";
  zipPath: string | null;
  error: string | null;
  filesGenerated: number;
  createdAt: number;
}

const jobs = new Map<string, Job>();
const OUTPUT_DIR = join(tmpdir(), "godot-parser-output");
mkdirSync(OUTPUT_DIR, { recursive: true });

const MAX_JOBS = 50;
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
  const fullPath = join(baseDir, relPath);
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

async function processJob(jobId: string, data: Record<string, unknown>): Promise<void> {
  try {
    const projectDir = join(OUTPUT_DIR, jobId);
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(join(projectDir, "scripts"), { recursive: true });
    mkdirSync(join(projectDir, "entities"), { recursive: true });

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
      writeFile(projectDir, `entities/${entityId}.tscn`, generateEntityScene(entityData));
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

    const zipPath = join(OUTPUT_DIR, `${jobId}.zip`);
    await zipDirectory(projectDir, zipPath);

    const { rmSync } = require("fs");
    rmSync(projectDir, { recursive: true, force: true });

    jobs.set(jobId, { status: "complete", zipPath, error: null, filesGenerated, createdAt: Date.now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    jobs.set(jobId, { status: "error", zipPath: null, error: message, filesGenerated: 0, createdAt: Date.now() });
  }
}

router.post("/parse", (req, res) => {
  cleanupStaleJobs();

  if (jobs.size >= MAX_JOBS) {
    res.status(429).json({ error: "Too many concurrent builds. Please try again later." });
    return;
  }

  const { schemaData } = req.body;
  if (!schemaData || typeof schemaData !== "object") {
    res.status(400).json({ error: "schemaData is required" });
    return;
  }

  const validation = gameDnaSchema.safeParse(schemaData);
  if (!validation.success) {
    res.status(400).json({ error: "Invalid GameDNA schema", details: validation.error.issues });
    return;
  }

  const jobId = randomBytes(4).toString("hex");
  jobs.set(jobId, { status: "processing", zipPath: null, error: null, filesGenerated: 0, createdAt: Date.now() });

  res.json({ jobId, status: "processing" });

  processJob(jobId, schemaData as Record<string, unknown>);
});

router.get("/parse/status/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const downloadUrl = job.status === "complete" ? `/api/parse/download/${jobId}` : null;
  res.json({
    jobId,
    status: job.status,
    downloadUrl,
    error: job.error,
    filesGenerated: job.filesGenerated,
  });
});

router.get("/parse/download/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
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
  res.setHeader("Content-Disposition", `attachment; filename="godot-project-${jobId}.zip"`);
  createReadStream(job.zipPath).pipe(res);
});

export default router;
