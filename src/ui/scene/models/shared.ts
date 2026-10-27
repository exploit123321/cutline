import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  type BufferGeometry,
  LatheGeometry,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  DoubleSide,
} from "three";

/*
 * Geometry and materials shared by every copy of every model. Each drei <View> mounts
 * its own copy of the scene, so sharing buffers keeps five views about as cheap as one.
 */

const geo = new Map<string, BufferGeometry>();
function cached<T extends BufferGeometry>(key: string, make: () => T): T {
  let g = geo.get(key);
  if (!g) {
    g = make();
    geo.set(key, g);
  }
  return g as T;
}

export const sphere = () => cached("sphere", () => new SphereGeometry(1, 32, 20));
export const unitBox = () => cached("box", () => new BoxGeometry(1, 1, 1));
export const capsule = (r: number, len: number) =>
  cached(`cap:${r}:${len}`, () => new CapsuleGeometry(r, len, 8, 20));
export const cylinder = (rTop: number, rBottom: number, h: number, seg = 28, open = false) =>
  cached(`cyl:${rTop}:${rBottom}:${h}:${seg}:${open}`, () => new CylinderGeometry(rTop, rBottom, h, seg, 1, open));
export const torus = (r: number, tube: number, arc = Math.PI * 2) =>
  cached(`tor:${r}:${tube}:${arc}`, () => new TorusGeometry(r, tube, 12, 64, arc));

/** A body shape turned on a lathe from (radius, height) pairs, in metres. */
export const lathe = (key: string, profile: [number, number][], seg = 32) =>
  cached(`lathe:${key}`, () => new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), seg));

type MatOpts = { rough?: number; metal?: number; emissive?: string; glow?: number; opacity?: number; side?: "double" };
const mats = new Map<string, MeshStandardMaterial>();

export function mat(color: string, o: MatOpts = {}): MeshStandardMaterial {
  const key = `${color}|${o.rough ?? 0.75}|${o.metal ?? 0}|${o.emissive ?? ""}|${o.glow ?? 0}|${o.opacity ?? 1}|${o.side ?? ""}`;
  let m = mats.get(key);
  if (!m) {
    m = new MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.75,
      metalness: o.metal ?? 0,
      emissive: o.emissive ?? "#000000",
      emissiveIntensity: o.glow ?? 0,
      transparent: (o.opacity ?? 1) < 1,
      opacity: o.opacity ?? 1,
      ...(o.side === "double" ? { side: DoubleSide } : {}),
    });
    mats.set(key, m);
  }
  return m;
}

/** Studio palette for set and equipment; people have their own wardrobe. */
export const C = {
  floor: "#0d0e12",
  slate: "#161a22",
  slateLight: "#1e2430",
  fabric: "#2a3446",
  fabricLight: "#344158",
  wood: "#6b4f3a",
  metal: "#9aa0aa",
  metalDark: "#3a3f47",
  rubber: "#111215",
  camBody: "#2a2d33",
  camDark: "#16181c",
  accent: "#7c9cff",
  tally: "#ff453a",
  pvw: "#30d158",
} as const;
