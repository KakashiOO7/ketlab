import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { BlochVector, CircuitGate } from '../quantum/types';

export interface RotationSpec {
  axis: [number, number, number];
  angle: number;
  axisLabel: string;
}

export function getGateRotationSpec(
  gate?: CircuitGate | null,
  qubit?: number
): RotationSpec | null {
  if (!gate || qubit === undefined || gate.target !== qubit) return null;
  switch (gate.kind) {
    case 'X':
      return { axis: [1, 0, 0], angle: Math.PI, axisLabel: 'X axis (180°)' };
    case 'Y':
      return { axis: [0, 1, 0], angle: Math.PI, axisLabel: 'Y axis (180°)' };
    case 'Z':
      return { axis: [0, 0, 1], angle: Math.PI, axisLabel: 'Z axis (180°)' };
    case 'S':
      return { axis: [0, 0, 1], angle: Math.PI / 2, axisLabel: 'Z axis (+90°)' };
    case 'Sdg':
      return { axis: [0, 0, 1], angle: -Math.PI / 2, axisLabel: 'Z axis (−90°)' };
    case 'T':
      return { axis: [0, 0, 1], angle: Math.PI / 4, axisLabel: 'Z axis (+45°)' };
    case 'Tdg':
      return { axis: [0, 0, 1], angle: -Math.PI / 4, axisLabel: 'Z axis (−45°)' };
    case 'H':
      return {
        axis: [Math.SQRT1_2, 0, Math.SQRT1_2],
        angle: Math.PI,
        axisLabel: '(X+Z)/√2 diagonal (180°)',
      };
    case 'Rx':
      return { axis: [1, 0, 0], angle: gate.angle ?? Math.PI / 2, axisLabel: 'X axis' };
    case 'Ry':
      return { axis: [0, 1, 0], angle: gate.angle ?? Math.PI / 2, axisLabel: 'Y axis' };
    case 'Rz':
      return { axis: [0, 0, 1], angle: gate.angle ?? Math.PI / 2, axisLabel: 'Z axis' };
    default:
      return null;
  }
}

function rotateRodrigues(
  v: [number, number, number],
  axis: [number, number, number],
  theta: number
): [number, number, number] {
  const [vx, vy, vz] = v;
  const [kx, ky, kz] = axis;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const dot = kx * vx + ky * vy + kz * vz;
  // k x v
  const cx = ky * vz - kz * vy;
  const cy = kz * vx - kx * vz;
  const cz = kx * vy - ky * vx;

  return [
    vx * c + cx * s + kx * dot * (1 - c),
    vy * c + cy * s + ky * dot * (1 - c),
    vz * c + cz * s + kz * dot * (1 - c),
  ];
}

interface BlochSphereProps {
  vector: BlochVector;
  previousVector?: BlochVector;
  actingGate?: CircuitGate | null;
  animateTransition?: boolean;
  replayKey?: number;
  durationMs?: number;
  size?: number;
  label?: string;
  compact?: boolean;
}

