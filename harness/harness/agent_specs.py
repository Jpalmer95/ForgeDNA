"""Agent type definitions and capabilities."""
from dataclasses import dataclass, field
from enum import Enum


class AgentType(str, Enum):
    """Types of agents in the build pipeline."""
    ASSET_3D = "asset_3d"
    TEXTURE = "texture"
    ANIMATION = "animation"
    AUDIO_MUSIC = "audio_music"
    AUDIO_SFX = "audio_sfx"
    AUDIO_AMBIENT = "audio_ambient"
    AUDIO_VOICE = "audio_voice"
    VFX = "vfx"
    CODE_PLAYER = "code_player"
    CODE_ENEMY = "code_enemy"
    CODE_COMBAT = "code_combat"
    CODE_QUEST = "code_quest"
    CODE_CRAFTING = "code_crafting"
    CODE_UI = "code_ui"
    CODE_WORLD = "code_world"
    CODE_TERRAIN = "code_terrain"
    CODE_WATER = "code_water"
    CODE_FOLIAGE = "code_foliage"
    CODE_SKY = "code_sky"
    ASSEMBLY = "assembly"
    TEST = "test"


@dataclass
class AgentSpec:
    """Specification for an agent type."""
    agent_type: AgentType
    name: str
    description: str
    tools_required: list[str] = field(default_factory=list)
    models_required: list[str] = field(default_factory=list)
    can_parallelize: bool = True
    max_instances: int = 4
    estimated_time_per_task: str = "minutes"


