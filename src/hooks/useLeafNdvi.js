import { useEffect, useState } from "react";
import { computeLeafNdvi } from "@/lib/leafNdvi";

/**
 * Carga el NDVI promedio de hojas para el cube seleccionado.
 *
 * @param {{
 *   cubeId: string | null,
 *   bands: { r?: string, nir?: string } | null,
 *   boxes: Array<{x1:number,y1:number,x2:number,y2:number}> | null,
 *   imageWidth?: number | null,
 *   imageHeight?: number | null,
 * }} params
 */
export function useLeafNdvi({ cubeId, bands, boxes, imageWidth, imageHeight }) {
  const [state, setState] = useState({
    loading: false,
    mean: null,
    error: null,
    pixels: 0,
    excludedBoxes: 0,
  });

  const redUrl = bands?.r ?? null;
  const nirUrl = bands?.nir ?? null;
  const boxesCount = Array.isArray(boxes) ? boxes.length : 0;
  const dimsKey =
    imageWidth && imageHeight ? `${imageWidth}x${imageHeight}` : "";

  useEffect(() => {
    if (!cubeId || !redUrl || !nirUrl) {
      setState({
        loading: false,
        mean: null,
        error: null,
        pixels: 0,
        excludedBoxes: 0,
      });
      return undefined;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    computeLeafNdvi({
      redUrl,
      nirUrl,
      boxes,
      imageWidth: imageWidth || 0,
      imageHeight: imageHeight || 0,
    })
      .then((res) => {
        if (cancelled) return;
        setState({
          loading: false,
          mean: res.mean,
          error: null,
          pixels: res.pixels,
          excludedBoxes: res.boxesCount,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({
          loading: false,
          mean: null,
          error: e instanceof Error ? e.message : String(e),
          pixels: 0,
          excludedBoxes: 0,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [cubeId, redUrl, nirUrl, boxesCount, dimsKey, boxes, imageWidth, imageHeight]);

  return state;
}
