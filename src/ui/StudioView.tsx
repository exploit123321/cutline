import { OrbitControls, PerspectiveCamera, View } from "@react-three/drei";
import { useStore } from "../state/store";
import { StudioSet } from "./scene/StudioSet";
import { CameraRig, PersonMarker } from "./scene/markers";

/** 3D overview of the studio: people, cameras and their frustums. */
export function StudioView() {
  const studio = useStore((s) => s.studio);
  return (
    <View className="absolute inset-0">
      <PerspectiveCamera makeDefault position={[1.5, 7.5, 11]} fov={38} />
      <OrbitControls makeDefault target={[0, 0.4, 0.6]} maxPolarAngle={Math.PI / 2.05} />
      <StudioSet studio={studio} />
      {studio.people.map((p) => (
        <PersonMarker key={p.id} person={p} />
      ))}
      {studio.cameras.map((c) => (
        <CameraRig key={c.id} camera={c} yaw={c.yaw} pitch={c.pitch} fov={(c.fovRange[0] + c.fovRange[1]) / 2} />
      ))}
    </View>
  );
}
