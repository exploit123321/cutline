import { RoundedBox } from "@react-three/drei";
import { memo, useEffect, useMemo, type JSX } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { DEG } from "../../../geometry";
import { wallAt, type WallContent } from "../../../show";
import { useStore } from "../../../state/store";
import { useCanvasFont } from "../../fonts";
import { C, cylinder, mat, torus, unitBox } from "./shared";

/*
 * Talk-show set pieces in metres, facing -z, standing on y = 0. They replace the
 * part-list presets of the same ids (rug, armchair, coffeeTable, tvScreen, backdrop);
 * the presets stay as the fallback for anything without a detailed model.
 */

export const Armchair = memo(function Armchair() {
  const fabric = mat(C.fabric, { rough: 0.95 });
  const cushion = mat(C.fabricLight, { rough: 0.95 });
  const leg = mat(C.wood, { rough: 0.5 });
  return (
    <group>
      <RoundedBox args={[0.74, 0.2, 0.7]} radius={0.04} smoothness={3} position={[0, 0.21, 0.04]} material={fabric} castShadow receiveShadow />
      <RoundedBox args={[0.56, 0.11, 0.58]} radius={0.045} smoothness={3} position={[0, 0.35, -0.01]} material={cushion} castShadow receiveShadow />
      <RoundedBox args={[0.7, 0.56, 0.15]} radius={0.06} smoothness={3} position={[0, 0.6, 0.33]} rotation={[0.16, 0, 0]} material={fabric} castShadow />
      <RoundedBox args={[0.5, 0.34, 0.1]} radius={0.045} smoothness={3} position={[0, 0.57, 0.25]} rotation={[0.16, 0, 0]} material={cushion} castShadow />
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.11, 0.22, 0.68]} radius={0.04} smoothness={3} position={[0.33 * s, 0.42, 0.04]} material={fabric} castShadow />
      ))}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={cylinder(0.022, 0.015, 0.11, 12)} material={leg} position={[0.31 * (x as number), 0.055, 0.04 + 0.29 * (z as number)]} castShadow />
      ))}
    </group>
  );
});