# Registry of all agent types
AGENT_REGISTRY: dict[AgentType, AgentSpec] = {
    AgentType.ASSET_3D: AgentSpec(
        agent_type=AgentType.ASSET_3D,
        name="3D Asset Generator",
        description="Generates 3D meshes from text descriptions using TripoSR, InstantMesh, or similar.",
        tools_required=["blender_python", "hf_inference"],
        models_required=["TripoSR", "InstantMesh"],
        can_parallelize=True,
        max_instances=4,
    ),
    AgentType.TEXTURE: AgentSpec(
        agent_type=AgentType.TEXTURE,
        name="Texture Generator",
        description="Generates PBR textures and surface materials from descriptions.",
        tools_required=["hf_inference", "image_generation"],
        models_required=["stable-diffusion-xl", "controlnet"],
        can_parallelize=True,
        max_instances=4,
    ),
    AgentType.ANIMATION: AgentSpec(
        agent_type=AgentType.ANIMATION,
        name="Animation Generator",
        description="Creates skeletal animations from text descriptions.",
        tools_required=["blender_python", "hf_inference"],
        models_required=["motion-diffusion-model"],
        can_parallelize=True,
        max_instances=2,
    ),
    AgentType.AUDIO_MUSIC: AgentSpec(
        agent_type=AgentType.AUDIO_MUSIC,
        name="Music Generator",
        description="Generates background music and theme tracks from mood/genre descriptions.",
        tools_required=["hf_inference"],
        models_required=["musicgen-medium", "stable-audio"],
        can_parallelize=True,
        max_instances=2,
    ),
    AgentType.AUDIO_SFX: AgentSpec(
        agent_type=AgentType.AUDIO_SFX,
        name="SFX Generator",
        description="Generates sound effects from text descriptions.",
        tools_required=["hf_inference"],
        models_required=["audiocraft", "musicgen-small"],
        can_parallelize=True,
        max_instances=4,
    ),
    AgentType.AUDIO_AMBIENT: AgentSpec(
        agent_type=AgentType.AUDIO_AMBIENT,
        name="Ambient Audio Generator",
        description="Generates environmental ambient soundscapes.",
        tools_required=["hf_inference"],
        models_required=["audioldm-2"],
        can_parallelize=True,
        max_instances=2,
    ),
    AgentType.AUDIO_VOICE: AgentSpec(
        agent_type=AgentType.AUDIO_VOICE,
        name="Voice Generator",
        description="Generates NPC voice lines from text with character voice profiles.",
        tools_required=["hf_inference"],
        models_required=["bark", "xtts-v2"],
        can_parallelize=True,
        max_instances=2,
    ),
    AgentType.VFX: AgentSpec(
        agent_type=AgentType.VFX,
        name="VFX Generator",
        description="Creates visual effect shaders, particle systems, and post-processing.",
        tools_required=["code_generation"],
        models_required=["qwen-2.5-72b-instruct"],
        can_parallelize=True,
        max_instances=2,
    ),
    AgentType.CODE_PLAYER: AgentSpec(
        agent_type=AgentType.CODE_PLAYER,
        name="Player Controller Agent",
        description="Generates player controller scripts, movement, abilities, and glyph systems.",
        tools_required=["code_generation", "filesystem"],
        models_required=["qwen-2.5-72b-instruct"],
        can_parallelize=False,
        max_instances=1,
    ),
    AgentType.CODE_ENEMY: AgentSpec(
        agent_type=AgentType.CODE_ENEMY,
        name="Enemy AI Agent",
        description="Generates enemy AI behavior trees, attack patterns, and boss mechanics.",
        tools_required=["code_generation", "filesystem"],
        models_required=["qwen-2.5-72b-instruct"],
        can_parallelize=True,
        max_instances=2,
    ),
    AgentType.CODE_COMBAT: AgentSpec(
        agent_type=AgentType.CODE_COMBAT,
        name="Combat System Agent",
        description="Generates combat mechanics, damage calculation, status effects, and elemental reactions.",
        tools_required=["code_generation", "filesystem"],
        models_required=["qwen-2.5-72b-instruct"],
        can_parallelize=False,
        max_instances=1,
    ),
    AgentType.CODE_QUEST: AgentSpec(
        agent_type=AgentType.CODE_QUEST,
        name="Quest System Agent",
        description="Generates quest logic, dialogue trees, objective tracking, and reward systems.",
        tools_required=["code_generation", "filesystem"],
        models_required=["qwen-2.5-72b-instruct"],
        can_parallelize=True,
        max_instances=2,
    ),
    AgentType.CODE_CRAFTING: AgentSpec(
        agent_type=AgentType.CODE_CRAFTING,
        name="Crafting System Agent",
        description="Generates crafting stations, recipe logic, gathering systems, and economy.",
        tools_required=["code_generation", "filesystem"],
        models_required=["qwen-2.5-72b-instruct"],
        can_parallelize=False,
        max_instances=1,
    ),
    AgentType.CODE_UI: AgentSpec(
        agent_type=AgentType.CODE_UI,
        name="UI Agent",
        description="Generates HUD elements, menus, inventory screens, and accessibility features.",
        tools_required=["code_generation", "filesystem"],
        models_required=["qwen-2.5-72b-instruct"],
        can_parallelize=True,
        max_instances=2,
    ),
    AgentType.CODE_WORLD: AgentSpec(
        agent_type=AgentType.CODE_WORLD,
        name="World Building Agent",
        description="Generates level/scene files, environment scripts, day-night cycles, weather.",
        tools_required=["code_generation", "filesystem"],
        models_required=["qwen-2.5-72b-instruct"],
        can_parallelize=True,
        max_instances=3,
    ),
    # ─── HermesForge environment agents (schema v2) ───
    # These emit HermesForge module recipes, not raw scenes. Their output is a
    # filled recipe JSON + the bridge tool call needed to realize it in the
    # generated HermesForge-base project.
    AgentType.CODE_TERRAIN: AgentSpec(
        agent_type=AgentType.CODE_TERRAIN,
        name="Terrain Recipe Agent",
        description="Fills a HermesForge terrain recipe (rolling_hills / mountain_range / island) from the DNA environment block and drives hermes_terrain_generate through the bridge.",
        tools_required=["hermesforge_mcp", "filesystem"],
        models_required=["qwen-2.5-72b-instruct"],
        can_parallelize=False,
        max_instances=1,
    ),
    AgentType.CODE_WATER: AgentSpec(
        agent_type=AgentType.CODE_WATER,
        name="Water Recipe Agent",
        description="Fills HermesForge water recipes (lake / pond / ocean / river_spline / calm_pool) incl. buoyancy float_bodies, and drives hermes_water_create / hermes_water_float_on_water.",
        tools_required=["hermesforge_mcp", "filesystem"],
        models_required=["qwen-2.5-72b-instruct"],
        can_parallelize=True,
        max_instances=2,
    ),
    AgentType.CODE_FOLIAGE: AgentSpec(
        agent_type=AgentType.CODE_FOLIAGE,
        name="Foliage Recipe Agent",
        description="Fills HermesForge foliage scatter recipes (pine / jungle / alpine / rock / grass / shrub) and drives hermes_foliage_scatter.",
        tools_required=["hermesforge_mcp", "filesystem"],
        models_required=["qwen-2.5-72b-instruct"],
        can_parallelize=True,
        max_instances=2,
    ),
    AgentType.CODE_SKY: AgentSpec(
        agent_type=AgentType.CODE_SKY,
        name="Sky Preset Agent",
        description="Selects the HermesForge sky preset (golden_hour / midday / overcast_storm / clear_night) from the DNA ambiance and drives hermes_sky_set.",
        tools_required=["hermesforge_mcp", "filesystem"],
        models_required=["qwen-2.5-72b-instruct"],
        can_parallelize=False,
        max_instances=1,
    ),
    AgentType.ASSEMBLY: AgentSpec(
        agent_type=AgentType.ASSEMBLY,
        name="Assembly Agent",
        description="Integrates all generated assets and code into the target engine project.",
        tools_required=["filesystem", "engine_cli"],
        models_required=[],
        can_parallelize=False,
        max_instances=1,
    ),
    AgentType.TEST: AgentSpec(
        agent_type=AgentType.TEST,
        name="Test Agent",
        description="Runs automated tests on the built game — validates assets load, scenes compile, no crashes.",
        tools_required=["engine_cli", "filesystem"],
        models_required=[],
        can_parallelize=False,
        max_instances=1,
    ),
}
