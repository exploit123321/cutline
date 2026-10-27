import { Line } from "@react-three/drei";
import type { Camera, Person, Vec3 } from "../../model/types";
import { DEG, add, forward, headPosition, scale, toRad, v } from "../../geometry";
import { ASPECT } from "../../model/constants";
import type { CamState } from "../../show";
import { Label } from "./Label";
import { BroadcastCamera } from "./models/BroadcastCamera";
import { C, cylinder, mat, torus } from "./models/shared";

export const TALLY = C.tally;
export const PVW = C.pvw;
export const ACCENT = C.accent;

type PersonProps = {
  person: Person;
  talking?: boolean;
  inShot?: boolean;
  labelHeight?: number;
  onPointerDown?: () => void;
};

/**
 * Overview extras for a person: a name label, a pick target for dragging, and a floor
 * ring that lights while they talk. The figure itself is the shared <Human>.
 */
export function PersonMarker({ person, talking, inShot, labelHeight, onPointerDown }: PersonProps) {
  const { x, y, z } = person.position;
  const first = person.name.split(" ")[0] ?? person.name;
  return (
    <group position={[x, y, z]}>
      {/* invisible, generous pick volume around the seated figure */}
      <mesh
        geometry={cylinder(0.42, 0.42, person.eyeHeight + 0.2)}
        position={[0, person.eyeHeight / 2, 0]}
        visible={false}
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDown?.();
        }}
      />
      <mesh
        geometry={torus(0.5, talking ? 0.018 : 0.008)}
        material={mat(talking ? ACCENT : inShot ? "#c8cdd8" : "#3a3f4a", { emissive: talking ? ACCENT : "#000000", glow: talking ? 2 : 0 })}
        position={[0, 0.02, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <Label
        text={talking ? `● ${first}` : first}
        position={[0, person.eyeHeight + 0.42, 0]}
        color={talking ? "#ffffff" : "#ececf2"}
        background={talking ? "rgba(91,124,250,0.92)" : "rgba(11,11,14,0.82)"}
        height={labelHeight}
      />
    </group>
  );
}

/** Frustum corners at `dist` metres for a 16:9 frame. */
export function frustumCorners(origin: Vec3, yaw: number, pitch: number, fov: number, dist: number): Vec3[] {
  const f = forward(yaw, pitch);
  const right = v(Math.cos(toRad(yaw)), 0, -Math.sin(toRad(yaw)));
  // up = right × forward
  const up = v(right.y * f.z - right.z * f.y, right.z * f.x - right.x * f.z, right.x * f.y - right.y * f.x);
  const halfH = Math.tan((fov * DEG) / 2) * dist;
  const halfW = halfH * ASPECT;
  const centre = add(origin, scale(f, dist));
  return [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ].map(([sx, sy]) => add(add(centre, scale(right, (sx as number) * halfW)), scale(up, (sy as number) * halfH)));
}

type CameraProps = {
  camera: Camera;
  state: CamState;
  labelHeight?: number;
  onPointerDown?: () => void;
};

const STATUS = {
  pgm: { colour: TALLY, label: "rgba(255,69,58,0.94)", dist: 4.4, width: 1.8, opacity: 0.95 },
  pvw: { colour: PVW, label: "rgba(48,209,88,0.9)", dist: 3.2, width: 1.3, opacity: 0.8 },
  idle: { colour: "#8a90a0", label: "rgba(11,11,14,0.82)", dist: 2.0, width: 1, opacity: 0.35 },
} as const;

/** Overview camera: the body on its pedestal, the live frustum, and a label in tally colour. */
export function CameraRig({ camera, state, labelHeight, onPointerDown }: CameraProps) {
  const p = camera.position;
  const look = STATUS[state.status];
  const corners = frustumCorners(p, state.aim.yaw, state.aim.pitch, state.fov, look.dist);
  const tup = (q: Vec3): [number, number, number] => [q.x, q.y, q.z];
  const lines: [number, number, number][][] = [...corners.map((c) => [tup(p), tup(c)]), [...corners.map(tup), tup(corners[0] as Vec3)]];
  const tag = state.status === "pgm" ? `${camera.label} · ON AIR` : state.status === "pvw" ? `${camera.label} · NEXT` : camera.label;
  return (
    <group>
      <group
        position={[p.x, 0, p.z]}
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDown?.();
        }}
      >
        <BroadcastCamera height={p.y} yaw={state.aim.yaw} pitch={state.aim.pitch} status={state.status} fixed={camera.fixed} />
      </group>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color={look.colour} lineWidth={look.width} transparent opacity={look.opacity} />
      ))}
      <Label text={tag} position={[p.x, p.y + 0.62, p.z]} color="#ffffff" background={look.label} height={labelHeight} />
    </group>
  );
}

/** The active 180° line: a dashed floor line through the two people, extended past both. */
export function ActionLine({ a, b }: { a: Person; b: Person }) {
  const pa = headPosition(a);
  const pb = headPosition(b);
  const d = v(pb.x - pa.x, 0, pb.z - pa.z);
  const len = Math.hypot(d.x, d.z) || 1;
  const ext = scale(v(d.x / len, 0, d.z / len), 2.2);
  const y = 0.05;
  return (
    <Line
      points={[
        [pa.x - ext.x, y, pa.z - ext.z],
        [pb.x + ext.x, y, pb.z + ext.z],
      ]}
      color="#f2b84b"
      lineWidth={2.6}
      dashed
      dashSize={0.18}
      gapSize={0.12}
      transparent
      opacity={0.95}
    />
  );
}
