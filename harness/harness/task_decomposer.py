"""Decompose GameDNA into a build plan DAG of tasks."""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from .agent_specs import AgentType
from .dna_parser import GameDNA


class TaskStatus(str, Enum):
    PENDING = "pending"
    READY = "ready"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class BuildTask:
    """A single task in the build pipeline."""
    task_id: str
    agent_type: AgentType
    name: str
    description: str
    input_data: dict[str, Any] = field(default_factory=dict)
    dependencies: list[str] = field(default_factory=list)
    status: TaskStatus = TaskStatus.PENDING
    output_path: str = ""
    priority: int = 0  # Higher = more important

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "agent_type": self.agent_type.value,
            "name": self.name,
            "description": self.description,
            "input_data": self.input_data,
            "dependencies": self.dependencies,
            "status": self.status.value,
            "output_path": self.output_path,
            "priority": self.priority,
        }


@dataclass
class BuildPlan:
    """A complete build plan — a DAG of tasks."""
    game_title: str
    tasks: list[BuildTask] = field(default_factory=list)
    phases: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "game_title": self.game_title,
            "total_tasks": len(self.tasks),
            "phases": self.phases,
            "tasks": [t.to_dict() for t in self.tasks],
        }

    def tasks_by_agent(self) -> dict[AgentType, list[BuildTask]]:
        result: dict[AgentType, list[BuildTask]] = {}
        for task in self.tasks:
            result.setdefault(task.agent_type, []).append(task)
        return result

    def ready_tasks(self) -> list[BuildTask]:
        """Return tasks whose dependencies are all completed."""
        completed = {t.task_id for t in self.tasks if t.status == TaskStatus.COMPLETED}
        return [
            t for t in self.tasks
            if t.status == TaskStatus.PENDING
            and all(d in completed for d in t.dependencies)
        ]

    def stats(self) -> dict:
        by_status = {}
        by_agent = {}
        for t in self.tasks:
            by_status[t.status.value] = by_status.get(t.status.value, 0) + 1
            by_agent[t.agent_type.value] = by_agent.get(t.agent_type.value, 0) + 1
        return {"total": len(self.tasks), "by_status": by_status, "by_agent": by_agent}


