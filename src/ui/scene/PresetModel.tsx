import { memo } from "react";
import { buildMetric } from "../../models/adapter";
import { PRESETS } from "../../models/presets";
import type { Vec3 } from "../../model/types";
import { DEG } from "../../geometry";

type Props = {
  preset: string;
  position: Vec3;
  yaw: number;
  tint?: string;
};

/** Renders a preset's part list. Yaw follows the studio convention (three.js rotation.y). */
export const PresetModel = memo(function PresetModel({ preset, position, yaw, tint }: Props) {
  const def = PRESETS[preset];
  if (!def) return null;
  const parts = buildMetric(def);
  return (
    <group position={[position.x, position.y, position.z]} rotation={[0, yaw * DEG, 0]}>
      {parts.map((p, i) => (
        <mesh key={i} position={p.position} rotation={p.rotation} scale={p.size}>
          {p.kind === "box" && <boxGeometry args={[1, 1, 1]} />}
          {p.kind === "cyl" && <cylinderGeometry args={[0.5, 0.5, 1, 20]} />}
          {p.kind === "sphere" && <sphereGeometry args={[0.5, 20, 14]} />}
          <meshStandardMaterial color={tint ?? p.color} roughness={0.8} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
});
