import { useEffect, useMemo } from "react";
import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

type Props = {
  text: string;
  position: [number, number, number];
  color?: string;
  background?: string;
  height?: number;
};

/**
 * A billboard text label drawn into a canvas texture. Avoids font downloads
 * (drei <Text> fetches a font) so the app keeps working offline.
 */
export function Label({ text, position, color = "#e2e7ec", background = "rgba(10,12,16,0.82)", height = 0.032 }: Props) {
  const { texture, aspect } = useMemo(() => {
    const scale = 4;
    const font = `600 ${13 * scale}px Inter, system-ui, sans-serif`;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas unavailable");
    ctx.font = font;
    const padX = 8 * scale;
    const w = Math.ceil(ctx.measureText(text).width + padX * 2);
    const h = 22 * scale;
    canvas.width = w;
    canvas.height = h;
    ctx.font = font;
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 5 * scale);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(text, padX, h / 2 + scale);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearFilter;
    return { texture: tex, aspect: w / h };
  }, [text, color, background]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    // sizeAttenuation off: labels keep a readable screen size at any zoom; height is in screen units
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={texture} depthTest={false} transparent sizeAttenuation={false} />
    </sprite>
  );
}
