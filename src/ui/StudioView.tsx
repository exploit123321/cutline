import { OrbitControls, PerspectiveCamera, View } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { aimAt, centroid, headPosition } from "../geometry";
import { blockAt, useStore } from "../state/store";
import { StudioSet } from "./scene/StudioSet";
import { CameraRig, PersonMarker } from "./scene/markers";

/** 3D overview: people, cameras and frustums. Drag a person or camera to move it; the engine re-runs live. */
export function StudioView() {
  const studio = useStore((s) => s.studio);
  const plan = useStore((s) => s.plan);
  const time = useStore((s) => s.time);
  const drag = useStore((s) => s.drag);
  const setDrag = useStore((s) => s.setDrag);
  const move = useStore((s) => s.move);
  const block = blockAt(plan, time);
  const setCentre = centroid(studio.people.map(headPosition));

  const onFloorMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag) return;
    e.stopPropagation();
    move(drag.kind, drag.id, Math.round(e.point.x * 20) / 20, Math.round(e.point.z * 20) / 20);
  };

  return (
    <View className="absolute inset-0">
      <PerspectiveCamera makeDefault position={[1.5, 7.5, 11]} fov={38} />
      <OrbitControls makeDefault enabled={!drag} target={[0, 0.4, 0.6]} maxPolarAngle={Math.PI / 2.05} />
      <StudioSet studio={studio} />
      {/* invisible drag plane; only listens while something is being dragged */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        visible={false}
        onPointerMove={onFloorMove}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
      >
        <planeGeometry args={[40, 40]} />
      </mesh>
      {studio.people.map((p) => (
        <PersonMarker
          key={p.id}
          person={p}
          highlight={block?.subjectIds.includes(p.id) && block.subjectIds.length < studio.people.length}
          onPointerDown={() => setDrag({ kind: "person", id: p.id })}
        />
      ))}
      {studio.cameras.map((c) => {
        const live = block?.cameraId === c.id;
        // idle operated cameras are drawn resting on the middle of the set
        const aim = live && block ? block.aim : aimAt(c, setCentre);
        const fov = live && block ? block.fov : (c.fovRange[0] + c.fovRange[1]) / 2;
        return (
          <CameraRig
            key={c.id}
            camera={c}
            yaw={aim.yaw}
            pitch={aim.pitch}
            fov={fov}
            active={live}
            onPointerDown={() => setDrag({ kind: "camera", id: c.id })}
          />
        );
      })}
    </View>
  );
}
