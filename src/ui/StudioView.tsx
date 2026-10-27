import { Grid, OrbitControls, PerspectiveCamera, View } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { camerasAt, exchangeAt, personAt } from "../show";
import { useStore } from "../state/store";
import { People, StudioSet } from "./scene/StudioSet";
import { ActionLine, CameraRig, PersonMarker } from "./scene/markers";
import { performanceOf } from "./scene/showState";

type Props = { shadows?: boolean; className?: string; /** the big Show view: wider framing, smaller labels */ big?: boolean };

/**
 * 3D overview: the set, people, cameras with their live frustums, and the active 180°
 * line. Drag a person or camera to move them; the engine re-runs live.
 */
export function StudioView({ shadows = false, className = "absolute inset-0", big = false }: Props) {
  const studio = useStore((s) => s.studio);
  const plan = useStore((s) => s.plan);
  const time = useStore((s) => s.time);
  const drag = useStore((s) => s.drag);
  const setDrag = useStore((s) => s.setDrag);
  const move = useStore((s) => s.move);
  const cams = camerasAt(plan, studio, time);
  const perf = performanceOf(plan, studio);
  const pair = exchangeAt(perf, time);
  const person = (id: string) => studio.people.find((p) => p.id === id);
  const pa = pair ? person(pair[0]) : undefined;
  const pb = pair ? person(pair[1]) : undefined;

  const onFloorMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag) return;
    e.stopPropagation();
    move(drag.kind, drag.id, Math.round(e.point.x * 20) / 20, Math.round(e.point.z * 20) / 20);
  };

  return (
    <View className={className}>
      <PerspectiveCamera makeDefault position={big ? [0, 8, 15.5] : [2.2, 6.8, 10.5]} fov={36} />
      <OrbitControls makeDefault enabled={!drag} target={big ? [0, 0.3, 1.6] : [0, 0.6, 0.4]} maxPolarAngle={Math.PI / 2.05} minDistance={3} maxDistance={22} />
      <StudioSet studio={studio} shadows={shadows} />
      <Grid
        position={[0, 0.002, 0]}
        args={[30, 30]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#1a1d26"
        sectionSize={2}
        sectionThickness={0.8}
        sectionColor="#232838"
        fadeDistance={22}
        infiniteGrid
      />
      <People studio={studio} />
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
          talking={personAt(perf, p, time).talking}
          inShot={cams.block?.subjectIds.includes(p.id)}
          labelHeight={big ? 0.022 : undefined}
          onPointerDown={() => setDrag({ kind: "person", id: p.id })}
        />
      ))}
      {pa && pb && <ActionLine a={pa} b={pb} />}
      {studio.cameras.map((c) => {
        const state = cams.states[c.id];
        return state ? <CameraRig key={c.id} camera={c} state={state} labelHeight={big ? 0.022 : undefined} onPointerDown={() => setDrag({ kind: "camera", id: c.id })} /> : null;
      })}
    </View>
  );
}
