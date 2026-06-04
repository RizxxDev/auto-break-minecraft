import type { Vector3 } from "../domain/types";

export function floorVector(position: Vector3): Vector3 {
  return {
    x: Math.floor(position.x),
    y: Math.floor(position.y),
    z: Math.floor(position.z)
  };
}

export function vectorKey(position: Vector3): string {
  const p = floorVector(position);
  return `${p.x},${p.y},${p.z}`;
}

export function parseVectorKey(key: string): Vector3 {
  const [x, y, z] = key.split(",").map(Number);
  return { x, y, z };
}

export function distanceSquared(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function equalsVector(a: Vector3, b: Vector3): boolean {
  return Math.floor(a.x) === Math.floor(b.x) && Math.floor(a.y) === Math.floor(b.y) && Math.floor(a.z) === Math.floor(b.z);
}

export function addVector(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function below(position: Vector3): Vector3 {
  return { x: position.x, y: position.y - 1, z: position.z };
}

export function above(position: Vector3): Vector3 {
  return { x: position.x, y: position.y + 1, z: position.z };
}

export function formatVector(position: Vector3): string {
  const p = floorVector(position);
  return `${p.x} ${p.y} ${p.z}`;
}
