interface Controller {
  hand: string;
  tracker: string;
  haptic_curves?: Record<string, number[]>;
}

export function generatePlayerRigScene(rig: Record<string, unknown>): string {
  const camera = (rig.camera || {}) as Record<string, unknown>;
  const controllers = (rig.controllers || []) as Controller[];
  const collision = (rig.collision || {}) as Record<string, unknown>;

  const heightOffset = Number(camera.height_offset ?? 1.7);
  const near = Number(camera.near ?? 0.05);
  const far = Number(camera.far ?? 1000);
  const capsuleRadius = Number(collision.capsule_radius ?? 0.3);
  const capsuleHeight = Number(collision.capsule_height ?? 1.8);

  let leftTracker = "/user/hand/left";
  let rightTracker = "/user/hand/right";
  let leftHapticCurves: Record<string, number[]> = {};
  let rightHapticCurves: Record<string, number[]> = {};
  for (const ctrl of controllers) {
    if (ctrl.hand === "left") {
      leftTracker = ctrl.tracker || leftTracker;
      if (ctrl.haptic_curves) leftHapticCurves = ctrl.haptic_curves;
    }
    if (ctrl.hand === "right") {
      rightTracker = ctrl.tracker || rightTracker;
      if (ctrl.haptic_curves) rightHapticCurves = ctrl.haptic_curves;
    }
  }

  const hapticLines = (hand: string, curves: Record<string, number[]>): string => {
    const entries = Object.entries(curves);
    if (entries.length === 0) return "";
    return entries.map(([name, values]) =>
      `${hand}_haptic_${name} = PackedFloat32Array(${values.join(", ")})`
    ).join("\n");
  };

  const leftHapticStr = hapticLines("left", leftHapticCurves);
  const rightHapticStr = hapticLines("right", rightHapticCurves);

  return `[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://scripts/locomotion.gd" id="1"]

[sub_resource type="CapsuleShape3D" id="CapsuleShape3D_001"]
radius = ${capsuleRadius}
height = ${capsuleHeight}

[node name="PlayerRig" type="XROrigin3D"]
script = ExtResource("1")

[node name="XRCamera3D" type="XRCamera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, ${heightOffset}, 0)
near = ${near}
far = ${far}

[node name="LeftController" type="XRController3D" parent="."]
tracker = "${leftTracker}"
${leftHapticStr}

[node name="RightController" type="XRController3D" parent="."]
tracker = "${rightTracker}"
${rightHapticStr}

[node name="CharacterBody3D" type="CharacterBody3D" parent="."]

[node name="CollisionShape3D" type="CollisionShape3D" parent="CharacterBody3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, ${capsuleHeight / 2}, 0)
shape = SubResource("CapsuleShape3D_001")
`;
}

export function generateLocomotionScript(rig: Record<string, unknown>): string {
  const locomotion = (rig.locomotion || {}) as Record<string, unknown>;
  const mode = String(locomotion.mode ?? "teleport_with_blinder");
  const turnSpeed = Number(locomotion.turn_speed_deg ?? 45);
  const snapTurn = locomotion.snap_turn !== false ? "true" : "false";
  const movementSpeed = Number(locomotion.movement_speed ?? 3);

  return `extends XROrigin3D

@export var locomotion_mode: String = "${mode}"
@export var turn_speed_deg: float = ${turnSpeed}
@export var snap_turn: bool = ${snapTurn}
@export var movement_speed: float = ${movementSpeed}

var _xr_interface: XRInterface

func _ready() -> void:
\t_xr_interface = XRServer.find_interface("OpenXR")
\tif _xr_interface and _xr_interface.is_initialized():
\t\tget_viewport().use_xr = true
\t\tprint("[ForgeDNA] OpenXR initialized — mode: ", locomotion_mode)
\telse:
\t\tpush_warning("[ForgeDNA] OpenXR not available, falling back to desktop mode")

func _physics_process(delta: float) -> void:
\tif locomotion_mode == "smooth":
\t\t_handle_smooth_locomotion(delta)
\telif locomotion_mode == "teleport" or locomotion_mode == "teleport_with_blinder":
\t\tpass

func _handle_smooth_locomotion(delta: float) -> void:
\tvar left_ctrl := $LeftController as XRController3D
\tif not left_ctrl:
\t\treturn

\tvar input_vec := Vector2(
\t\tleft_ctrl.get_float("primary_x"),
\t\tleft_ctrl.get_float("primary_y")
\t)

\tif input_vec.length() > 0.1:
\t\tvar camera := $XRCamera3D as XRCamera3D
\t\tvar forward := -camera.global_transform.basis.z
\t\tforward.y = 0
\t\tforward = forward.normalized()
\t\tvar right := camera.global_transform.basis.x
\t\tright.y = 0
\t\tright = right.normalized()

\t\tvar direction := (forward * input_vec.y + right * input_vec.x).normalized()
\t\tglobal_position += direction * movement_speed * delta

\tvar right_ctrl := $RightController as XRController3D
\tif right_ctrl:
\t\tvar turn_input := right_ctrl.get_float("primary_x")
\t\tif snap_turn:
\t\t\tif abs(turn_input) > 0.6:
\t\t\t\tvar snap_deg := turn_speed_deg if turn_input > 0 else -turn_speed_deg
\t\t\t\trotate_y(deg_to_rad(-snap_deg))
\t\telse:
\t\t\tif abs(turn_input) > 0.1:
\t\t\t\trotate_y(deg_to_rad(-turn_input * turn_speed_deg * delta))
`;
}
