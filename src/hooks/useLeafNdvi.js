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
 *   compensators?: { r?: number, nir?: number } | null,
 * }} params
 */
export function useLeafNdvi({
  cubeId,
  bands,
  boxes,
  imageWidth,
  imageHeight,
  compensators,
}) {
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
  const compR = compensators?.r ?? null;
  const compNir = compensators?.nir ?? null;

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
      compensators: compensators ?? null,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cubeId,
    redUrl,
    nirUrl,
    boxesCount,
    dimsKey,
    boxes,
    imageWidth,
    imageHeight,
    compR,
    compNir,
  ]);

  return state;
}
