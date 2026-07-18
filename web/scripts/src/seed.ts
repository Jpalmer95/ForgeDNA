import { db } from "@workspace/db";
import { gameSchemasTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const neonShadowDna = {
  meta: {
    title: "Neon Shadow VR Escape",
    version: "1.2",
    vibe_prompt: "Cyberpunk 2077 meets Blade Runner 2049 – rain-slick neon streets, holographic billboards, distant flying cars, moody synthwave",
    target_platforms: ["Quest 3", "WebXR"],
    goal: "Escape the megacorp tower in under 15 minutes. Collect 3 data shards while avoiding security drones.",
  },
  environment_config: {
    physics: { gravity_vector: [0, -9.81, 0], default_friction: 0.8, terminal_velocity: 50 },
    skybox: { type: "procedural", description: "Night city skyline with rain streaks and flying car trails", hdr_intensity: 1.2 },
    terrain: { base_type: "plane", collision_shape: "box", size_m: [200, 1, 200], spawn_points: [{ name: "player_start", position: [0, 2, 0] }] },
    post_processing: { bloom: 0.6, chromatic_aberration: 0.3, color_grading: "cyberpunk_teal_pink" },
  },
  player_rig: {
    origin_type: "XROrigin3D",
    camera: { type: "XRCamera3D", height_offset: 1.7, near: 0.05, far: 1000 },
    controllers: [
      { hand: "left", type: "XRController3D", tracker: "left_hand", haptic_curves: { grab: [0.8, 0.3, 0.1] } },
      { hand: "right", type: "XRController3D", tracker: "right_hand", haptic_curves: { grab: [0.8, 0.3, 0.1] } },
    ],
    locomotion: { mode: "teleport_with_blinder", turn_speed_deg: 45, snap_turn: true, movement_speed: 5.0 },
    collision: { capsule_radius: 0.35, capsule_height: 1.8, center_of_mass_offset: [0, 0.9, 0] },
    ik_settings: { enabled: true, elbow_offset: [0.2, 0, 0] },
  },
  entity_registry: [
    { id: "neon_sword", type: "grabbable", model_prompt: "glowing cyan katana with holographic edge", mass_kg: 1.2, physics_material: { friction: 0.4, bounce: 0.1 }, damage: 25, grab_offset: [0, 0.1, 0], haptic_on_hit: [1.0, 0.5, 0.2] },
    { id: "security_drone", type: "npc", model_prompt: "sleek black quadcopter drone with red scanning laser", behavior_tree: "patrol → detect_player → chase → shoot", navmesh_layer: "air", speed: 8.0, health: 50 },
    { id: "data_shard", type: "grabbable", model_prompt: "small glowing blue crystal data fragment", mass_kg: 0.1, physics_material: { friction: 0.2, bounce: 0.3 }, grab_offset: [0, 0, 0] },
    { id: "crafting_table", type: "static_prop", model_prompt: "holographic workbench with floating tool icons" },
    { id: "scrap_metal", type: "grabbable", model_prompt: "twisted piece of chrome-plated metal debris", mass_kg: 0.5, physics_material: { friction: 0.6, bounce: 0.05 }, grab_offset: [0, 0, 0] },
    { id: "holo_chip", type: "grabbable", model_prompt: "tiny translucent circuit board emitting faint blue light", mass_kg: 0.05, physics_material: { friction: 0.3, bounce: 0.1 }, grab_offset: [0, 0, 0] },
  ],
  logic_recipes: [
    { name: "craft_data_shard", type: "crafting", ingredients: ["scrap_metal", "holo_chip"], trigger: { type: "proximity", to: "crafting_table" }, result: { spawn: "data_shard", probability: 1.0 } },
    { name: "drone_ai", type: "behavior_tree", nodes: [{ id: 1, type: "selector", children: [2, 3] }, { id: 2, type: "sequence", action: "patrol" }, { id: 3, type: "sequence", condition: "player_in_sight", action: "chase_and_shoot" }] },
  ],
  levels: [{ id: "level_1_tower_lobby", description: "Rain-soaked entrance hall with holographic receptionist", layout_prompt: "large atrium with glass walls and floating ads", objectives: ["find_keycard", "hack_terminal"], win_condition: { collect_shards: 3, time_limit_seconds: 900 } }],
  audio: {
    bgm: { prompt: "cyberpunk synthwave rain loop" },
    sfx_library: [
      { id: "sword_swing", prompt: "whooshing neon blade" },
      { id: "drone_hover", prompt: "electric quadcopter hum with servo whine" },
      { id: "shard_pickup", prompt: "crystalline chime with digital echo" },
      { id: "craft_success", prompt: "holographic assembly completion tone" },
    ],
  },
};

const escapeRoomDna = {
  meta: {
    title: "VR Escape Room Starter",
    version: "1.0",
    vibe_prompt: "Mysterious Victorian study crossed with steampunk laboratory — mahogany panels, brass instruments, ticking clocks, amber gaslight, hidden mechanisms",
    target_platforms: ["Quest 3", "WebXR"],
    goal: "Solve interconnected puzzles to unlock the exit door within 30 minutes.",
  },
  environment_config: {
    physics: { gravity_vector: [0, -9.81, 0], default_friction: 0.9, terminal_velocity: 50 },
    skybox: { type: "solid_color", description: "Warm amber interior lighting", hdr_intensity: 0.8 },
    terrain: { base_type: "plane", collision_shape: "box", size_m: [10, 1, 10], spawn_points: [{ name: "player_start", position: [0, 1, 0] }] },
    post_processing: { bloom: 0.3, chromatic_aberration: 0.0, color_grading: "warm_vintage" },
  },
  player_rig: {
    origin_type: "XROrigin3D",
    camera: { type: "XRCamera3D", height_offset: 1.7, near: 0.05, far: 100 },
    controllers: [
      { hand: "left", type: "XRController3D", tracker: "left_hand", haptic_curves: { grab: [0.5, 0.2, 0.1] } },
      { hand: "right", type: "XRController3D", tracker: "right_hand", haptic_curves: { grab: [0.5, 0.2, 0.1] } },
    ],
    locomotion: { mode: "teleport_with_blinder", turn_speed_deg: 45, snap_turn: true, movement_speed: 3.0 },
    collision: { capsule_radius: 0.3, capsule_height: 1.8, center_of_mass_offset: [0, 0.9, 0] },
  },
  entity_registry: [
    { id: "brass_key", type: "grabbable", model_prompt: "ornate brass skeleton key with gear-shaped handle", mass_kg: 0.15, physics_material: { friction: 0.5, bounce: 0.05 }, grab_offset: [0, 0, 0] },
    { id: "cipher_wheel", type: "grabbable", model_prompt: "rotating brass cipher wheel with engraved letters", mass_kg: 0.8, physics_material: { friction: 0.7, bounce: 0.0 }, grab_offset: [0, 0.05, 0] },
    { id: "locked_chest", type: "static_prop", model_prompt: "heavy wooden chest with brass lock mechanism and embossed symbols" },
    { id: "exit_door", type: "trigger", model_prompt: "heavy oak door with multiple lock mechanisms and a glowing keyhole" },
    { id: "clue_note", type: "grabbable", model_prompt: "aged parchment with cryptic handwritten symbols in faded ink", mass_kg: 0.02, physics_material: { friction: 0.1, bounce: 0.0 }, grab_offset: [0, 0, 0] },
  ],
  logic_recipes: [
    { name: "unlock_chest", type: "trigger", trigger: { type: "proximity", to: "locked_chest" }, condition: "player_holding:brass_key", action: "open_chest_reveal_cipher" },
    { name: "solve_cipher", type: "crafting", ingredients: ["cipher_wheel", "clue_note"], trigger: { type: "proximity", to: "locked_chest" }, result: { spawn: "brass_key", probability: 1.0 } },
  ],
  levels: [{ id: "study_room", description: "Victorian gentleman's study with hidden puzzles", layout_prompt: "rectangular room 8x6m with bookshelves, desk, fireplace, globe, and grandfather clock", objectives: ["find_key", "decode_cipher", "unlock_exit"], win_condition: { unlock_door: true, time_limit_seconds: 1800 } }],
  audio: {
    bgm: { prompt: "mysterious Victorian ambient with ticking clocks and creaking wood" },
    sfx_library: [
      { id: "key_insert", prompt: "brass key sliding into lock mechanism click" },
      { id: "chest_open", prompt: "heavy wooden chest creaking open with dust puff" },
      { id: "cipher_rotate", prompt: "brass gears clicking into alignment" },
    ],
  },
};

const dungeonCrawlerDna = {
  meta: {
    title: "VR Dungeon Crawler Starter",
    version: "1.0",
    vibe_prompt: "Dark Souls meets medieval dungeon — torch-lit stone corridors, dripping water, distant growls, gothic arches, fog-shrouded depths",
    target_platforms: ["Quest 3", "WebXR"],
    goal: "Fight through dungeon floors, defeat enemies, collect loot, and reach the final boss chamber.",
  },
  environment_config: {
    physics: { gravity_vector: [0, -9.81, 0], default_friction: 0.85, terminal_velocity: 50 },
    skybox: { type: "solid_color", description: "Dark underground void with distant torchlight flickers", hdr_intensity: 0.4 },
    terrain: { base_type: "plane", collision_shape: "box", size_m: [50, 1, 50], spawn_points: [{ name: "player_start", position: [0, 1, 0] }] },
    post_processing: { bloom: 0.2, chromatic_aberration: 0.1, color_grading: "dark_dungeon" },
  },
  player_rig: {
    origin_type: "XROrigin3D",
    camera: { type: "XRCamera3D", height_offset: 1.7, near: 0.05, far: 200 },
    controllers: [
      { hand: "left", type: "XRController3D", tracker: "left_hand", haptic_curves: { grab: [0.7, 0.4, 0.2], hit: [1.0, 0.6, 0.2] } },
      { hand: "right", type: "XRController3D", tracker: "right_hand", haptic_curves: { grab: [0.7, 0.4, 0.2], hit: [1.0, 0.6, 0.2] } },
    ],
    locomotion: { mode: "smooth", turn_speed_deg: 90, snap_turn: false, movement_speed: 4.0 },
    collision: { capsule_radius: 0.35, capsule_height: 1.8, center_of_mass_offset: [0, 0.9, 0] },
  },
  entity_registry: [
    { id: "iron_sword", type: "grabbable", model_prompt: "battered iron longsword with leather-wrapped grip", mass_kg: 2.5, physics_material: { friction: 0.5, bounce: 0.05 }, damage: 30, grab_offset: [0, 0.15, 0], haptic_on_hit: [1.0, 0.7, 0.3] },
    { id: "wooden_shield", type: "grabbable", model_prompt: "round wooden shield with iron rim and faded crest", mass_kg: 3.0, physics_material: { friction: 0.6, bounce: 0.1 }, grab_offset: [0, 0.1, 0] },
    { id: "skeleton_warrior", type: "npc", model_prompt: "animated skeleton in rusted chainmail wielding a jagged sword", behavior_tree: "idle → detect_player → attack_melee", navmesh_layer: "ground", speed: 3.0, health: 40 },
    { id: "health_potion", type: "grabbable", model_prompt: "glowing red potion in a glass flask with cork stopper", mass_kg: 0.3, physics_material: { friction: 0.3, bounce: 0.2 }, grab_offset: [0, 0, 0] },
    { id: "treasure_chest", type: "static_prop", model_prompt: "iron-banded wooden chest overflowing with gold coins" },
  ],
  logic_recipes: [
    { name: "skeleton_ai", type: "behavior_tree", nodes: [{ id: 1, type: "selector", children: [2, 3] }, { id: 2, type: "sequence", action: "idle_patrol" }, { id: 3, type: "sequence", condition: "player_in_range_5m", action: "melee_attack" }] },
    { name: "spawn_skeletons", type: "spawning", entity: "skeleton_warrior", max_count: 4, interval_seconds: 30, spawn_area: { center: [10, 0, 10], radius: 8 } },
  ],
  levels: [{ id: "dungeon_floor_1", description: "First floor of the forgotten crypt", layout_prompt: "branching stone corridors with alcoves, a central chamber with pillars, two side rooms with treasure", objectives: ["clear_enemies", "find_treasure"], win_condition: { enemies_defeated: 8, collect_treasure: 1 } }],
  audio: {
    bgm: { prompt: "dark dungeon ambient with dripping water and distant echoes" },
    sfx_library: [
      { id: "sword_clash", prompt: "metal on metal sword impact clang" },
      { id: "skeleton_rattle", prompt: "bones rattling and clanking movement" },
      { id: "potion_drink", prompt: "cork pop and magical gulping sound" },
      { id: "chest_open", prompt: "creaky wooden chest opening with coin clink" },
    ],
  },
};

const explorationDna = {
  meta: {
    title: "VR Exploration / Walking Sim Starter",
    version: "1.0",
    vibe_prompt: "Journey meets Firewatch — vast painterly landscapes, golden hour light, gentle wind, floating particles, contemplative solitude",
    target_platforms: ["Quest 3", "WebXR"],
    goal: "Explore a serene island, discover hidden landmarks, and collect memory fragments that tell a story.",
  },
  environment_config: {
    physics: { gravity_vector: [0, -9.81, 0], default_friction: 0.9, terminal_velocity: 50 },
    skybox: { type: "procedural", description: "Golden sunset sky with volumetric clouds and distant mountain silhouettes", hdr_intensity: 1.5 },
    terrain: { base_type: "heightmap", collision_shape: "trimesh", size_m: [500, 50, 500], spawn_points: [{ name: "player_start", position: [0, 5, 0] }] },
    post_processing: { bloom: 0.5, chromatic_aberration: 0.0, color_grading: "warm_golden" },
  },
  player_rig: {
    origin_type: "XROrigin3D",
    camera: { type: "XRCamera3D", height_offset: 1.7, near: 0.05, far: 2000 },
    controllers: [
      { hand: "left", type: "XRController3D", tracker: "left_hand" },
      { hand: "right", type: "XRController3D", tracker: "right_hand" },
    ],
    locomotion: { mode: "smooth", turn_speed_deg: 60, snap_turn: false, movement_speed: 3.5 },
    collision: { capsule_radius: 0.3, capsule_height: 1.8, center_of_mass_offset: [0, 0.9, 0] },
  },
  entity_registry: [
    { id: "memory_fragment", type: "grabbable", model_prompt: "floating translucent orb with swirling golden light inside", mass_kg: 0.0, physics_material: { friction: 0.0, bounce: 0.0 }, grab_offset: [0, 0, 0] },
    { id: "ancient_ruins", type: "static_prop", model_prompt: "weathered stone arch covered in moss and vine with carved symbols" },
    { id: "lighthouse", type: "static_prop", model_prompt: "tall white lighthouse on a cliff with rotating beam of warm light" },
    { id: "viewpoint_marker", type: "trigger", model_prompt: "small stone cairn at a scenic overlook point" },
  ],
  logic_recipes: [
    { name: "viewpoint_discovery", type: "trigger", trigger: { type: "proximity", to: "viewpoint_marker" }, action: "reveal_panorama_and_narration" },
  ],
  levels: [{ id: "island_dusk", description: "A tranquil island at golden hour", layout_prompt: "rolling green hills with scattered trees, a rocky coastline, ancient ruins on the hilltop, a lighthouse on the cliff", objectives: ["discover_viewpoints", "collect_memories"], win_condition: { collect_fragments: 5 } }],
  audio: {
    bgm: { prompt: "ambient acoustic guitar with ocean waves and gentle wind" },
    sfx_library: [
      { id: "memory_collect", prompt: "soft crystalline chime with warm reverb" },
      { id: "wind_gust", prompt: "gentle breeze through grass and leaves" },
      { id: "ocean_waves", prompt: "distant rhythmic ocean waves on rocky shore" },
    ],
  },
};

const puzzleRoomDna = {
  meta: {
    title: "VR Puzzle Room Starter",
    version: "1.0",
    vibe_prompt: "Portal meets The Witness — clean minimalist architecture, stark lighting, colored light beams, geometric shapes, satisfying mechanical clicks",
    target_platforms: ["Quest 3", "WebXR"],
    goal: "Complete a sequence of physics-based puzzles using colored cubes and light beams to open the final portal.",
  },
  environment_config: {
    physics: { gravity_vector: [0, -9.81, 0], default_friction: 0.7, terminal_velocity: 50 },
    skybox: { type: "solid_color", description: "Clean white void with subtle gradient to pale blue", hdr_intensity: 1.0 },
    terrain: { base_type: "plane", collision_shape: "box", size_m: [30, 1, 30], spawn_points: [{ name: "player_start", position: [0, 1, 0] }] },
    post_processing: { bloom: 0.4, chromatic_aberration: 0.0, color_grading: "clean_minimal" },
  },
  player_rig: {
    origin_type: "XROrigin3D",
    camera: { type: "XRCamera3D", height_offset: 1.7, near: 0.05, far: 500 },
    controllers: [
      { hand: "left", type: "XRController3D", tracker: "left_hand", haptic_curves: { grab: [0.4, 0.2, 0.1] } },
      { hand: "right", type: "XRController3D", tracker: "right_hand", haptic_curves: { grab: [0.4, 0.2, 0.1] } },
    ],
    locomotion: { mode: "teleport_with_blinder", turn_speed_deg: 45, snap_turn: true, movement_speed: 4.0 },
    collision: { capsule_radius: 0.3, capsule_height: 1.8, center_of_mass_offset: [0, 0.9, 0] },
  },
  entity_registry: [
    { id: "red_cube", type: "grabbable", model_prompt: "glossy red cube 20cm with subtle inner glow", mass_kg: 1.0, physics_material: { friction: 0.8, bounce: 0.1 }, grab_offset: [0, 0, 0] },
    { id: "blue_cube", type: "grabbable", model_prompt: "glossy blue cube 20cm with subtle inner glow", mass_kg: 1.0, physics_material: { friction: 0.8, bounce: 0.1 }, grab_offset: [0, 0, 0] },
    { id: "pressure_plate", type: "trigger", model_prompt: "flat square pressure plate that glows when activated" },
    { id: "light_emitter", type: "static_prop", model_prompt: "wall-mounted device emitting a beam of white light" },
    { id: "portal_gate", type: "trigger", model_prompt: "large circular frame with swirling energy when all puzzles solved" },
  ],
  logic_recipes: [
    { name: "plate_activation", type: "trigger", trigger: { type: "proximity", to: "pressure_plate" }, condition: "red_cube_placed", action: "open_barrier" },
    { name: "cube_combining", type: "crafting", ingredients: ["red_cube", "blue_cube"], trigger: { type: "proximity", to: "light_emitter" }, result: { spawn: "portal_gate", probability: 1.0 } },
  ],
  levels: [{ id: "puzzle_chamber_1", description: "First puzzle chamber with light beam mechanics", layout_prompt: "series of 3 connected white rooms, each with a puzzle involving cubes and pressure plates, final room has portal", objectives: ["solve_room_1", "solve_room_2", "activate_portal"], win_condition: { puzzles_solved: 3 } }],
  audio: {
    bgm: { prompt: "minimal ambient electronic with clean reverb and subtle pulses" },
    sfx_library: [
      { id: "cube_place", prompt: "satisfying click of cube locking into position" },
      { id: "plate_activate", prompt: "mechanical pressure plate depression with light activation hum" },
      { id: "portal_open", prompt: "whooshing energy portal opening with harmonic resonance" },
      { id: "barrier_open", prompt: "glass barrier sliding open with pneumatic hiss" },
    ],
  },
};

const templates = [
  { dns: neonShadowDna, slug: "neon-shadow-vr-escape", genre: null },
  { dns: escapeRoomDna, slug: "vr-escape-room-starter", genre: "escape-room" },
  { dns: dungeonCrawlerDna, slug: "vr-dungeon-crawler-starter", genre: "dungeon-crawler" },
  { dns: explorationDna, slug: "vr-exploration-walking-sim-starter", genre: "exploration" },
  { dns: puzzleRoomDna, slug: "vr-puzzle-room-starter", genre: "puzzle" },
];

async function seed() {
  console.log("Seeding ForgeDNA template schemas...");

  for (const tmpl of templates) {
    const meta = tmpl.dns.meta;
    const existing = await db.select().from(gameSchemasTable).where(
      eq(gameSchemasTable.slug, tmpl.slug)
    );
    if (existing.length > 0) {
      console.log(`  Skipping "${meta.title}" (slug "${tmpl.slug}" already exists)`);
      continue;
    }

    await db.insert(gameSchemasTable).values({
      title: meta.title,
      slug: tmpl.slug,
      version: meta.version,
      vibePrompt: meta.vibe_prompt,
      targetPlatforms: meta.target_platforms,
      goal: meta.goal,
      genreTag: tmpl.genre,
      schemaData: tmpl.dns as unknown as Record<string, unknown>,
      isPublic: true,
      forkCount: 0,
    });
    console.log(`  Seeded "${meta.title}"`);
  }

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