def decompose(dna: GameDNA) -> BuildPlan:
    """Decompose a GameDNA into a build plan."""
    plan = BuildPlan(game_title=dna.title)
    task_counter = 0

    def next_id(prefix: str) -> str:
        nonlocal task_counter
        task_counter += 1
        return f"{prefix}_{task_counter:04d}"

    # ─── Phase 1: Project Scaffolding ───
    scaffold_id = next_id("scaffold")
    plan.tasks.append(BuildTask(
        task_id=scaffold_id,
        agent_type=AgentType.ASSEMBLY,
        name="Project Scaffolding",
        description=f"Initialize empty project structure for {dna.title}. Create folder hierarchy, config files, and engine-specific project files.",
        input_data={"title": dna.title, "genre": dna.genre, "art_style": dna.art_style},
        priority=100,
    ))

    # ─── Phase 2: Core Systems (parallel where possible) ───
    core_ids = []

    # Combat system
    combat_system = dna.mechanics.get("combat", {})
    if combat_system:
        combat_id = next_id("combat")
        core_ids.append(combat_id)
        plan.tasks.append(BuildTask(
            task_id=combat_id,
            agent_type=AgentType.CODE_COMBAT,
            name="Combat System",
            description=f"Implement {combat_system.get('style', 'action')} combat system with damage types, status effects, and elemental reactions.",
            input_data={"combat": combat_system},
            dependencies=[scaffold_id],
            priority=90,
        ))

    # Movement system
    movement = dna.mechanics.get("movement", {})
    if movement:
        movement_id = next_id("movement")
        core_ids.append(movement_id)
        plan.tasks.append(BuildTask(
            task_id=movement_id,
            agent_type=AgentType.CODE_PLAYER,
            name="Player Movement System",
            description=f"Implement movement: {', '.join(movement.get('types', ['walk']))}",
            input_data={"movement": movement},
            dependencies=[scaffold_id],
            priority=90,
        ))

    # Progression system
    progression = dna.mechanics.get("progression", {})
    if progression:
        prog_id = next_id("progression")
        core_ids.append(prog_id)
        plan.tasks.append(BuildTask(
            task_id=prog_id,
            agent_type=AgentType.CODE_PLAYER,
            name="Progression System",
            description=f"Implement {progression.get('type', 'level_based')} progression with {len(progression.get('skill_trees', []))} skill trees.",
            input_data={"progression": progression},
            dependencies=[scaffold_id],
            priority=85,
        ))

    # Crafting system
    crafting = dna.mechanics.get("crafting", {})
    if crafting and crafting.get("enabled"):
        craft_id = next_id("crafting")
        core_ids.append(craft_id)
        plan.tasks.append(BuildTask(
            task_id=craft_id,
            agent_type=AgentType.CODE_CRAFTING,
            name="Crafting System",
            description=f"Implement crafting with professions: {', '.join(crafting.get('professions', []))}",
            input_data={"crafting": crafting, "recipes": dna.crafting_recipes()},
            dependencies=[scaffold_id],
            priority=80,
        ))

    # Economy system
    economy = dna.mechanics.get("economy", {})
    if economy and economy.get("enabled"):
        econ_id = next_id("economy")
        core_ids.append(econ_id)
        plan.tasks.append(BuildTask(
            task_id=econ_id,
            agent_type=AgentType.CODE_CRAFTING,
            name="Economy System",
            description=f"Implement economy with {len(economy.get('currencies', []))} currencies. Player trading: {economy.get('player_trading')}",
            input_data={"economy": economy},
            dependencies=[scaffold_id],
            priority=75,
        ))

    # ─── Phase 3: Asset Generation (fully parallel) ───
    asset_ids = []

    # 3D Models
    for model in dna.models_3d():
        mid = next_id("3d")
        asset_ids.append(mid)
        plan.tasks.append(BuildTask(
            task_id=mid,
            agent_type=AgentType.ASSET_3D,
            name=f"3D: {model['name']}",
            description=model.get("description", ""),
            input_data=model,
            dependencies=[scaffold_id],
            priority=70,
        ))

    # Textures
    for tex in dna.textures():
        tid = next_id("tex")
        asset_ids.append(tid)
        plan.tasks.append(BuildTask(
            task_id=tid,
            agent_type=AgentType.TEXTURE,
            name=f"Texture: {tex['name']}",
            description=tex.get("description", ""),
            input_data=tex,
            dependencies=[scaffold_id],
            priority=65,
        ))

    # Animations
    for anim in dna.animations():
        aid = next_id("anim")
        asset_ids.append(aid)
        plan.tasks.append(BuildTask(
            task_id=aid,
            agent_type=AgentType.ANIMATION,
            name=f"Anim: {anim['name']}",
            description=anim.get("description", ""),
            input_data=anim,
            dependencies=[scaffold_id],
            priority=60,
        ))

    # Music
    for track in dna.audio_music():
        mid = next_id("music")
        asset_ids.append(mid)
        plan.tasks.append(BuildTask(
            task_id=mid,
            agent_type=AgentType.AUDIO_MUSIC,
            name=f"Music: {track['name']}",
            description=track.get("description", ""),
            input_data=track,
            dependencies=[scaffold_id],
            priority=55,
        ))

    # SFX
    for sfx in dna.audio_sfx():
        sid = next_id("sfx")
        asset_ids.append(sid)
        plan.tasks.append(BuildTask(
            task_id=sid,
            agent_type=AgentType.AUDIO_SFX,
            name=f"SFX: {sfx['name']}",
            description=sfx.get("description", ""),
            input_data=sfx,
            dependencies=[scaffold_id],
            priority=50,
        ))

    # Ambient
    for amb in dna.audio_ambient():
        aid = next_id("amb")
        asset_ids.append(aid)
        plan.tasks.append(BuildTask(
            task_id=aid,
            agent_type=AgentType.AUDIO_AMBIENT,
            name=f"Ambient: {amb['name']}",
            description=amb.get("description", ""),
            input_data=amb,
            dependencies=[scaffold_id],
            priority=50,
        ))

    # Voice
    for voice in dna.audio_voice():
        vid = next_id("voice")
        asset_ids.append(vid)
        plan.tasks.append(BuildTask(
            task_id=vid,
            agent_type=AgentType.AUDIO_VOICE,
            name=f"Voice: {voice['character']}",
            description=voice.get("voice_description", ""),
            input_data=voice,
            dependencies=[scaffold_id],
            priority=50,
        ))

    # VFX
    for effect in dna.vfx():
        vid = next_id("vfx")
        asset_ids.append(vid)
        plan.tasks.append(BuildTask(
            task_id=vid,
            agent_type=AgentType.VFX,
            name=f"VFX: {effect['name']}",
            description=effect.get("description", ""),
            input_data=effect,
            dependencies=[scaffold_id],
            priority=55,
        ))

    # ─── Phase 4: World Building ───
    world_ids = []
    for env in dna.environments():
        eid = next_id("env")
        world_ids.append(eid)
        plan.tasks.append(BuildTask(
            task_id=eid,
            agent_type=AgentType.CODE_WORLD,
            name=f"Environment: {env['name']}",
            description=f"Build {env.get('type', 'unknown')} environment: {env.get('visual_description', '')[:100]}",
            input_data=env,
            dependencies=[scaffold_id] + core_ids,
            priority=80,
        ))

    # ─── Phase 5: Dungeons ───
    dungeon_ids = []
    for dungeon in dna.dungeons():
        did = next_id("dungeon")
        dungeon_ids.append(did)
        plan.tasks.append(BuildTask(
            task_id=did,
            agent_type=AgentType.CODE_WORLD,
            name=f"Dungeon: {dungeon['name']}",
            description=f"Build {dungeon.get('difficulty', 'normal')} dungeon with {len(dungeon.get('boss_encounters', []))} bosses",
            input_data=dungeon,
            dependencies=world_ids + core_ids,
            priority=75,
        ))

    # ─── Phase 6: Enemies ───
    enemy_ids = []
    for enemy in dna.enemies():
        eid = next_id("enemy")
        enemy_ids.append(eid)
        plan.tasks.append(BuildTask(
            task_id=eid,
            agent_type=AgentType.CODE_ENEMY,
            name=f"Enemy: {enemy['name']}",
            description=f"{enemy.get('type', 'normal')} enemy — {enemy.get('description', '')[:80]}",
            input_data=enemy,
            dependencies=[scaffold_id, combat_id] if combat_system else [scaffold_id],
            priority=70,
        ))

    # ─── Phase 7: Quests ───
    quest_ids = []
    for quest in dna.quests():
        qid = next_id("quest")
        quest_ids.append(qid)
        plan.tasks.append(BuildTask(
            task_id=qid,
            agent_type=AgentType.CODE_QUEST,
            name=f"Quest: {quest['name']}",
            description=f"{quest.get('type', 'side_quest')} — {len(quest.get('steps', []))} steps",
            input_data=quest,
            dependencies=[scaffold_id] + world_ids[:1] if world_ids else [scaffold_id],
            priority=65,
        ))

    # ─── Phase 8: UI ───
    ui_deps = [scaffold_id] + core_ids

    hud_id = next_id("ui_hud")
    plan.tasks.append(BuildTask(
        task_id=hud_id,
        agent_type=AgentType.CODE_UI,
        name="HUD System",
        description=f"Build HUD with {len(dna.hud_elements())} elements",
        input_data={"hud": dna.hud_elements(), "style": dna.ui.get("style", ""), "palette": dna.ui.get("color_palette", {})},
        dependencies=ui_deps,
        priority=70,
    ))

    for menu in dna.menus():
        mid = next_id("ui_menu")
        plan.tasks.append(BuildTask(
            task_id=mid,
            agent_type=AgentType.CODE_UI,
            name=f"Menu: {menu['name']}",
            description=f"{menu.get('type', 'unknown')} menu — {menu.get('description', '')[:80]}",
            input_data=menu,
            dependencies=ui_deps,
            priority=60,
        ))

    # ─── Phase 9: Custom Mechanics ───
    for mech in dna.mechanics.get("custom_mechanics", []):
        mid = next_id("mech")
        plan.tasks.append(BuildTask(
            task_id=mid,
            agent_type=AgentType.CODE_COMBAT,
            name=f"Mechanic: {mech['name']}",
            description=mech.get("description", "")[:120],
            input_data=mech,
            dependencies=core_ids,
            priority=75,
        ))

    # ─── Phase 10: Integration & Assembly ───
    all_content_ids = asset_ids + world_ids + dungeon_ids + enemy_ids + quest_ids

    integration_id = next_id("integration")
    plan.tasks.append(BuildTask(
        task_id=integration_id,
        agent_type=AgentType.ASSEMBLY,
        name="Content Integration",
        description="Wire all generated assets and code together. Connect scripts to scenes, apply textures to models, attach audio triggers.",
        input_data={},
        dependencies=all_content_ids + core_ids,
        priority=30,
    ))

    # Mounts / Vehicles
    mounts = dna.mechanics.get("movement", {}).get("mounts_vehicles", [])
    for mount in mounts:
        mid = next_id("mount")
        plan.tasks.append(BuildTask(
            task_id=mid,
            agent_type=AgentType.CODE_PLAYER,
            name=f"Mount: {mount['name']}",
            description=f"{mount.get('type', 'ground')} mount — {mount.get('description', '')[:80]}",
            input_data=mount,
            dependencies=[scaffold_id, movement_id] if movement else [scaffold_id],
            priority=50,
        ))

    # ─── Phase 11: Testing ───
    test_id = next_id("test")
    plan.tasks.append(BuildTask(
        task_id=test_id,
        agent_type=AgentType.TEST,
        name="Automated Testing",
        description="Run build validation — check all assets load, scenes compile, no missing references, performance sanity check.",
        input_data={},
        dependencies=[integration_id],
        priority=10,
    ))

    # Build phases summary
    plan.phases = [
        {"name": "Scaffolding", "tasks": [scaffold_id]},
        {"name": "Core Systems", "tasks": core_ids},
        {"name": "Asset Generation", "tasks": asset_ids},
        {"name": "World Building", "tasks": world_ids},
        {"name": "Dungeons", "tasks": dungeon_ids},
        {"name": "Enemies", "tasks": enemy_ids},
        {"name": "Quests", "tasks": quest_ids},
        {"name": "UI", "tasks": [hud_id]},
        {"name": "Integration", "tasks": [integration_id]},
        {"name": "Testing", "tasks": [test_id]},
    ]

    return plan
