"""
ForgeDNA Community Hub — Gradio Application

Browse, view, edit, remix, and share Game DNA files.
"""

import json
import gradio as gr
from pathlib import Path

from storage import list_dna_files, load_dna, upload_dna, export_markdown
from schema_ops import (
    load_schema, validate, get_summary, get_template_names,
    load_template, diff, create_remix,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

GENRE_OPTIONS = [
    "", "rpg", "mmorpg", "action", "adventure", "platformer", "puzzle",
    "strategy", "simulation", "survival", "roguelike", "fps", "tps",
    "horror", "racing", "sports", "sandbox", "visual_novel",
    "tower_defense", "metroidvania", "soulslike", "battle_royale",
    "moba", "card_game", "rhythm", "stealth", "immersive_sim", "open_world",
]
ART_STYLES = [
    "", "realistic", "stylized", "pixel_art_2d", "pixel_art_3d",
    "low_poly", "cel_shaded", "hand_painted", "voxel", "retro_16bit",
    "retro_8bit", "minimalist", "watercolor", "comic_book", "anime",
    "photorealistic", "abstract", "paper_cutout", "claymation", "ink_brush",
]
COMPLEXITY_OPTIONS = ["", "minimal", "simple", "moderate", "complex"]

SECTIONS = ["meta", "mechanics", "world", "entities", "assets", "logic", "ui"]


def _dna_card_html(item: dict) -> str:
    """Generate an HTML card for a DNA file — visual display only."""
    genres = ", ".join(item.get("genre", [])) or "—"
    tags_html = " ".join(
        f'<span style="background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:12px;font-size:0.75rem;margin:2px;">{t}</span>'
        for t in item.get("tags", [])[:5]
    )
    filename = item.get("filename", "")
    return f"""
    <div style="border:1px solid #d1d5db;border-radius:12px;padding:16px;margin:8px 0;background:#ffffff;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;color:#111827;font-size:1.1rem;font-weight:700;">{item.get('title', 'Untitled')}</h3>
            <span style="background:{'#dbeafe' if item['source']=='local' else '#fef3c7'};color:#1e40af;padding:2px 10px;border-radius:12px;font-size:0.7rem;font-weight:600;">{item['source']}</span>
        </div>
        <p style="color:#374151;margin:4px 0 8px;font-style:italic;">{item.get('tagline', '')}</p>
        <div style="font-size:0.8rem;color:#1f2937;">
            <strong>Genre:</strong> {genres} &nbsp;|&nbsp;
            <strong>Art:</strong> {item.get('art_style', '—')} &nbsp;|&nbsp;
            <strong>Complexity:</strong> {item.get('complexity', '—')}
        </div>
        <div style="margin-top:8px;">{tags_html}</div>
        <div style="margin-top:8px;font-size:0.75rem;color:#6b7280;">
            📄 <code style="background:#f3f4f6;padding:1px 6px;border-radius:4px;color:#374151;">{filename}</code>
        </div>
    </div>
    """


def _section_md(dna: dict, section: str) -> str:
    """Format a DNA section as rich markdown."""
    data = dna.get(section, {})
    if not data:
        return f"*No {section} data defined.*"

    if section == "meta":
        return _render_meta(data)
    elif section == "mechanics":
        return _render_mechanics(data)
    elif section == "world":
        return _render_world(data)
    elif section == "entities":
        return _render_entities(data)
    elif section == "assets":
        return _render_assets(data)
    elif section == "logic":
        return _render_logic(data)
    elif section == "ui":
        return _render_ui(data)
    return f"```\n{json.dumps(data, indent=2)}\n```"


def _render_meta(m: dict) -> str:
    lines = [
        f"### {m.get('title', 'Untitled')}",
        f"*{m.get('tagline', '')}*",
        "",
        f"**Genre:** {', '.join(m.get('genre', []))}  ",
        f"**Art Style:** {m.get('art_style', 'N/A')}  ",
        f"**Platforms:** {', '.join(m.get('target_platforms', []))}  ",
        f"**Rating:** {m.get('rating', 'N/A')}  ",
    ]
    pc = m.get("player_count", {})
    if pc:
        lines.append(f"**Players:** {pc.get('min', 1)}-{pc.get('max', 1)} ({pc.get('mode', 'N/A')})")
    if m.get("tags"):
        lines.append(f"**Tags:** {', '.join(m['tags'])}")
    if m.get("inspiration"):
        lines.append(f"**Inspired by:** {', '.join(m['inspiration'])}")
    if m.get("description"):
        lines.extend(["", "#### Description", m["description"]])
    if m.get("lineage"):
        lines.extend(["", "#### Lineage"])
        for l in m["lineage"]:
            lines.append(f"- Forked from **{l.get('source', '?')}** at {l.get('remixed_at', '?')}")
    return "\n".join(lines)


def _render_mechanics(mech: dict) -> str:
    lines = []
    if mech.get("movement"):
        mv = mech["movement"]
        lines.extend([
            "### Movement",
            f"**Types:** {', '.join(mv.get('types', []))}",
            f"**Physics:** {mv.get('physics_style', 'N/A')}",
        ])
        mounts = mv.get("mounts_vehicles", [])
        if mounts:
            lines.append("**Mounts/Vehicles:**")
            for mt in mounts:
                lines.append(f"- **{mt.get('name', '?')}** ({mt.get('type', '?')}, {mt.get('speed', '?')}) — {mt.get('description', '')}")
        lines.append("")

    if mech.get("combat"):
        cb = mech["combat"]
        style = cb.get("style")
        if style:
            lines.extend([
                "### Combat",
                f"**Style:** {style}",
                f"**Damage Types:** {', '.join(cb.get('damage_types', []))}",
            ])
            wc = cb.get("weapon_categories", [])
            if wc:
                lines.append("**Weapons:**")
                for w in wc:
                    lines.append(f"- **{w.get('name', '?')}** ({w.get('range', '?')}, {w.get('speed', '?')}) — {w.get('description', '')}")
            se = cb.get("status_effects", [])
            if se:
                lines.append("**Status Effects:**")
                for s in se:
                    lines.append(f"- **{s.get('name', '?')}** ({s.get('element', '?')}): {s.get('effect', '')} [{s.get('duration_type', '?')}]")
            lines.append("")

    if mech.get("crafting", {}).get("enabled"):
        cr = mech["crafting"]
        lines.extend([
            "### Crafting",
            f"**Complexity:** {cr.get('complexity', 'N/A')}",
            f"**Professions:** {', '.join(cr.get('professions', []))}",
            f"**Gathering:** {', '.join(cr.get('gathering_skills', []))}",
            "",
        ])

    if mech.get("progression"):
        pg = mech["progression"]
        lines.extend([
            "### Progression",
            f"**Type:** {pg.get('type', 'N/A')}  ",
            f"**Max Level:** {pg.get('max_level', 'N/A')}  ",
            f"**Respec:** {'Yes' if pg.get('respec_available') else 'No'}",
        ])
        for st in pg.get("skill_trees", []):
            lines.append(f"- **{st.get('name', '?')}**: {st.get('description', '')} (~{st.get('node_count_estimate', '?')} nodes)")
        lines.append("")

    if mech.get("economy", {}).get("enabled"):
        ec = mech["economy"]
        lines.extend([
            "### Economy",
        ])
        for c in ec.get("currencies", []):
            lines.append(f"- **{c.get('name', '?')}** ({c.get('type', '?')}): {c.get('description', '')}")
        lines.append(f"Trading: {'Yes' if ec.get('player_trading') else 'No'} | Auction House: {'Yes' if ec.get('auction_house') else 'No'}")
        lines.append("")

    cm = mech.get("custom_mechanics", [])
    if cm:
        lines.append("### Custom Mechanics")
        for c in cm:
            lines.append(f"#### {c.get('name', '?')}")
            lines.append(c.get("description", ""))
            if c.get("rules"):
                lines.append("**Rules:**")
                for r in c["rules"]:
                    lines.append(f"- {r}")
            if c.get("interactions"):
                lines.append("**Interactions:**")
                for i in c["interactions"]:
                    lines.append(f"- {i}")
            lines.append("")

    return "\n".join(lines) or "*No mechanics defined.*"


def _render_world(world: dict) -> str:
    lines = [
        f"**Scale:** {world.get('scale', 'N/A')} | **Structure:** {world.get('structure', 'N/A')}",
    ]
    if world.get("day_night_cycle"):
        lines.append("**Day/Night Cycle:** Yes")
    if world.get("weather_system"):
        lines.append(f"**Weather:** {', '.join(world['weather_system'])}")
    lines.append("")

    for env in world.get("environments", []):
        lines.append(f"### {env.get('name', 'Unnamed')} ({env.get('type', '?')})")
        lines.append(env.get("visual_description", ""))
        if env.get("audio_mood"):
            lines.append(f"*Audio: {env['audio_mood']}*")
        if env.get("min_level") is not None:
            lines.append(f"**Level Range:** {env.get('min_level', '?')}–{env.get('max_level', '?')}")
        for sa in env.get("sub_areas", []):
            lines.append(f"- **{sa.get('name', '?')}**: {sa.get('description', '')}")
        if env.get("resources"):
            lines.append(f"**Resources:** {', '.join(env['resources'])}")
        if env.get("factions_present"):
            lines.append(f"**Factions:** {', '.join(env['factions_present'])}")
        amb = env.get("ambiance", {})
        if amb:
            amb_parts = []
            for k in ("lighting", "fog", "particles", "sky"):
                if amb.get(k):
                    amb_parts.append(f"{k.capitalize()}: {amb[k]}")
            if amb_parts:
                lines.append(f"*{' | '.join(amb_parts)}*")
        lines.append("")

    for dg in world.get("dungeons", []):
        lines.append(f"### Dungeon: {dg.get('name', '?')}")
        lines.append(f"**Difficulty:** {dg.get('difficulty', '?')} | **Floors:** {dg.get('floors', '?')}")
        lines.append(dg.get("visual_description", ""))
        pc = dg.get("player_count", {})
        if pc:
            lines.append(f"**Party:** {pc.get('min', '?')}–{pc.get('max', '?')} players")
        for boss in dg.get("boss_encounters", []):
            lines.append(f"- **Boss: {boss.get('name', '?')}** — {boss.get('description', '')} ({boss.get('phases', '?')} phases)")
        lines.append("")

    pg = world.get("procedural_generation", {})
    if pg.get("enabled"):
        lines.extend([
            "### Procedural Generation",
            f"**Scope:** {', '.join(pg.get('scope', []))}",
            pg.get("description", ""),
        ])

    return "\n".join(lines) or "*No world data defined.*"


def _render_entities(ent: dict) -> str:
    lines = []
    if ent.get("player"):
        p = ent["player"]
        lines.extend([
            "### Player",
            p.get("visual_description", ""),
        ])
        if p.get("stats"):
            lines.append(f"**Stats:** {', '.join(p['stats'])}")
        for ab in p.get("abilities", []):
            cd = ab.get("cooldown_seconds", 0)
            cost = ab.get("resource_cost", "none")
            lines.append(f"- **{ab.get('name', '?')}**: {ab.get('description', '')} (CD: {cd}s, Cost: {cost})")
        lines.append("")

    for npc in ent.get("npcs", []):
        lines.append(f"### NPC: {npc.get('name', '?')} ({npc.get('role', '?')})")
        lines.append(npc.get("description", ""))
        lines.append("")

    for enemy in ent.get("enemies", []):
        lines.append(f"### Enemy: {enemy.get('name', '?')} [{enemy.get('type', '?')}]")
        lines.append(enemy.get("description", ""))
        lr = enemy.get("level_range", {})
        if lr:
            lines.append(f"**Level:** {lr.get('min', '?')}–{lr.get('max', '?')}")
        if enemy.get("element"):
            lines.append(f"**Element:** {enemy['element']}")
        if enemy.get("abilities"):
            lines.append(f"**Abilities:** {', '.join(enemy['abilities'])}")
        wk = enemy.get("weaknesses", [])
        rs = enemy.get("resistances", [])
        if wk:
            lines.append(f"**Weaknesses:** {', '.join(wk)}")
        if rs:
            lines.append(f"**Resistances:** {', '.join(rs)}")
        if enemy.get("behavior"):
            lines.append(f"**Behavior:** {enemy['behavior']}")
        lines.append("")

    items = ent.get("items", {})
    if items:
        lines.append("### Items")
        rt = items.get("rarity_tiers", [])
        if rt:
            lines.append("**Rarity Tiers:**")
            for r in rt:
                lines.append(f"- <span style='color:{r.get('color_hex', '#000')}'>■</span> **{r.get('name', '?')}** (weight: {r.get('drop_rate_weight', '?')})")
        if items.get("equipment_slots"):
            lines.append(f"**Slots:** {', '.join(items['equipment_slots'])}")
        for cat in items.get("categories", []):
            lines.append(f"- **{cat.get('name', '?')}**: {cat.get('description', '')}")

    return "\n".join(lines) or "*No entity data defined.*"


def _render_assets(assets: dict) -> str:
    lines = []
    for key, label in [
        ("models_3d", "3D Models"),
        ("textures", "Textures"),
        ("animations", "Animations"),
        ("vfx", "VFX"),
    ]:
        items = assets.get(key, [])
        if items:
            lines.append(f"### {label} ({len(items)})")
            for it in items[:10]:
                tags = ", ".join(it.get("tags", []))
                lines.append(f"- **{it.get('name', '?')}**: {it.get('description', '')[:120]}{'...' if len(it.get('description', '')) > 120 else ''}")
                if tags:
                    lines.append(f"  Tags: {tags}")
            if len(items) > 10:
                lines.append(f"  *...and {len(items)-10} more*")
            lines.append("")

    audio = assets.get("audio", {})
    if audio:
        for subkey, sublabel in [("music", "Music"), ("sfx", "Sound Effects"), ("ambient", "Ambient"), ("voice", "Voice")]:
            items = audio.get(subkey, [])
            if items:
                lines.append(f"### {sublabel} ({len(items)})")
                for it in items[:5]:
                    lines.append(f"- **{it.get('name', '?')}**: {it.get('description', '')[:100]}")
                if len(items) > 5:
                    lines.append(f"  *...and {len(items)-5} more*")
                lines.append("")

    return "\n".join(lines) or "*No asset data defined.*"


def _render_logic(logic: dict) -> str:
    lines = []
    quests = logic.get("quests", [])
    if quests:
        lines.append(f"### Quests ({len(quests)})")
        for q in quests:
            lines.append(f"#### {q.get('name', '?')} [{q.get('type', '?')}]")
            lines.append(q.get("description", ""))
            if q.get("level_requirement") is not None:
                lines.append(f"**Level:** {q['level_requirement']}")
            for step in q.get("steps", []):
                lines.append(f"  {step.get('order', '?')}. {step.get('description', '')} ({step.get('objective_type', '?')})")
            rw = q.get("rewards", {})
            if rw:
                reward_parts = []
                if rw.get("xp"):
                    reward_parts.append(f"{rw['xp']} XP")
                if rw.get("items"):
                    reward_parts.extend(rw["items"])
                if rw.get("unlock"):
                    reward_parts.append(f"Unlocks: {rw['unlock']}")
                if reward_parts:
                    lines.append(f"**Rewards:** {', '.join(reward_parts)}")
            lines.append("")

    we = logic.get("world_events", [])
    if we:
        lines.append(f"### World Events ({len(we)})")
        for w in we:
            lines.append(f"- **{w.get('name', '?')}** [{w.get('type', '?')}]: {w.get('description', '')}")
        lines.append("")

    recipes = logic.get("crafting_recipes", [])
    if recipes:
        lines.append(f"### Crafting Recipes ({len(recipes)})")
        for r in recipes:
            ing = ", ".join(f"{i.get('item', '?')} x{i.get('quantity', '?')}" for i in r.get("ingredients", []))
            lines.append(f"- **{r.get('name', '?')}** ({r.get('profession', '?')}, lvl {r.get('skill_level_required', '?')}): {ing} → {r.get('result', '?')} x{r.get('result_quantity', 1)}")
        lines.append("")

    return "\n".join(lines) or "*No logic data defined.*"


def _render_ui(ui: dict) -> str:
    lines = []
    if ui.get("style"):
        lines.append(f"**Style:** {ui['style']}")
    cp = ui.get("color_palette", {})
    if cp:
        lines.append("**Color Palette:**")
        for k, v in cp.items():
            lines.append(f"- {k}: `{v}`")
    hud = ui.get("hud_elements", [])
    if hud:
        lines.append(f"### HUD Elements ({len(hud)})")
        for h in hud:
            lines.append(f"- **{h.get('name', '?')}** ({h.get('position', '?')}): {h.get('description', '')}")
    menus = ui.get("menus", [])
    if menus:
        lines.append(f"### Menus ({len(menus)})")
        for m in menus:
            lines.append(f"- **{m.get('name', '?')}** [{m.get('type', '?')}]: {m.get('description', '')}")
    acc = ui.get("accessibility", {})
    if acc:
        lines.append("### Accessibility")
        for k, v in acc.items():
            label = k.replace("_", " ").title()
            lines.append(f"- **{label}:** {'Yes' if v else 'No' if isinstance(v, bool) else ', '.join(v) if isinstance(v, list) else v}")
    return "\n".join(lines) or "*No UI data defined.*"


def _summary_html(s: dict) -> str:
    """Generate a summary stats HTML block."""
    return f"""
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;padding:12px;">
        <div style="background:#f0f9ff;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:1.5rem;font-weight:700;color:#0369a1;">{s['environments']}</div>
            <div style="font-size:0.8rem;color:#64748b;">Environments</div>
        </div>
        <div style="background:#fef3c7;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:1.5rem;font-weight:700;color:#b45309;">{s['dungeons']}</div>
            <div style="font-size:0.8rem;color:#64748b;">Dungeons</div>
        </div>
        <div style="background:#fce7f3;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:1.5rem;font-weight:700;color:#be185d;">{s['enemies']}</div>
            <div style="font-size:0.8rem;color:#64748b;">Enemies</div>
        </div>
        <div style="background:#ecfdf5;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:1.5rem;font-weight:700;color:#047857;">{s['quests']}</div>
            <div style="font-size:0.8rem;color:#64748b;">Quests</div>
        </div>
        <div style="background:#f5f3ff;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:1.5rem;font-weight:700;color:#6d28d9;">{s['weapons']}</div>
            <div style="font-size:0.8rem;color:#64748b;">Weapons</div>
        </div>
        <div style="background:#fff7ed;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:1.5rem;font-weight:700;color:#c2410c;">{s['movement_types']}</div>
            <div style="font-size:0.8rem;color:#64748b;">Movement Types</div>
        </div>
        <div style="background:#f0fdf4;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:1.5rem;font-weight:700;color:#16a34a;">{s['skill_trees']}</div>
            <div style="font-size:0.8rem;color:#64748b;">Skill Trees</div>
        </div>
        <div style="background:#fdf2f8;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:1.5rem;font-weight:700;color:#db2777;">{s['size_kb']} KB</div>
            <div style="font-size:0.8rem;color:#64748b;">File Size</div>
        </div>
    </div>
    """


# ---------------------------------------------------------------------------
# App State
# ---------------------------------------------------------------------------
# We store the currently-loaded DNA in a state variable

def _extract_filename_from_radio(radio_value):
    """Extract filename from radio selection like 'Title — `filename`'."""
    if not radio_value:
        return None
    # Extract filename from backticks
    import re
    match = re.search(r'`([^`]+)`', radio_value)
    if match:
        return match.group(1)
    return None


def _refresh_gallery(genre_filter, style_filter, complexity_filter):
    """Refresh the browse gallery with filters — also updates dropdown and radio choices."""
    files = list_dna_files()
    if genre_filter:
        files = [f for f in files if genre_filter in f.get("genre", [])]
    if style_filter:
        files = [f for f in files if f.get("art_style") == style_filter]
    if complexity_filter:
        files = [f for f in files if f.get("complexity") == complexity_filter]

    all_files = list_dna_files()
    radio_choices = [f"{f.get('title', 'Untitled')} — `{f['filename']}`" for f in all_files]
    dropdown_choices = [f["filename"] for f in all_files]

    if not files:
        return (
            "<div style='text-align:center;padding:40px;color:#374151;'>No game DNA files found matching filters.</div>",
            gr.update(choices=dropdown_choices),
            gr.update(choices=radio_choices),
        )

    cards = "".join(_dna_card_html(f) for f in files)
    return (
        f"<div>{cards}</div>",
        gr.update(choices=dropdown_choices),
        gr.update(choices=radio_choices),
    )


def _view_dna(filename):
    """Load and display a DNA file."""
    dna = load_dna(filename)
    if dna is None:
        return (
            gr.update(visible=False),
            "Could not load file.",
            "", "", "", "", "", "", "", "",
            {},
            json.dumps({"error": "file not found"}, indent=2),
            None,
        )
    meta = dna.get("meta", {})
    summary = get_summary(dna)
    is_valid, errors = validate(dna)
    valid_text = "✅ Valid" if is_valid else f"⚠️ {len(errors)} validation issues"

    # Build full DNA markdown
    full_md = f"# {meta.get('title', 'Untitled')}\n\n"
    full_md += f"*{meta.get('tagline', '')}*\n\n"
    full_md += f"**Description:** {meta.get('description', 'N/A')}\n\n"
    for section in ["meta", "mechanics", "world", "entities", "assets", "logic", "ui"]:
        full_md += f"\n---\n\n{_section_md(dna, section)}\n"

    return (
        gr.update(visible=True),
        f"## {meta.get('title', 'Untitled')}\n*{meta.get('tagline', '')}*\n\n{valid_text}",
        full_md,
        _section_md(dna, "meta"),
        _section_md(dna, "mechanics"),
        _section_md(dna, "world"),
        _section_md(dna, "entities"),
        _section_md(dna, "assets"),
        _section_md(dna, "logic"),
        _section_md(dna, "ui"),
        summary,
        json.dumps(dna, indent=2),
        dna,
    )


def _on_load_for_editor(filename_or_template):
    """Load DNA into the editor."""
    # Try as filename first
    dna = load_dna(filename_or_template)
    if dna is None:
        # Try as template
        dna = load_template(filename_or_template)
    if dna is None:
        dna = load_template("minimal") or {}
    return (
        json.dumps(dna, indent=2),
        dna,
    )


def _validate_live(json_text):
    """Validate JSON and return status."""
    try:
        dna = json.loads(json_text)
        is_valid, errors = validate(dna)
        if is_valid:
            summary = get_summary(dna)
            return "✅ Valid JSON — schema validation passed", dna
        else:
            err_text = "\n".join(f"- {e}" for e in errors[:10])
            if len(errors) > 10:
                err_text += f"\n...and {len(errors)-10} more"
            return f"⚠️ Valid JSON but {len(errors)} schema issues:\n{err_text}", dna
    except json.JSONDecodeError as e:
        return f"❌ Invalid JSON: {e}", None


def _on_remix(filename):
    """Create a remix of a DNA file."""
    dna = load_dna(filename)
    if dna is None:
        return "Could not load file for remix.", None
    remix = create_remix(dna)
    return json.dumps(remix, indent=2), remix


def _on_upload(file):
    """Handle uploaded DNA file."""
    if file is None:
        return "No file uploaded.", gr.update(visible=False, value=""), {}, None
    try:
        content = Path(file.name).read_text()
        dna = json.loads(content)
        is_valid, errors = validate(dna)
        summary = get_summary(dna)
        valid = "✅ Valid" if is_valid else f"⚠️ {len(errors)} issues"
        meta = dna.get("meta", {})
        info = f"**{meta.get('title', 'Untitled')}** — {valid}"
        return info, gr.update(visible=True, value=content), summary, dna
    except json.JSONDecodeError as e:
        return f"❌ Invalid JSON: {e}", gr.update(visible=False, value=""), {}, None


def _on_save_to_hub(dna_dict, filename):
    """Save DNA to storage."""
    if dna_dict is None:
        return "No DNA loaded."
    fname = filename.strip() or dna_dict.get("meta", {}).get("title", "untitled").lower().replace(" ", "-") + ".json"
    if not fname.endswith(".json"):
        fname += ".json"
    try:
        ok = upload_dna(dna_dict, fname)
        return f"✅ Saved as {fname}" if ok else "❌ Save failed"
    except Exception as e:
        return f"❌ Error: {e}"


def _on_export_md(dna_dict):
    """Export DNA as markdown."""
    if dna_dict is None:
        return "No DNA loaded."
    return export_markdown(dna_dict)


# ---------------------------------------------------------------------------
# Build Gradio App
# ---------------------------------------------------------------------------

def build_app():
    with gr.Blocks(
        title="ForgeDNA Community Hub",
    ) as app:

        gr.Markdown("# 🧬 ForgeDNA Community Hub", elem_classes=["main-title"])
        gr.Markdown("*Browse, view, edit, remix, and share Game DNA files — universal game designs for human-AI collaboration*", elem_classes=["main-subtitle"])

        # Shared state: current DNA dict
        current_dna = gr.State(None)

        # ------------------------------------------------------------------
        # TAB 1: Browse
        # ------------------------------------------------------------------
        with gr.Tab("📚 Browse"):
            with gr.Row():
                genre_dd = gr.Dropdown(
                    choices=GENRE_OPTIONS, label="Filter by Genre", value=""
                )
                style_dd = gr.Dropdown(
                    choices=ART_STYLES, label="Filter by Art Style", value=""
                )
                complexity_dd = gr.Dropdown(
                    choices=COMPLEXITY_OPTIONS, label="Filter by Complexity", value=""
                )
                refresh_btn = gr.Button("🔄 Refresh", variant="secondary")

            gallery_html = gr.HTML(value="<div>Loading...</div>")

            gr.Markdown("---")
            gr.Markdown("### 👁️ View DNA Details")
            gr.Markdown("Click a game title below to view its details:")
            file_choices = [f"{f.get('title', 'Untitled')} — `{f['filename']}`" for f in list_dna_files()]
            file_radio = gr.Radio(
                label="Select a game to view",
                choices=file_choices,
                value=None,
                interactive=True,
            )
            with gr.Row():
                dna_select = gr.Dropdown(
                    label="Or select by filename",
                    choices=[f["filename"] for f in list_dna_files()],
                    value=None,
                    visible=True,
                )
                view_btn = gr.Button("View Details", variant="primary")

            view_container = gr.Column(visible=False)
            with view_container:
                view_header = gr.Markdown("")
                summary_html = gr.HTML(value="")
                with gr.Tabs():
                    view_tab_all = gr.Tab("🧬 Full DNA")
                    with view_tab_all:
                        view_md_all = gr.Markdown("")
                    view_tab_mechanics = gr.Tab("🔧 Mechanics")
                    with view_tab_mechanics:
                        view_md_mechanics = gr.Markdown("")
                    view_tab_world = gr.Tab("🌍 World")
                    with view_tab_world:
                        view_md_world = gr.Markdown("")
                    view_tab_entities = gr.Tab("👾 Entities")
                    with view_tab_entities:
                        view_md_entities = gr.Markdown("")
                    view_tab_assets = gr.Tab("🎨 Assets")
                    with view_tab_assets:
                        view_md_assets = gr.Markdown("")
                    view_tab_logic = gr.Tab("⚡ Logic")
                    with view_tab_logic:
                        view_md_logic = gr.Markdown("")
                    view_tab_ui = gr.Tab("🖥️ UI")
                    with view_tab_ui:
                        view_md_ui = gr.Markdown("")
                    view_tab_meta = gr.Tab("📋 Meta")
                    with view_tab_meta:
                        view_md_meta = gr.Markdown("")

                with gr.Row():
                    download_btn = gr.Button("📥 Download JSON")
                    remix_btn = gr.Button("🔀 Remix", variant="secondary")
                    export_md_btn = gr.Button("📝 Export Markdown")
                    edit_btn = gr.Button("✏️ Edit in Editor", variant="primary")

                view_json = gr.Code(label="Raw JSON", language="json", lines=10, visible=False)

        # ------------------------------------------------------------------
        # TAB 2: Editor
        # ------------------------------------------------------------------
        with gr.Tab("✏️ Editor"):
            gr.Markdown("### Visual Schema Editor")
            gr.Markdown("Edit Game DNA in structured JSON. Changes validate automatically.")

            with gr.Row():
                editor_source = gr.Dropdown(
                    label="Load from",
                    choices=list_dna_files() and [f["filename"] for f in list_dna_files()] + get_template_names(),
                    value=None,
                )
                load_editor_btn = gr.Button("📂 Load", variant="secondary")
                template_dd = gr.Dropdown(
                    label="Or start from template",
                    choices=get_template_names(),
                    value=None,
                )
                new_template_btn = gr.Button("📄 New from Template", variant="secondary")

            editor_json = gr.Code(
                label="Game DNA JSON",
                language="json",
                lines=30,
                value=json.dumps(load_template("minimal") or {}, indent=2),
            )

            validation_status = gr.Markdown("*Waiting for edits...*")

            with gr.Row():
                save_btn = gr.Button("💾 Save to Hub", variant="primary")
                download_editor_btn = gr.Button("📥 Download")
                validate_btn = gr.Button("✅ Validate", variant="secondary")

            save_status = gr.Markdown("")
            editor_dna = gr.State(None)

        # ------------------------------------------------------------------
        # TAB 3: Upload
        # ------------------------------------------------------------------
        with gr.Tab("📤 Upload"):
            gr.Markdown("### Upload Game DNA")
            gr.Markdown("Drag and drop a `game_dna.json` file to validate, preview, and save.")

            upload_file = gr.File(
                label="Upload game_dna.json",
                file_types=[".json"],
                type="filepath",
            )
            upload_info = gr.Markdown("")
            upload_json = gr.Code(label="File Contents", language="json", lines=15, visible=False)
            upload_summary = gr.HTML(value="")

            with gr.Row():
                upload_save_btn = gr.Button("💾 Save to Hub", variant="primary")
                upload_md_btn = gr.Button("📝 Export as Markdown")
            upload_dna_state = gr.State(None)
            upload_status = gr.Markdown("")

        # ------------------------------------------------------------------
        # TAB 4: About
        # ------------------------------------------------------------------
        with gr.Tab("📖 About"):
            gr.Markdown("""
            ## ForgeDNA

            **A universal, engine-agnostic schema for defining complete game designs as lightweight JSON.**

            Designed for human-AI collaboration: humans define creative vision, AI agents generate assets and code.

            ### How It Works

            1. **Browse** existing game DNA files in the gallery
            2. **View** detailed breakdowns of each game design
            3. **Remix** any design to create your own version
            4. **Edit** using the visual schema editor
            5. **Upload** your own game DNA files
            6. **Download** and share with others

            ### Schema Structure

            Every Game DNA file has these sections:

            | Section | Description |
            |---------|-------------|
            | `meta` | Title, genre, art style, tagline, description |
            | `mechanics` | Movement, combat, crafting, progression, economy |
            | `world` | Environments, dungeons, procedural generation |
            | `entities` | Player, NPCs, enemies, items |
            | `assets` | 3D models, textures, animations, audio, VFX |
            | `logic` | Quests, world events, crafting recipes |
            | `ui` | HUD elements, menus, color palette, accessibility |

            ### Storage

            Game DNA files can be stored locally or on Hugging Face Hub.
            Set `FORGEDNA_HUB_REPO` and `HF_TOKEN` environment variables for HF integration.

            ### Links

            - **Website:** [forgedna.org](https://forgedna.org)
            - **GitHub:** [github.com/Jpalmer95/ForgeDNA](https://github.com/Jpalmer95/ForgeDNA)
            - **Schema:** `schema/game_dna.schema.json`
            - **CLI Tool:** `cli/` directory
            - **Substrate Harness:** `harness/` directory
            - **Walkthrough:** `docs/WALKTHROUGH.md`
            """)

        # ================================================================
        # Event Wiring
        # ================================================================

        # Browse tab
        refresh_btn.click(
            _refresh_gallery,
            inputs=[genre_dd, style_dd, complexity_dd],
            outputs=[gallery_html, dna_select, file_radio],
        )
        # Auto-refresh on load
        app.load(
            _refresh_gallery,
            inputs=[genre_dd, style_dd, complexity_dd],
            outputs=[gallery_html, dna_select, file_radio],
        )

        view_btn.click(
            _view_dna,
            inputs=[dna_select],
            outputs=[
                view_container,
                view_header,
                view_md_all,
                view_md_meta,
                view_md_mechanics,
                view_md_world,
                view_md_entities,
                view_md_assets,
                view_md_logic,
                view_md_ui,
                summary_html,
                view_json,
                current_dna,
            ],
        )

        # Also auto-view when dropdown selection changes
        dna_select.change(
            _view_dna,
            inputs=[dna_select],
            outputs=[
                view_container,
                view_header,
                view_md_all,
                view_md_meta,
                view_md_mechanics,
                view_md_world,
                view_md_entities,
                view_md_assets,
                view_md_logic,
                view_md_ui,
                summary_html,
                view_json,
                current_dna,
            ],
        )

        # Auto-view when Radio selection changes
        def _on_radio_select(radio_value):
            filename = _extract_filename_from_radio(radio_value)
            if filename:
                return _view_dna(filename)
            return (gr.update(visible=False), "", "", "", "", "", "", "", "", "", {}, "{}", None)

        file_radio.change(
            _on_radio_select,
            inputs=[file_radio],
            outputs=[
                view_container,
                view_header,
                view_md_all,
                view_md_meta,
                view_md_mechanics,
                view_md_world,
                view_md_entities,
                view_md_assets,
                view_md_logic,
                view_md_ui,
                summary_html,
                view_json,
                current_dna,
            ],
        )

        # Editor tab
        load_editor_btn.click(
            _on_load_for_editor,
            inputs=[editor_source],
            outputs=[editor_json, editor_dna],
        )
        new_template_btn.click(
            _on_load_for_editor,
            inputs=[template_dd],
            outputs=[editor_json, editor_dna],
        )

        # Live validation on editor change
        editor_json.change(
            _validate_live,
            inputs=[editor_json],
            outputs=[validation_status, editor_dna],
        )

        validate_btn.click(
            _validate_live,
            inputs=[editor_json],
            outputs=[validation_status, editor_dna],
        )

        save_btn.click(
            _on_save_to_hub,
            inputs=[editor_dna, gr.Textbox(value="", visible=False)],
            outputs=[save_status],
        )

        # Remix button
        remix_btn.click(
            _on_remix,
            inputs=[dna_select],
            outputs=[editor_json, editor_dna],
        )

        # Edit button switches to editor tab
        edit_btn.click(
            lambda dna: (json.dumps(dna, indent=2) if dna else "", dna),
            inputs=[current_dna],
            outputs=[editor_json, editor_dna],
        )

        # Download
        download_file = gr.File(label="Download", visible=False)
        def _download_json(dna):
            if dna is None:
                return gr.update(visible=False)
            import tempfile
            title = dna.get("meta", {}).get("title", "game").lower().replace(" ", "-")
            path = Path(tempfile.gettempdir()) / f"{title}.json"
            path.write_text(json.dumps(dna, indent=2))
            return gr.update(value=str(path), visible=True)

        download_btn.click(
            _download_json,
            inputs=[current_dna],
            outputs=[download_file],
        )

        download_editor_file = gr.File(label="Download", visible=False)
        download_editor_btn.click(
            _download_json,
            inputs=[editor_dna],
            outputs=[download_editor_file],
        )

        export_md_btn.click(
            _on_export_md,
            inputs=[current_dna],
            outputs=[gr.Textbox(label="Markdown Export", lines=20)],
        )

        # Upload tab
        upload_file.change(
            _on_upload,
            inputs=[upload_file],
            outputs=[upload_info, upload_json, upload_summary, upload_dna_state],
        )

        # Upload tab — save also refreshes the Browse gallery, dropdown, and radio
        def _on_upload_save(dna, _ignored, genre_f, style_f, complexity_f):
            """Save uploaded DNA and refresh the gallery."""
            status = _on_save_to_hub(dna, _ignored)
            gallery, dropdown, radio = _refresh_gallery(genre_f, style_f, complexity_f)
            return status, gallery, dropdown, radio

        upload_save_btn.click(
            _on_upload_save,
            inputs=[upload_dna_state, gr.Textbox(value="", visible=False), genre_dd, style_dd, complexity_dd],
            outputs=[upload_status, gallery_html, dna_select, file_radio],
        )

        upload_md_btn.click(
            _on_export_md,
            inputs=[upload_dna_state],
            outputs=[gr.Textbox(label="Markdown Export", lines=20)],
        )

    return app


# HF Spaces requires a top-level demo/app variable
# Rebuild trigger
demo = build_app()

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
