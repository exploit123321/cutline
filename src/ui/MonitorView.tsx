import { PerspectiveCamera, View } from "@react-three/drei";
import { DEG } from "../geometry";
import { blockAt, rowAt, useStore } from "../state/store";
import { StudioSet } from "./scene/StudioSet";
import { PersonFigure } from "./scene/markers";
import { PresetModel } from "./scene/PresetModel";

/** Program output: what the live camera sees, at its FOV, 16:9. */
export function MonitorView() {
  const studio = useStore((s) => s.studio);
  const plan = useStore((s) => s.plan);
  const time = useStore((s) => s.time);
  const block = blockAt(plan, time);
  const row = rowAt(plan, time);
  const camera = studio.cameras.find((c) => c.id === block?.cameraId);
  const names = block
    ? block.subjectIds.length === studio.people.length && studio.people.length > 1
      ? "Everyone"
      : block.subjectIds.map((id) => studio.people.find((p) => p.id === id)?.name.split(" ")[0]).join(" & ")
    : "";

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-black ring-1 ring-ink-700">
      {block && camera ? (
        <>
          <View className="absolute inset-0">
            {/* Pose is passed as props, not set in an effect: the View mounts its children
                after this component's effects run, so a ref would still be null on the first shot.
                three.js cameras look down -z; YXZ applies yaw then pitch, matching forward(yaw, pitch). */}
            <PerspectiveCamera
              makeDefault
              near={0.05}
              far={60}
              fov={block.fov}
              position={[camera.position.x, camera.position.y, camera.position.z]}
              rotation={[block.aim.pitch * DEG, block.aim.yaw * DEG, 0]}
              rotation-order="YXZ"
            />
            <StudioSet studio={studio} />
            {studio.people.map((p) => (
              <PersonFigure key={p.id} person={p} />
            ))}
            {studio.cameras
              .filter((c) => c.id !== camera.id)
              .map((c) => (
                <PresetModel key={c.id} preset="pedestalCamera" position={{ ...c.position, y: Math.max(c.position.y - 1.4, 0) }} yaw={c.yaw} />
              ))}
          </View>
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2">
            <span className="rounded-sm bg-tally px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-white">PGM</span>
            <span className="font-mono text-[11px] text-white/80 [text-shadow:0_1px_2px_#000]">{time.toFixed(1)} s</span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent px-4 pb-3 pt-8">
            <div className="font-mono text-[13px] font-semibold tracking-wide text-white">
              {camera.label} · {block.shot.toUpperCase()} · {names}
            </div>
            {row?.reason && <div className="mt-0.5 truncate text-[11px] text-white/65">{row.reason}</div>}
          </div>
        </>
      ) : (
        <div className="grid h-full place-items-center text-xs text-ink-500">No program yet</div>
      )}
    </div>
  );
}
