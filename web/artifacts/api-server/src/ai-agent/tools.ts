interface FunctionTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const mcpTools: FunctionTool[] = [
  {
    type: "function",
    function: {
      name: "read_game_dna",
      description: "Read a specific section of the GameDNA schema JSON. Use this to inspect entity_registry, logic_recipes, environment_config, player_rig, meta, levels, or audio sections.",
      parameters: {
        type: "object",
        properties: {
          section: {
            type: "string",
            enum: ["meta", "environment_config", "player_rig", "entity_registry", "logic_recipes", "levels", "audio", "full"],
            description: "The top-level section of the GameDNA schema to read.",
          },
        },
        required: ["section"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_gdscript",
      description: "Write a GDScript (.gd) file to the generated Godot project and attach it to a target entity. The script will be integrated as a child node on the specified entity's scene.",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "The relative file path within the Godot project, e.g. 'scripts/crafting/craft_data_shard.gd'. Must end with .gd.",
          },
          content: {
            type: "string",
            description: "The full GDScript source code content.",
          },
          description: {
            type: "string",
            description: "Brief description of what this script does.",
          },
          target_entity_id: {
            type: "string",
            description: "The entity ID from entity_registry that this script should be attached to. E.g. 'security_drone', 'crafting_table'. Leave empty if this is a standalone/global script.",
          },
          node_type: {
            type: "string",
            enum: ["Node", "Node3D", "Area3D", "CharacterBody3D", "RigidBody3D", "StaticBody3D"],
            description: "The Godot node type this script should be attached to. Must match the extends declaration in the script. Defaults to 'Node'.",
          },
          attach_mode: {
            type: "string",
            enum: ["root", "child"],
            description: "How to attach this script: 'root' attaches to the entity's existing root node (use for behavior_tree/NPC control scripts that must drive the entity body), 'child' creates a new child node (use for auxiliary logic like crafting stations, triggers). Defaults to 'child'.",
          },
        },
        required: ["file_path", "content", "description", "target_entity_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_tscn",
      description: "Write a Godot text scene (.tscn) file to the generated project. Use this for scene files that define node trees for crafting tables, spawn points, trigger zones, etc.",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "The relative file path within the Godot project, e.g. 'scenes/crafting/craft_data_shard.tscn'. Must end with .tscn.",
          },
          content: {
            type: "string",
            description: "The full Godot text scene file content.",
          },
          description: {
            type: "string",
            description: "Brief description of what this scene contains.",
          },
        },
        required: ["file_path", "content", "description"],
      },
    },
  },
];
