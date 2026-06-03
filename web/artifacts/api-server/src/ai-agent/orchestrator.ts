import { normalize } from "path";
import OpenAI from "openai";
import { mcpTools } from "./tools";
import { buildSystemPrompt, buildRecipePrompt } from "./prompts";

function sanitizePath(filePath: string): string | null {
  const cleaned = filePath.replace(/[^a-zA-Z0-9_\-/.]/g, "_");
  const normalized = normalize(cleaned);
  if (normalized.startsWith("/") || normalized.startsWith("..") || normalized.includes("/../") || normalized.includes("/..")) {
    return null;
  }
  return normalized;
}

function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "",
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
  });
}

export interface AgentLogEntry {
  timestamp: number;
  type: "tool_call" | "tool_result" | "agent_message" | "status" | "error";
  toolName?: string;
  input?: string;
  output?: string;
  message?: string;
}

export interface ScriptBinding {
  scriptPath: string;
  targetEntityId: string;
  nodeType: string;
  attachMode: "root" | "child";
}

export interface AgentResult {
  files: Map<string, string>;
  logs: AgentLogEntry[];
  failedRecipes: string[];
  scriptBindings: ScriptBinding[];
}

interface RecipeData {
  name: string;
  type: string;
  ingredients?: string[];
  trigger?: { type?: string; to?: string };
  result?: { spawn?: string; probability?: number };
  nodes?: Array<{ id: number; type: string; children?: number[]; action?: string; condition?: string }>;
}