export const CoffeeTable = memo(function CoffeeTable() {
  const glass = mat("#1c2734", { rough: 0.08, metal: 0.4, opacity: 0.82 });
  const metal = mat(C.metal, { rough: 0.3, metal: 0.85 });
  const cup = mat("#e9e6df", { rough: 0.35 });
  return (
    <group>
      <mesh geometry={cylinder(0.45, 0.45, 0.025, 48)} material={glass} position={[0, 0.41, 0]} castShadow receiveShadow />
      <mesh geometry={torus(0.45, 0.012)} material={metal} position={[0, 0.41, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={cylinder(0.035, 0.05, 0.38, 20)} material={metal} position={[0, 0.2, 0]} castShadow />
      <mesh geometry={cylinder(0.24, 0.26, 0.02, 40)} material={metal} position={[0, 0.01, 0]} receiveShadow />
      {[[-0.18, -0.08], [0.2, 0.12]].map(([x, z], i) => (
        <group key={i} position={[x as number, 0.468, z as number]}>
          <mesh geometry={cylinder(0.037, 0.032, 0.09, 20)} material={cup} castShadow />
          <mesh geometry={torus(0.022, 0.006)} material={cup} position={[0.042, 0, 0]} />
        </group>
      ))}
      <mesh geometry={unitBox()} material={mat("#f3f1ea", { rough: 0.9 })} position={[0.02, 0.425, -0.14]} rotation={[0, 0.3, 0]} scale={[0.21, 0.004, 0.297]} />
    </group>
  );
});

/** Round stage carpet with an LED ring set into the floor. */
export const Rug = memo(function Rug() {
  return (
    <group>
      <mesh geometry={cylinder(2.5, 2.5, 0.012, 96)} material={mat("#151b26", { rough: 0.95 })} position={[0, 0.006, 0]} receiveShadow />
      <mesh geometry={torus(2.38, 0.014)} material={mat(C.accent, { emissive: C.accent, glow: 1.4 })} position={[0, 0.013, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={torus(1.1, 0.006)} material={mat("#2a3550", { emissive: C.accent, glow: 0.25 })} position={[0, 0.013, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
});

// ---------- Video wall ----------

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Draws the wall picture: the show logo, or a graphic built from the row text. */
function drawWall(content: WallContent, family: string): HTMLCanvasElement {
  const W = 1024;
  const H = 576;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) return c;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0c1630");
  bg.addColorStop(1, "#05070d");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // LED tile seams
  g.strokeStyle = "rgba(255,255,255,0.035)";
  g.lineWidth = 2;
  for (let x = 0; x <= W; x += W / 8) g.strokeRect(x, 0, 0, H);
  for (let y = 0; y <= H; y += H / 4.5) g.strokeRect(0, y, W, 0);

  const font = (px: number, weight = 600) => `${weight} ${px}px ${family}`;
  if (content.kind === "logo") {
    const glow = g.createRadialGradient(W * 0.5, H * 0.5, 10, W * 0.5, H * 0.5, W * 0.55);
    glow.addColorStop(0, "rgba(124,156,255,0.35)");
    glow.addColorStop(1, "rgba(124,156,255,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#ececf2";
    g.font = font(104, 700);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("EVENING DESK", W / 2, H / 2 - 18);
    g.fillStyle = "#7c9cff";
    g.fillRect(W / 2 - 150, H / 2 + 52, 300, 6);
    g.fillStyle = "rgba(236,236,242,0.6)";
    g.font = font(30, 500);
    g.fillText("LIVE · WEEKNIGHTS", W / 2, H / 2 + 100);
    return c;
  }
  // a bar chart whose values come from the text, so the same row always draws the same chart
  const title = content.text.replace(/\b(full[\s-]?screen|fs)\b/gi, "").trim() || "Graphics";
  g.fillStyle = "#ececf2";
  g.font = font(54, 700);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.fillText(title.toUpperCase().slice(0, 28), 72, 112);
  g.fillStyle = "#7c9cff";
  g.fillRect(72, 136, 120, 5);
  const seed = hash(title);
  const labels = ["2022", "2023", "2024", "2025", "2026"];
  const base = H - 90;
  labels.forEach((label, i) => {
    const v = 0.25 + (((seed >>> (i * 5)) & 31) / 31) * 0.65;
    const x = 96 + i * 170;
    const h = v * 300;
    const bar = g.createLinearGradient(0, base - h, 0, base);
    bar.addColorStop(0, i === labels.length - 1 ? "#ff8a7a" : "#8ea9ff");
    bar.addColorStop(1, i === labels.length - 1 ? "#c43d33" : "#3d5bd1");
    g.fillStyle = bar;
    g.fillRect(x, base - h, 104, h);
    g.fillStyle = "rgba(236,236,242,0.75)";
    g.font = font(26, 500);
    g.fillText(label, x + 22, base + 40);
  });
  return c;
}

function useWallContent(): WallContent {
  // a string key, so the selector only re-renders the wall when the picture changes
  const key = useStore((s) => JSON.stringify(wallAt(s.plan, s.time)));
  return useMemo(() => JSON.parse(key) as WallContent, [key]);
}

/** LED video wall on two posts; shows the logo or the current graphic. */
export const VideoWall = memo(function VideoWall() {
  const content = useWallContent();
  const family = useCanvasFont();
  const texture = useMemo(() => {
    const t = new CanvasTexture(drawWall(content, family));
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [content, family]);
  useEffect(() => () => texture.dispose(), [texture]);
  const frame = mat("#0b0d12", { rough: 0.5, metal: 0.4 });
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={unitBox()} material={frame} position={[1.2 * s, 0.35, 0.05]} scale={[0.08, 0.7, 0.08]} castShadow />
      ))}
      <RoundedBox args={[3.36, 1.92, 0.08]} radius={0.02} smoothness={2} position={[0, 1.55, 0.05]} material={frame} castShadow />
      <mesh position={[0, 1.55, 0.005]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[3.2, 1.8]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
});

/** Curved backdrop: dark slatted panels on an arc with LED seams between them. */
export const Backdrop = memo(function Backdrop() {
  const R = 4.8;
  const steps = 11;
  const span = 110;
  const panel = mat(C.slate, { rough: 0.9 });
  const panelAlt = mat(C.slateLight, { rough: 0.85 });
  const seam = mat(C.accent, { emissive: C.accent, glow: 0.9 });
  const items = Array.from({ length: steps }, (_, i) => {
    const a = (-span / 2 + (span * (i + 0.5)) / steps) * DEG;
    return { a, x: Math.sin(a) * R, z: -R + Math.cos(a) * R };
  });
  const w = 2 * R * Math.sin((span / steps / 2) * DEG) - 0.04;
  // the middle panel sits at the origin and the ends curve forward (-z), around the stage
  return (
    <group>
      {items.map(({ a, x, z }, i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, a, 0]}>
          <mesh geometry={unitBox()} material={i % 2 ? panelAlt : panel} position={[0, 1.8, 0]} scale={[w, 3.6, 0.06]} receiveShadow />
          {i < steps - 1 && <mesh geometry={unitBox()} material={seam} position={[w / 2 + 0.02, 1.8, -0.03]} scale={[0.015, 3.2, 0.015]} />}
        </group>
      ))}
    </group>
  );
});

/** Overhead truss with fresnel lamps. Out of shot on most framings; sells the studio in the overview. */
export const LightRig = memo(function LightRig() {
  const truss = mat("#2c3038", { rough: 0.5, metal: 0.7 });
  const lamp = mat("#1a1c21", { rough: 0.6, metal: 0.4 });
  const lens = mat("#ffe2b0", { emissive: "#ffd79a", glow: 1.6 });
  const y = 4.3;
  const beams: [number, number, number, number, number][] = [
    [0, y, -1.6, 6.4, 0.12],
    [0, y, 2.6, 6.4, 0.12],
  ];
  const lamps = [-2.4, -0.8, 0.8, 2.4].flatMap((x) => [
    { x, z: 2.6, tilt: -0.6 },
    { x, z: -1.6, tilt: 0.35 },
  ]);
  return (
    <group>
      {beams.map(([x, yy, z, len, t], i) => (
        <mesh key={i} geometry={unitBox()} material={truss} position={[x, yy, z]} scale={[len, t, t]} />
      ))}
      {[-3.1, 3.1].map((x) => (
        <mesh key={x} geometry={unitBox()} material={truss} position={[x, y, 0.5]} scale={[0.12, 0.12, 4.3]} />
      ))}
      {lamps.map((l, i) => (
        <group key={i} position={[l.x, y - 0.22, l.z]} rotation={[l.tilt, 0, 0]}>
          <mesh geometry={cylinder(0.11, 0.13, 0.28, 20)} material={lamp} />
          <mesh geometry={cylinder(0.09, 0.09, 0.01, 20)} material={lens} position={[0, -0.145, 0]} />
        </group>
      ))}
    </group>
  );
});

/** Registry: preset id → detailed model. Anything else falls back to its part-list preset. */
export const DETAILED: Record<string, () => JSX.Element> = {
  armchair: () => <Armchair />,
  coffeeTable: () => <CoffeeTable />,
  rug: () => <Rug />,
  tvScreen: () => <VideoWall />,
  backdrop: () => <Backdrop />,
};
