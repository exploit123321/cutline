import { useFrame } from "@react-three/fiber";
import { memo, useRef } from "react";
import type { Group, Mesh } from "three";
import { DEG } from "../../../geometry";
import type { Person } from "../../../model/types";
import { personAt } from "../../../show";
import { useStore } from "../../../state/store";
import { performanceOf } from "../showState";
import { capsule, lathe, mat, sphere, unitBox } from "./shared";

/*
 * A jointed studio figure: pelvis → torso → neck → head, two arms with elbows, and legs
 * posed seated or standing. Built facing -z at the seated eye height of 1.2 m (standing
 * 1.65 m), then scaled to the person's eyeHeight. Every joint is set each frame from
 * personAt(t), so the pose depends only on the playhead.
 */

type Wardrobe = { jacket: string; shirt: string; trousers: string; skin: string; hair: string; style: "short" | "long" | "bun" };

const WARDROBE: Wardrobe[] = [
  { jacket: "#1f2a44", shirt: "#e8e4dc", trousers: "#16181e", skin: "#e0b49a", hair: "#4a2f1f", style: "long" },
  { jacket: "#454a52", shirt: "#9fb4c8", trousers: "#1b1d22", skin: "#d9a988", hair: "#241c17", style: "short" },
  { jacket: "#6e2a35", shirt: "#f1e9df", trousers: "#1a1a1f", skin: "#efc4a8", hair: "#a4794b", style: "bun" },
];
const SHOE = "#121317";
const DARK = "#1a1214";

// torso turned on a lathe, then flattened front to back
const TORSO: [number, number][] = [
  [0.001, -0.02], [0.15, 0], [0.16, 0.12], [0.155, 0.25], [0.175, 0.4], [0.19, 0.49], [0.13, 0.55], [0.055, 0.58], [0.001, 0.585],
];

type Props = { person: Person; index: number; seed?: number };

