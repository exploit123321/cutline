import { Bone, Matrix4, type Object3D, Quaternion, SkinnedMesh, Vector3 } from "three";

/*
 * Seats a Mixamo-rigged character and poses it each frame.
 *
 * Mixamo bone axes differ from bone to bone, so the solver does not set local angles.
 * It works in the model's own space: each posed bone is turned, by the smallest
 * rotation, until the line to its child bone points where the pose wants it. Gaze, nods
 * and laughs are extra rotations about the model's up and right axes, laid on top.
 */

/** three.js drops the ":" from node names, so "mixamorig:Hips" arrives as "mixamorigHips" */
const PREFIX = /^mixamorig:?/;

/** bone → the child bone whose direction the pose controls */
const CHAIN: Record<string, string> = {
  Hips: "Spine",
  Spine: "Spine1",
  Spine1: "Spine2",
  Spine2: "Neck",
  Neck: "Head",
  LeftArm: "LeftForeArm",
  LeftForeArm: "LeftHand",
  RightArm: "RightForeArm",
  RightForeArm: "RightHand",
  LeftUpLeg: "LeftLeg",
  LeftLeg: "LeftFoot",
  LeftFoot: "LeftToeBase",
  RightUpLeg: "RightLeg",
  RightLeg: "RightFoot",
  RightFoot: "RightToeBase",
};

export type PoseInput = {
  /** gaze relative to the body, degrees; positive yaw turns left, positive pitch looks up */
  yaw: number;
  pitch: number;
  /** 0..1 */
  talk: number;
  laugh: number;
  nod: number;
  /** seconds, for the small talking motions */
  t: number;
  seed: number;
};

/** Seat geometry in metres: the hip joints sit this high, and this far back from the chair centre. */
export const SEAT = { hipsY: 0.55, back: 0.06, ankleY: 0.085 };

const DEG = Math.PI / 180;
const axisAngle = (axis: Vector3, rad: number) => new Quaternion().setFromAxisAngle(axis, rad);

export class SeatedRig {
  readonly forward: Vector3;
  readonly right: Vector3;
  readonly up = new Vector3(0, 1, 0);
  private bones: Bone[] = [];
  private names: string[] = [];
  private parent: number[] = [];
  /** world rotation of a parent that is not a bone (the armature), fixed */
  private staticParentQ: Quaternion[] = [];
  private bindLocal: Quaternion[] = [];
  private dirLocal: (Vector3 | null)[] = [];
  private hipsParentInv = new Matrix4();
  private legTargets = new Map<string, Vector3>();
  private modelQ: Quaternion[] = [];

  constructor(root: Object3D) {
    root.updateMatrixWorld(true);
    let mesh: SkinnedMesh | null = null;
    root.traverse((o) => {
      if (!mesh && (o as SkinnedMesh).isSkinnedMesh) mesh = o as SkinnedMesh;
    });
    if (!mesh) throw new Error("no skinned mesh in model");
    const skeleton = (mesh as SkinnedMesh).skeleton;

    // parents first, so each bind world matrix is set before its children read it
    const depth = (o: Object3D) => {
      let d = 0;
      for (let p = o.parent; p; p = p.parent) d++;
      return d;
    };
    const order = skeleton.bones.map((b, i) => ({ b, i })).sort((x, y) => depth(x.b) - depth(y.b));

    // back to the bind pose (A-pose) from the inverse bind matrices; the file's own
    // node transforms can hold a frame of an animation
    for (const { b, i } of order) {
      const world = (skeleton.boneInverses[i] as Matrix4).clone().invert();
      const parentWorld = b.parent ? b.parent.matrixWorld : new Matrix4();
      const local = parentWorld.clone().invert().multiply(world);
      local.decompose(b.position, b.quaternion, b.scale);
      b.updateMatrixWorld(true);
    }

    this.bones = order.map((o) => o.b);
    this.names = this.bones.map((b) => b.name.replace(PREFIX, ""));
    const index = new Map(this.bones.map((b, i) => [b, i]));
    this.parent = this.bones.map((b) => (b.parent && index.has(b.parent as Bone) ? (index.get(b.parent as Bone) as number) : -1));
    this.staticParentQ = this.bones.map((b) => {
      const q = new Quaternion();
      b.parent?.matrixWorld.decompose(new Vector3(), q, new Vector3());
      return q;
    });
    this.bindLocal = this.bones.map((b) => b.quaternion.clone());

    const worldPos = (name: string) => {
      const b = this.bone(name);
      return b ? new Vector3().setFromMatrixPosition(b.matrixWorld) : null;
    };
    this.dirLocal = this.bones.map((b, i) => {
      const child = CHAIN[this.names[i] as string];
      const from = new Vector3().setFromMatrixPosition(b.matrixWorld);
      const to = child ? worldPos(child) : null;
      if (!to) return null;
      const q = new Quaternion();
      b.matrixWorld.decompose(new Vector3(), q, new Vector3());
      return to.sub(from).normalize().applyQuaternion(q.invert());
    });

    // the feet point where the character faces
    const f = new Vector3();
    for (const side of ["Left", "Right"]) {
      const foot = worldPos(`${side}Foot`);
      const toe = worldPos(`${side}ToeBase`);
      if (foot && toe) f.add(toe.sub(foot));
    }
    f.y = 0;
    this.forward = f.lengthSq() > 1e-8 ? f.normalize() : new Vector3(0, 0, 1);
    this.right = new Vector3().crossVectors(this.forward, this.up).normalize();

    const hips = this.bone("Hips");
    if (hips?.parent) this.hipsParentInv.copy(hips.parent.matrixWorld).invert();

    this.fitLegs();
  }

