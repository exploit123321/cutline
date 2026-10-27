import { PMREMGenerator, type Texture, type WebGLRenderer } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * One reflection map for every view. Each drei <View> is its own scene, so a per-view
 * <Environment> would render and prefilter the same cube five times on the first frame.
 * RoomEnvironment is built from boxes and lights: nothing is downloaded.
 */
const cache = new WeakMap<WebGLRenderer, Texture>();

export function studioEnv(gl: WebGLRenderer): Texture {
  let tex = cache.get(gl);
  if (!tex) {
    const pmrem = new PMREMGenerator(gl);
    tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    cache.set(gl, tex);
  }
  return tex;
}
