import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Component, memo, Suspense, useMemo, type ReactNode } from "react";
import type { Mesh, MeshStandardMaterial } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { DEG } from "../../../geometry";
import type { Person } from "../../../model/types";
import { personAt } from "../../../show";
import { useStore } from "../../../state/store";
import { performanceOf } from "../showState";
import { Human } from "./Human";
import { SeatedRig } from "./rig";

/*
 * Realistic people: the author's own Meshy AI models, rigged with a Mixamo skeleton,
 * made web-sized by scripts/prepare_people.py. Each view gets its own skinned clone;
 * geometry and textures are shared.
 */

const BASE = `${import.meta.env.BASE_URL}models/people/`;
const BY_ID: Record<string, string> = {
  anna: `${BASE}woman_green_sweater.glb`,
  martins: `${BASE}man_knit_sweater.glb`,
  laura: `${BASE}woman_camel_coat.glb`,
};
const BY_INDEX = [BY_ID.anna, BY_ID.martins, BY_ID.laura] as string[];

/** Studios other than the sample get the same three models in turn. */
export function modelFor(person: Person, index: number): string {
  return BY_ID[person.id] ?? (BY_INDEX[index % BY_INDEX.length] as string);
}

for (const url of BY_INDEX) useGLTF.preload(url);

const Seated = memo(function Seated({ person, url, index }: { person: Person; url: string; index: number }) {
  const gltf = useGLTF(url);
  const { scene, rig, turn } = useMemo(() => {
    const scene = cloneSkinned(gltf.scene);
    scene.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // the bounding sphere is from the standing bind pose; seated, parts would be culled
      mesh.frustumCulled = false;
      const m = mesh.material as MeshStandardMaterial;
      m.envMapIntensity = 0.6;
    });
    const rig = new SeatedRig(scene);
    return { scene, rig, turn: rig.facingRotation() };
  }, [gltf.scene]);

  useFrame(() => {
    const { plan, studio, time: t } = useStore.getState();
    const s = personAt(performanceOf(plan, studio), person, t);
    const rel = ((((s.gaze.yaw - person.facingYaw) % 360) + 540) % 360) - 180;
    rig.pose({
      yaw: rel,
      pitch: s.gaze.pitch,
      talk: s.talking ? 1 : 0,
      laugh: s.act === "laugh" ? Math.sin(s.phase * Math.PI) : 0,
      nod: s.act === "nod" ? Math.max(0, Math.sin(s.phase * Math.PI * 4)) : 0,
      t,
      seed: index * 1.7,
    });
  });

  return (
    <group position={[person.position.x, person.position.y, person.position.z]} rotation={[0, person.facingYaw * DEG, 0]}>
      <primitive object={scene} rotation-y={turn} />
    </group>
  );
});

/** A model that fails to load falls back to the built figure instead of breaking the view. */
class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** A seated, realistic person; the built figure shows while the model loads. */
export function RealPerson({ person, index }: { person: Person; index: number }) {
  // the rig seats people; a standing person keeps the built figure
  if (person.eyeHeight >= 1.45) return <Human person={person} index={index} />;
  const fallback = <Human person={person} index={index} />;
  return (
    <Fallback fallback={fallback}>
      <Suspense fallback={fallback}>
        <Seated person={person} url={modelFor(person, index)} index={index} />
      </Suspense>
    </Fallback>
  );
}
