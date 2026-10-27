import type { Studio } from "../../model/types";
import { PresetModel } from "./PresetModel";

/** Floor, lights and set dressing. Rendered in both the overview and the program view. */
export function StudioSet({ studio }: { studio: Studio }) {
  return (
    <>
      <color attach="background" args={["#0b0d11"]} />
      <hemisphereLight args={["#d6dee8", "#2a2e35", 1.1]} />
      <directionalLight position={[3, 6, 5]} intensity={2.2} />
      <directionalLight position={[-4, 4, 3]} intensity={0.6} color="#9fb4ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#14171c" roughness={1} />
      </mesh>
      {studio.props.map((p, i) => (
        <PresetModel key={i} preset={p.preset} position={p.position} yaw={p.yaw} />
      ))}
    </>
  );
}
