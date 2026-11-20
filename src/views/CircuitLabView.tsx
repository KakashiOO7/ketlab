import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipBack,
  SkipForward,
  Trash2,
} from 'lucide-react';
import { BlochSphere, getGateRotationSpec } from '../components/BlochSphere';
import { CircuitDiagram, CircuitDragPayload } from '../components/CircuitDiagram';
import { MatrixStepPanel } from '../components/MatrixStepPanel';
import { StateVectorView } from '../components/StateVectorView';
import { formatAnglePi, formatKet } from '../quantum/complex';
import { CIRCUIT_PRESETS, GATE_CATALOG } from '../quantum/gates';
import { sampleShots, simulateCircuit } from '../quantum/simulator';
import { CircuitGate, CircuitStep, GateKind } from '../quantum/types';

interface CircuitLabViewProps {
  numQubits: number;
  initialBits: number[];
  steps: CircuitStep[];
  onChangeNumQubits: (n: number) => void;
  onChangeInitialBits: (bits: number[]) => void;
  onChangeSteps: (steps: CircuitStep[]) => void;
}

const SINGLE_GATES: GateKind[] = ['H', 'X', 'Y', 'Z', 'S', 'T', 'Rx', 'Ry', 'Rz'];
const MULTI_GATES: GateKind[] = ['CNOT', 'CZ', 'CP', 'SWAP', 'CCX'];

