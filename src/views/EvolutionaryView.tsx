import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  FastForward,
} from 'lucide-react';
import { formatAnglePi } from '../quantum/complex';
import {
  KNAPSACK_CAPACITY,
  KNAPSACK_ITEMS,
  QEAProblemId,
  QEAState,
  QEAVariant,
  QEA_VARIANTS,
  initializeQEA,
  lookupRotationSign,
  stepQEAGeneration,
} from '../quantum/qea';
import { CircuitStep } from '../quantum/types';

interface EvolutionaryViewProps {
  onLoadIntoLab: (numQubits: number, initialBits: number[], steps: CircuitStep[]) => void;
}

export const EvolutionaryView: React.FC<EvolutionaryViewProps> = ({
  onLoadIntoLab,
}) => {
  const [variant, setVariant] = useState<QEAVariant>('standard');
  const [problem, setProblem] = useState<QEAProblemId>('knapsack');
  const [popSize, setPopSize] = useState<number>(8);
  const [baseDelta, setBaseDelta] = useState<number>(0.06 * Math.PI);
  const [selectedIndIdx, setSelectedIndIdx] = useState<number>(0);
  const [selectedLocus, setSelectedLocus] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const [qea, setQea] = useState<QEAState>(() => initializeQEA(8, 'knapsack'));

  const handleReset = (
    nextPop = popSize,
    nextProblem = problem
  ) => {
    setIsRunning(false);
    setQea(initializeQEA(nextPop, nextProblem));
    setSelectedIndIdx(0);
    setSelectedLocus(0);
  };

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setQea((prev) => stepQEAGeneration(prev, variant, problem, baseDelta));
    }, 450);
    return () => window.clearInterval(timer);
  }, [isRunning, variant, problem, baseDelta]);

  const handleStepOne = () => {
    setIsRunning(false);
    setQea((prev) => stepQEAGeneration(prev, variant, problem, baseDelta));
  };

  const handleRunBatch = (count: number) => {
    setIsRunning(false);
    setQea((prev) => {
      let cur = prev;
      for (let i = 0; i < count; i++) {
        cur = stepQEAGeneration(cur, variant, problem, baseDelta);
      }
      return cur;
    });
  };

  const safeIndIdx = Math.min(selectedIndIdx, qea.population.length - 1);
  const activeInd = qea.population[safeIndIdx] ?? qea.population[0];
  const safeLocus = Math.min(selectedLocus, activeInd.qbits.length - 1);
  const activeQBit = activeInd.qbits[safeLocus];

  const latestMetric = qea.history[qea.history.length - 1];

  // Lookup rule info for activeInd[safeLocus]
  const activeX = activeInd.observedBits[safeLocus] ?? 0;
  const activeB = qea.bestBits[safeLocus] ?? 0;
  const activeFGeq = activeInd.fitness >= qea.bestFitness;
  const activeSign = lookupRotationSign(activeX, activeB, activeFGeq);

  const handleExportTopToLab = () => {
    // Take top 4 qubits of the best-performing individual and map theta -> Ry(2*theta)
    const sorted = [...qea.population].sort((a, b) => b.fitness - a.fitness);
    const bestInd = sorted[0] ?? activeInd;
    const nQ = Math.min(4, bestInd.qbits.length);
    const steps: CircuitStep[] = [
      {
        id: `qea-export-${Date.now()}`,
        label: `Evolved Q-Bits (${QEA_VARIANTS[variant].shortName})`,
        note: `Imported Q-bit state angles θ₀..θ${nQ - 1} from Generation ${qea.generation} via Ry(2θ).`,
        gates: Array.from({ length: nQ }, (_, q) => ({
          id: `qea-ry-${q}-${Date.now()}`,
          kind: 'Ry',
          target: q,
          angle: bestInd.qbits[q].theta * 2,
        })),
      },
    ];
    onLoadIntoLab(
      nQ,
      Array.from({ length: nQ }, () => 0),
      steps
    );
  };

  // Convergence SVG geometry
  const chartW = 620;
  const chartH = 190;
  const padL = 36;
  const padR = 14;
  const padT = 14;
  const padB = 24;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const chartPaths = useMemo(() => {
    const pts = qea.history;
    if (pts.length === 0) return { best: '', mean: '', entropy: '' };
    const maxG = Math.max(1, pts.length - 1);
    const maxF = Math.max(1, qea.maxPossibleFitness);

    const toX = (idx: number) => padL + (idx / maxG) * plotW;
    const toYFit = (f: number) => padT + (1 - Math.min(1, Math.max(0, f / maxF))) * plotH;
    const toYEnt = (h: number) => padT + (1 - Math.min(1, Math.max(0, h))) * plotH;

    const buildLine = (mapper: (p: typeof pts[number], i: number) => [number, number]) =>
      pts
        .map((p, i) => {
          const [x, y] = mapper(p, i);
          return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ');

    return {
      best: buildLine((p, i) => [toX(i), toYFit(p.bestFitness)]),
      mean: buildLine((p, i) => [toX(i), toYFit(p.meanFitness)]),
      entropy: buildLine((p, i) => [toX(i), toYEnt(p.entropy)]),
      catastrophes: pts
        .map((p, i) => (p.catastropheTriggered ? toX(i) : null))
        .filter((x): x is number => x !== null),
    };
  }, [qea.history, qea.maxPossibleFitness, plotW, plotH]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)_310px] gap-4 items-start">
      {/* LEFT PANEL: Variant Selector, Problem Landscape, Hyperparameters */}
      <aside className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            QEA Variant
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare how rotation strategies and diversity mechanisms evolve Q-bits.
          </p>
          <div className="mt-2.5 space-y-1.5">
            {(Object.keys(QEA_VARIANTS) as QEAVariant[]).map((vKey) => {
              const meta = QEA_VARIANTS[vKey];
              const active = variant === vKey;
              return (
                <button
                  key={vKey}
                  type="button"
                  onClick={() => setVariant(vKey)}
                  className={`w-full text-left px-3 py-2 rounded-md border transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-50 border-blue-400'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        active ? 'text-blue-900' : 'text-slate-800'
                      }`}
                    >
                      {meta.shortName}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {meta.yearOrOrigin}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {meta.mechanism}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optimization Problem Landscape */}
        <div className="pt-3 border-t border-slate-200 space-y-2">
          <span className="block text-xs font-semibold text-slate-800">
            Optimization Landscape
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            {(
              [
                {
                  id: 'knapsack',
                  title: '0/1 Knapsack (6 Items)',
                  sub: `Max value within ${KNAPSACK_CAPACITY} kg limit (opt = 80)`,
                },
                {
                  id: 'trap',
                  title: 'Deceptive Trap-6',
                  sub: 'Tests escaping local optima 000 toward 111111 (opt = 60)',
                },
                {
                  id: 'onemax',
                  title: 'OneMax (8 Bits)',
                  sub: 'Maximize number of 1s across 8 Q-bits (opt = 80)',
                },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setProblem(item.id);
                  handleReset(popSize, item.id);
                }}
                className={`text-left px-3 py-2 rounded-md border transition-colors cursor-pointer ${
                  problem === item.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-medium">{item.title}</div>
                <div
                  className={`text-[11px] ${
                    problem === item.id ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {item.sub}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Hyperparameters */}
        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 font-medium">Q-Bit Population (N)</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {popSize}
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={16}
              step={2}
              value={popSize}
              onChange={(e) => {
                const nextN = Number(e.target.value);
                setPopSize(nextN);
                handleReset(nextN, problem);
              }}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 font-medium">Rotation Step Δθ</span>
              <span className="font-mono font-semibold text-blue-700 tabular-nums">
                {formatAnglePi(baseDelta)}
              </span>
            </div>
            <input
              type="range"
              min={0.02 * Math.PI}
              max={0.14 * Math.PI}
              step={0.01 * Math.PI}
              value={baseDelta}
              onChange={(e) => setBaseDelta(parseFloat(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Active Variant Detail */}
        <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
          <div className="font-semibold text-slate-900 mb-1">
            {QEA_VARIANTS[variant].title}
          </div>
          {QEA_VARIANTS[variant].description}
        </div>
      </aside>

      {/* CENTER STAGE: Playback, Q-Bit Amplitude Circles, Rotation Matrix, Convergence Chart */}
      <div className="space-y-4 min-w-0">
        {/* Top Controls & Telemetry Bar */}
        <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="text-[11px] text-slate-500">Generation</div>
                <div className="text-lg font-mono font-bold text-slate-900 tabular-nums">
                  t = {qea.generation}
                </div>
              </div>
              <div className="h-7 w-px bg-slate-200" />
              <div>
                <div className="text-[11px] text-slate-500">Global Best</div>
                <div className="text-lg font-mono font-bold text-emerald-700 tabular-nums">
                  {qea.bestFitness} / {qea.maxPossibleFitness}
                </div>
              </div>
              <div className="h-7 w-px bg-slate-200" />
              <div>
                <div className="text-[11px] text-slate-500">Best Bitstring</div>
                <div className="text-sm font-mono font-semibold text-slate-900">
                  |{qea.bestBits.join('')}⟩
                </div>
              </div>
              <div className="h-7 w-px bg-slate-200" />
              <div>
                <div className="text-[11px] text-slate-500">Quantum Entropy</div>
                <div className="text-sm font-mono font-semibold text-amber-700 tabular-nums">
                  {((latestMetric?.entropy ?? 1) * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Playback Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleStepOne}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <StepForward className="w-3.5 h-3.5 text-blue-600" />
                Step 1
              </button>
              <button
                type="button"
                onClick={() => handleRunBatch(10)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5 text-slate-600" />
                +10 Gen
              </button>
              <button
                type="button"
                onClick={() => setIsRunning((r) => !r)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Evolve
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleReset(popSize, problem)}
                title="Reset to initial |+⟩ superposition"
                className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700">
            {qea.lastEventNote}
          </div>
        </section>

        {/* Live Q-Bit Chromosome Visualizer */}
        <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Q-Bit Register · Individual #{activeInd.id + 1}
              </h3>
              <p className="text-xs text-slate-500">
                Each Q-bit amplitude vector (α, β) rotates on the unit circle from 45° superposition toward |0⟩ or |1⟩. Click any Q-bit to inspect its U(Δθ) gate update.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportTopToLab}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              Send Top Q-Bits to Circuit Lab
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Q-Bit Circle Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 xl:grid-cols-8 gap-2.5">
            {activeInd.qbits.map((q, idx) => {
              const p0 = q.alpha * q.alpha;
              const p1 = q.beta * q.beta;
              const isSelected = idx === safeLocus;
              const bestBit = qea.bestBits[idx];
              const obsBit = activeInd.observedBits[idx];

              // SVG unit quadrant circle (cx=14, cy=56, r=42)
              const cx = 14;
              const cy = 56;
              const r = 40;
              const vx = cx + q.alpha * r;
              const vy = cy - q.beta * r;
              const supX = cx + Math.SQRT1_2 * r;
              const supY = cy - Math.SQRT1_2 * r;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedLocus(idx)}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/60 border-blue-400 ring-1 ring-blue-200'
                      : 'bg-slate-50/40 border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                    <span className="font-semibold text-slate-800">q{idx}</span>
                    <span className="text-slate-500">
                      x={obsBit} · b={bestBit}
                    </span>
                  </div>

                  {/* Quadrant unit circle showing rotation angle theta */}
                  <div className="flex justify-center my-1">
                    <svg width="70" height="70" viewBox="0 0 70 70">
                      {/* Quarter arc */}
                      <path
                        d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                        fill="none"
                        stroke="#cbd5e1"
                        strokeWidth="1.25"
                      />
                      {/* Axes */}
                      <line x1={cx} y1={cy} x2={cx + r + 4} y2={cy} stroke="#94a3b8" strokeWidth="1" />
                      <line x1={cx} y1={cy} x2={cx} y2={cy - r - 4} stroke="#94a3b8" strokeWidth="1" />
                      {/* 45 deg superposition guide */}
                      <line
                        x1={cx}
                        y1={cy}
                        x2={supX}
                        y2={supY}
                        stroke="#cbd5e1"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                      {/* Labels */}
                      <text x={cx + r + 5} y={cy + 3} className="fill-slate-500 font-mono text-[8px]">
                        |0⟩
                      </text>
                      <text x={cx - 4} y={cy - r - 6} className="fill-slate-500 font-mono text-[8px]">
                        |1⟩
                      </text>
                      {/* Amplitude state vector */}
                      <line
                        x1={cx}
                        y1={cy}
                        x2={vx}
                        y2={vy}
                        stroke={p1 > 0.5 ? '#059669' : '#2563eb'}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                      <circle
                        cx={vx}
                        cy={vy}
                        r="3"
                        fill={p1 > 0.5 ? '#059669' : '#2563eb'}
                      />
                    </svg>
                  </div>

                  {/* Probability bar P(|1>) */}
                  <div className="space-y-1">
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-blue-600"
                        style={{ width: `${p0 * 100}%` }}
                      />
                      <div
                        className="h-full bg-emerald-600"
                        style={{ width: `${p1 * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono tabular-nums text-slate-600">
                      <span>0:{(p0 * 100).toFixed(0)}%</span>
                      <span>1:{(p1 * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quantum Rotation Gate Matrix & Lookup Rule for selected locus */}
          <div className="pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 items-center">
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              <div className="text-xs font-mono text-slate-600">
                U(Δθ) =
              </div>
              <div className="border-l-2 border-r-2 border-slate-400 px-2 py-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px] tabular-nums bg-white">
                <span>cos(Δθ)</span>
                <span>−sin(Δθ)</span>
                <span>sin(Δθ)</span>
                <span>cos(Δθ)</span>
              </div>
              <div className="border-l-2 border-r-2 border-blue-500 px-2 py-1 flex flex-col font-mono text-[11px] tabular-nums bg-white">
                <span>{activeQBit.alpha.toFixed(3)}</span>
                <span>{activeQBit.beta.toFixed(3)}</span>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div className="font-medium text-slate-900">
                Locus q{safeLocus} Update Rule (Individual #{activeInd.id + 1})
              </div>
              <p>
                Observed bit <span className="font-mono font-semibold">x={activeX}</span> vs Global Best{' '}
                <span className="font-mono font-semibold">b={activeB}</span>{' '}
                ({activeFGeq ? 'f(x) ≥ f(b)' : 'f(x) < f(b)'}) →{' '}
                <span className="font-mono font-semibold text-blue-700">
                  {activeSign === 0
                    ? 'Δθ = 0 (aligned, no rotation)'
                    : activeSign > 0
                      ? `Rotate +Δθ toward |1⟩ (${formatAnglePi(activeQBit.lastDelta)})`
                      : `Rotate −Δθ toward |0⟩ (${formatAnglePi(activeQBit.lastDelta)})`}
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Convergence & Quantum Entropy Chart */}
        <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Convergence &amp; Superposition Entropy Curve
              </h3>
              <p className="text-xs text-slate-500">
                Tracks Global Best, Population Mean, and Quantum Entropy (how much superposition remains).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-600 inline-block" />
                Best Fitness
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-blue-600 inline-block" />
                Mean Fitness
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-600 inline-block" />
                Quantum Entropy H
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full h-48 overflow-visible"
              role="img"
              aria-label="Convergence and quantum entropy history"
            >
              {/* Horizontal reference lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const y = padT + (1 - frac) * plotH;
                return (
                  <g key={frac}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={chartW - padR}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeWidth="1"
                    />
                    <text
                      x={padL - 6}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-400 font-mono text-[9px]"
                    >
                      {Math.round(frac * qea.maxPossibleFitness)}
                    </text>
                  </g>
                );
              })}

              {/* Catastrophe vertical markers */}
              {chartPaths.catastrophes?.map((cxPos, i) => (
                <line
                  key={i}
                  x1={cxPos}
                  y1={padT}
                  x2={cxPos}
                  y2={padT + plotH}
                  stroke="#dc2626"
                  strokeWidth="1"
                  strokeDasharray="3 2"
                />
              ))}

              {/* Quantum Entropy dashed curve */}
              {chartPaths.entropy && (
                <path
                  d={chartPaths.entropy}
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="1.75"
                  strokeDasharray="4 3"
                />
              )}

              {/* Mean Fitness curve */}
              {chartPaths.mean && (
                <path
                  d={chartPaths.mean}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2"
                />
              )}

              {/* Best Fitness curve */}
              {chartPaths.best && (
                <path
                  d={chartPaths.best}
                  fill="none"
                  stroke="#059669"
                  strokeWidth="2.5"
                />
              )}

              {/* X-axis label */}
              <text
                x={padL + plotW / 2}
                y={chartH - 4}
                textAnchor="middle"
                className="fill-slate-500 font-mono text-[10px]"
              >
                Generations (0 → {qea.generation})
              </text>
            </svg>
          </div>
        </section>
      </div>

      {/* RIGHT PANEL: Population Register & Problem Breakdown */}
      <aside className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Observed Population
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Click row to inspect
            </span>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {qea.population.map((ind, idx) => {
              const isSelected = idx === safeIndIdx;
              const isBestMatch = ind.fitness === qea.bestFitness;
              return (
                <button
                  key={ind.id}
                  type="button"
                  onClick={() => setSelectedIndIdx(idx)}
                  className={`w-full text-left px-2.5 py-2 rounded-md border flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-blue-400'
                      : 'bg-slate-50/50 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] text-slate-400 w-5">
                      #{ind.id + 1}
                    </span>
                    <span className="font-mono font-semibold text-slate-900 truncate">
                      {ind.observedBits.join('')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                    {!ind.isFeasible && (
                      <span className="text-[10px] font-sans text-amber-700">
                        overweight
                      </span>
                    )}
                    <span
                      className={`font-semibold ${
                        isBestMatch ? 'text-emerald-700' : 'text-slate-700'
                      }`}
                    >
                      {ind.fitness}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Problem-Specific Solution Decoder */}
        {problem === 'knapsack' && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Best Knapsack Packing
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-600">
                {qea.bestBits.reduce(
                  (w, b, i) => w + (b ? KNAPSACK_ITEMS[i].weight : 0),
                  0
                )}{' '}
                / {KNAPSACK_CAPACITY} kg
              </span>
            </div>
            <div className="space-y-1">
              {KNAPSACK_ITEMS.map((item, i) => {
                const picked = qea.bestBits[i] === 1;
                return (
                  <div
                    key={item.name}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-xs ${
                      picked
                        ? 'bg-emerald-50/70 border-emerald-200 text-slate-900 font-medium'
                        : 'bg-slate-50 border-slate-200/70 text-slate-400'
                    }`}
                  >
                    <span>
                      {picked ? '✓ ' : ''}
                      {item.name}
                    </span>
                    <span className="font-mono tabular-nums text-[11px]">
                      {item.weight}kg · val {item.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {problem === 'trap' && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Deceptive Trap Blocks
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Each 3-bit block rewards <span className="font-mono">000</span> (16 pts) as a local trap, while <span className="font-mono">111</span> gives 30 pts. Watch how Catastrophic QEA escapes <span className="font-mono">000</span>!
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
              {[0, 1].map((blk) => {
                const bits = qea.bestBits.slice(blk * 3, blk * 3 + 3);
                const solved = bits.every((b) => b === 1);
                return (
                  <div
                    key={blk}
                    className={`p-2 rounded border text-center ${
                      solved
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    Block {blk + 1}: {bits.join('')}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {problem === 'onemax' && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">
              OneMax Progress
            </h3>
            <p className="text-xs text-slate-600">
              Global best has{' '}
              <span className="font-mono font-semibold text-slate-900">
                {qea.bestBits.reduce((a, b) => a + b, 0)} / {qea.bestBits.length}
              </span>{' '}
              bits set to <span className="font-mono">|1⟩</span>.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
};
