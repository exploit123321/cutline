import { PerspectiveCamera, View } from "@react-three/drei";
import { DEG, add, fovForHeight, forward, headPosition, lookAngles, scale, v } from "../../geometry";
import type { Person } from "../../model/types";
import { RealPerson } from "../scene/models/RealPerson";

/** The iso camera sits this far in front of the face, and frames this much height. */
const ISO_DISTANCE = 1.6;
const ISO_HEIGHT = 0.62;

/**
 * A cut-out square of one person: their own iso view, the person alone on a tinted
 * background, as a mixer would key a host over a screen share. The camera is virtual,
 * square in front of the face, so it never takes one of the studio cameras.
 */
export function IsoFeed({ person, index, tint, className }: { person: Person; index: number; tint: string; className?: string }) {
  const head = headPosition(person);
  const pos = add(add(head, scale(forward(person.facingYaw), ISO_DISTANCE)), v(0, 0.03, 0));
  const aim = lookAngles(pos, head);
  return (
    <View className={className}>
      <color attach="background" args={[tint]} />
      <PerspectiveCamera
        makeDefault
        near={0.05}
        far={10}
        fov={fovForHeight(ISO_DISTANCE, ISO_HEIGHT)}
        position={[pos.x, pos.y, pos.z]}
        rotation={[aim.pitch * DEG, aim.yaw * DEG, 0]}
        rotation-order="YXZ"
      />
      <hemisphereLight args={["#dfe6f2", "#1a1d24", 0.9]} />
      <directionalLight position={[pos.x + 1.5, pos.y + 2, pos.z + 1]} intensity={2.2} />
      <directionalLight position={[head.x - 1, head.y + 1, head.z - 2]} intensity={1.2} color="#ffd2a6" />
      <RealPerson person={person} index={index} />
    </View>
  );
}