export const BlochSphere: React.FC<BlochSphereProps> = ({
  vector,
  previousVector,
  actingGate,
  animateTransition = false,
  replayKey = 0,
  durationMs = 820,
  size = 220,
  label,
  compact = false,
}) => {
  const [az, setAz] = useState(0.65); // azimuth radians
  const [el, setEl] = useState(0.36); // elevation radians
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const [animProgress, setAnimProgress] = useState(1);

  const rotationSpec = useMemo(
    () => getGateRotationSpec(actingGate, vector.qubit),
    [actingGate, vector.qubit]
  );

  const hasDiff = useMemo(() => {
    if (!previousVector) return false;
    return (
      Math.hypot(
        vector.x - previousVector.x,
        vector.y - previousVector.y,
        vector.z - previousVector.z
      ) > 1e-3
    );
  }, [vector, previousVector]);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (!animateTransition || !previousVector || prefersReduced || (!hasDiff && !rotationSpec)) {
      setAnimProgress(1);
      return;
    }

    let rafId = 0;
    const start = performance.now();
    setAnimProgress(0);

    const tick = (now: number) => {
      const elapsed = now - start;
      const raw = Math.min(1, elapsed / durationMs);
      // Smooth cubic ease-in-out
      const eased =
        raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      setAnimProgress(eased);
      if (raw < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    animateTransition,
    previousVector,
    vector.x,
    vector.y,
    vector.z,
    replayKey,
    durationMs,
    hasDiff,
    rotationSpec,
  ]);

  // Compute interpolated vector at progress t in [0, 1]
  const evalAtProgress = (t: number): { x: number; y: number; z: number; purity: number } => {
    if (!previousVector || t >= 1) {
      return { x: vector.x, y: vector.y, z: vector.z, purity: vector.purity };
    }
    if (rotationSpec && previousVector.purity > 0.05 && vector.purity > 0.05) {
      const [rx, ry, rz] = rotateRodrigues(
        [previousVector.x, previousVector.y, previousVector.z],
        rotationSpec.axis,
        rotationSpec.angle * t
      );
      const purity = previousVector.purity + (vector.purity - previousVector.purity) * t;
      return { x: rx, y: ry, z: rz, purity };
    }
    const x = previousVector.x + (vector.x - previousVector.x) * t;
    const y = previousVector.y + (vector.y - previousVector.y) * t;
    const z = previousVector.z + (vector.z - previousVector.z) * t;
    return { x, y, z, purity: Math.hypot(x, y, z) };
  };

  const displayed = evalAtProgress(animProgress);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;

  // Project 3D Bloch coordinates (x=front-left, y=front-right, z=up) to 2D SVG
  const project = (bx: number, by: number, bz: number) => {
    const x1 = bx * Math.cos(az) - by * Math.sin(az);
    const y1 = bx * Math.sin(az) + by * Math.cos(az);
    const z1 = bz;

    const sx = y1;
    const sy = z1 * Math.cos(el) - x1 * Math.sin(el);
    const depth = x1 * Math.cos(el) + z1 * Math.sin(el);

    return {
      px: cx + sx * radius,
      py: cy - sy * radius,
      depth,
    };
  };

  const buildGreatCircle = (axis: 'xy' | 'xz' | 'yz', segments = 48) => {
    const pts: Array<{ px: number; py: number; depth: number }> = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      let bx = 0;
      let by = 0;
      let bz = 0;
      if (axis === 'xy') {
        bx = Math.cos(t);
        by = Math.sin(t);
      } else if (axis === 'xz') {
        bx = Math.cos(t);
        bz = Math.sin(t);
      } else {
        by = Math.cos(t);
        bz = Math.sin(t);
      }
      pts.push(project(bx, by, bz));
    }
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(' ');
  };

  // Build swept arc trail from previousVector -> displayed
  const trailPath = useMemo(() => {
    if (!previousVector || !hasDiff) return '';
    const steps = 28;
    const maxT = animProgress;
    if (maxT <= 0.02) return '';
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * maxT;
      const v = evalAtProgress(t);
      const p = project(v.x, v.y, v.z);
      pts.push(`${i === 0 ? 'M' : 'L'} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`);
    }
    return pts.join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousVector, vector, animProgress, az, el, hasDiff, rotationSpec]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setAz((prev) => prev + dx * 0.012);
    setEl((prev) => Math.max(-1.2, Math.min(1.2, prev + dy * 0.012)));
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if already released
    }
  };

  const origin = project(0, 0, 0);
  const tip = project(displayed.x, displayed.y, displayed.z);
  const xyShadow = project(displayed.x, displayed.y, 0);
  const prevTip = previousVector
    ? project(previousVector.x, previousVector.y, previousVector.z)
    : null;

  const rotAxisLine = rotationSpec
    ? {
        p1: project(
          -rotationSpec.axis[0] * 1.12,
          -rotationSpec.axis[1] * 1.12,
          -rotationSpec.axis[2] * 1.12
        ),
        p2: project(
          rotationSpec.axis[0] * 1.12,
          rotationSpec.axis[1] * 1.12,
          rotationSpec.axis[2] * 1.12
        ),
      }
    : null;

  const axes = [
    { pos: project(1.18, 0, 0), neg: project(-1.18, 0, 0), posLbl: '|+⟩', negLbl: '|−⟩', endP: project(1, 0, 0), endN: project(-1, 0, 0) },
    { pos: project(0, 1.18, 0), neg: project(0, -1.18, 0), posLbl: '|i⟩', negLbl: '|−i⟩', endP: project(0, 1, 0), endN: project(0, -1, 0) },
    { pos: project(0, 0, 1.18), neg: project(0, 0, -1.18), posLbl: '|0⟩', negLbl: '|1⟩', endP: project(0, 0, 1), endN: project(0, 0, -1) },
  ];

  const isEntangled = displayed.purity < 0.985;

  return (
    <div className="flex flex-col items-center">
      {label && (
        <div className="w-full flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-800 font-mono">
            {label}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono tabular-nums text-slate-500">
              r = {displayed.purity.toFixed(2)}
            </span>
            {!compact && (
              <button
                type="button"
                onClick={() => {
                  setAz(0.65);
                  setEl(0.36);
                }}
                title="Reset Bloch sphere camera"
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="relative select-none">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="cursor-grab active:cursor-grabbing touch-none overflow-visible"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="img"
          aria-label={`Bloch sphere for ${label || `qubit ${vector.qubit}`}`}
        >
          {/* Outer spherical silhouette */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="#ffffff"
            fillOpacity={0.75}
            stroke="#cbd5e1"
            strokeWidth={1.25}
          />

          {/* Equator and meridian rings */}
          <path d={buildGreatCircle('xy')} fill="none" stroke="#94a3b8" strokeWidth={0.9} strokeDasharray="3 3" opacity={0.65} />
          <path d={buildGreatCircle('xz')} fill="none" stroke="#cbd5e1" strokeWidth={0.75} opacity={0.55} />
          <path d={buildGreatCircle('yz')} fill="none" stroke="#cbd5e1" strokeWidth={0.75} opacity={0.55} />

          {/* Coordinate axes */}
          {axes.map((ax, idx) => (
            <g key={idx}>
              <line
                x1={ax.endN.px}
                y1={ax.endN.py}
                x2={ax.endP.px}
                y2={ax.endP.py}
                stroke="#94a3b8"
                strokeWidth={0.85}
                opacity={0.7}
              />
              {!compact && (
                <>
                  <text
                    x={ax.pos.px}
                    y={ax.pos.py}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-slate-600 font-mono text-[10px] font-medium"
                  >
                    {ax.posLbl}
                  </text>
                  <text
                    x={ax.neg.px}
                    y={ax.neg.py}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-slate-400 font-mono text-[10px]"
                  >
                    {ax.negLbl}
                  </text>
                </>
              )}
              {compact && idx === 2 && (
                <>
                  <text
                    x={ax.pos.px}
                    y={ax.pos.py}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-slate-600 font-mono text-[9px] font-medium"
                  >
                    |0⟩
                  </text>
                  <text
                    x={ax.neg.px}
                    y={ax.neg.py}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-slate-400 font-mono text-[9px]"
                  >
                    |1⟩
                  </text>
                </>
              )}
            </g>
          ))}

          {/* Gate Rotation Axis Highlight */}
          {rotAxisLine && (
            <line
              x1={rotAxisLine.p1.px}
              y1={rotAxisLine.p1.py}
              x2={rotAxisLine.p2.px}
              y2={rotAxisLine.p2.py}
              stroke="#d97706"
              strokeWidth={1.35}
              strokeDasharray="4 3"
              opacity={0.75}
            />
          )}

          {/* Swept Trajectory Arc Trail */}
          {trailPath && (
            <path
              d={trailPath}
              fill="none"
              stroke="#d97706"
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.85}
            />
          )}

          {/* Previous state ghost vector */}
          {prevTip && hasDiff && (
            <g opacity={0.4}>
              <line
                x1={origin.px}
                y1={origin.py}
                x2={prevTip.px}
                y2={prevTip.py}
                stroke="#64748b"
                strokeWidth={1.5}
                strokeDasharray="3 2"
              />
              <circle cx={prevTip.px} cy={prevTip.py} r={3} fill="#64748b" />
            </g>
          )}

          {/* Equatorial projection guide */}
          {displayed.purity > 0.05 && (
            <>
              <line
                x1={origin.px}
                y1={origin.py}
                x2={xyShadow.px}
                y2={xyShadow.py}
                stroke="#94a3b8"
                strokeWidth={0.9}
                strokeDasharray="2 2"
              />
              <line
                x1={xyShadow.px}
                y1={xyShadow.py}
                x2={tip.px}
                y2={tip.py}
                stroke="#94a3b8"
                strokeWidth={0.9}
                strokeDasharray="2 2"
              />
            </>
          )}

          {/* Origin dot */}
          <circle cx={origin.px} cy={origin.py} r={2.5} fill="#475569" />

          {/* State vector arrow */}
          {displayed.purity > 0.03 ? (
            <g>
              <line
                x1={origin.px}
                y1={origin.py}
                x2={tip.px}
                y2={tip.py}
                stroke={isEntangled ? '#0891b2' : '#2563eb'}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              <circle
                cx={tip.px}
                cy={tip.py}
                r={compact ? 4 : 5}
                fill={isEntangled ? '#0891b2' : '#2563eb'}
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            </g>
          ) : (
            <circle
              cx={origin.px}
              cy={origin.py}
              r={6}
              fill="#0891b2"
              fillOpacity={0.25}
              stroke="#0891b2"
              strokeWidth={1.5}
            />
          )}
        </svg>
      </div>

      {/* Coordinates & purity note */}
      <div className="w-full mt-1 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
        <span>
          ({displayed.x.toFixed(2)}, {displayed.y.toFixed(2)}, {displayed.z.toFixed(2)})
        </span>
        {isEntangled ? (
          <span className="text-cyan-700 font-sans font-medium">
            Entangled (mixed)
          </span>
        ) : (
          <span className="text-slate-500 font-sans">Pure state</span>
        )}
      </div>
    </div>
  );
};
