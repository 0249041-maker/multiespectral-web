import { useEffect, useState } from "react";

const COLOR_CLASS = {
  red: "fill-red-500 shadow-[0_0_8px_rgba(239,68,68,0.75)]",
  green: "fill-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]",
  emerald: "fill-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.85)]",
  blue: "fill-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.85)]",
  yellow: "fill-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.85)]",
  white: "fill-white shadow-[0_0_12px_rgba(255,255,255,1)]",
  cyan: "fill-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.85)]",
};

const DIM = "fill-slate-300";

const LEDS = 16;
const R = 38;
const CX = 50;
const CY = 50;

function ledPositions() {
  return Array.from({ length: LEDS }, (_, i) => {
    const a = (i / LEDS) * 2 * Math.PI - Math.PI / 2;
    return {
      x: CX + R * Math.cos(a),
      y: CY + R * Math.sin(a),
    };
  });
}

const POSITIONS = ledPositions();

/**
 * Anillo NeoPixel simulado: patrones Spinner, Blink, DoubleFlash.
 * @param {{ pattern?: 'spinner'|'blink'|'doubleFlash', colorKey?: keyof COLOR_CLASS, size?: number, label?: string }} props
 */
export default function NeoPixelRing({
  pattern = "spinner",
  colorKey = "emerald",
  size = 120,
  label = "NeoPixel ring",
}) {
  const [tick, setTick] = useState(0);
  const activeClass = COLOR_CLASS[colorKey] || COLOR_CLASS.emerald;

  useEffect(() => {
    const ms =
      pattern === "doubleFlash" ? 85 : pattern === "blink" ? 380 : 110;
    const id = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [pattern]);

  const phase = tick % 1000;

  return (
    <div
      className="relative inline-flex flex-col items-center gap-1"
      role="img"
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="drop-shadow-[0_2px_8px_rgba(16,185,129,0.15)]"
      >
        <circle cx={CX} cy={CY} r={R + 10} className="fill-slate-100" />
        {POSITIONS.map((p, i) => {
          let lit = false;
          if (pattern === "spinner") {
            lit = i === tick % LEDS;
          } else if (pattern === "blink") {
            lit = phase % 2 === 0;
          } else if (pattern === "doubleFlash") {
            const c = phase % 8;
            lit = c === 0 || c === 1 || c === 4 || c === 5;
          }
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3.2}
              className={`transition-all duration-75 ${lit ? activeClass : DIM}`}
            />
          );
        })}
        <circle
          cx={CX}
          cy={CY}
          r={22}
          className="fill-white stroke-slate-200"
          strokeWidth={0.75}
        />
        <text
          x={CX}
          y={CY + 4}
          textAnchor="middle"
          className="font-mono text-[9px] uppercase tracking-tighter fill-slate-500"
        >
          LED
        </text>
      </svg>
      <span className="font-mono text-[10px] uppercase tracking-wide text-slate-600">
        {pattern}
      </span>
    </div>
  );
}
