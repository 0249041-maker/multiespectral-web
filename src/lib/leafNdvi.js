/**
 * NDVI promedio de "hojas": media de NDVI sobre los píxeles que NO caen
 * dentro de ninguna caja de fruto detectado.
 *
 * Las cajas vienen en coordenadas del bitmap RGB usado para YOLO; se reescalan
 * al tamaño de la imagen R/NIR antes de excluir píxeles.
 */

import {
  applyShiftFloat32,
  createAlignerForReferenceImage,
  drawToImageData,
  imageDataToLuminance,
} from "@/lib/spectralRgbComposite";

const EPS = 1e-6;

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith("blob:") && !url.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen remota."));
    img.src = url;
  });
}

/**
 * @param {{ width: number, height: number, boxes: Array<{x1:number,y1:number,x2:number,y2:number}>, sx:number, sy:number }} params
 * @returns {Uint8Array} máscara 1 = fruto, 0 = no fruto
 */
function buildFruitMask({ width, height, boxes, sx, sy }) {
  const mask = new Uint8Array(width * height);
  for (const b of boxes) {
    const x1 = Math.max(0, Math.floor(b.x1 * sx));
    const y1 = Math.max(0, Math.floor(b.y1 * sy));
    const x2 = Math.min(width, Math.ceil(b.x2 * sx));
    const y2 = Math.min(height, Math.ceil(b.y2 * sy));
    if (x2 <= x1 || y2 <= y1) continue;
    for (let y = y1; y < y2; y++) {
      const row = y * width;
      for (let x = x1; x < x2; x++) {
        mask[row + x] = 1;
      }
    }
  }
  return mask;
}

/**
 * Calcula NDVI promedio sobre píxeles de hoja (no-fruto).
 *
 * @param {{
 *   redUrl: string,
 *   nirUrl: string,
 *   boxes: Array<{x1:number,y1:number,x2:number,y2:number}> | null | undefined,
 *   imageWidth: number,
 *   imageHeight: number,
 * }} params
 * @returns {Promise<{ mean: number | null, pixels: number, boxesCount: number }>}
 */
export async function computeLeafNdvi({
  redUrl,
  nirUrl,
  boxes,
  imageWidth,
  imageHeight,
}) {
  if (!redUrl || !nirUrl) {
    return { mean: null, pixels: 0, boxesCount: 0 };
  }

  const [redImg, nirImg] = await Promise.all([
    loadImageFromUrl(redUrl),
    loadImageFromUrl(nirUrl),
  ]);

  if (redImg.width !== nirImg.width || redImg.height !== nirImg.height) {
    throw new Error(
      `R y NIR con tamaño distinto (R: ${redImg.width}×${redImg.height}, NIR: ${nirImg.width}×${nirImg.height}).`
    );
  }

  const w = redImg.width;
  const h = redImg.height;

  const redLum = imageDataToLuminance(drawToImageData(redImg, w, h));
  const nirLumRaw = imageDataToLuminance(drawToImageData(nirImg, w, h));
  const align = createAlignerForReferenceImage(redImg);
  const shift = align(nirImg);
  const nirLum = applyShiftFloat32(nirLumRaw, w, h, shift.dx, shift.dy);

  const validBoxes =
    Array.isArray(boxes) && boxes.length > 0 && imageWidth > 0 && imageHeight > 0
      ? boxes
      : [];

  const sx = validBoxes.length ? w / imageWidth : 1;
  const sy = validBoxes.length ? h / imageHeight : 1;
  const mask = validBoxes.length
    ? buildFruitMask({ width: w, height: h, boxes: validBoxes, sx, sy })
    : null;

  const n = w * h;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (mask && mask[i]) continue;
    const rVal = redLum[i];
    const nVal = nirLum[i];
    let ndvi = (nVal - rVal) / (nVal + rVal + EPS);
    if (ndvi < -1) ndvi = -1;
    if (ndvi > 1) ndvi = 1;
    sum += ndvi;
    count += 1;
  }

  return {
    mean: count > 0 ? sum / count : null,
    pixels: count,
    boxesCount: validBoxes.length,
  };
}
