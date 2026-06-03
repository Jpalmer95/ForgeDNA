import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

const spawnPointSchema = z.object({
  name: z.string(),
  position: vec3Schema,
});

const physicsSchema = z.object({
  gravity_vector: vec3Schema,
  default_friction: z.number().min(0).max(1),
  terminal_velocity: z.number().min(0),
});

const skyboxSchema = z.object({
  type: z.enum(["procedural", "hdri", "solid_color"]),
  description: z.string(),
  hdr_intensity: z.number().min(0).optional(),
});

const terrainSchema = z.object({
  base_type: z.enum(["plane", "heightmap", "mesh"]),
  collision_shape: z.enum(["box", "trimesh", "convex"]),
  size_m: vec3Schema,
  spawn_points: z.array(spawnPointSchema),
});

const postProcessingSchema = z.object({
  bloom: z.number().min(0).max(1).optional(),
  chromatic_aberration: z.number().min(0).max(1).optional(),
  color_grading: z.string().optional(),
});

const environmentConfigSchema = z.object({
  physics: physicsSchema,
  skybox: skyboxSchema,
  terrain: terrainSchema,
  post_processing: postProcessingSchema.optional(),
});

const cameraSchema = z.object({
  type: z.string(),
  height_offset: z.number(),
  near: z.number(),
  far: z.number(),
});

const controllerSchema = z.object({
  hand: z.enum(["left", "right"]),
  type: z.string(),
  tracker: z.string(),
  haptic_curves: z.record(z.string(), z.array(z.number())).optional(),
});

const locomotionSchema = z.object({
  mode: z.enum(["teleport_with_blinder", "smooth", "teleport", "none"]),
  turn_speed_deg: z.number(),
  snap_turn: z.boolean(),
  movement_speed: z.number(),
});

const collisionSchema = z.object({
  capsule_radius: z.number(),
  capsule_height: z.number(),
  center_of_mass_offset: vec3Schema.optional(),
});

const ikSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  elbow_offset: vec3Schema.optional(),
});

const playerRigSchema = z.object({
  origin_type: z.string(),
  camera: cameraSchema,
  controllers: z.array(controllerSchema),
  locomotion: locomotionSchema,
  collision: collisionSchema,
  ik_settings: ikSettingsSchema.optional(),
});

const entitySchema = z.object({
  id: z.string(),
  type: z.enum(["grabbable", "npc", "trigger", "static_prop"]),
  model_prompt: z.string().optional(),
  mass_kg: z.number().optional(),
  physics_material: z.object({
    friction: z.number().optional(),
    bounce: z.number().optional(),
  }).optional(),
  damage: z.number().optional(),
  grab_offset: vec3Schema.optional(),
  haptic_on_hit: z.array(z.number()).optional(),
  behavior_tree: z.string().optional(),
  navmesh_layer: z.string().optional(),
  speed: z.number().optional(),
  health: z.number().optional(),
});

const behaviorNodeSchema = z.object({
  id: z.number().int(),
  type: z.enum(["selector", "sequence", "condition", "action"]),
  children: z.array(z.number().int()).optional(),
  action: z.string().optional(),
  condition: z.string().optional(),
});

const logicRecipeSchema = z.object({
  name: z.string(),
  type: z.enum(["crafting", "behavior_tree", "trigger", "spawning"]),
  ingredients: z.array(z.string()).optional(),
  trigger: z.object({
    type: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
  result: z.object({
    spawn: z.string().optional(),
    probability: z.number().min(0).max(1).optional(),
  }).optional(),
  nodes: z.array(behaviorNodeSchema).optional(),
});

const winConditionSchema = z.object({
  collect_shards: z.number().int().optional(),
  time_limit_seconds: z.number().int().optional(),
});

const levelSchema = z.object({
  id: z.string(),
  description: z.string(),
  layout_prompt: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  win_condition: winConditionSchema.optional(),
});

const audioSchema = z.object({
  bgm: z.object({
    prompt: z.string().optional(),
  }).optional(),
  sfx_library: z.array(z.object({
    id: z.string(),
    prompt: z.string(),
  })).optional(),
});

const metaSchema = z.object({
  title: z.string(),
  version: z.string(),
  vibe_prompt: z.string(),
  target_platforms: z.array(z.string()),
  goal: z.string(),
});

export const gameDnaSchema = z.object({
  meta: metaSchema,
  environment_config: environmentConfigSchema,
  player_rig: playerRigSchema,
  entity_registry: z.array(entitySchema),
  logic_recipes: z.array(logicRecipeSchema),
  levels: z.array(levelSchema),
  audio: audioSchema,
});

export type GameDNA = z.infer<typeof gameDnaSchema>;

export function getGameDnaJsonSchema() {
  return zodToJsonSchema(gameDnaSchema, {
    name: "GameDNA",
    $refStrategy: "none",
  });
}
