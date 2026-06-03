interface EntityData {
  id: string;
  type: string;
  mass_kg?: number;
  physics_material?: { friction?: number; bounce?: number };
  speed?: number;
  health?: number;
  grab_offset?: number[];
  haptic_on_hit?: number[];
  navmesh_layer?: string;
}

export function generateEntityScene(entity: EntityData): string {
  switch (entity.type) {
    case "grabbable":
      return generateGrabbable(entity);
    case "npc":
      return generateNPC(entity);
    case "trigger":
      return generateTrigger(entity);
    default:
      return generateStaticProp(entity);
  }
}

function generateGrabbable(entity: EntityData): string {
  const mass = entity.mass_kg ?? 1;
  const friction = entity.physics_material?.friction ?? 0.5;
  const bounce = entity.physics_material?.bounce ?? 0;
  const grabOffset = entity.grab_offset ?? [0, 0, 0];
  const hapticOnHit = entity.haptic_on_hit ?? [];
  const hapticStr = hapticOnHit.join(", ");
  const collisionSize = Math.max(0.1, Math.min(2.0, 0.2 + mass * 0.15));

  return `[gd_scene load_steps=4 format=3]

[ext_resource type="Script" path="res://scripts/grab.gd" id="1"]

[sub_resource type="BoxShape3D" id="GrabCollision"]
size = Vector3(${collisionSize.toFixed(3)}, ${collisionSize.toFixed(3)}, ${collisionSize.toFixed(3)})

[sub_resource type="BoxMesh" id="GrabMesh"]
size = Vector3(${collisionSize.toFixed(3)}, ${collisionSize.toFixed(3)}, ${collisionSize.toFixed(3)})

[sub_resource type="PhysicsMaterial" id="PhysMat"]
friction = ${friction}
bounce = ${bounce}

[node name="${entity.id}" type="RigidBody3D"]
mass = ${mass}
physics_material_override = SubResource("PhysMat")
script = ExtResource("1")
grab_offset = Vector3(${grabOffset[0]}, ${grabOffset[1]}, ${grabOffset[2]})
haptic_on_hit = PackedFloat32Array(${hapticStr})

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
shape = SubResource("GrabCollision")

[node name="MeshInstance3D" type="MeshInstance3D" parent="."]
mesh = SubResource("GrabMesh")
`;
}

function generateNPC(entity: EntityData): string {
  const speed = entity.speed ?? 2;
  const health = entity.health ?? 100;

  return `[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://scripts/npc_patrol.gd" id="1"]

[sub_resource type="CapsuleShape3D" id="NPCCollision"]
radius = 0.3
height = 1.8

[sub_resource type="CapsuleMesh" id="NPCMesh"]
radius = 0.3
height = 1.8

[node name="${entity.id}" type="CharacterBody3D"]
script = ExtResource("1")
patrol_speed = ${speed}
max_health = ${health}

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.9, 0)
shape = SubResource("NPCCollision")

[node name="MeshInstance3D" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.9, 0)
mesh = SubResource("NPCMesh")

[node name="NavigationAgent3D" type="NavigationAgent3D" parent="."]
`;
}

function generateTrigger(entity: EntityData): string {
  return `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://scripts/trigger_zone.gd" id="1"]

[sub_resource type="BoxShape3D" id="TriggerCollision"]
size = Vector3(2, 2, 2)

[node name="${entity.id}" type="Area3D"]
script = ExtResource("1")

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
shape = SubResource("TriggerCollision")
`;
}

function generateStaticProp(entity: EntityData): string {
  return `[gd_scene load_steps=2 format=3]

[sub_resource type="BoxShape3D" id="PropCollision"]
size = Vector3(1, 1, 1)

[sub_resource type="BoxMesh" id="PropMesh"]
size = Vector3(1, 1, 1)

[node name="${entity.id}" type="StaticBody3D"]

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
shape = SubResource("PropCollision")

[node name="MeshInstance3D" type="MeshInstance3D" parent="."]
mesh = SubResource("PropMesh")
`;
}

export function generateGrabScript(): string {
  return `extends RigidBody3D

@export var grab_offset: Vector3 = Vector3.ZERO
@export var haptic_on_hit: PackedFloat32Array = PackedFloat32Array()

var _is_grabbed: bool = false
var _grabbing_controller: XRController3D = null

func grab(controller: XRController3D) -> void:
\t_is_grabbed = true
\t_grabbing_controller = controller
\tfreeze = true
\treparent(controller)
\tposition = grab_offset

func release() -> void:
\tif not _is_grabbed:
\t\treturn
\t_is_grabbed = false
\tvar global_pos := global_position
\tvar velocity_hint := _grabbing_controller.get_pose("default").linear_velocity if _grabbing_controller else Vector3.ZERO
\t_grabbing_controller = null
\treparent(get_tree().current_scene)
\tglobal_position = global_pos
\tfreeze = false
\tlinear_velocity = velocity_hint

func _on_body_entered(body: Node) -> void:
\tif haptic_on_hit.size() > 0 and _grabbing_controller:
\t\t_grabbing_controller.trigger_haptic_pulse("haptic", 0.0, haptic_on_hit[0] if haptic_on_hit.size() > 0 else 0.5, 0.1, 0.0)
`;
}

export function generateNpcPatrolScript(): string {
  return `extends CharacterBody3D

@export var patrol_speed: float = 2.0
@export var max_health: float = 100.0
@export var patrol_points: Array[Vector3] = []

var _current_health: float
var _patrol_index: int = 0
var _nav_agent: NavigationAgent3D

func _ready() -> void:
\t_current_health = max_health
\t_nav_agent = $NavigationAgent3D
\tif patrol_points.size() > 0:
\t\t_nav_agent.target_position = patrol_points[0]

func _physics_process(delta: float) -> void:
\tif patrol_points.size() == 0:
\t\treturn

\tif _nav_agent.is_navigation_finished():
\t\t_patrol_index = (_patrol_index + 1) % patrol_points.size()
\t\t_nav_agent.target_position = patrol_points[_patrol_index]
\t\treturn

\tvar next_pos := _nav_agent.get_next_path_position()
\tvar direction := (next_pos - global_position).normalized()
\tvelocity = direction * patrol_speed
\tmove_and_slide()

\tif direction.length() > 0.1:
\t\tlook_at(global_position + direction, Vector3.UP)

func take_damage(amount: float) -> void:
\t_current_health -= amount
\tif _current_health <= 0:
\t\tqueue_free()
`;
}

export function generateTriggerScript(): string {
  return `extends Area3D

signal triggered(body: Node3D)
signal untriggered(body: Node3D)

@export var one_shot: bool = false

var _has_triggered: bool = false

func _ready() -> void:
\tbody_entered.connect(_on_body_entered)
\tbody_exited.connect(_on_body_exited)

func _on_body_entered(body: Node3D) -> void:
\tif one_shot and _has_triggered:
\t\treturn
\t_has_triggered = true
\ttriggered.emit(body)
\tprint("[Trigger] ", name, " activated by ", body.name)

func _on_body_exited(body: Node3D) -> void:
\tuntriggered.emit(body)
`;
}
