import { RoundedBox } from "@react-three/drei";
import { memo } from "react";
import { DEG } from "../../../geometry";
import type { CamStatus } from "../../../show";
import { C, capsule, cylinder, mat, sphere, torus, unitBox } from "./shared";

type Props = {
  /** lens centre height in metres (the camera's y) */
  height: number;
  yaw: number;
  pitch: number;
  status: CamStatus;
  /** fixed cameras sit on a tripod; operated ones on a pedestal with a steering ring */
  fixed: boolean;
};

const LIGHT = { pgm: C.tally, pvw: C.pvw, idle: "#2b1d1d" } as const;

/**
 * Studio camera: pedestal (or tripod), pan/tilt head, body, box lens with hood,
 * viewfinder, pan bars and tally lamps. Faces -z at yaw 0 like everything else.
 */
export const BroadcastCamera = memo(function BroadcastCamera({ height, yaw, pitch, status, fixed }: Props) {
  const pivot = height - 0.12;
  const body = mat(C.camBody, { rough: 0.55, metal: 0.25 });
  const dark = mat(C.camDark, { rough: 0.45, metal: 0.3 });
  const metal = mat(C.metal, { rough: 0.35, metal: 0.8 });
  const metalDark = mat(C.metalDark, { rough: 0.5, metal: 0.6 });
  const tally = mat(LIGHT[status], { emissive: LIGHT[status], glow: status === "idle" ? 0 : 3.2, rough: 0.3 });

  return (
    <group>
      {fixed ? (
        // tripod: three splayed legs and a spreader
        <group>
          {[0, 120, 240].map((a) => (
            <group key={a} rotation={[0, a * DEG, 0]}>
              <mesh geometry={cylinder(0.018, 0.014, pivot * 1.04)} material={metalDark} position={[0, pivot / 2, 0.2]} rotation={[-0.26, 0, 0]} castShadow />
              <mesh geometry={unitBox()} material={metalDark} position={[0, 0.12, 0.18]} scale={[0.02, 0.02, 0.34]} />
            </group>
          ))}
        </group>
      ) : (
        // pedestal: skirted base on three wheels, two-stage column, steering ring
        <group>
          <mesh geometry={cylinder(0.2, 0.24, 0.14, 36)} material={dark} position={[0, 0.11, 0]} castShadow receiveShadow />
          {[0, 120, 240].map((a) => (
            <group key={a} rotation={[0, a * DEG, 0]}>
              <mesh geometry={unitBox()} material={dark} position={[0, 0.07, 0.3]} scale={[0.08, 0.06, 0.32]} castShadow />
              <mesh geometry={cylinder(0.045, 0.045, 0.04, 20)} material={mat(C.rubber, { rough: 0.9 })} position={[0, 0.045, 0.44]} rotation={[0, 0, Math.PI / 2]} />
            </group>
          ))}
          <mesh geometry={cylinder(0.075, 0.08, 0.6)} material={metalDark} position={[0, 0.48, 0]} castShadow />
          <mesh geometry={cylinder(0.058, 0.058, Math.max(pivot - 0.8, 0.1))} material={metal} position={[0, 0.78 + Math.max(pivot - 0.8, 0.1) / 2, 0]} castShadow />
          <mesh geometry={torus(0.3, 0.014)} material={metal} position={[0, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />
          {[30, 150, 270].map((a) => (
            <mesh key={a} geometry={cylinder(0.008, 0.008, 0.24)} material={metal} position={[Math.sin(a * DEG) * 0.18, 0.82, Math.cos(a * DEG) * 0.18]} rotation={[Math.PI / 2, 0, -a * DEG]} />
          ))}
        </group>
      )}
      {/* pan/tilt head */}
      <mesh geometry={cylinder(0.075, 0.085, 0.07)} material={dark} position={[0, pivot - 0.06, 0]} />
      <group position={[0, pivot, 0]} rotation={[0, yaw * DEG, 0]}>
        <mesh geometry={unitBox()} material={dark} position={[0, -0.01, 0.02]} scale={[0.17, 0.04, 0.2]} />
        <group rotation={[pitch * DEG, 0, 0]}>
          <RoundedBox args={[0.2, 0.24, 0.44]} radius={0.025} smoothness={3} position={[0, 0.12, 0.09]} material={body} castShadow />
          {/* side panel stripe */}
          <mesh geometry={unitBox()} material={mat(C.accent, { emissive: C.accent, glow: 0.4 })} position={[0.101, 0.07, 0.12]} scale={[0.002, 0.012, 0.22]} />
          {/* box lens: barrel, zoom ring, front glass, hood */}
          <mesh geometry={cylinder(0.068, 0.07, 0.3, 32)} material={dark} position={[0, 0.12, -0.27]} rotation={[Math.PI / 2, 0, 0]} castShadow />
          <mesh geometry={cylinder(0.074, 0.074, 0.05, 32)} material={metalDark} position={[0, 0.12, -0.2]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={cylinder(0.058, 0.058, 0.004, 32)} material={mat("#0e1a2e", { rough: 0.05, metal: 0.9 })} position={[0, 0.12, -0.421]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={cylinder(0.095, 0.075, 0.09, 4, true)} material={mat(C.camDark, { rough: 0.6, side: "double" })} position={[0, 0.12, -0.465]} rotation={[Math.PI / 2, Math.PI / 4, 0]} />
          {/* viewfinder with its screen facing the operator */}
          <RoundedBox args={[0.17, 0.12, 0.14]} radius={0.015} smoothness={2} position={[-0.015, 0.31, 0.2]} material={body} castShadow />
          <mesh geometry={unitBox()} material={mat("#22324a", { emissive: "#3a5680", glow: 0.6 })} position={[-0.015, 0.31, 0.271]} scale={[0.13, 0.085, 0.002]} />
          {/* tally lamps: front of body, top of viewfinder */}
          <mesh geometry={unitBox()} material={tally} position={[0, 0.245, -0.11]} scale={[0.06, 0.016, 0.02]} />
          <mesh geometry={sphere()} material={tally} position={[-0.015, 0.378, 0.2]} scale={[0.022, 0.012, 0.022]} />
          {/* pan bars with grips */}
          {[-1, 1].map((s) => (
            <group key={s} position={[0.11 * s, 0.05, 0.28]} rotation={[-0.42, 0.12 * s, 0]}>
              <mesh geometry={cylinder(0.011, 0.011, 0.5)} material={metal} position={[0, 0, 0.25]} rotation={[Math.PI / 2, 0, 0]} />
              <mesh geometry={capsule(0.019, 0.08)} material={mat(C.rubber, { rough: 0.9 })} position={[0, 0, 0.48]} rotation={[Math.PI / 2, 0, 0]} />
            </group>
          ))}
        </group>
      </group>
    </group>
  );
});
