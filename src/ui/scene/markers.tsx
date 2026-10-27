import { Line } from "@react-three/drei";
import type { Camera, Person, Vec3 } from "../../model/types";
import { DEG, add, forward, scale, toRad, v } from "../../geometry";
import { ASPECT } from "../../model/constants";
import { Label } from "./Label";
import { PresetModel } from "./PresetModel";

export const ACCENT = "#ff3b30";

type PersonProps = {
  person: Person;
  highlight?: boolean;
  onPointerDown?: () => void;
};

/** Overview marker: a capsule at eye height with a name label and a facing tick. */
export function PersonMarker({ person, highlight, onPointerDown }: PersonProps) {
  const { x, y, z } = person.position;
  const h = person.eyeHeight;
  const radius = 0.18;
  const nose = add(v(0, h, 0), scale(forward(person.facingYaw), 0.32));
  const first = person.name.split(" ")[0] ?? person.name;
  return (
    <group position={[x, y, z]}>
      <mesh
        position={[0, h / 2 + 0.05, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDown?.();
        }}
      >
        <capsuleGeometry args={[radius, Math.max(h - 2 * radius, 0.1), 6, 16]} />
        <meshStandardMaterial color={highlight ? "#f0f3f6" : "#8796a8"} roughness={0.6} />
      </mesh>
      <Line points={[[0, h, 0], [nose.x, nose.y, nose.z]]} color={highlight ? ACCENT : "#e2e7ec"} lineWidth={2} />
      <Label text={first} position={[0, h + 0.42, 0]} color={highlight ? "#ffffff" : "#e2e7ec"} />
    </group>
  );
}

/** Program-view stand-in: a seated or standing figure that matches the eye height. */
export function PersonFigure({ person }: { person: Person }) {
  const preset = person.eyeHeight > 1.45 ? "standingFigure" : "seatedFigure";
  return <PresetModel preset={preset} position={person.position} yaw={person.facingYaw} />;
}

type CameraProps = {
  camera: Camera;
  yaw: number;
  pitch: number;
  fov: number;
  active?: boolean;
  onPointerDown?: () => void;
};

/** Frustum corners at `dist` metres for a 16:9 frame. */
export function frustumCorners(origin: Vec3, yaw: number, pitch: number, fov: number, dist: number): Vec3[] {
  const f = forward(yaw, pitch);
  const right = v(Math.cos(toRad(yaw)), 0, -Math.sin(toRad(yaw)));
  // up = right × forward
  const up = v(
    right.y * f.z - right.z * f.y,
    right.z * f.x - right.x * f.z,
    right.x * f.y - right.y * f.x,
  );
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

export function CameraRig({ camera, yaw, pitch, fov, active, onPointerDown }: CameraProps) {
  const p = camera.position;
  const colour = active ? ACCENT : "#7f8c9a";
  const corners = frustumCorners(p, yaw, pitch, fov, active ? 4.2 : 2.2);
  const tup = (q: Vec3): [number, number, number] => [q.x, q.y, q.z];
  const lines: [number, number, number][][] = [
    ...corners.map((c) => [tup(p), tup(c)]),
    [...corners.map(tup), tup(corners[0] as Vec3)],
  ];
  // the pedestal preset has its lens at 1.4 m; lift it so the lens sits at the camera height
  const lift = p.y - 1.4;
  return (
    <group>
      <group
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDown?.();
        }}
      >
        <PresetModel
          preset="pedestalCamera"
          position={{ x: p.x, y: Math.max(lift, 0), z: p.z }}
          yaw={yaw}
          tint={active ? "#5a2522" : undefined}
        />
      </group>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color={colour} lineWidth={active ? 1.6 : 1} transparent opacity={active ? 0.95 : 0.45} />
      ))}
      <Label
        text={camera.label}
        position={[p.x, Math.max(lift, 0) + 1.95, p.z]}
        color={active ? "#ffffff" : "#bcc6d0"}
        background={active ? "rgba(255,59,48,0.92)" : "rgba(10,12,16,0.82)"}
      />
    </group>
  );
}