export const Human = memo(function Human({ person, index }: Props) {
  const w = WARDROBE[index % WARDROBE.length] as Wardrobe;
  const seated = person.eyeHeight < 1.45;
  const k = person.eyeHeight / (seated ? 1.2 : 1.65);
  const pelvisY = seated ? 0.47 : 0.92;

  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const mouth = useRef<Mesh>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const foreL = useRef<Group>(null);
  const foreR = useRef<Group>(null);

  useFrame(() => {
    const { plan, studio, time: t } = useStore.getState();
    const s = personAt(performanceOf(plan, studio), person, t);
    const seed = index * 1.7;
    // gaze relative to the body, split between torso and head, limited like a real neck
    const rel = ((((s.gaze.yaw - person.facingYaw) % 360) + 540) % 360) - 180;
    const yaw = Math.max(-80, Math.min(80, rel)) * DEG;
    const laugh = s.act === "laugh" ? Math.sin(s.phase * Math.PI) : 0;
    const nod = s.act === "nod" ? Math.max(0, Math.sin(s.phase * Math.PI * 4)) : 0;
    const talk = s.talking ? 1 : 0;
    const breathe = Math.sin(t * 1.6 + seed);

    if (torso.current) {
      torso.current.rotation.set((seated ? 0.12 : 0.02) + laugh * 0.16, yaw * 0.3, 0);
      torso.current.position.y = pelvisY + breathe * 0.003 + (laugh ? Math.sin(t * 34) * 0.006 * laugh : 0);
    }
    if (head.current) {
      const bob = talk * Math.sin(t * 5.3 + seed) * 0.05;
      head.current.rotation.set(s.gaze.pitch * DEG - 0.12 + bob + laugh * 0.28 - nod * 0.3, yaw * 0.7, talk * Math.sin(t * 2.1 + seed) * 0.05);
    }
    if (mouth.current) {
      const open = talk ? 0.3 + 0.7 * Math.abs(Math.sin(t * 13 + seed) * Math.sin(t * 4.7)) : laugh * 0.8;
      mouth.current.scale.set(0.034, 0.004 + 0.016 * open, 0.01);
    }
    // talking hands: the right hand gestures, the left answers a little
    const g = talk * (0.5 + 0.5 * Math.sin(t * 2.3 + seed));
    if (armR.current) armR.current.rotation.set(0.3 + g * 0.35 * Math.sin(t * 3.1 + seed), 0, -0.12);
    if (foreR.current) foreR.current.rotation.set(seated ? 1.25 + g * 0.45 * Math.sin(t * 4.3) : 0.25 + g * 1.1, 0, 0);
    if (armL.current) armL.current.rotation.set(0.3 + g * 0.12 * Math.sin(t * 2.7), 0, 0.12);
    if (foreL.current) foreL.current.rotation.set(seated ? 1.3 + g * 0.18 * Math.sin(t * 3.7 + 1) : 0.2, 0, 0);
  });

  const jacket = mat(w.jacket, { rough: 0.85 });
  const skin = mat(w.skin, { rough: 0.6 });
  const hair = mat(w.hair, { rough: 0.9 });
  const trousers = mat(w.trousers, { rough: 0.85 });
  const shoes = mat(SHOE, { rough: 0.4, metal: 0.1 });

  const arm = (side: 1 | -1, armRef: typeof armL, foreRef: typeof foreL) => (
    <group ref={armRef} position={[0.2 * side, 0.5, 0.01]}>
      <mesh geometry={sphere()} material={jacket} scale={0.06} castShadow />
      <mesh geometry={capsule(0.048, 0.2)} material={jacket} position={[0, -0.14, 0]} castShadow />
      <group ref={foreRef} position={[0, -0.27, 0]}>
        <mesh geometry={capsule(0.042, 0.18)} material={jacket} position={[0, -0.12, 0]} castShadow />
        <mesh geometry={sphere()} material={skin} position={[0, -0.25, -0.005]} scale={[0.038, 0.05, 0.03]} castShadow />
      </group>
    </group>
  );

  const leg = (side: 1 | -1) =>
    seated ? (
      <group key={side}>
        <mesh geometry={capsule(0.075, 0.3)} material={trousers} position={[0.1 * side, 0.47, -0.19]} rotation={[Math.PI / 2, 0, 0]} castShadow />
        <mesh geometry={capsule(0.055, 0.3)} material={trousers} position={[0.1 * side, 0.27, -0.42]} rotation={[-0.1, 0, 0]} castShadow />
        <mesh geometry={unitBox()} material={shoes} position={[0.1 * side, 0.04, -0.48]} scale={[0.1, 0.08, 0.26]} castShadow />
      </group>
    ) : (
      <group key={side}>
        <mesh geometry={capsule(0.075, 0.34)} material={trousers} position={[0.1 * side, 0.7, 0]} castShadow />
        <mesh geometry={capsule(0.058, 0.36)} material={trousers} position={[0.1 * side, 0.3, 0]} castShadow />
        <mesh geometry={unitBox()} material={shoes} position={[0.1 * side, 0.04, -0.05]} scale={[0.1, 0.08, 0.26]} castShadow />
      </group>
    );

  return (
    <group position={[person.position.x, person.position.y, person.position.z]} rotation={[0, person.facingYaw * DEG, 0]} scale={k}>
      {leg(1)}
      {leg(-1)}
      <group ref={torso} position={[0, pelvisY, 0.06]}>
        <mesh geometry={lathe("torso", TORSO)} material={jacket} scale={[1, 1, 0.62]} castShadow />
        {/* shirt front and collar */}
        <mesh geometry={unitBox()} material={mat(w.shirt, { rough: 0.7 })} position={[0, 0.5, -0.1]} rotation={[0.25, 0, 0]} scale={[0.075, 0.13, 0.01]} />
        {arm(1, armR, foreR)}
        {arm(-1, armL, foreL)}
        <group position={[0, 0.575, 0]}>
          <mesh geometry={capsule(0.045, 0.05)} material={skin} position={[0, 0.03, 0]} />
          <group ref={head} position={[0, 0.07, 0]}>
            <mesh geometry={sphere()} material={skin} position={[0, 0.1, 0]} scale={[0.093, 0.115, 0.104]} castShadow />
            {/* hair */}
            <mesh geometry={sphere()} material={hair} position={[0, 0.135, 0.014]} scale={[0.099, 0.1, 0.104]} castShadow />
            {w.style === "long" && <mesh geometry={capsule(0.085, 0.14)} material={hair} position={[0, 0.06, 0.05]} scale={[1.08, 1, 0.6]} />}
            {w.style === "bun" && <mesh geometry={sphere()} material={hair} position={[0, 0.17, 0.1]} scale={0.045} />}
            {/* face: eyes, brows, nose, mouth, ears */}
            {[-1, 1].map((s) => (
              <group key={s}>
                <mesh geometry={sphere()} material={mat(DARK, { rough: 0.3 })} position={[0.034 * s, 0.105, -0.093]} scale={0.011} />
                <mesh geometry={unitBox()} material={hair} position={[0.034 * s, 0.128, -0.095]} rotation={[0, 0, -0.12 * s]} scale={[0.028, 0.006, 0.006]} />
                <mesh geometry={sphere()} material={skin} position={[0.092 * s, 0.095, 0.005]} scale={[0.014, 0.026, 0.02]} />
              </group>
            ))}
            <mesh geometry={sphere()} material={skin} position={[0, 0.082, -0.106]} scale={[0.015, 0.022, 0.018]} />
            <mesh ref={mouth} geometry={unitBox()} material={mat("#5a2a2a", { rough: 0.5 })} position={[0, 0.045, -0.095]} scale={[0.034, 0.005, 0.01]} />
          </group>
        </group>
      </group>
    </group>
  );
});
