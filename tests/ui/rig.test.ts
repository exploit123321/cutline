import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Bone, type Object3D, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SEAT, SeatedRig, type PoseInput } from "../../src/ui/scene/models/rig";

/** Loads a people GLB without its texture (Node has no image decoder) and returns its scene. */
async function loadModel(name: string): Promise<Object3D> {
  const data = readFileSync(new URL(`../../public/models/people/${name}.glb`, import.meta.url));
  const jsonLen = data.readUInt32LE(12);
  const doc = JSON.parse(data.subarray(20, 20 + jsonLen).toString("utf8"));
  const bin = data.subarray(20 + jsonLen + 8);
  delete doc.images;
  delete doc.textures;
  delete doc.samplers;
  for (const m of doc.materials ?? []) delete m.pbrMetallicRoughness?.baseColorTexture;
  let json = Buffer.from(JSON.stringify(doc));
  json = Buffer.concat([json, Buffer.alloc(-json.length % 4 & 3, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const chunk = (len: number, type: number) => {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(len, 0);
    b.writeUInt32LE(type, 4);
    return b;
  };
  const glb = Buffer.concat([header, chunk(json.length, 0x4e4f534a), json, chunk(bin.length, 0x004e4942), bin]);
  const ab = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, "", (g) => resolve(g.scene), reject));
}

const still: PoseInput = { yaw: 0, pitch: 0, talk: 0, laugh: 0, nod: 0, t: 0, seed: 0 };

function bonePos(root: Object3D, name: string): Vector3 {
  let found: Bone | undefined;
  root.traverse((o) => {
    if ((o as Bone).isBone && o.name.replace(/^mixamorig:?/, "") === name) found = o as Bone;
  });
  if (!found) throw new Error(`no bone ${name}`);
  return new Vector3().setFromMatrixPosition(found.matrixWorld);
}

/** Head yaw relative to the body forward, degrees, positive = turned left (studio convention). */
function headYaw(root: Object3D, rig: SeatedRig): number {
  const face = bonePos(root, "headfront").sub(bonePos(root, "Head"));
  face.y = 0;
  face.normalize();
  const f = rig.forward;
  // signed angle about +y from forward to face
  const cross = f.z * face.x - f.x * face.z;
  return (Math.atan2(cross, f.dot(face)) * 180) / Math.PI;
}

describe.each(["woman_green_sweater", "man_knit_sweater", "woman_camel_coat"])("seated rig on %s", (name) => {
  it("sits the hips on the seat and puts both feet on the floor", async () => {
    const root = await loadModel(name);
    const rig = new SeatedRig(root);
    rig.pose(still);
    root.updateMatrixWorld(true);
    expect(bonePos(root, "Hips").y).toBeCloseTo(SEAT.hipsY, 2);
    for (const side of ["Left", "Right"]) {
      const ankle = bonePos(root, `${side}Foot`);
      expect(ankle.y).toBeGreaterThan(0.03);
      expect(ankle.y).toBeLessThan(0.16);
      // knees ahead of the hips, at about seat height
      const knee = bonePos(root, `${side}Leg`);
      expect(knee.clone().sub(bonePos(root, "Hips")).dot(rig.forward)).toBeGreaterThan(0.3);
      // thighs rest on the cushion (top at 0.405 m), not inside it
      expect(knee.y).toBeGreaterThan(0.44);
      expect(knee.y).toBeLessThan(0.56);
    }
  });

  it("turns the head by the asked yaw, left positive", async () => {
    const root = await loadModel(name);
    const rig = new SeatedRig(root);
    rig.pose(still);
    root.updateMatrixWorld(true);
    const rest = headYaw(root, rig);
    for (const yaw of [-62, 40]) {
      rig.pose({ ...still, yaw });
      root.updateMatrixWorld(true);
      expect(headYaw(root, rig) - rest).toBeCloseTo(yaw, -1);
    }
  });
});