  /** Turn about the up axis that brings the model's forward onto -z, the studio's facing. */
  facingRotation(): number {
    return -Math.atan2(-this.forward.x, -this.forward.z);
  }

  private bone(name: string): Bone | undefined {
    const i = this.names.indexOf(name);
    return i >= 0 ? this.bones[i] : undefined;
  }

  private outward(name: string): Vector3 {
    // the character's left is -right
    return this.right.clone().multiplyScalar(name.startsWith("Left") ? -1 : 1);
  }

  private dir(...parts: [Vector3, number][]): Vector3 {
    const v = new Vector3();
    for (const [axis, k] of parts) v.addScaledVector(axis, k);
    return v.normalize();
  }

  /** Legs do not move during the show: aim each shin so the ankle lands on the floor. */
  private fitLegs() {
    const F = this.forward;
    const U = this.up;
    for (const side of ["Left", "Right"]) {
      const out = this.outward(side);
      this.legTargets.set(`${side}UpLeg`, this.dir([F, 1], [U, 0.06], [out, 0.13]));
      this.legTargets.set(`${side}Leg`, this.dir([U, -1], [F, 0.2]));
      this.legTargets.set(`${side}Foot`, this.dir([F, 1], [U, -0.5]));
    }
    this.pose({ yaw: 0, pitch: 0, talk: 0, laugh: 0, nod: 0, t: 0, seed: 0 });
    this.bones[0]?.parent?.updateMatrixWorld(true);
    for (const side of ["Left", "Right"]) {
      const knee = this.bone(`${side}Leg`);
      const ankle = this.bone(`${side}Foot`);
      if (!knee || !ankle) continue;
      const k = new Vector3().setFromMatrixPosition(knee.matrixWorld);
      const len = k.distanceTo(new Vector3().setFromMatrixPosition(ankle.matrixWorld));
      const drop = Math.min(len, Math.max(0.05, k.y - SEAT.ankleY));
      const ahead = Math.sqrt(Math.max(0, len * len - drop * drop));
      this.legTargets.set(`${side}Leg`, this.dir([U, -drop], [this.forward, ahead]));
    }
  }

  /** Set every bone for this frame. */
  pose(p: PoseInput) {
    const F = this.forward;
    const U = this.up;
    const R = this.right;
    const lean = 0.12 + p.laugh * 0.28;
    // talking: the right hand rises and turns now and then, the left answers a little
    const g = p.talk * (0.5 + 0.5 * Math.sin(p.t * 2.3 + p.seed));
    const wave = Math.sin(p.t * 3.4 + p.seed);

    const targets = new Map<string, Vector3>(this.legTargets);
    targets.set("Hips", this.dir([U, 1], [F, -lean * 0.5]));
    targets.set("Spine", this.dir([U, 1], [F, -lean]));
    targets.set("Spine1", this.dir([U, 1], [F, -lean * 0.6]));
    targets.set("Spine2", this.dir([U, 1], [F, 0.05]));
    targets.set("Neck", this.dir([U, 1], [F, 0.18]));
    for (const side of ["Left", "Right"]) {
      const out = this.outward(side);
      const gest = side === "Right" ? g : g * 0.35;
      targets.set(`${side}Arm`, this.dir([U, -1], [F, 0.32 + gest * 0.35], [out, 0.2]));
      targets.set(`${side}ForeArm`, this.dir([F, 1], [U, -0.55 + gest * (1.0 + 0.3 * wave)], [out, -0.28 + gest * 0.2]));
    }

    const yaw = Math.max(-80, Math.min(80, p.yaw)) * DEG;
    const pitch = p.pitch * DEG;
    const bob = p.talk * Math.sin(p.t * 5.3 + p.seed) * 0.05;
    const turn = (y: number, x: number) => axisAngle(U, y).multiply(axisAngle(R, x));
    const extras = new Map<string, Quaternion>([
      ["Spine2", turn(yaw * 0.25, 0)],
      ["Neck", turn(yaw * 0.3, pitch * 0.35)],
      ["Head", turn(yaw * 0.45, pitch * 0.65 + bob + p.laugh * 0.3 - p.nod * 0.32)],
    ]);

    const qInv = new Quaternion();
    for (let i = 0; i < this.bones.length; i++) {
      const bone = this.bones[i] as Bone;
      const name = this.names[i] as string;
      const pi = this.parent[i] as number;
      const parentQ = pi >= 0 ? (this.modelQ[pi] as Quaternion) : (this.staticParentQ[i] as Quaternion);
      const q = parentQ.clone().multiply(this.bindLocal[i] as Quaternion);
      const target = targets.get(name);
      const d = this.dirLocal[i];
      if (target && d) q.premultiply(new Quaternion().setFromUnitVectors(d.clone().applyQuaternion(q), target));
      const extra = extras.get(name);
      if (extra) q.premultiply(extra);
      bone.quaternion.copy(qInv.copy(parentQ).invert().multiply(q));
      this.modelQ[i] = q;
    }

    const hips = this.bone("Hips");
    if (hips) {
      const seat = new Vector3().addScaledVector(U, SEAT.hipsY).addScaledVector(F, -SEAT.back);
      hips.position.copy(seat.applyMatrix4(this.hipsParentInv));
    }
  }
}
