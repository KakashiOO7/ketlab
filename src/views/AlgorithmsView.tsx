import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { BlochSphere } from '../components/BlochSphere';
import { CircuitDiagram } from '../components/CircuitDiagram';
import { MatrixStepPanel } from '../components/MatrixStepPanel';
import { StateVectorView } from '../components/StateVectorView';
import {
  DeutschOracleType,
  buildDeutschJozsaCircuit,
  buildGroverCircuit,
  buildQFT3Circuit,
  buildTeleportationCircuit,
} from '../quantum/algorithms';
import { formatAnglePi } from '../quantum/complex';
import { simulateCircuit } from '../quantum/simulator';
import { CircuitStep } from '../quantum/types';

export type AlgorithmTab = 'grover' | 'deutsch-jozsa' | 'teleportation' | 'qft';

interface AlgorithmsViewProps {
  onLoadIntoLab: (numQubits: number, initialBits: number[], steps: CircuitStep[]) => void;
}

export const AlgorithmsView: React.FC<AlgorithmsViewProps> = ({ onLoadIntoLab }) => {
  const [activeAlgo, setActiveAlgo] = useState<AlgorithmTab>('grover');

  // Grover state
  const [groverQubits, setGroverQubits] = useState<2 | 3>(3);
  const [groverTarget, setGroverTarget] = useState<string>('101');
  const [groverIterations, setGroverIterations] = useState<number>(2);

  // Deutsch-Jozsa state
  const [djOracle, setDjOracle] = useState<DeutschOracleType>('balanced-xor');

  // Teleportation state
  const [tpTheta, setTpTheta] = useState<number>(Math.PI / 3);
  const [tpPhi, setTpPhi] = useState<number>(Math.PI / 2);

  // QFT state
  const [qftInput, setQftInput] = useState<number>(3);

  // Playback state
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedMatrixRow, setSelectedMatrixRow] = useState<number | null>(0);
  const [showMatrix, setShowMatrix] = useState<boolean>(false);

  // Adjust target bitstring when switching 2Q / 3Q Grover
  useEffect(() => {
    if (groverQubits === 2 && groverTarget.length !== 2) {
      setGroverTarget('11');
      setGroverIterations(1);
    } else if (groverQubits === 3 && groverTarget.length !== 3) {
      setGroverTarget('101');
      setGroverIterations(2);
    }
  }, [groverQubits, groverTarget.length]);

  const built = useMemo(() => {
    if (activeAlgo === 'grover') {
      const safeTarget =
        groverTarget.length === groverQubits
          ? groverTarget
          : '1'.repeat(groverQubits);
      return {
        numQubits: groverQubits,
        ...buildGroverCircuit(groverQubits, safeTarget, groverIterations),
      };
    }
    if (activeAlgo === 'deutsch-jozsa') {
      return {
        numQubits: 3,
        ...buildDeutschJozsaCircuit(djOracle),
      };
    }
    if (activeAlgo === 'teleportation') {
      return {
        numQubits: 3,
        ...buildTeleportationCircuit(tpTheta, tpPhi, 1, 1),
      };
    }
    return {
      numQubits: 3,
      ...buildQFT3Circuit(qftInput),
    };
  }, [
    activeAlgo,
    groverQubits,
    groverTarget,
    groverIterations,
    djOracle,
    tpTheta,
    tpPhi,
    qftInput,
  ]);

  const snapshots = useMemo(
    () => simulateCircuit(built.numQubits, built.initialBits, built.steps),
    [built]
  );

  // Clamp step index on algorithm change
  const clampedStep = Math.min(stepIndex, snapshots.length - 1);
  const currentSnapshot = snapshots[clampedStep];
  const prevSnapshot = clampedStep > 0 ? snapshots[clampedStep - 1] : undefined;

  useEffect(() => {
    setStepIndex(snapshots.length - 1);
    setIsPlaying(false);
  }, [activeAlgo, groverQubits, groverTarget, groverIterations, djOracle, qftInput, snapshots.length]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      setStepIndex((prev) => {
        if (prev >= snapshots.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1050);
    return () => window.clearInterval(id);
  }, [isPlaying, snapshots.length]);

  const algoMeta: Record<
    AlgorithmTab,
    { title: string; subtitle: string; insight: string }
  > = {
    grover: {
      title: "Grover's Amplitude Amplification",
      subtitle:
        'Unstructured search achieving O(√N) speedup by alternating phase-flip Oracles with Inversion-about-the-Mean Diffusers.',
      insight:
        groverQubits === 2
          ? 'With N = 4 states, 1 Grover iteration amplifies the target state to 100% probability. Running 2+ iterations over-rotates past the target!'
          : 'With N = 8 states, optimal amplification occurs at k = 2 iterations (94.5% probability). Notice how the oracle flips the target negative, then the diffuser reflects across the dashed mean μ.',
    },
    'deutsch-jozsa': {
      title: 'Deutsch–Jozsa Algorithm',
      subtitle:
        'Determines whether an unknown binary oracle f(x) is Constant or Balanced in a single quantum query.',
      insight:
        'Watch q₀ and q₁ in the final step: when f is Constant, all amplitudes constructively interfere into |00⟩ (100% on q₀q₁ = 00). When Balanced, |00⟩ cancels out to 0%!',
    },
    teleportation: {
      title: 'Quantum Teleportation Protocol',
      subtitle:
        'Transfers an arbitrary quantum state |ψ⟩ from Alice (q₀) to Bob (q₂) using shared Bell entanglement and 2 classical bits.',
      insight:
        'Compare q₀’s Bloch vector after Step 2 (prepared payload) with Bob’s q₂ Bloch vector at the final step—Bob recovers the exact (θ, φ) state without physically sending the qubit.',
    },
    qft: {
      title: 'Quantum Fourier Transform (3-Qubit QFT)',
      subtitle:
        'Maps computational basis states into phase-encoded frequency spirals across the complex unit circle.',
      insight:
        'Notice the Phasor Dials: every basis state ends with equal probability (12.5%), while the complex phase rotates linearly at frequency k = input integer x.',
    },
  };

  return (
    <div className="space-y-4">
      {/* Algorithm Selector Tabs */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          {(
            [
              { id: 'grover', label: "Grover's Search" },
              { id: 'deutsch-jozsa', label: 'Deutsch–Jozsa' },
              { id: 'teleportation', label: 'Teleportation' },
              { id: 'qft', label: 'Quantum Fourier Transform' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveAlgo(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeAlgo === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            onLoadIntoLab(built.numQubits, built.initialBits, built.steps)
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
        >
          Open in Circuit Lab
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Algorithm Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-[310px_minmax(0,1fr)] gap-4 items-start">
        {/* Left: Algorithm Parameters & Concept Guide */}
        <aside className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {algoMeta[activeAlgo].title}
            </h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              {algoMeta[activeAlgo].subtitle}
            </p>
          </div>

          {/* Grover Controls */}
          {activeAlgo === 'grover' && (
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div>
                <span className="block text-xs font-medium text-slate-700 mb-1.5">
                  Search Space Size
                </span>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md border border-slate-200">
                  {([2, 3] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setGroverQubits(n)}
                      className={`py-1.5 text-xs font-mono rounded transition-colors cursor-pointer ${
                        groverQubits === n
                          ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {n} Qubits (N={1 << n})
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 mb-1.5">
                  Marked Target State
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 1 << groverQubits }, (_, i) => {
                    const bits = i.toString(2).padStart(groverQubits, '0');
                    const active = groverTarget === bits;
                    return (
                      <button
                        key={bits}
                        type="button"
                        onClick={() => setGroverTarget(bits)}
                        className={`py-1.5 text-xs font-mono rounded border transition-colors cursor-pointer ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        |{bits}⟩
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">
                    Grover Iterations (k)
                  </span>
                  <span className="font-mono font-semibold text-blue-700">
                    k = {groverIterations}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[1, 2, 3].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setGroverIterations(k)}
                      className={`py-1.5 text-xs font-mono rounded border transition-colors cursor-pointer ${
                        groverIterations === k
                          ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      k = {k}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Optimal k ≈ (π/4)√N:{' '}
                  {groverQubits === 2 ? '1 iteration (100%)' : '2 iterations (94.5%)'}.
                </p>
              </div>
            </div>
          )}

          {/* Deutsch-Jozsa Controls */}
          {activeAlgo === 'deutsch-jozsa' && (
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <span className="block text-xs font-medium text-slate-700">
                Select Oracle Function f(x₀, x₁)
              </span>
              {(
                [
                  { id: 'constant-0', label: 'Constant: f(x) = 0', type: 'Constant' },
                  { id: 'constant-1', label: 'Constant: f(x) = 1', type: 'Constant' },
                  { id: 'balanced-x0', label: 'Balanced: f(x) = x₀', type: 'Balanced' },
                  { id: 'balanced-xor', label: 'Balanced: f(x) = x₀ ⊕ x₁', type: 'Balanced' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDjOracle(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-md border flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    djOracle === item.id
                      ? 'bg-blue-50 border-blue-400 text-blue-900 font-medium'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <span className="font-mono">{item.label}</span>
                  <span className="text-[11px] text-slate-500">{item.type}</span>
                </button>
              ))}
            </div>
          )}

          {/* Teleportation Controls */}
          {activeAlgo === 'teleportation' && (
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 font-medium">Payload Polar θ</span>
                  <span className="font-mono text-blue-700">
                    {formatAnglePi(tpTheta)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.PI}
                  step={Math.PI / 12}
                  value={tpTheta}
                  onChange={(e) => setTpTheta(parseFloat(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 font-medium">Payload Phase φ</span>
                  <span className="font-mono text-blue-700">
                    {formatAnglePi(tpPhi)}
                  </span>
                </div>
                <input
                  type="range"
                  min={-Math.PI}
                  max={Math.PI}
                  step={Math.PI / 12}
                  value={tpPhi}
                  onChange={(e) => setTpPhi(parseFloat(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* QFT Controls */}
          {activeAlgo === 'qft' && (
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <span className="block text-xs font-medium text-slate-700">
                Input Basis State |x⟩
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 8 }, (_, x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setQftInput(x)}
                    className={`py-1.5 text-xs font-mono rounded border transition-colors cursor-pointer ${
                      qftInput === x
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    |{x.toString(2).padStart(3, '0')}⟩
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                Input integer x = {qftInput} sets phase step 2π·{qftInput}/8 ={' '}
                {formatAnglePi((2 * Math.PI * qftInput) / 8)} per state.
              </p>
            </div>
          )}

          {/* Key Concept Insight */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-xs font-semibold text-slate-800 mb-1">
              Key Geometric Intuition
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {algoMeta[activeAlgo].insight}
            </p>
          </div>

          {/* Bloch Sphere Preview for Qubit 0 / Bob's Qubit 2 */}
          <div className="pt-2 border-t border-slate-200 flex justify-center">
            <BlochSphere
              vector={
                activeAlgo === 'teleportation'
                  ? currentSnapshot.blochVectors[2]
                  : currentSnapshot.blochVectors[0]
              }
              previousVector={
                activeAlgo === 'teleportation'
                  ? prevSnapshot?.blochVectors[2]
                  : prevSnapshot?.blochVectors[0]
              }
              size={210}
              label={
                activeAlgo === 'teleportation'
                  ? "Bob's Qubit (q₂)"
                  : 'Qubit q₀ Reduced State'
              }
            />
          </div>
        </aside>

        {/* Right: Step-by-Step Circuit + Live Amplitude/Phase Evolution */}
        <div className="space-y-4 min-w-0">
          <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono text-blue-700 font-semibold tabular-nums">
                  Stage {clampedStep} of {snapshots.length - 1} · {currentSnapshot.label}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {currentSnapshot.note}
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setStepIndex(0);
                  }}
                  className="p-1.5 rounded text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer"
                  title="Initial state"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setStepIndex((p) => Math.max(0, p - 1));
                  }}
                  className="p-1.5 rounded text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer"
                  title="Previous stage"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (clampedStep >= snapshots.length - 1) setStepIndex(0);
                    setIsPlaying((p) => !p);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3 h-3" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" /> Animate Steps
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setStepIndex((p) => Math.min(snapshots.length - 1, p + 1));
                  }}
                  className="p-1.5 rounded text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer"
                  title="Next stage"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setStepIndex(snapshots.length - 1);
                  }}
                  className="p-1.5 rounded text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer"
                  title="Final state"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <CircuitDiagram
              numQubits={built.numQubits}
              initialBits={built.initialBits}
              steps={built.steps}
              activeStepIndex={clampedStep}
              editable={false}
              onSelectStep={(idx) => {
                setIsPlaying(false);
                setStepIndex(idx);
              }}
            />
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <span className="text-xs text-slate-500">
                Observe amplitude sign flips, phase rotation, and probability concentration
              </span>
              <button
                type="button"
                onClick={() => setShowMatrix((v) => !v)}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
              >
                {showMatrix ? 'Hide Step Matrix' : 'Show Step Matrix U_t'}
              </button>
            </div>

            <StateVectorView
              numQubits={built.numQubits}
              stateVector={currentSnapshot.stateVector}
              previousVector={prevSnapshot?.stateVector}
              markedBitstring={activeAlgo === 'grover' ? groverTarget : undefined}
              showMeanLine={activeAlgo === 'grover'}
              selectedBasisRow={selectedMatrixRow}
              onSelectBasisRow={setSelectedMatrixRow}
            />

            {showMatrix && (
              <div className="pt-4 border-t border-slate-200">
                <MatrixStepPanel
                  numQubits={built.numQubits}
                  snapshot={currentSnapshot}
                  selectedRow={selectedMatrixRow}
                  onSelectRow={setSelectedMatrixRow}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
