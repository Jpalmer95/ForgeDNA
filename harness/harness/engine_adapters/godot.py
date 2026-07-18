"""Godot engine adapter — generates project files, scenes, and scripts."""
import json
import os
import shutil
from pathlib import Path
from typing import Any

from ..dna_parser import GameDNA
from .base import EngineAdapter

# Default location of the HermesForge base template (vendored module stack:
# Terrain3D + Gaea pre-wired, Jolt as the 3D physics backend). Overridable via
# HERMESFORGE_TEMPLATE env var for non-standard checkouts.
_DEFAULT_TEMPLATE = Path.home() / "dev" / "hermesforge" / "templates" / "base"

# The hermes_bridge editor plugin (MCP control socket) ships in the golden-demo
# template, not the base template. Generated projects get it too so the bridge
# can apply the environment recipes. Overridable via HERMESFORGE_BRIDGE env var.
_DEFAULT_BRIDGE = Path.home() / "dev" / "hermesforge" / "templates" / "golden-demo" / "addons" / "hermes_bridge"


class GodotAdapter(EngineAdapter):
    """Generates a complete Godot 4.x project from GameDNA.

    v2 (schema v2): when the DNA declares an `environment:` block, the project
    is emitted on top of the HermesForge base template — vendored module stack
    pre-wired — plus an `environment/` manifest of filled module recipes that
    the hermes_bridge MCP tools (or a human) apply to realize terrain, water,
    foliage, and sky. Without the block it emits the classic self-contained
    project as before.
    """

    def __init__(self, dna: GameDNA, output_dir: str):
        super().__init__(dna, output_dir)
        self.project_dir = self.output_dir / "godot_project"
        self.project_dir.mkdir(parents=True, exist_ok=True)

    def get_engine_name(self) -> str:
        return "godot"

    def get_engine_version(self) -> str:
        return "4.7" if self.dna.has_environment_stack() else "4.x"

    def get_supported_features(self) -> list[str]:
        features = [
            "movement", "combat", "crafting", "progression", "economy",
            "day_night", "weather", "quests", "npcs", "enemies",
            "items", "inventory", "dialogue", "skill_trees", "save_system",
        ]
        if self.dna.has_environment_stack():
            features += ["terrain", "water", "foliage", "sky"]
        return features

    def get_export_targets(self) -> list[str]:
        return ["pc", "mac", "linux", "web", "android"]

    def generate_project(self, outputs: dict[str, Any] | None = None) -> dict[str, Any]:
        """Assemble all outputs into a complete Godot project."""
        return self.generate_all()

    def generate_all(self) -> dict[str, Any]:
        """Generate the complete Godot project."""
        if self.dna.has_environment_stack():
            return self._generate_hermesforge_project()
        return self._generate_classic_project()

    # ─── v2: HermesForge-base project ───────────────────────────────────────

    def _generate_hermesforge_project(self) -> dict[str, Any]:
        """Emit a HermesForge-base project with the environment manifest."""
        files_created: list[str] = []

        # 1. Copy the vendored HermesForge base template (module stack) plus
        #    the hermes_bridge editor plugin (applies the environment recipes).
        template = Path(os.environ.get("HERMESFORGE_TEMPLATE", str(_DEFAULT_TEMPLATE)))
        if self._copy_template(template):
            files_created.append(f"<template:{template.name}>")
        bridge_src = Path(os.environ.get("HERMESFORGE_BRIDGE", str(_DEFAULT_BRIDGE)))
        if self._copy_bridge(bridge_src):
            files_created.append("addons/hermes_bridge")

        # 2. project.godot: game name + Jolt + module plugins, on top of base.
        files_created.append(self._write_hermesforge_project_godot())

        # 3. Environment manifest — the filled module recipes + bridge calls.
        files_created += self._write_environment_manifest()

        # 4. Boot scene + script that reports the environment stack headless.
        files_created.append(self._write_hermesforge_main_scene())

        return {
            "engine": "godot",
            "base": "hermesforge",
            "project_dir": str(self.project_dir),
            "files_created": files_created,
            "total_files": len(files_created),
            "environment_stack": {
                "terrain": bool(self.dna.env_terrain()),
                "water": len(self.dna.env_water()),
                "foliage": len(self.dna.env_foliage()),
                "sky": bool(self.dna.env_sky()),
            },
        }

    def _copy_template(self, template: Path) -> bool:
        """Copy the HermesForge base template into the project dir."""
        if not template.exists():
            # Template unavailable — emit a manifest-only project that still
            # records the environment intent (adapter stays usable standalone).
            return False
        for item in template.iterdir():
            dest = self.project_dir / item.name
            if item.is_dir():
                if dest.exists():
                    shutil.rmtree(dest)
                shutil.copytree(item, dest)
            else:
                shutil.copy2(item, dest)
        return True

    def _copy_bridge(self, bridge_src: Path) -> bool:
        """Copy the hermes_bridge editor plugin into addons/ (bridge-ready)."""
        if not bridge_src.exists():
            return False
        dest = self.project_dir / "addons" / "hermes_bridge"
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(bridge_src, dest)
        return True

    def _write_hermesforge_project_godot(self) -> str:
        """project.godot for a HermesForge-base project (Godot 4.7, Jolt, modules)."""
        title = self.dna.title
        genre = ", ".join(self.dna.genre)

        content = f"""\
; Engine configuration file.
; Generated by ForgeDNA (schema v2) on the HermesForge base template.
; Module stack pre-wired: Terrain3D + Gaea plugins, Jolt 3D physics.
; Game: {title} — {genre}

config_version=5

[application]

config/name="{title}"
config/description="Generated by ForgeDNA on HermesForge — {genre}"
run/main_scene="res://main.tscn"
config/features=PackedStringArray("4.7", "Forward Plus")

[editor_plugins]

enabled=PackedStringArray("terrain_3d", "gaea", "hermes_bridge")

[physics]

3d/physics_engine="Jolt Physics"

[rendering]

renderer/rendering_method="forward_plus"
"""
        path = self.project_dir / "project.godot"
        path.write_text(content)
        return "project.godot"

    def _write_environment_manifest(self) -> list[str]:
        """Write the filled environment module recipes + bridge application script."""
        written: list[str] = []
        env_dir = self.project_dir / "environment"
        env_dir.mkdir(parents=True, exist_ok=True)

        manifest: dict[str, Any] = {
            "game": self.dna.title,
            "generator": "forgedna-harness (schema v2)",
            "modules": {},
            "bridge_tools": [],
        }

        terrain = self.dna.env_terrain()
        if terrain:
            manifest["modules"]["terrain"] = terrain
            manifest["bridge_tools"].append("hermes_terrain_generate")
        for water in self.dna.env_water():
            manifest["modules"].setdefault("water", []).append(water)
            if "hermes_water_create" not in manifest["bridge_tools"]:
                manifest["bridge_tools"].append("hermes_water_create")
        for foliage in self.dna.env_foliage():
            manifest["modules"].setdefault("foliage", []).append(foliage)
            if "hermes_foliage_scatter" not in manifest["bridge_tools"]:
                manifest["bridge_tools"].append("hermes_foliage_scatter")
        sky = self.dna.env_sky()
        if sky:
            manifest["modules"]["sky"] = sky
            manifest["bridge_tools"].append("hermes_sky_set")

        manifest_path = env_dir / "environment.manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2))
        written.append("environment/environment.manifest.json")

        # Also write per-module filled recipe files (the recipe vocabulary a
        # human or agent can hand-edit and re-apply).
        if terrain:
            p = env_dir / "terrain.recipe.json"
            p.write_text(json.dumps(self._as_recipe("terrain", terrain), indent=2))
            written.append("environment/terrain.recipe.json")
        for i, water in enumerate(self.dna.env_water()):
            rid = water.get("recipe", f"water_{i}")
            p = env_dir / f"water.{rid}.recipe.json"
            p.write_text(json.dumps(self._as_recipe("water", water), indent=2))
            written.append(f"environment/water.{rid}.recipe.json")
        for i, foliage in enumerate(self.dna.env_foliage()):
            rid = foliage.get("recipe", f"foliage_{i}")
            p = env_dir / f"foliage.{rid}.recipe.json"
            p.write_text(json.dumps(self._as_recipe("foliage", foliage), indent=2))
            written.append(f"environment/foliage.{rid}.recipe.json")
        if sky:
            p = env_dir / "sky.recipe.json"
            p.write_text(json.dumps(self._as_recipe("sky", sky), indent=2))
            written.append("environment/sky.recipe.json")

        return written

    @staticmethod
    def _as_recipe(module: str, block: dict) -> dict[str, Any]:
        """Normalize an environment: sub-block into a module recipe document."""
        recipe_id = block.get("recipe") or block.get("preset") or "custom"
        return {
            "module": module,
            "recipe_id": recipe_id,
            "params": {k: v for k, v in block.items() if k != "recipe"},
        }

    def _write_hermesforge_main_scene(self) -> str:
        """Boot scene + script that reports the environment stack headless."""
        # Boot script — printed by the QA harness to confirm the stack.
        summary = {
            "terrain": self.dna.env_terrain().get("recipe"),
            "water": [w.get("recipe") for w in self.dna.env_water()],
            "foliage": [f.get("recipe") for f in self.dna.env_foliage()],
            "sky": self.dna.env_sky().get("preset"),
        }
        script = f'''\
extends Node3D
## Boot scene — Generated by ForgeDNA (schema v2) on the HermesForge stack.
## The environment/ manifest holds the module recipes; apply them via the
## hermes_bridge MCP tools (hermes_terrain_generate, hermes_water_create,
## hermes_foliage_scatter, hermes_sky_set) or by hand in the editor.

const ENVIRONMENT_STACK := {json.dumps(summary)}

func _ready() -> void:
\tprint("ForgeDNA HermesForge project booted OK")
\tprint("Physics engine: ", ProjectSettings.get_setting("physics/3d/physics_engine", "default"))
\tprint("Environment stack: ", ENVIRONMENT_STACK)
'''
        (self.project_dir / "main.gd").write_text(script)

        scene = '''[gd_scene load_steps=2 format=3 uid="uid://forgedna_hermesforge_main"]

[ext_resource type="Script" path="res://main.gd" id="1"]

[node name="Main" type="Node3D"]
script = ExtResource("1")
'''
        (self.project_dir / "main.tscn").write_text(scene)
        return "main.tscn"

    # ─── v1: classic self-contained project ─────────────────────────────────

    def _generate_classic_project(self) -> dict[str, Any]:
        """Generate the classic (pre-v2) self-contained Godot project."""
        # Create directory structure FIRST
        dirs = ["scenes", "scripts", "assets/textures", "assets/audio/music",
                "assets/audio/sfx", "assets/audio/ambient", "assets/models"]
        for d in dirs:
            (self.project_dir / d).mkdir(parents=True, exist_ok=True)

        files_created = []

        files_created.append(self._write_project_godot())
        files_created.append(self._write_main_scene())
        files_created.append(self._write_player_script())
        files_created.append(self._write_combat_system())
        files_created.append(self._write_glyph_system())
        files_created.append(self._write_enemy_base())
        files_created.append(self._write_quest_system())
        files_created.append(self._write_hud_script())
        files_created.append(self._write_hud_scene())

        # Generate environment scenes
        for env in self.dna.environments():
            files_created.append(self._write_environment_scene(env))

        # Generate enemy scripts
        for enemy in self.dna.enemies()[:5]:  # Limit to first 5 for now
            files_created.append(self._write_enemy_script(enemy))

        # Generate audio manager
        files_created.append(self._write_audio_manager())

        return {
            "engine": "godot",
            "base": "classic",
            "project_dir": str(self.project_dir),
            "files_created": files_created,
            "total_files": len(files_created),
        }

    def _write_project_godot(self) -> str:
        """Generate project.godot configuration."""
        title = self.dna.title
        genre = ", ".join(self.dna.genre)
        art_style = self.dna.art_style

        # Build autoload section
        autoloads = []
        autoloads.append('CombatSystem="*res://scripts/combat_system.gd"')
        autoloads.append('GlyphSystem="*res://scripts/glyph_system.gd"')
        autoloads.append('QuestSystem="*res://scripts/quest_system.gd"')
        autoloads.append('AudioManager="*res://scripts/audio_manager.gd"')

        content = f"""\
; Engine configuration file.
; It's best edited using the editor UI and not directly,
; but it can also be edited with a text editor.

[application]

config/name="{title}"
config/description="Generated by ForgeDNA — {genre}"
run/main_scene="res://scenes/main.tscn"
config/features=PackedStringArray("4.3", "GL Compatibility")
config/icon="res://icon.svg"

[autoload]

{chr(10).join(autoloads)}

[display]

window/size/viewport_width=1920
window/size/viewport_height=1080
window/stretch/mode="canvas_items"

[input]

move_left={{
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":65,"key_label":0,"unicode":97,"location":0,"echo":false,"script":null)]
}}
move_right={{
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":68,"key_label":0,"unicode":100,"location":0,"echo":false,"script":null)]
}}
move_up={{
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":87,"key_label":0,"unicode":119,"location":0,"echo":false,"script":null)]
}}
move_down={{
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":83,"key_label":0,"unicode":115,"location":0,"echo":false,"script":null)]
}}
jump={{
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":32,"key_label":0,"unicode":32,"location":0,"echo":false,"script":null)]
}}
attack={{
"deadzone": 0.5,
"events": [Object(InputEventMouseButton,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"button_mask":1,"position":Vector2(0, 0),"global_position":Vector2(0, 0),"factor":1.0,"button_index":1,"canceled":false,"pressed":true,"double_click":false,"script":null)]
}}
dodge={{
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":16777237,"key_label":0,"unicode":0,"location":0,"echo":false,"script":null)]
}}

[layer_names]

2d_physics/layer_1="Player"
2d_physics/layer_2="Enemies"
2d_physics/layer_3="Environment"
2d_physics/layer_4="Projectiles"

[rendering]

renderer/rendering_method="gl_compatibility"
"""
        path = self.project_dir / "project.godot"
        path.write_text(content)
        return "project.godot"

    def _write_main_scene(self) -> str:
        """Generate the main scene."""
        content = """\
[gd_scene load_steps=3 format=3 uid="uid://main_scene"]

[ext_resource type="Script" path="res://scripts/player.gd" id="1_player"]
[ext_resource type="Script" path="res://scripts/hud.gd" id="1_hud"]

[sub_resource type="CircleShape2D" id="CircleShape2D_circle"]
radius = 16.0

[node name="Main" type="Node2D"]

[node name="Player" type="CharacterBody2D" parent="."]
script = ExtResource("1_player")

[node name="CollisionShape2D" type="CollisionShape2D" parent="Player"]
shape = SubResource("CircleShape2D_circle")

[node name="Camera2D" type="Camera2D" parent="Player"]

[node name="HUD" type="CanvasLayer" parent="."]
script = ExtResource("1_hud")
"""
        path = self.project_dir / "scenes" / "main.tscn"
        path.write_text(content)
        return "scenes/main.tscn"

    def _write_player_script(self) -> str:
        """Generate player controller script."""
        movement = self.dna.mechanics.get("movement", {})
        move_types = movement.get("types", ["walk", "run", "jump", "dash"])
        has_sprint = "sprint" in move_types
        has_dash = "dash" in move_types
        has_climb = "climb" in move_types
        has_glide = "glide" in move_types
        has_double_jump = "double_jump" in move_types

        content = f'''\
extends CharacterBody2D
## Player Controller — Generated by ForgeDNA
## Movement types: {", ".join(move_types)}

@export var speed := 300.0
@export var jump_velocity := -400.0
{"@export var sprint_multiplier := 1.5" if has_sprint else ""}
{"@export var dash_speed := 800.0" if has_dash else ""}
{"@export var max_jumps := 2" if has_double_jump else ""}

var gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")
{"var jumps_remaining := max_jumps" if has_double_jump else ""}
{"var is_dashing := false" if has_dash else ""}
{"var can_glide := false" if has_glide else ""}

@onready var animated_sprite: AnimatedSprite2D = $AnimatedSprite2D if has_node("AnimatedSprite2D") else null

func _physics_process(delta: float) -> void:
    # Apply gravity
    if not is_on_floor():
        velocity.y += gravity * delta
        {"if can_glide and Input.is_action_pressed(\"jump\"):" if has_glide else ""}
        {"    velocity.y = min(velocity.y, 50.0)  # Glide slowly" if has_glide else ""}
    {"else:" if has_double_jump else ""}
    {"    jumps_remaining = max_jumps" if has_double_jump else ""}

    # Jump
    if Input.is_action_just_pressed("jump"):
        if is_on_floor():
            velocity.y = jump_velocity
        {"elif jumps_remaining > 0:" if has_double_jump else ""}
        {"    velocity.y = jump_velocity" if has_double_jump else ""}
        {"    jumps_remaining -= 1" if has_double_jump else ""}

    # Horizontal movement
    var direction := Input.get_axis("move_left", "move_right")
    if direction:
        {"var current_speed = speed * sprint_multiplier if Input.is_action_pressed(\"sprint\") else speed" if has_sprint else "var current_speed = speed"}
        {"if is_dashing:" if has_dash else ""}
        {"    current_speed = dash_speed" if has_dash else ""}
        velocity.x = direction * current_speed
        if animated_sprite:
            animated_sprite.flip_h = direction < 0
    else:
        velocity.x = move_toward(velocity.x, 0, speed)

    {"# Dash" if has_dash else ""}
    {"if Input.is_action_just_pressed(\"dodge\") and not is_dashing:" if has_dash else ""}
    {"    is_dashing = true" if has_dash else ""}
    {"    await get_tree().create_timer(0.2).timeout" if has_dash else ""}
    {"    is_dashing = false" if has_dash else ""}

    move_and_slide()

    # Emit position for combat system
    CombatSystem.player_position = global_position

func take_damage(amount: float, element: String = "physical") -> void:
    var actual_damage = CombatSystem.calculate_damage(amount, element)
    CombatSystem.apply_damage_to_player(actual_damage)
    if animated_sprite:
        animated_sprite.modulate = Color.RED
        await get_tree().create_timer(0.1).timeout
        animated_sprite.modulate = Color.WHITE
'''
        path = self.project_dir / "scripts" / "player.gd"
        path.write_text(content)
        return "scripts/player.gd"

    def _write_combat_system(self) -> str:
        """Generate combat system autoload."""
        combat = self.dna.mechanics.get("combat", {})
        damage_types = combat.get("damage_types", ["physical_slash", "fire", "ice"])
        status_effects = combat.get("status_effects", [])

        effects_code = ""
        for se in status_effects:
            name = se.get("name", "unknown")
            element = se.get("element", "physical")
            effect = se.get("effect", "")
            effects_code += f'    "{name}": {{"element": "{element}", "effect": "{effect}"}},\n'

        content = f'''\
extends Node
## Combat System — Generated by ForgeDNA

signal damage_dealt(target: Node, amount: float, element: String)
signal status_applied(target: Node, effect: String)
signal player_health_changed(new_health: float)

var player_health: float = 100.0
var player_max_health: float = 100.0
var player_mana: float = 100.0
var player_position: Vector2 = Vector2.ZERO

var active_effects: Dictionary = {{}}  # target -> [effects]

var STATUS_EFFECTS: Dictionary = {{
{effects_code}
}}

var ELEMENTAL_WEAKNESSES: Dictionary = {{
    "fire": ["ice"],
    "ice": ["fire"],
    "lightning": ["water"],
    "nature": ["fire"],
    "shadow": ["holy"],
    "holy": ["shadow"],
    "void": ["holy", "arcane"],
    "earth": ["lightning"],
    "water": ["lightning"],
    "arcane": [],
    "physical": [],
}}

func calculate_damage(base_damage: float, element: String, target: Node = null) -> float:
    var damage = base_damage
    # Apply elemental modifiers
    if target and target.has_method("get_element"):
        var target_element = target.get_element()
        if target_element in ELEMENTAL_WEAKNESSES.get(element, []):
            damage *= 1.5  # Super effective
        elif element in ELEMENTAL_WEAKNESSES.get(target_element, []):
            damage *= 0.5  # Resisted
    return damage

func apply_damage_to_player(amount: float) -> void:
    player_health = max(0, player_health - amount)
    player_health_changed.emit(player_health)
    if player_health <= 0:
        _player_died()

func heal_player(amount: float) -> void:
    player_health = min(player_max_health, player_health + amount)
    player_health_changed.emit(player_health)

func apply_status(target: Node, effect_name: String, duration: float = 5.0) -> void:
    if not active_effects.has(target):
        active_effects[target] = []
    active_effects[target].append({{"effect": effect_name, "time_left": duration}})
    status_applied.emit(target, effect_name)

func _player_died() -> void:
    print("Player died! Respawning...")
    player_health = player_max_health
    player_health_changed.emit(player_health)
    # Respawn logic here
'''
        path = self.project_dir / "scripts" / "combat_system.gd"
        path.write_text(content)
        return "scripts/combat_system.gd"

    def _write_glyph_system(self) -> str:
        """Generate glyph attunement system."""
        mechanics = self.dna.mechanics
        custom = mechanics.get("custom_mechanics", [])
        glyph_mechanic = next((m for m in custom if "glyph" in m.get("name", "").lower()), None)

        rules = ""
        if glyph_mechanic:
            for r in glyph_mechanic.get("rules", []):
                rules += f'    ## {r}\n'

        content = f'''\
extends Node
## Glyph Attunement System — Generated by ForgeDNA

signal glyph_equipped(slot: int, glyph: Dictionary)
signal glyph_unequipped(slot: int)
signal deep_attunement_unlocked(element: String)

const MAX_ACTIVE_GLYPHS := 4
const MAX_PASSIVE_GLYPHS := 2

var active_glyphs: Array[Dictionary] = [{{}}, {{}}, {{}}, {{}}]
var passive_glyphs: Array[Dictionary] = [{{}}, {{}}]
var glyph_collection: Array[Dictionary] = []

{rules}
var ELEMENTS := ["fire", "ice", "lightning", "earth", "nature", "shadow", "holy", "arcane"]

func equip_glyph(glyph: Dictionary, slot: int) -> bool:
    if slot < 0 or slot >= MAX_ACTIVE_GLYPHS:
        return false
    active_glyphs[slot] = glyph
    glyph_equipped.emit(slot, glyph)
    _check_deep_attunement()
    _check_resonance_combos()
    return true

func unequip_glyph(slot: int) -> void:
    if slot >= 0 and slot < MAX_ACTIVE_GLYPHS:
        active_glyphs[slot] = {{}}
        glyph_unequipped.emit(slot)

func _check_deep_attunement() -> void:
    ## Deep Attunement: all 4 glyphs same element = ultimate ability
    var elements := []
    for g in active_glyphs:
        if g.has("element"):
            elements.append(g["element"])
    if elements.size() == MAX_ACTIVE_GLYPHS:
        var first = elements[0]
        if elements.all(func(e): return e == first):
            deep_attunement_unlocked.emit(first)

func _check_resonance_combos() -> void:
    ## Check for elemental resonance combos
    var elements := []
    for g in active_glyphs:
        if g.has("element") and g["element"] not in elements:
            elements.append(g["element"])
    if elements.size() >= 2:
        print("Resonance combo available with: ", elements)

func get_active_elements() -> Array[String]:
    var elements: Array[String] = []
    for g in active_glyphs:
        if g.has("element") and g["element"] not in elements:
            elements.append(g["element"])
    return elements

func get_abilities_for_element(element: String) -> Array[Dictionary]:
    var abilities: Array[Dictionary] = []
    for g in active_glyphs:
        if g.get("element") == element and g.has("abilities"):
            abilities.append_array(g["abilities"])
    return abilities
'''
        path = self.project_dir / "scripts" / "glyph_system.gd"
        path.write_text(content)
        return "scripts/glyph_system.gd"

    def _write_enemy_base(self) -> str:
        """Generate base enemy script."""
        content = '''\
extends CharacterBody2D
## Base Enemy — Generated by ForgeDNA

class_name BaseEnemy

@export var enemy_name := "Enemy"
@export var max_health := 50.0
@export var damage := 10.0
@export var speed := 100.0
@export var element := "physical"
@export var behavior := "territorial"
@export var detection_range := 200.0
@export var attack_range := 50.0

var health: float
var target: Node2D = null
var is_dead := false

enum State { IDLE, PATROL, CHASE, ATTACK, STAGGERED, DEAD }
var state: State = State.IDLE

@onready var nav_agent: NavigationAgent2D = $NavigationAgent2D if has_node("NavigationAgent2D") else null

func _ready() -> void:
    health = max_health

func _physics_process(delta: float) -> void:
    if is_dead:
        return

    match state:
        State.IDLE:
            _idle_behavior(delta)
        State.PATROL:
            _patrol_behavior(delta)
        State.CHASE:
            _chase_behavior(delta)
        State.ATTACK:
            _attack_behavior(delta)
        State.STAGGERED:
            _staggered_behavior(delta)

func _idle_behavior(_delta: float) -> void:
    # Look for player
    if _player_in_range():
        state = State.CHASE

func _patrol_behavior(_delta: float) -> void:
    # Patrol logic — override in subclasses
    pass

func _chase_behavior(_delta: float) -> void:
    if not _player_in_range():
        state = State.IDLE
        return
    if _player_in_attack_range():
        state = State.ATTACK
        return
    # Move toward player
    if nav_agent and target:
        nav_agent.target_position = target.global_position
        var next_pos = nav_agent.get_next_path_position()
        var direction = (next_pos - global_position).normalized()
        velocity = direction * speed
        move_and_slide()

func _attack_behavior(_delta: float) -> void:
    # Override in subclasses for specific attack patterns
    if target and _player_in_attack_range():
        if target.has_method("take_damage"):
            target.take_damage(damage, element)
    state = State.CHASE

func _staggered_behavior(_delta: float) -> void:
    # Brief stun
    pass

func _player_in_range() -> bool:
    if not target:
        target = get_tree().get_first_node_in_group("player")
    if target:
        return global_position.distance_to(target.global_position) <= detection_range
    return false

func _player_in_attack_range() -> bool:
    if target:
        return global_position.distance_to(target.global_position) <= attack_range
    return false

func take_damage(amount: float, attack_element: String = "physical") -> void:
    var actual = CombatSystem.calculate_damage(amount, attack_element, self)
    health -= actual
    CombatSystem.damage_dealt.emit(self, actual, attack_element)
    if health <= 0:
        die()

func get_element() -> String:
    return element

func die() -> void:
    is_dead = true
    state = State.DEAD
    # Drop loot, play death animation, etc.
    queue_free()
'''
        path = self.project_dir / "scripts" / "enemy_base.gd"
        path.write_text(content)
        return "scripts/enemy_base.gd"

    def _write_enemy_script(self, enemy: dict) -> str:
        """Generate specific enemy script."""
        name = enemy.get("name", "Enemy").replace(" ", "")
        base_type = enemy.get("type", "normal")
        element = enemy.get("element", "physical")
        description = enemy.get("description", "")
        abilities = enemy.get("abilities", [])
        weaknesses = enemy.get("weaknesses", [])
        behavior = enemy.get("behavior", "territorial")

        abilities_code = ""
        for a in abilities:
            safe_name = a.replace(" ", "_").lower()
            abilities_code += f'''
func _ability_{safe_name}() -> void:
    ## {a}
    if target and _player_in_attack_range():
        if target.has_method("take_damage"):
            target.take_damage(damage * 1.2, "{element}")
'''

        content = f'''\
extends BaseEnemy
## {name} — Generated by ForgeDNA
## {description}

func _ready() -> void:
    super._ready()
    enemy_name = "{name}"
    element = "{element}"
    behavior = "{behavior}"
    {"max_health = 500.0" if base_type == "world_boss" else "max_health = 100.0" if base_type == "elite" else "max_health = 50.0"}
    health = max_health
    {"detection_range = 400.0" if base_type in ("world_boss", "raid_boss") else "detection_range = 200.0"}
    {"speed = 60.0" if base_type == "world_boss" else "speed = 120.0"}

func _attack_behavior(_delta: float) -> void:
    ## Custom attack pattern for {name}
    if not target or not _player_in_attack_range():
        state = State.CHASE
        return
    # Random ability selection
    var abilities_list = {[a.replace(" ", "_").lower() for a in abilities]}
    if abilities_list.size() > 0:
        var chosen = abilities_list[randi() % abilities_list.size()]
        call("_ability_" + chosen)
    else:
        super._attack_behavior(_delta)
{abilities_code}
'''
        path = self.project_dir / "scripts" / f"enemy_{name.lower()}.gd"
        path.write_text(content)
        return f"scripts/enemy_{name.lower()}.gd"

    def _write_quest_system(self) -> str:
        """Generate quest system autoload."""
        quests = self.dna.quests()
        quest_data = json.dumps(quests[:5], indent=4)  # First 5 quests

        content = f'''\
extends Node
## Quest System — Generated by ForgeDNA

signal quest_started(quest_name: String)
signal quest_updated(quest_name: String, step: int)
signal quest_completed(quest_name: String)
signal objective_updated(description: String)

var active_quests: Dictionary = {{}}
var completed_quests: Array[String] = []

var quest_definitions: Array = {quest_data}

func start_quest(quest_name: String) -> bool:
    var quest_def = _find_quest(quest_name)
    if not quest_def:
        push_warning("Quest not found: " + quest_name)
        return false
    # Check prerequisites
    for prereq in quest_def.get("prerequisites", []):
        if prereq not in completed_quests:
            push_warning("Prerequisite not met: " + prereq)
            return false
    active_quests[quest_name] = {{"step": 0, "definition": quest_def}}
    quest_started.emit(quest_name)
    return true

func advance_quest(quest_name: String) -> void:
    if quest_name not in active_quests:
        return
    var quest = active_quests[quest_name]
    quest["step"] += 1
    var steps = quest["definition"].get("steps", [])
    if quest["step"] >= steps.size():
        _complete_quest(quest_name)
    else:
        quest_updated.emit(quest_name, quest["step"])
        var step_desc = steps[quest["step"]].get("description", "")
        objective_updated.emit(step_desc)

func _complete_quest(quest_name: String) -> void:
    var quest = active_quests[quest_name]
    completed_quests.append(quest_name)
    active_quests.erase(quest_name)
    # Grant rewards
    var rewards = quest["definition"].get("rewards", {{}})
    if rewards.has("xp"):
        print("Granted ", rewards["xp"], " XP")
    if rewards.has("items"):
        for item in rewards["items"]:
            print("Granted item: ", item)
    quest_completed.emit(quest_name)

func _find_quest(name: String) -> Dictionary:
    for q in quest_definitions:
        if q.get("name") == name:
            return q
    return {{}}

func get_active_quest_names() -> Array[String]:
    var names: Array[String] = []
    for key in active_quests:
        names.append(key)
    return names

func is_quest_complete(quest_name: String) -> bool:
    return quest_name in completed_quests
'''
        path = self.project_dir / "scripts" / "quest_system.gd"
        path.write_text(content)
        return "scripts/quest_system.gd"

    def _write_hud_script(self) -> str:
        """Generate HUD script."""
        hud_elements = self.dna.hud_elements()
        ui_style = self.dna.ui.get("style", "clean")

        content = '''\
extends CanvasLayer
## HUD — Generated by ForgeDNA

@onready var health_bar: ProgressBar = $HealthBar
@onready var mana_bar: ProgressBar = $ManaBar
@onready var quest_label: Label = $QuestLabel

func _ready() -> void:
    CombatSystem.player_health_changed.connect(_on_health_changed)
    QuestSystem.objective_updated.connect(_on_objective_updated)
    _update_health_display()

func _on_health_changed(new_health: float) -> void:
    if health_bar:
        health_bar.value = (new_health / CombatSystem.player_max_health) * 100

func _on_objective_updated(description: String) -> void:
    if quest_label:
        quest_label.text = description

func _update_health_display() -> void:
    if health_bar:
        health_bar.value = (CombatSystem.player_health / CombatSystem.player_max_health) * 100
'''
        path = self.project_dir / "scripts" / "hud.gd"
        path.write_text(content)
        return "scripts/hud.gd"

    def _write_hud_scene(self) -> str:
        """Generate HUD scene."""
        content = '''[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://scripts/hud.gd" id="1_hud"]

[node name="HUD" type="CanvasLayer"]
script = ExtResource("1_hud")

[node name="HealthBar" type="ProgressBar" parent="."]
offset_left = 20.0
offset_top = 20.0
offset_right = 320.0
offset_top = 50.0
value = 100.0

[node name="ManaBar" type="ProgressBar" parent="."]
offset_left = 20.0
offset_top = 60.0
offset_right = 320.0
offset_bottom = 80.0
value = 100.0

[node name="QuestLabel" type="Label" parent="."]
offset_left = 20.0
offset_top = 100.0
offset_right = 500.0
offset_bottom = 130.0
text = ""
'''
        path = self.project_dir / "scenes" / "hud.tscn"
        path.write_text(content)
        return "scenes/hud.tscn"

    def _write_environment_scene(self, env: dict) -> str:
        """Generate an environment scene."""
        name = env.get("name", "Environment").replace(" ", "_")
        env_type = env.get("type", "forest")
        description = env.get("visual_description", "")

        content = f'''[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://scripts/environment_{name.lower()}.gd" id="1_env"]

[node name="{name}" type="Node2D"]
script = ExtResource("1_env")

[node name="TileMap" type="TileMap" parent="."]

[node name="YSort" type="YSort" parent="."]

[node name="NavigationRegion2D" type="NavigationRegion2D" parent="."]
'''
        # Write scene file
        path = self.project_dir / "scenes" / f"{name.lower()}.tscn"
        path.write_text(content)

        # Write environment script
        sub_areas = env.get("sub_areas", [])
        sub_areas_code = ""
        for sa in sub_areas:
            sub_areas_code += f'    "{sa.get("name", "")}": "{sa.get("description", "")}",\n'

        script_content = f'''\
extends Node2D
## {name} Environment — Generated by ForgeDNA
## Type: {env_type}
## {description[:100]}

@export var environment_name := "{name}"
@export var environment_type := "{env_type}"
@export var min_level := {env.get("min_level", 1)}
@export var max_level := {env.get("max_level", 99)}

var sub_areas: Dictionary = {{
{sub_areas_code}
}}

var resources: Array = {env.get("resources", [])}

func _ready() -> void:
    AudioManager.play_ambient("{env.get("audio_mood", "")}")
'''
        script_path = self.project_dir / "scripts" / f"environment_{name.lower()}.gd"
        script_path.write_text(script_content)

        return f"scenes/{name.lower()}.tscn"

    def _write_audio_manager(self) -> str:
        """Generate audio manager autoload."""
        music = self.dna.audio_music()
        sfx = self.dna.audio_sfx()
        ambient = self.dna.audio_ambient()

        music_dict = ""
        for m in music:
            music_dict += f'    "{m.get("name", "")}": {{"mood": "{m.get("mood", "")}", "loop": {str(m.get("loop", True)).lower()}}},\n'

        content = f'''\
extends Node
## Audio Manager — Generated by ForgeDNA

var current_music: AudioStreamPlayer
var current_ambient: AudioStreamPlayer
var sfx_pool: Array[AudioStreamPlayer] = []

var music_tracks: Dictionary = {{
{music_dict}
}}

func _ready() -> void:
    # Create audio players
    current_music = AudioStreamPlayer.new()
    current_music.bus = "Music"
    add_child(current_music)
    current_ambient = AudioStreamPlayer.new()
    current_ambient.bus = "Ambient"
    add_child(current_ambient)
    # Create SFX pool
    for i in range(8):
        var player = AudioStreamPlayer.new()
        player.bus = "SFX"
        add_child(player)
        sfx_pool.append(player)

func play_music(track_name: String) -> void:
    var track_path = "res://assets/audio/music/" + track_name.to_lower().replace(" ", "_") + ".wav"
    if ResourceLoader.exists(track_path):
        current_music.stream = load(track_path)
        current_music.play()

func stop_music() -> void:
    current_music.stop()

func play_sfx(sfx_name: String) -> void:
    var sfx_path = "res://assets/audio/sfx/" + sfx_name.to_lower().replace(" ", "_") + ".wav"
    if ResourceLoader.exists(sfx_path):
        for player in sfx_pool:
            if not player.playing:
                player.stream = load(sfx_path)
                player.play()
                break

func play_ambient(description: String) -> void:
    ## Play ambient based on environment description
    current_ambient.stop()
    # Map description to ambient file if available
    print("Ambient: ", description)
'''
        path = self.project_dir / "scripts" / "audio_manager.gd"
        path.write_text(content)
        return "scripts/audio_manager.gd"
