/** "light" bg → use dark (black) text; "dark" bg → use light (white) text. */
export type ImageTextTone = "light" | "dark";

export function isDisplayableImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Relative luminance 0–1 from sRGB channels (0–255). */
function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Sample the bottom band of an image to pick readable label text.
 * Returns "light" when the band is bright (use black text).
 */
export function toneFromImageElement(img: HTMLImageElement): ImageTextTone {
  const canvas = document.createElement("canvas");
  const sampleH = Math.max(8, Math.floor(img.naturalHeight * 0.18));
  const w = Math.min(48, img.naturalWidth);
  canvas.width = w;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || img.naturalWidth < 1 || img.naturalHeight < 1) {
    return "dark";
  }
  ctx.drawImage(
    img,
    0,
    img.naturalHeight - sampleH,
    img.naturalWidth,
    sampleH,
    0,
    0,
    w,
    sampleH,
  );
  const { data } = ctx.getImageData(0, 0, w, sampleH);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += relativeLuminance(data[i]!, data[i + 1]!, data[i + 2]!);
    count += 1;
  }
  return sum / count > 0.55 ? "light" : "dark";
}
