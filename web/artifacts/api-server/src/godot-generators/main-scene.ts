interface SpawnPoint {
  name: string;
  position: number[];
}

interface Entity {
  id: string;
  type?: string;
}

export function generateMainScene(data: Record<string, unknown>): string {
  const env = (data.environment_config || {}) as Record<string, unknown>;
  const terrain = (env.terrain || {}) as Record<string, unknown>;
  const entityRegistry = (data.entity_registry || []) as Entity[];

  const sizeM = (terrain.size_m || [100, 0, 100]) as number[];
  const terrainX = sizeM[0] ?? 100;
  const terrainZ = sizeM[2] ?? 100;
  const spawnPoints = (terrain.spawn_points || []) as SpawnPoint[];

  let playerStart = [0, 0, 0];
  for (const sp of spawnPoints) {
    if (sp.name?.toLowerCase().includes("player") || sp.name?.toLowerCase().includes("start")) {
      playerStart = sp.position || [0, 0, 0];
      break;
    }
  }
  if (playerStart[0] === 0 && playerStart[1] === 0 && playerStart[2] === 0 && spawnPoints.length > 0) {
    playerStart = spawnPoints[0].position || [0, 0, 0];
  }

  const extResources: string[] = [];
  extResources.push('[ext_resource type="PackedScene" uid="uid://player_rig" path="res://player_rig.tscn" id="player_rig"]');

  for (const entity of entityRegistry) {
    const eid = (entity.id || "entity").replace(/[^a-zA-Z0-9_-]/g, "_");
    extResources.push(`[ext_resource type="PackedScene" uid="uid://${eid}" path="res://entities/${eid}.tscn" id="${eid}"]`);
  }

  const subResources = [
    `[sub_resource type="BoxShape3D" id="TerrainCollision"]\nsize = Vector3(${terrainX}, 0.1, ${terrainZ})`,
    `[sub_resource type="BoxMesh" id="TerrainMesh"]\nsize = Vector3(${terrainX}, 0.1, ${terrainZ})`,
    `[sub_resource type="StandardMaterial3D" id="TerrainMaterial"]\nalbedo_color = Color(0.25, 0.25, 0.3, 1)\nroughness = 0.85`,
  ];

  const loadSteps = 1 + extResources.length + subResources.length;
  const lines: string[] = [];

  lines.push(`[gd_scene load_steps=${loadSteps} format=3]`);
  lines.push("");
  for (const er of extResources) {
    lines.push(er);
  }
  lines.push("");
  for (const sr of subResources) {
    lines.push(sr);
    lines.push("");
  }

  lines.push('[node name="Main" type="Node3D"]');
  lines.push("");
  lines.push('[node name="WorldEnvironment" type="WorldEnvironment" parent="."]');
  lines.push("");
  lines.push('[node name="DirectionalLight3D" type="DirectionalLight3D" parent="."]');
  lines.push("transform = Transform3D(1, 0, 0, 0, 0.707, 0.707, 0, -0.707, 0.707, 0, 10, 0)");
  lines.push("shadow_enabled = true");
  lines.push("");

  lines.push('[node name="Terrain" type="StaticBody3D" parent="."]');
  lines.push("");
  lines.push('[node name="CollisionShape3D" type="CollisionShape3D" parent="Terrain"]');
  lines.push('shape = SubResource("TerrainCollision")');
  lines.push("");
  lines.push('[node name="MeshInstance3D" type="MeshInstance3D" parent="Terrain"]');
  lines.push('mesh = SubResource("TerrainMesh")');
  lines.push('material_override = SubResource("TerrainMaterial")');
  lines.push("");

  const [px, py, pz] = playerStart;
  lines.push('[node name="PlayerRig" parent="." instance=ExtResource("player_rig")]');
  if (px !== 0 || py !== 0 || pz !== 0) {
    lines.push(`transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${px}, ${py}, ${pz})`);
  }
  lines.push("");

  for (const sp of spawnPoints) {
    const name = (sp.name || "spawn").replace(/[^a-zA-Z0-9_-]/g, "_");
    const pos = sp.position || [0, 0, 0];
    lines.push(`[node name="${name}" type="Marker3D" parent="."]`);
    lines.push(`transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${pos[0]}, ${pos[1]}, ${pos[2]})`);
    lines.push("");
  }

  for (const entity of entityRegistry) {
    const eid = (entity.id || "entity").replace(/[^a-zA-Z0-9_-]/g, "_");
    lines.push(`[node name="${eid}" parent="." instance=ExtResource("${eid}")]`);
    lines.push("");
  }

  return lines.join("\n");
}