export const CircuitLabView: React.FC<CircuitLabViewProps> = ({
  numQubits,
  initialBits,
  steps,
  onChangeNumQubits,
  onChangeInitialBits,
  onChangeSteps,
}) => {
  const [activeStepIndex, setActiveStepIndex] = useState<number>(steps.length);
  const [isPlaying, setIsPlaying] = useState(false);
  const [armedGate, setArmedGate] = useState<GateKind | null>('H');
  const [selectedGateRef, setSelectedGateRef] = useState<{
    stepIdx: number;
    gateId: string;
  } | null>(null);
  const [selectedQubitBloch, setSelectedQubitBloch] = useState<number>(0);
  const [selectedMatrixRow, setSelectedMatrixRow] = useState<number | null>(0);
  const [inspectorMode, setInspectorMode] = useState<'both' | 'vector' | 'matrix'>('both');
  const [dragPayload, setDragPayload] = useState<CircuitDragPayload | null>(null);
  const [animateBloch, setAnimateBloch] = useState<boolean>(true);
  const [blochReplayKey, setBlochReplayKey] = useState<number>(0);

  // Measurement simulator state
  const [lastSingleShot, setLastSingleShot] = useState<string | null>(null);
  const [shotCounts, setShotCounts] = useState<number[] | null>(null);

  const snapshots = useMemo(
    () => simulateCircuit(numQubits, initialBits, steps),
    [numQubits, initialBits, steps]
  );

  // Keep activeStepIndex in bounds
  const clampedStepIdx = Math.min(activeStepIndex, snapshots.length - 1);
  const currentSnapshot = snapshots[clampedStepIdx];
  const previousSnapshot = clampedStepIdx > 0 ? snapshots[clampedStepIdx - 1] : undefined;

  useEffect(() => {
    setActiveStepIndex(snapshots.length - 1);
  }, [snapshots.length]);

  useEffect(() => {
    if (selectedQubitBloch >= numQubits) {
      setSelectedQubitBloch(0);
    }
  }, [numQubits, selectedQubitBloch]);

  useEffect(() => {
    setLastSingleShot(null);
    setShotCounts(null);
  }, [clampedStepIdx, steps, initialBits, numQubits]);

  // Auto-playback timer
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setActiveStepIndex((prev) => {
        if (prev >= snapshots.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1100);
    return () => window.clearInterval(timer);
  }, [isPlaying, snapshots.length]);

  const selectedGate: CircuitGate | undefined = useMemo(() => {
    if (!selectedGateRef) return undefined;
    const st = steps[selectedGateRef.stepIdx];
    return st?.gates.find((g) => g.id === selectedGateRef.gateId);
  }, [selectedGateRef, steps]);

  const createGateForSlot = (kind: GateKind, qubit: number): CircuitGate | null => {
    const meta = GATE_CATALOG[kind];
    if (meta.qubitsRequired > numQubits) return null;

    const id = `gate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (meta.qubitsRequired === 1) {
      return {
        id,
        kind,
        target: qubit,
        angle: meta.hasAngle ? Math.PI / 2 : undefined,
      };
    }
    if (meta.qubitsRequired === 2) {
      const target = qubit === numQubits - 1 ? qubit - 1 : qubit + 1;
      const control = qubit;
      return {
        id,
        kind,
        control,
        target,
        angle: meta.hasAngle ? Math.PI / 2 : undefined,
      };
    }
    // 3-qubit Toffoli
    const wires = [0, 1, 2].filter((w) => w < numQubits);
    const target = wires.includes(qubit) ? qubit : 2;
    const controls = wires.filter((w) => w !== target);
    return {
      id,
      kind,
      control: controls[0],
      control2: controls[1],
      target,
    };
  };

  const placeSpecificGateAt = (kind: GateKind, stepIdx: number, qubit: number) => {
    const newGate = createGateForSlot(kind, qubit);
    if (!newGate) return;

    const occupiedWires = new Set<number>([newGate.target]);
    if (newGate.control !== undefined) occupiedWires.add(newGate.control);
    if (newGate.control2 !== undefined) occupiedWires.add(newGate.control2);

    const nextSteps = steps.map((st, idx) => {
      if (idx !== stepIdx) return st;
      const filtered = st.gates.filter((g) => {
        const gw = [g.target, g.control, g.control2].filter(
          (w): w is number => w !== undefined
        );
        return !gw.some((w) => occupiedWires.has(w));
      });
      return { ...st, gates: [...filtered, newGate] };
    });

    onChangeSteps(nextSteps);
    setSelectedGateRef({ stepIdx, gateId: newGate.id });
    setActiveStepIndex(stepIdx + 1);
  };

  const handlePlaceGateAt = (stepIdx: number, qubit: number) => {
    if (!armedGate) return;
    placeSpecificGateAt(armedGate, stepIdx, qubit);
  };

  const computeMovedGate = (
    gate: CircuitGate,
    role: 'target' | 'control' | 'control2',
    targetQubit: number,
    sameStep: boolean
  ): CircuitGate => {
    const req = GATE_CATALOG[gate.kind].qubitsRequired;
    if (req === 1) {
      return { ...gate, target: targetQubit };
    }
    if (req === 2) {
      if (sameStep) {
        if (role === 'control') {
          if (targetQubit === gate.target) {
            return { ...gate, control: gate.target, target: gate.control ?? 0 };
          }
          return { ...gate, control: targetQubit };
        }
        // dragging target within same step
        if (targetQubit === gate.control) {
          return { ...gate, target: gate.control ?? 0, control: gate.target };
        }
        return { ...gate, target: targetQubit };
      }
      // Moving 2-qubit gate to another column: preserve relative span if valid
      const oldSpan = (gate.control ?? 0) - gate.target;
      if (role === 'control') {
        const candidateTgt = targetQubit - oldSpan;
        const nextTgt =
          candidateTgt >= 0 && candidateTgt < numQubits && candidateTgt !== targetQubit
            ? candidateTgt
            : targetQubit === numQubits - 1
              ? targetQubit - 1
              : targetQubit + 1;
        return { ...gate, control: targetQubit, target: nextTgt };
      }
      const candidateCtrl = targetQubit + oldSpan;
      const nextCtrl =
        candidateCtrl >= 0 && candidateCtrl < numQubits && candidateCtrl !== targetQubit
          ? candidateCtrl
          : targetQubit === 0
            ? 1
            : targetQubit - 1;
      return { ...gate, target: targetQubit, control: nextCtrl };
    }

    // 3-qubit CCX
    if (sameStep) {
      if (role === 'control') {
        if (targetQubit === gate.target) {
          return { ...gate, control: gate.target, target: gate.control ?? 0 };
        }
        if (targetQubit === gate.control2) {
          return { ...gate, control: gate.control2, control2: gate.control ?? 0 };
        }
        return { ...gate, control: targetQubit };
      }
      if (role === 'control2') {
        if (targetQubit === gate.target) {
          return { ...gate, control2: gate.target, target: gate.control2 ?? 1 };
        }
        if (targetQubit === gate.control) {
          return { ...gate, control2: gate.control, control: gate.control2 ?? 1 };
        }
        return { ...gate, control2: targetQubit };
      }
      if (targetQubit === gate.control) {
        return { ...gate, target: gate.control ?? 0, control: gate.target };
      }
      if (targetQubit === gate.control2) {
        return { ...gate, target: gate.control2 ?? 1, control2: gate.target };
      }
      return { ...gate, target: targetQubit };
    }

    // Moving CCX across columns
    const available = Array.from({ length: numQubits }, (_, i) => i).filter(
      (i) => i !== targetQubit
    );
    if (role === 'control') {
      return {
        ...gate,
        control: targetQubit,
        control2: available[0] ?? 1,
        target: available[1] ?? 2,
      };
    }
    if (role === 'control2') {
      return {
        ...gate,
        control: available[0] ?? 0,
        control2: targetQubit,
        target: available[1] ?? 2,
      };
    }
    return {
      ...gate,
      control: available[0] ?? 0,
      control2: available[1] ?? 1,
      target: targetQubit,
    };
  };

  const applyGateIntoSteps = (
    baseSteps: CircuitStep[],
    destStepIdx: number,
    gateToPlace: CircuitGate
  ): CircuitStep[] => {
    const occupied = new Set<number>([gateToPlace.target]);
    if (gateToPlace.control !== undefined) occupied.add(gateToPlace.control);
    if (gateToPlace.control2 !== undefined) occupied.add(gateToPlace.control2);

    return baseSteps.map((st, idx) => {
      if (idx !== destStepIdx) return st;
      const filtered = st.gates.filter((g) => {
        const gw = [g.target, g.control, g.control2].filter(
          (w): w is number => w !== undefined
        );
        return !gw.some((w) => occupied.has(w));
      });
      return { ...st, gates: [...filtered, gateToPlace] };
    });
  };

  const handleDropOnCell = (targetStepIdx: number, targetQubit: number) => {
    if (!dragPayload) return;
    if (dragPayload.source === 'palette') {
      placeSpecificGateAt(dragPayload.kind, targetStepIdx, targetQubit);
      setDragPayload(null);
      return;
    }

    const sourceStep = steps[dragPayload.stepIdx];
    const draggedGate = sourceStep?.gates.find((g) => g.id === dragPayload.gateId);
    if (!draggedGate) {
      setDragPayload(null);
      return;
    }

    const sameStep = dragPayload.stepIdx === targetStepIdx;
    const movedGate = computeMovedGate(
      draggedGate,
      dragPayload.role,
      targetQubit,
      sameStep
    );

    const strippedSteps = steps.map((st, idx) =>
      idx === dragPayload.stepIdx
        ? { ...st, gates: st.gates.filter((g) => g.id !== draggedGate.id) }
        : st
    );

    const finalSteps = applyGateIntoSteps(strippedSteps, targetStepIdx, movedGate);
    onChangeSteps(finalSteps);
    setSelectedGateRef({ stepIdx: targetStepIdx, gateId: movedGate.id });
    setActiveStepIndex(targetStepIdx + 1);
    setDragPayload(null);
  };

  const handleDropOnNewStep = (targetQubit: number) => {
    if (!dragPayload) return;
    if (dragPayload.source === 'palette') {
      const newGate = createGateForSlot(dragPayload.kind, targetQubit);
      if (!newGate) {
        setDragPayload(null);
        return;
      }
      const nextSteps: CircuitStep[] = [
        ...steps,
        { id: `step-${Date.now()}`, gates: [newGate] },
      ];
      onChangeSteps(nextSteps);
      setSelectedGateRef({ stepIdx: nextSteps.length - 1, gateId: newGate.id });
      setActiveStepIndex(nextSteps.length);
      setDragPayload(null);
      return;
    }

    const sourceStep = steps[dragPayload.stepIdx];
    const draggedGate = sourceStep?.gates.find((g) => g.id === dragPayload.gateId);
    if (!draggedGate) {
      setDragPayload(null);
      return;
    }

    const strippedSteps = steps.map((st, idx) =>
      idx === dragPayload.stepIdx
        ? { ...st, gates: st.gates.filter((g) => g.id !== draggedGate.id) }
        : st
    );
    const nextSteps: CircuitStep[] = [
      ...strippedSteps,
      { id: `step-${Date.now()}`, gates: [draggedGate] },
    ];
    onChangeSteps(nextSteps);
    setSelectedGateRef({ stepIdx: nextSteps.length - 1, gateId: draggedGate.id });
    setActiveStepIndex(nextSteps.length);
    setDragPayload(null);
  };

  const handleDropOnTrash = () => {
    if (dragPayload?.source === 'circuit') {
      handleRemoveGate(dragPayload.stepIdx, dragPayload.gateId);
    }
    setDragPayload(null);
  };

  const handleAppendGate = (kind: GateKind) => {
    setArmedGate(kind);
    const meta = GATE_CATALOG[kind];
    if (meta.qubitsRequired > numQubits) return;

    const defaultQubit = meta.qubitsRequired === 3 ? 2 : 0;
    const newGate = createGateForSlot(kind, defaultQubit);
    if (!newGate) return;

    const newStep: CircuitStep = {
      id: `step-${Date.now()}`,
      gates: [newGate],
    };
    const nextSteps = [...steps, newStep];
    onChangeSteps(nextSteps);
    setSelectedGateRef({ stepIdx: nextSteps.length - 1, gateId: newGate.id });
    setActiveStepIndex(nextSteps.length);
  };

  const handleUpdateSelectedGate = (patch: Partial<CircuitGate>) => {
    if (!selectedGateRef) return;
    const nextSteps = steps.map((st, idx) => {
      if (idx !== selectedGateRef.stepIdx) return st;
      return {
        ...st,
        gates: st.gates.map((g) =>
          g.id === selectedGateRef.gateId ? { ...g, ...patch } : g
        ),
      };
    });
    onChangeSteps(nextSteps);
  };

  const handleRemoveGate = (stepIdx: number, gateId: string) => {
    const nextSteps = steps.map((st, idx) =>
      idx === stepIdx ? { ...st, gates: st.gates.filter((g) => g.id !== gateId) } : st
    );
    onChangeSteps(nextSteps);
    if (selectedGateRef?.gateId === gateId) setSelectedGateRef(null);
  };

  const handleAddStep = () => {
    const nextSteps = [
      ...steps,
      { id: `step-${Date.now()}`, gates: [] },
    ];
    onChangeSteps(nextSteps);
  };

  const handleRemoveStep = (stepIdx: number) => {
    if (steps.length <= 1) return;
    const nextSteps = steps.filter((_, idx) => idx !== stepIdx);
    onChangeSteps(nextSteps);
    setSelectedGateRef(null);
    setActiveStepIndex((prev) => Math.min(prev, nextSteps.length));
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = CIRCUIT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onChangeNumQubits(preset.numQubits);
    onChangeInitialBits(preset.initialBits);
    onChangeSteps(preset.steps);
    setSelectedGateRef(null);
    setActiveStepIndex(0);
    setIsPlaying(true);
  };

  const handleResetCircuit = () => {
    onChangeInitialBits(Array.from({ length: numQubits }, () => 0));
    onChangeSteps([
      {
        id: `step-clean-${Date.now()}`,
        gates: [{ id: `g-clean-${Date.now()}`, kind: 'H', target: 0 }],
      },
    ]);
    setSelectedGateRef(null);
    setActiveStepIndex(1);
    setIsPlaying(false);
  };

  const handleSampleOneShot = () => {
    const counts = sampleShots(currentSnapshot.probabilities, 1);
    const winningIdx = counts.findIndex((c) => c === 1);
    setLastSingleShot(formatKet(winningIdx >= 0 ? winningIdx : 0, numQubits));
  };

  const handleSample1024Shots = () => {
    setShotCounts(sampleShots(currentSnapshot.probabilities, 1024));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)_320px] gap-4 items-start">
      {/* LEFT RAIL: Circuit Setup & Gate Palette */}
      <aside className="bg-white border border-slate-200 rounded-lg p-4 space-y-5">
        {/* Qubit Register Size */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-800">
              Qubit Register
            </span>
            <span className="text-[11px] font-mono text-slate-500 tabular-nums">
              2^{numQubits} = {1 << numQubits} states
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-md border border-slate-200">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  onChangeNumQubits(n);
                  onChangeInitialBits(
                    Array.from({ length: n }, (_, i) => initialBits[i] ?? 0)
                  );
                  // Filter out gates referencing deleted qubits
                  onChangeSteps(
                    steps.map((st) => ({
                      ...st,
                      gates: st.gates.filter(
                        (g) =>
                          g.target < n &&
                          (g.control === undefined || g.control < n) &&
                          (g.control2 === undefined || g.control2 < n)
                      ),
                    }))
                  );
                  setSelectedGateRef(null);
                }}
                className={`py-1.5 text-xs font-mono font-medium rounded transition-colors cursor-pointer ${
                  numQubits === n
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {n}Q
              </button>
            ))}
          </div>
        </div>

        {/* Single-Qubit Gate Palette */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-800">
              Single-Qubit Gates
            </span>
            <span className="text-[11px] text-slate-400">Click or drag onto wire</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {SINGLE_GATES.map((kind) => {
              const meta = GATE_CATALOG[kind];
              const isArmed = armedGate === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', kind);
                    setArmedGate(kind);
                    setDragPayload({ source: 'palette', kind });
                  }}
                  onDragEnd={() => setDragPayload(null)}
                  onClick={() => setArmedGate(kind)}
                  onDoubleClick={() => handleAppendGate(kind)}
                  title={`${meta.name}: ${meta.summary} (Drag onto circuit wire, or click to arm)`}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-md border text-xs font-mono font-semibold transition-all cursor-grab active:cursor-grabbing ${
                    isArmed
                      ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-300'
                      : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-white'
                  }`}
                  style={{ color: meta.accentHex }}
                >
                  <span>{meta.symbol}</span>
                  <span className="text-[10px] font-sans font-normal text-slate-500 truncate max-w-full px-1">
                    {kind === 'Rx' || kind === 'Ry' || kind === 'Rz' ? 'Rot(θ)' : meta.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Multi-Qubit Gates */}
        <div>
          <span className="block text-xs font-semibold text-slate-800 mb-2">
            Multi-Qubit Gates
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {MULTI_GATES.map((kind) => {
              const meta = GATE_CATALOG[kind];
              const disabled = meta.qubitsRequired > numQubits;
              const isArmed = armedGate === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  disabled={disabled}
                  draggable={!disabled}
                  onDragStart={(e) => {
                    if (disabled) return;
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', kind);
                    setArmedGate(kind);
                    setDragPayload({ source: 'palette', kind });
                  }}
                  onDragEnd={() => setDragPayload(null)}
                  onClick={() => setArmedGate(kind)}
                  title={
                    disabled
                      ? `Requires at least ${meta.qubitsRequired} qubits`
                      : `${meta.name}: ${meta.summary} (Drag onto circuit wire, or click to arm)`
                  }
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-md border text-xs font-mono font-semibold transition-all ${
                    disabled
                      ? 'opacity-40 bg-slate-50 border-slate-200 cursor-not-allowed'
                      : isArmed
                        ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-300 cursor-grab active:cursor-grabbing'
                        : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-white cursor-grab active:cursor-grabbing'
                  }`}
                  style={{ color: disabled ? '#94a3b8' : meta.accentHex }}
                >
                  <span>{meta.symbol}</span>
                  <span className="text-[10px] font-sans font-normal text-slate-500">
                    {meta.qubitsRequired}Q
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Append Action for Armed Gate */}
        {armedGate && (
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
            <div className="text-xs text-slate-600 min-w-0">
              Armed:{' '}
              <span className="font-mono font-semibold text-slate-900">
                {GATE_CATALOG[armedGate].symbol}
              </span>
            </div>
            <button
              type="button"
              disabled={GATE_CATALOG[armedGate].qubitsRequired > numQubits}
              onClick={() => handleAppendGate(armedGate)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Append Step
            </button>
          </div>
        )}

        {/* Selected Gate Parameter Editor */}
        {selectedGate && selectedGateRef && (
          <div className="pt-3 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">
                Selected: {GATE_CATALOG[selectedGate.kind].name}
              </span>
              <button
                type="button"
                onClick={() =>
                  handleRemoveGate(selectedGateRef.stepIdx, selectedGate.id)
                }
                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Remove gate"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {GATE_CATALOG[selectedGate.kind].summary}
            </p>

            {/* Rotation Angle Slider */}
            {GATE_CATALOG[selectedGate.kind].hasAngle && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Angle θ</span>
                  <span className="font-mono tabular-nums font-semibold text-blue-700">
                    {formatAnglePi(selectedGate.angle ?? Math.PI / 2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={-Math.PI * 2}
                  max={Math.PI * 2}
                  step={Math.PI / 16}
                  value={selectedGate.angle ?? Math.PI / 2}
                  onChange={(e) =>
                    handleUpdateSelectedGate({ angle: parseFloat(e.target.value) })
                  }
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: 'π/4', val: Math.PI / 4 },
                    { label: 'π/2', val: Math.PI / 2 },
                    { label: 'π', val: Math.PI },
                    { label: '-π/2', val: -Math.PI / 2 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleUpdateSelectedGate({ angle: p.val })}
                      className="px-2 py-0.5 text-[10px] font-mono bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Control / Target Qubit selectors for 2-qubit gates */}
            {GATE_CATALOG[selectedGate.kind].qubitsRequired === 2 && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-600">
                  {selectedGate.kind === 'SWAP' ? 'Qubit A' : 'Control'}
                  <select
                    value={selectedGate.control ?? 0}
                    onChange={(e) => {
                      const nextCtrl = Number(e.target.value);
                      const nextTgt =
                        nextCtrl === selectedGate.target
                          ? selectedGate.control ?? 0
                          : selectedGate.target;
                      handleUpdateSelectedGate({ control: nextCtrl, target: nextTgt });
                    }}
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono"
                  >
                    {Array.from({ length: numQubits }, (_, q) => (
                      <option key={q} value={q}>
                        q{q}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-slate-600">
                  {selectedGate.kind === 'SWAP' ? 'Qubit B' : 'Target'}
                  <select
                    value={selectedGate.target}
                    onChange={(e) => {
                      const nextTgt = Number(e.target.value);
                      const nextCtrl =
                        nextTgt === selectedGate.control
                          ? selectedGate.target
                          : selectedGate.control;
                      handleUpdateSelectedGate({ target: nextTgt, control: nextCtrl });
                    }}
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono"
                  >
                    {Array.from({ length: numQubits }, (_, q) => (
                      <option key={q} value={q}>
                        q{q}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Starter Presets */}
        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-800">
              Starter Circuits
            </span>
            <button
              type="button"
              onClick={handleResetCircuit}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Clear
            </button>
          </div>
          <div className="space-y-1.5">
            {CIRCUIT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleLoadPreset(preset.id)}
                className="w-full text-left px-2.5 py-2 rounded-md border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors cursor-pointer"
              >
                <div className="text-xs font-medium text-slate-900">
                  {preset.title}
                </div>
                <div className="text-[11px] text-slate-500 line-clamp-1">
                  {preset.subtitle}
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* CENTER STAGE: Circuit Diagram + Playback + State Vector & Matrix Breakdown */}
      <div className="space-y-4 min-w-0">
        {/* Circuit Canvas Card */}
        <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Quantum Circuit Sequence
              </h2>
              <p className="text-xs text-slate-500">
                Click any time column (Init or t=1..{steps.length}) to inspect the state vector at that exact moment.
              </p>
            </div>

            {/* Step Playback Controls */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setActiveStepIndex(0);
                }}
                title="Jump to initial state"
                className="p-1.5 rounded text-slate-600 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setActiveStepIndex((p) => Math.max(0, p - 1));
                }}
                title="Previous step"
                className="p-1.5 rounded text-slate-600 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (clampedStepIdx >= snapshots.length - 1) {
                    setActiveStepIndex(0);
                  }
                  setIsPlaying((p) => !p);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3 h-3" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" /> Step Play
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setActiveStepIndex((p) => Math.min(snapshots.length - 1, p + 1));
                }}
                title="Next step"
                className="p-1.5 rounded text-slate-600 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setActiveStepIndex(snapshots.length - 1);
                }}
                title="Jump to final state"
                className="p-1.5 rounded text-slate-600 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <CircuitDiagram
            numQubits={numQubits}
            initialBits={initialBits}
            steps={steps}
            activeStepIndex={clampedStepIdx}
            selectedGateId={selectedGateRef?.gateId}
            armedGate={armedGate}
            editable={true}
            dragPayload={dragPayload}
            onStartDragGate={setDragPayload}
            onEndDrag={() => setDragPayload(null)}
            onDropOnCell={handleDropOnCell}
            onDropOnNewStep={handleDropOnNewStep}
            onDropOnTrash={handleDropOnTrash}
            onToggleInitialBit={(q) => {
              const next = [...initialBits];
              next[q] = next[q] === 1 ? 0 : 1;
              onChangeInitialBits(next);
            }}
            onSelectStep={(idx) => {
              setIsPlaying(false);
              setActiveStepIndex(idx);
            }}
            onSelectGate={(stepIdx, gate) =>
              setSelectedGateRef({ stepIdx, gateId: gate.id })
            }
            onPlaceGate={handlePlaceGateAt}
            onRemoveGate={handleRemoveGate}
            onAddStep={handleAddStep}
            onRemoveStep={handleRemoveStep}
          />

          {/* Step Annotation Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-blue-700 tabular-nums">
                Step {clampedStepIdx} / {snapshots.length - 1}
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-medium text-slate-900">
                {currentSnapshot.label}
              </span>
            </div>
            {currentSnapshot.note && (
              <span className="text-slate-600">{currentSnapshot.note}</span>
            )}
          </div>
        </section>

        {/* State Vector & Matrix Transformation Stage */}
        <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="text-xs text-slate-500">
              Visualizing state evolution after{' '}
              <span className="font-semibold text-slate-800">
                {currentSnapshot.label}
              </span>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md border border-slate-200">
              {(['both', 'vector', 'matrix'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setInspectorMode(m)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors capitalize cursor-pointer ${
                    inspectorMode === m
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m === 'both' ? 'Split View' : m === 'vector' ? 'State Vector' : 'Matrix Math'}
                </button>
              ))}
            </div>
          </div>

          {(inspectorMode === 'both' || inspectorMode === 'vector') && (
            <StateVectorView
              numQubits={numQubits}
              stateVector={currentSnapshot.stateVector}
              previousVector={previousSnapshot?.stateVector}
              selectedBasisRow={selectedMatrixRow}
              onSelectBasisRow={setSelectedMatrixRow}
            />
          )}

          {inspectorMode === 'both' && (
            <div className="border-t border-slate-200 pt-4" />
          )}

          {(inspectorMode === 'both' || inspectorMode === 'matrix') && (
            <MatrixStepPanel
              numQubits={numQubits}
              snapshot={currentSnapshot}
              selectedRow={selectedMatrixRow}
              onSelectRow={setSelectedMatrixRow}
            />
          )}
        </section>
      </div>

      {/* RIGHT RAIL: 3D Bloch Spheres & Shot Measurement Simulator */}
      <aside className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Bloch Sphere Inspector
              </h3>
              <p className="text-[11px] text-slate-500">
                Drag sphere to orbit · Watch each gate rotate |ψ⟩
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAnimateBloch((v) => !v)}
              aria-pressed={animateBloch}
              className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                animateBloch
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              {animateBloch ? 'Animate: On' : 'Animate: Off'}
            </button>
          </div>

          {numQubits > 1 && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200">
              {Array.from({ length: numQubits }, (_, q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setSelectedQubitBloch(q)}
                  className={`flex-1 py-1 text-xs font-mono font-medium rounded transition-colors cursor-pointer ${
                    selectedQubitBloch === q
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  q{q}
                </button>
              ))}
            </div>
          )}

          {(() => {
            const activeStepObj =
              clampedStepIdx > 0 ? steps[clampedStepIdx - 1] : undefined;
            const actingGate =
              activeStepObj?.gates.find(
                (g) =>
                  g.target === selectedQubitBloch ||
                  g.control === selectedQubitBloch ||
                  g.control2 === selectedQubitBloch
              ) ?? null;
            const rotSpec = getGateRotationSpec(actingGate, selectedQubitBloch);

            return (
              <>
                {/* Gate-to-Bloch Association Banner */}
                <div className="px-2.5 py-2 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    {clampedStepIdx === 0 ? (
                      <div className="text-[11px] text-slate-600">
                        Initial state <span className="font-mono font-semibold">|{initialBits[selectedQubitBloch] ?? 0}⟩</span> (no gate yet)
                      </div>
                    ) : actingGate ? (
                      <div className="text-[11px] text-slate-700 leading-snug">
                        <span
                          className="font-mono font-semibold"
                          style={{ color: GATE_CATALOG[actingGate.kind].accentHex }}
                        >
                          {GATE_CATALOG[actingGate.kind].symbol}
                        </span>{' '}
                        acted on q{selectedQubitBloch}
                        {rotSpec ? (
                          <span className="text-slate-500"> · {rotSpec.axisLabel}</span>
                        ) : (
                          <span className="text-slate-500">
                            {' '}
                            · {actingGate.target === selectedQubitBloch ? 'Target' : 'Control'}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500">
                        Step t={clampedStepIdx}: q{selectedQubitBloch} wire idle (unchanged)
                      </div>
                    )}
                  </div>

                  {clampedStepIdx > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAnimateBloch(true);
                        setBlochReplayKey((k) => k + 1);
                      }}
                      title="Replay this gate's Bloch rotation animation"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 hover:border-blue-400 text-[11px] font-medium text-slate-700 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Replay
                    </button>
                  )}
                </div>

                <div className="py-1 flex justify-center">
                  <BlochSphere
                    vector={
                      currentSnapshot.blochVectors[selectedQubitBloch] ??
                      currentSnapshot.blochVectors[0]
                    }
                    previousVector={
                      previousSnapshot?.blochVectors[selectedQubitBloch]
                    }
                    actingGate={actingGate}
                    animateTransition={animateBloch}
                    replayKey={blochReplayKey}
                    size={236}
                    label={`Qubit q${selectedQubitBloch}`}
                  />
                </div>
              </>
            );
          })()}

          {/* Per-qubit marginal probabilities */}
          <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
            <div className="px-2.5 py-1.5 rounded bg-slate-50 border border-slate-200 flex justify-between">
              <span className="text-slate-500">P(|0⟩)</span>
              <span className="font-semibold text-slate-900">
                {(
                  (currentSnapshot.blochVectors[selectedQubitBloch]?.probZero ??
                    1) * 100
                ).toFixed(1)}
                %
              </span>
            </div>
            <div className="px-2.5 py-1.5 rounded bg-slate-50 border border-slate-200 flex justify-between">
              <span className="text-slate-500">P(|1⟩)</span>
              <span className="font-semibold text-slate-900">
                {(
                  (currentSnapshot.blochVectors[selectedQubitBloch]?.probOne ??
                    0) * 100
                ).toFixed(1)}
                %
              </span>
            </div>
          </div>
        </div>

        {/* Simulated Measurement Sampling */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Measurement Simulator
            </h3>
            <p className="text-[11px] text-slate-500">
              Born rule collapse P(x) = |αₓ|² at step {clampedStepIdx}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleSampleOneShot}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5 text-blue-600" />
              1 Shot
            </button>
            <button
              type="button"
              onClick={handleSample1024Shots}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              1,024 Shots
            </button>
          </div>

          {lastSingleShot && (
            <div className="px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
              <span className="text-emerald-800 font-medium">Collapsed outcome</span>
              <span className="font-mono font-bold text-emerald-900">
                {lastSingleShot}
              </span>
            </div>
          )}

          {shotCounts && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] text-slate-500 flex justify-between">
                <span>Basis</span>
                <span>Observed / Expected</span>
              </div>
              {shotCounts.map((count, idx) => {
                const expected = currentSnapshot.probabilities[idx];
                if (count === 0 && expected < 0.005) return null;
                const obsPct = (count / 1024) * 100;
                return (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="font-semibold text-slate-800">
                        {formatKet(idx, numQubits)}
                      </span>
                      <span className="text-slate-600">
                        {count} ({obsPct.toFixed(1)}% / {(expected * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${obsPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
