/** Shared aim / movement — matches Three.js yaw/pitch camera looking down -Z. */

export function aimDirection(yaw, pitch) {
  const cp = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cp,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cp,
  };
}

/** Local input ax (strafe) / az (forward W=+1) → world XZ wish direction (unnormalized). */
export function wishXZ(yaw, ax, az) {
  const syn = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return {
    x: -syn * az + cos * ax,
    z: -cos * az - syn * ax,
  };
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
