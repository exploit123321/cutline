import { PerspectiveCamera, View } from "@react-three/drei";
import type { CSSProperties } from "react";
import { DEG } from "../geometry";
import { camerasAt } from "../show";
import { useStore } from "../state/store";
import { CameraModels, People, StudioSet } from "./scene/StudioSet";

type Props = { cameraId: string; shadows?: boolean; className?: string; style?: CSSProperties };

/**
 * What one studio camera sees right now: its position, its animated pan, tilt and
 * zoom. The same feed drives the program monitor and the multiview tiles.
 */
export function CameraFeed({ cameraId, shadows = false, className = "absolute inset-0", style }: Props) {
  const studio = useStore((s) => s.studio);
  const plan = useStore((s) => s.plan);
  const time = useStore((s) => s.time);
  const camera = studio.cameras.find((c) => c.id === cameraId);
  const state = camerasAt(plan, studio, time).states[cameraId];
  if (!camera || !state) return null;
  return (
    <View className={className} style={style}>
      {/* Pose is passed as props, not set in an effect: the View mounts its children
          after this component's effects run. three.js cameras look down -z; YXZ applies
          yaw then pitch, matching forward(yaw, pitch). */}
      <PerspectiveCamera
        makeDefault
        near={0.05}
        far={60}
        fov={state.fov}
        position={[camera.position.x, camera.position.y, camera.position.z]}
        rotation={[state.aim.pitch * DEG, state.aim.yaw * DEG, 0]}
        rotation-order="YXZ"
      />
      <StudioSet studio={studio} shadows={shadows} />
      <People studio={studio} />
      <CameraModels studio={studio} except={cameraId} />
    </View>
  );
}
