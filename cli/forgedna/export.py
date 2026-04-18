"""Export game DNA files as markdown summary or AI agent prompt."""

import json
from pathlib import Path

import typer
from rich.console import Console
from rich.markdown import Markdown

console = Console()


def _load_json(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def _generate_summary(data: dict) -> str:
    """Generate a human-readable markdown summary of the game DNA."""
    meta = data.get("meta", {})
    world = data.get("world", {})
    mechanics = data.get("mechanics", {})
    entities = data.get("entities", {})
    logic = data.get("logic", {})

    lines = []
    title = meta.get("title", "Untitled Game")
    lines.append(f"# {title}\n")

    if meta.get("tagline"):
        lines.append(f"*{meta['tagline']}*\n")

    if meta.get("description"):
        lines.append(f"{meta['description']}\n")

    # Genre & Style
    lines.append("## Overview\n")
    genre = meta.get("genre", [])
    if genre:
        lines.append(f"- **Genre:** {', '.join(genre)}")
    if meta.get("art_style"):
        lines.append(f"- **Art Style:** {meta['art_style']}")
    platforms = meta.get("target_platforms", [])
    if platforms:
        lines.append(f"- **Platforms:** {', '.join(platforms)}")
    if meta.get("rating"):
        lines.append(f"- **Rating:** {meta['rating']}")
    player_count = meta.get("player_count", {})
    if player_count:
        mode = player_count.get("mode", "")
        lines.append(f"- **Players:** {player_count.get('min', 1)}-{player_count.get('max', 1)} ({mode})")
    lines.append("")

    # Tags
    tags = meta.get("tags", [])
    if tags:
        lines.append(f"**Tags:** {', '.join(tags)}\n")

    # World
    lines.append("## World\n")
    if world.get("scale"):
        lines.append(f"- **Scale:** {world['scale']}")
    if world.get("structure"):
        lines.append(f"- **Structure:** {world['structure']}")

    envs = world.get("environments", [])
    if envs:
        lines.append(f"\n### Environments ({len(envs)})\n")
        for env in envs:
            name = env.get("name", "Unknown")
            etype = env.get("type", "?")
            lines.append(f"- **{name}** ({etype})")
            if env.get("visual_description"):
                lines.append(f"  > {env['visual_description'][:200]}...")

    dungeons = world.get("dungeons", [])
    if dungeons:
        lines.append(f"\n### Dungeons ({len(dungeons)})\n")
        for dg in dungeons:
            name = dg.get("name", "Unknown")
            diff = dg.get("difficulty", "?")
            lines.append(f"- **{name}** [{diff}]")
            if dg.get("visual_description"):
                lines.append(f"  > {dg['visual_description'][:150]}...")

    # Mechanics
    lines.append("\n## Mechanics\n")
    if mechanics.get("movement"):
        mv = mechanics["movement"]
        types = mv.get("types", [])
        if types:
            lines.append(f"- **Movement:** {', '.join(types)}")
    if mechanics.get("combat"):
        cb = mechanics["combat"]
        if cb.get("style"):
            lines.append(f"- **Combat Style:** {cb['style']}")
        wps = cb.get("weapon_categories", [])
        if wps:
            wp_names = [w.get("name", "?") for w in wps]
            lines.append(f"- **Weapons:** {', '.join(wp_names)}")
    if mechanics.get("crafting"):
        cr = mechanics["crafting"]
        if cr.get("enabled"):
            profs = cr.get("professions", [])
            lines.append(f"- **Crafting:** {', '.join(profs)}")
    if mechanics.get("progression"):
        pr = mechanics["progression"]
        if pr.get("type"):
            lines.append(f"- **Progression:** {pr['type']} (max level {pr.get('max_level', '?')})")

    # Entities
    lines.append("\n## Entities\n")
    enemies = entities.get("enemies", [])
    if enemies:
        lines.append(f"### Enemies ({len(enemies)})\n")
        for e in enemies:
            name = e.get("name", "?")
            etype = e.get("type", "?")
            lines.append(f"- **{name}** ({etype}): {e.get('description', '')[:100]}")

    # Logic
    lines.append("\n## Logic\n")
    quests = logic.get("quests", [])
    if quests:
        lines.append(f"### Quests ({len(quests)})\n")
        for q in quests:
            name = q.get("name", "?")
            qtype = q.get("type", "?")
            lines.append(f"- **{name}** [{qtype}]: {q.get('description', '')[:120]}")

    return "\n".join(lines)


def _generate_prompt(data: dict) -> str:
    """Generate a detailed AI agent prompt describing what to build."""
    meta = data.get("meta", {})
    world = data.get("world", {})
    mechanics = data.get("mechanics", {})
    entities = data.get("entities", {})
    logic = data.get("logic", {})
    assets = data.get("assets", {})
    ui = data.get("ui", {})

    title = meta.get("title", "Untitled Game")
    lines = []

    lines.append(f"# Game Development Brief: {title}\n")
    lines.append("You are an expert game developer. Build the following game based on this detailed design specification.\n")

    # Core vision
    lines.append("## Game Vision\n")
    if meta.get("tagline"):
        lines.append(f"**Tagline:** {meta['tagline']}\n")
    if meta.get("description"):
        lines.append(f"{meta['description']}\n")

    # Requirements
    lines.append("## Technical Requirements\n")
    genre = meta.get("genre", [])
    platforms = meta.get("target_platforms", [])
    lines.append(f"- Genre: {', '.join(genre)}")
    lines.append(f"- Art Style: {meta.get('art_style', 'TBD')}")
    lines.append(f"- Target Platforms: {', '.join(platforms)}")
    player_count = meta.get("player_count", {})
    if player_count:
        lines.append(f"- Player Count: {player_count.get('min', 1)}-{player_count.get('max', 1)} ({player_count.get('mode', 'singleplayer')})")
    lines.append("")

    # World design
    lines.append("## World Design\n")
    lines.append(f"- Scale: {world.get('scale', 'TBD')}")
    lines.append(f"- Structure: {world.get('structure', 'TBD')}")

    envs = world.get("environments", [])
    if envs:
        lines.append(f"\nThe world contains {len(envs)} distinct environments:\n")
        for env in envs:
            name = env.get("name", "Unknown")
            etype = env.get("type", "?")
            lines.append(f"### {name} ({etype})")
            if env.get("visual_description"):
                lines.append(f"Visual: {env['visual_description']}")
            if env.get("audio_mood"):
                lines.append(f"Audio: {env['audio_mood']}")
            subs = env.get("sub_areas", [])
            if subs:
                lines.append("Sub-areas:")
                for sub in subs:
                    lines.append(f"  - {sub.get('name', '?')}: {sub.get('description', '')}")
            lines.append("")

    dungeons = world.get("dungeons", [])
    if dungeons:
        lines.append(f"## Dungeons ({len(dungeons)})\n")
        for dg in dungeons:
            lines.append(f"### {dg.get('name', '?')} [{dg.get('difficulty', '?')}]")
            if dg.get("visual_description"):
                lines.append(f"Visual: {dg['visual_description']}")
            bosses = dg.get("boss_encounters", [])
            if bosses:
                lines.append("Boss encounters:")
                for boss in bosses:
                    lines.append(f"  - {boss.get('name', '?')}: {boss.get('description', '')}")
                    mechs = boss.get("mechanics", [])
                    for m in mechs:
                        lines.append(f"    * {m}")
            lines.append("")

    # Mechanics
    lines.append("## Gameplay Mechanics\n")
    if mechanics.get("movement"):
        mv = mechanics["movement"]
        lines.append(f"Movement system with types: {', '.join(mv.get('types', []))}")
        lines.append(f"Physics style: {mv.get('physics_style', 'TBD')}")
        lines.append("")

    if mechanics.get("combat"):
        cb = mechanics["combat"]
        lines.append(f"Combat style: {cb.get('style', 'TBD')}")
        if cb.get("damage_types"):
            lines.append(f"Damage types: {', '.join(cb['damage_types'])}")
        if cb.get("weapon_categories"):
            lines.append("Weapon categories:")
            for w in cb["weapon_categories"]:
                lines.append(f"  - {w.get('name', '?')}: {w.get('description', '')}")
        if cb.get("status_effects"):
            lines.append("Status effects:")
            for se in cb["status_effects"]:
                lines.append(f"  - {se.get('name', '?')} ({se.get('duration_type', '?')}): {se.get('effect', '')}")
        lines.append("")

    if mechanics.get("crafting") and mechanics["crafting"].get("enabled"):
        cr = mechanics["crafting"]
        lines.append(f"Crafting system ({cr.get('complexity', 'moderate')} complexity):")
        if cr.get("professions"):
            lines.append(f"  Professions: {', '.join(cr['professions'])}")
        if cr.get("gathering_skills"):
            lines.append(f"  Gathering: {', '.join(cr['gathering_skills'])}")
        lines.append("")

    if mechanics.get("progression"):
        pr = mechanics["progression"]
        lines.append(f"Progression: {pr.get('type', 'TBD')}, max level {pr.get('max_level', 'TBD')}")
        if pr.get("skill_trees"):
            lines.append("Skill trees:")
            for st in pr["skill_trees"]:
                lines.append(f"  - {st.get('name', '?')}: {st.get('description', '')} (~{st.get('node_count_estimate', '?')} nodes)")
        lines.append("")

    # Entities
    lines.append("## Entities\n")
    player = entities.get("player", {})
    if player:
        lines.append(f"### Player")
        if player.get("visual_description"):
            lines.append(player["visual_description"])
        if player.get("stats"):
            lines.append(f"Stats: {', '.join(player['stats'])}")
        if player.get("abilities"):
            lines.append("Abilities:")
            for ab in player["abilities"]:
                lines.append(f"  - {ab.get('name', '?')}: {ab.get('description', '')}")
        lines.append("")

    enemies = entities.get("enemies", [])
    if enemies:
        lines.append(f"### Enemies ({len(enemies)})\n")
        for e in enemies:
            lines.append(f"- {e.get('name', '?')} ({e.get('type', '?')}, {e.get('element', '?')}): {e.get('description', '')}")
        lines.append("")

    # Quests
    quests = logic.get("quests", [])
    if quests:
        lines.append(f"## Quests ({len(quests)})\n")
        for q in quests:
            lines.append(f"### {q.get('name', '?')} [{q.get('type', '?')}]")
            lines.append(q.get("description", ""))
            if q.get("steps"):
                lines.append("Steps:")
                for step in q["steps"]:
                    lines.append(f"  {step.get('order', '?')}. {step.get('description', '')} [{step.get('objective_type', '?')}]")
            lines.append("")

    # Assets
    if assets:
        lines.append("## Assets to Generate\n")
        for category in ["models_3d", "textures", "animations", "vfx"]:
            items = assets.get(category, [])
            if items:
                lines.append(f"### {category.replace('_', ' ').title()} ({len(items)})")
                for item in items:
                    lines.append(f"- {item.get('name', '?')}: {item.get('description', '')[:150]}")
                lines.append("")

    # UI
    if ui:
        lines.append("## UI Design\n")
        if ui.get("style"):
            lines.append(f"Style: {ui['style']}\n")
        if ui.get("hud_elements"):
            lines.append("HUD Elements:")
            for h in ui["hud_elements"]:
                lines.append(f"  - {h.get('name', '?')} ({h.get('position', '?')}): {h.get('description', '')}")
            lines.append("")
        if ui.get("menus"):
            lines.append("Menus:")
            for m in ui["menus"]:
                lines.append(f"  - {m.get('name', '?')} [{m.get('type', '?')}]: {m.get('description', '')}")
            lines.append("")

    lines.append("## Implementation Notes\n")
    lines.append("Build this game step by step. Start with the core mechanics, then world, then entities, then polish with assets and UI.")
    lines.append("Ensure all systems interact as described in the design spec.")

    return "\n".join(lines)


def export_file(file_path: str, fmt: str) -> None:
    """Export a game DNA file in the specified format."""
    path = Path(file_path)

    if not path.exists():
        console.print(f"[bold red]Error:[/] File not found: {file_path}")
        raise typer.Exit(code=1)

    data = _load_json(path)

    if fmt == "summary":
        output = _generate_summary(data)
        md = Markdown(output)
        console.print(md)
    elif fmt == "prompt":
        output = _generate_prompt(data)
        md = Markdown(output)
        console.print(md)
    else:
        console.print(f"[bold red]Error:[/] Unknown format '{fmt}'. Use 'summary' or 'prompt'.")
        raise typer.Exit(code=1)