export async function processLogicRecipes(
  gameDna: Record<string, unknown>,
  onLogEntry: (entry: AgentLogEntry) => void,
  recipeIds?: string[],
): Promise<AgentResult> {
  const meta = (gameDna.meta || {}) as Record<string, unknown>;
  const vibePrompt = String(meta.vibe_prompt || "");
  const gameGoal = String(meta.goal || "");
  const gameTitle = String(meta.title || "Untitled Game");

  const allRecipes = (gameDna.logic_recipes || []) as RecipeData[];
  const logicRecipes = recipeIds && recipeIds.length > 0
    ? allRecipes.filter((r) => recipeIds.includes(r.name))
    : allRecipes;
  const files = new Map<string, string>();
  const logs: AgentLogEntry[] = [];
  const failedRecipes: string[] = [];
  const scriptBindings: ScriptBinding[] = [];

  const emitLog = (entry: AgentLogEntry) => {
    logs.push(entry);
    onLogEntry(entry);
  };

  if (logicRecipes.length === 0) {
    emitLog({
      timestamp: Date.now(),
      type: "status",
      message: "No logic recipes found — skipping AI generation.",
    });
    return { files, logs, failedRecipes, scriptBindings };
  }

  emitLog({
    timestamp: Date.now(),
    type: "status",
    message: `Processing ${logicRecipes.length} logic recipe(s) for "${gameTitle}"...`,
  });

  const entityRegistry = (gameDna.entity_registry || []) as Array<Record<string, unknown>>;
  for (const entity of entityRegistry) {
    const modelPrompt = entity.model_prompt as string | undefined;
    if (modelPrompt) {
      emitLog({
        timestamp: Date.now(),
        type: "status",
        message: `Entity "${entity.id}" has model_prompt: "${modelPrompt}" (surfaced as comment in .tscn)`,
      });
    }
  }

  for (let i = 0; i < logicRecipes.length; i++) {
    const recipe = logicRecipes[i];
    emitLog({
      timestamp: Date.now(),
      type: "status",
      message: `[${i + 1}/${logicRecipes.length}] Processing ${recipe.type} recipe: "${recipe.name}"`,
    });

    try {
      const recipeResult = await processRecipe(gameDna, recipe, vibePrompt, gameGoal, gameTitle, emitLog);
      for (const [path, content] of recipeResult.files) {
        files.set(path, content);
      }
      scriptBindings.push(...recipeResult.bindings);
      if (recipeResult.files.size === 0) {
        failedRecipes.push(recipe.name);
        emitLog({
          timestamp: Date.now(),
          type: "error",
          message: `Recipe "${recipe.name}" produced no output files`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failedRecipes.push(recipe.name);
      emitLog({
        timestamp: Date.now(),
        type: "error",
        message: `Failed to process recipe "${recipe.name}": ${msg}`,
      });
    }
  }

  if (failedRecipes.length > 0) {
    emitLog({
      timestamp: Date.now(),
      type: "error",
      message: `${failedRecipes.length} recipe(s) failed: ${failedRecipes.join(", ")}`,
    });
  }

  emitLog({
    timestamp: Date.now(),
    type: "status",
    message: `AI Build complete. Generated ${files.size} file(s)${failedRecipes.length > 0 ? ` (${failedRecipes.length} failed)` : ""}.`,
  });

  return { files, logs, failedRecipes, scriptBindings };
}

interface RecipeResult {
  files: Map<string, string>;
  bindings: ScriptBinding[];
}

async function processRecipe(
  gameDna: Record<string, unknown>,
  recipe: RecipeData,
  vibePrompt: string,
  gameGoal: string,
  gameTitle: string,
  emitLog: (entry: AgentLogEntry) => void,
): Promise<RecipeResult> {
  const files = new Map<string, string>();
  const bindings: ScriptBinding[] = [];
  const systemPrompt = buildSystemPrompt(vibePrompt, gameGoal, gameTitle);
  const userPrompt = buildRecipePrompt(recipe.type, recipe.name, JSON.stringify(recipe, null, 2));

  const messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const MAX_ITERATIONS = 10;
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: messages as Parameters<typeof client.chat.completions.create>[0]["messages"],
      tools: mcpTools as Parameters<typeof client.chat.completions.create>[0]["tools"],
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    if (!choice) break;

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      messages.push({
        role: "assistant",
        content: choice.message.content || "",
        ...({ tool_calls: choice.message.tool_calls } as Record<string, unknown>),
      } as typeof messages[0]);

      for (const toolCall of choice.message.tool_calls) {
        const { name, arguments: argsStr } = toolCall.function;
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(argsStr);
        } catch {
          args = {};
        }

        emitLog({
          timestamp: Date.now(),
          type: "tool_call",
          toolName: name,
          input: JSON.stringify(args, null, 2),
        });

        let result: string;
        switch (name) {
          case "read_game_dna": {
            const section = String(args.section || "full");
            if (section === "full") {
              result = JSON.stringify(gameDna, null, 2);
            } else {
              const data = gameDna[section];
              result = data !== undefined ? JSON.stringify(data, null, 2) : `Section "${section}" not found.`;
            }
            break;
          }
          case "write_gdscript": {
            const rawPath = String(args.file_path || "scripts/unnamed.gd");
            const filePath = sanitizePath(rawPath);
            const content = String(args.content || "");
            const desc = String(args.description || "");
            const targetEntityId = String(args.target_entity_id || "");
            const nodeType = String(args.node_type || "Node");
            const VALID_ID_RE = /^[A-Za-z0-9_-]+$/;
            const ALLOWED_NODE_TYPES = new Set([
              "Node", "Node2D", "Node3D", "Area3D", "CharacterBody3D",
              "RigidBody3D", "StaticBody3D", "AnimationPlayer", "Timer",
              "Sprite3D", "MeshInstance3D", "CollisionShape3D", "Camera3D",
            ]);
            if (!filePath) {
              result = `Error: invalid file path "${rawPath}" — path traversal not allowed`;
            } else if (!filePath.endsWith(".gd")) {
              result = `Error: file_path must end with .gd, got "${filePath}"`;
            } else {
              files.set(filePath, content);
              if (targetEntityId && VALID_ID_RE.test(targetEntityId)) {
                const safeNodeType = ALLOWED_NODE_TYPES.has(nodeType) ? nodeType : "Node";
                const attachMode = String(args.attach_mode || "child") === "root" ? "root" as const : "child" as const;
                bindings.push({ scriptPath: filePath, targetEntityId, nodeType: safeNodeType, attachMode });
              } else if (targetEntityId) {
                emitLog({
                  timestamp: Date.now(),
                  type: "error",
                  message: `Invalid target_entity_id "${targetEntityId}" — must match [A-Za-z0-9_-]+`,
                });
              }
              result = `Written ${filePath} (${content.length} bytes): ${desc}${targetEntityId ? ` [attached to entity: ${targetEntityId}]` : ""}`;
            }
            break;
          }
          case "write_tscn": {
            const rawPath = String(args.file_path || "scenes/unnamed.tscn");
            const filePath = sanitizePath(rawPath);
            const content = String(args.content || "");
            const desc = String(args.description || "");
            if (!filePath) {
              result = `Error: invalid file path "${rawPath}" — path traversal not allowed`;
            } else if (!filePath.endsWith(".tscn")) {
              result = `Error: file_path must end with .tscn, got "${filePath}"`;
            } else {
              files.set(filePath, content);
              result = `Written ${filePath} (${content.length} bytes): ${desc}`;
            }
            break;
          }
          default:
            result = `Unknown tool: ${name}`;
        }

        emitLog({
          timestamp: Date.now(),
          type: "tool_result",
          toolName: name,
          output: result.length > 500 ? result.substring(0, 500) + "..." : result,
        });

        messages.push({
          role: "tool",
          content: result,
          tool_call_id: toolCall.id,
        });
      }
    } else {
      if (choice.message.content) {
        emitLog({
          timestamp: Date.now(),
          type: "agent_message",
          message: choice.message.content,
        });
      }
      break;
    }
  }

  return { files, bindings };
}
