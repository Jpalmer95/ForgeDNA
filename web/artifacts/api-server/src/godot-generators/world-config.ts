export function generateWorldConfigScript(data: Record<string, unknown>): string {
  const env = (data.environment_config || {}) as Record<string, unknown>;
  const physics = (env.physics || {}) as Record<string, unknown>;

  const defaultFriction = Number(physics.default_friction ?? 0.5);
  const terminalVelocity = Number(physics.terminal_velocity ?? 50);
  const gravityVec = (physics.gravity_vector || [0, -9.8, 0]) as number[];

  return `extends Node

var default_friction: float = ${defaultFriction}
var terminal_velocity: float = ${terminalVelocity}
var gravity_vector: Vector3 = Vector3(${gravityVec[0] ?? 0}, ${gravityVec[1] ?? -9.8}, ${gravityVec[2] ?? 0})

func get_default_friction() -> float:
\treturn default_friction

func get_terminal_velocity() -> float:
\treturn terminal_velocity

func clamp_velocity(vel: Vector3) -> Vector3:
\tif vel.length() > terminal_velocity:
\t\treturn vel.normalized() * terminal_velocity
\treturn vel
`;
}
