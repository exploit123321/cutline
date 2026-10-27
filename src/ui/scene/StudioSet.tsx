import { Environment } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { memo, useMemo } from "react";
import type { Studio } from "../../model/types";
import { camerasAt } from "../../show";
import { useStore } from "../../state/store";
import { BroadcastCamera } from "./models/BroadcastCamera";
import { RealPerson } from "./models/RealPerson";
import { DETAILED, LightRig, Room } from "./models/SetPieces";
import { PresetModel } from "./PresetModel";
import { DEG } from "../../geometry";
import { studioEnv } from "./studioEnv";

type SetProps = {
  studio: Studio;
  /** shadow maps cost one extra render per view, so only the big views ask for them */
  shadows?: boolean;
};

/**
 * Floor, lights and set dressing. Mounted once per view (overview, program, each camera).
 * Memoised: the views re-render every frame for their camera, the set does not change.
 */
export const StudioSet = memo(function StudioSet({ studio, shadows = false }: SetProps) {
  const gl = useThree((s) => s.gl);
  const env = useMemo(() => studioEnv(gl), [gl]);
  return (
    <>
      <color attach="background" args={["#08090c"]} />
      <fog attach="fog" args={["#08090c", 20, 48]} />
      {/* soft reflections for metal and glass; one shared map, no HDR download */}
      <Environment map={env} environmentIntensity={0.35} />
      <hemisphereLight args={["#c9d4e6", "#1a1d24", 0.55]} />
      {/* key from front right, fill from front left, warm back light for rim */}
      <directionalLight
        position={[3.5, 6.5, 6]}
        intensity={2.4}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <directionalLight position={[-5, 4, 5]} intensity={0.7} color="#a9bcff" />
      <directionalLight position={[0, 5, -6]} intensity={1.3} color="#ffd2a6" />
      <Room />
      {studio.props.map((p, i) => {
        const Detailed = DETAILED[p.preset];
        return Detailed ? (
          <group key={i} position={[p.position.x, p.position.y, p.position.z]} rotation={[0, p.yaw * DEG, 0]}>
            <Detailed />
          </group>
        ) : (
          <PresetModel key={i} preset={p.preset} position={p.position} yaw={p.yaw} />
        );
      })}
      <LightRig />
    </>
  );
});

export const People = memo(function People({ studio }: { studio: Studio }) {
  return (
    <>
      {studio.people.map((p, i) => (
        <RealPerson key={p.id} person={p} index={i} />
      ))}
    </>
  );
});

/** Camera bodies as other cameras see them, panning and lit by tally like in the overview. */
export function CameraModels({ studio, except }: { studio: Studio; except?: string }) {
  const plan = useStore((s) => s.plan);
  const time = useStore((s) => s.time);
  const cams = camerasAt(plan, studio, time);
  return (
    <>
      {studio.cameras
        .filter((c) => c.id !== except)
        .map((c) => {
          const s = cams.states[c.id];
          return (
            <group key={c.id} position={[c.position.x, 0, c.position.z]}>
              <BroadcastCamera height={c.position.y} yaw={s?.aim.yaw ?? c.yaw} pitch={s?.aim.pitch ?? c.pitch} status={s?.status ?? "idle"} fixed={c.fixed} />
            </group>
          );
        })}
    </>
  );
}
