import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formatAnglePi } from '../quantum/complex';
import { GATE_CATALOG } from '../quantum/gates';
import { CircuitGate, CircuitStep, GateKind } from '../quantum/types';

export type CircuitDragPayload =
  | { source: 'palette'; kind: GateKind }
  | {
      source: 'circuit';
      stepIdx: number;
      gateId: string;
      role: 'target' | 'control' | 'control2';
    };

interface CircuitDiagramProps {
  numQubits: number;
  initialBits: number[];
  steps: CircuitStep[];
  activeStepIndex: number; // 0 = initial, 1..N = after step k
  selectedGateId?: string | null;
  armedGate?: GateKind | null;
  editable?: boolean;
  dragPayload?: CircuitDragPayload | null;
  onStartDragGate?: (payload: CircuitDragPayload) => void;
  onEndDrag?: () => void;
  onDropOnCell?: (stepIdx: number, qubit: number) => void;
  onDropOnNewStep?: (qubit: number) => void;
  onDropOnTrash?: () => void;
  onToggleInitialBit?: (qubit: number) => void;
  onSelectStep: (stepIndex: number) => void;
  onSelectGate?: (stepIdx: number, gate: CircuitGate) => void;
  onPlaceGate?: (stepIdx: number, qubit: number) => void;
  onRemoveGate?: (stepIdx: number, gateId: string) => void;
  onAddStep?: () => void;
  onRemoveStep?: (stepIdx: number) => void;
}

export const CircuitDiagram: React.FC<CircuitDiagramProps> = ({
  numQubits,
  initialBits,
  steps,
  activeStepIndex,
  selectedGateId,
  armedGate,
  editable = true,
  dragPayload,
  onStartDragGate,
  onEndDrag,
  onDropOnCell,
  onDropOnNewStep,
  onDropOnTrash,
  onToggleInitialBit,
  onSelectStep,
  onSelectGate,
  onPlaceGate,
  onRemoveGate,
  onAddStep,
  onRemoveStep,
}) => {
  const ROW_H = 54;
  const COL_W = 74;
  const TOP_PAD = 32;

  const [hoverCell, setHoverCell] = useState<{ stepIdx: number; qubit: number } | null>(null);
  const [isOverNewStep, setIsOverNewStep] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);

  const isDraggingCircuitGate = dragPayload?.source === 'circuit';
  const isDraggingAny = Boolean(dragPayload);

  const clearDragHover = () => {
    setHoverCell(null);
    setIsOverNewStep(false);
    setIsOverTrash(false);
  };

  const handleGateDragStart = (
    e: React.DragEvent<HTMLElement>,
    stepIdx: number,
    gate: CircuitGate,
    role: 'target' | 'control' | 'control2'
  ) => {
    if (!editable) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', gate.id);
    onStartDragGate?.({ source: 'circuit', stepIdx, gateId: gate.id, role });
  };

  const handleGateDragEnd = () => {
    clearDragHover();
    onEndDrag?.();
  };

  const findGateAt = (step: CircuitStep, q: number): CircuitGate | undefined =>
    step.gates.find((g) => g.target === q);

  const findVerticalConnectors = (step: CircuitStep) => {
    const lines: Array<{
      id: string;
      minQ: number;
      maxQ: number;
      color: string;
    }> = [];
    for (const g of step.gates) {
      if (g.kind === 'CNOT' || g.kind === 'CZ' || g.kind === 'CP' || g.kind === 'SWAP') {
        const c = g.control ?? 0;
        const t = g.target;
        lines.push({
          id: g.id,
          minQ: Math.min(c, t),
          maxQ: Math.max(c, t),
          color: GATE_CATALOG[g.kind].accentHex,
        });
      } else if (g.kind === 'CCX') {
        const c1 = g.control ?? 0;
        const c2 = g.control2 ?? 1;
        const t = g.target;
        lines.push({
          id: g.id,
          minQ: Math.min(c1, c2, t),
          maxQ: Math.max(c1, c2, t),
          color: GATE_CATALOG[g.kind].accentHex,
        });
      }
    }
    return lines;
  };

  return (
    <div className="space-y-2.5">
      <div className="relative overflow-x-auto pb-2 lab-grid-bg rounded-lg border border-slate-200 bg-white">
        <div
          className="relative flex items-stretch min-w-max px-4 pt-3 pb-4"
          style={{ minHeight: TOP_PAD + numQubits * ROW_H + 16 }}
        >
          {/* Left Qubit Labels & Initial Basis State Column */}
          <div
            onClick={() => onSelectStep(0)}
            className={`flex flex-col shrink-0 pr-3 mr-1 rounded-md transition-colors cursor-pointer ${
              activeStepIndex === 0 ? 'bg-blue-50/70 ring-1 ring-blue-300' : 'hover:bg-slate-50'
            }`}
          >
            <div className="h-7 flex items-center justify-center text-[11px] font-mono text-slate-500">
              Init
            </div>
            {Array.from({ length: numQubits }, (_, q) => (
              <div
                key={q}
                className="flex items-center gap-2 px-1.5"
                style={{ height: ROW_H }}
              >
                <span className="text-xs font-mono text-slate-500 w-5">
                  q<sub className="text-[10px]">{q}</sub>
                </span>
                <button
                  type="button"
                  disabled={!editable || !onToggleInitialBit}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleInitialBit?.(q);
                  }}
                  title={editable ? 'Click to toggle initial |0⟩ / |1⟩' : undefined}
                  className={`px-2 py-1 rounded text-xs font-mono font-semibold border transition-colors ${
                    editable
                      ? 'cursor-pointer hover:border-blue-400'
                      : 'cursor-default'
                  } ${
                    initialBits[q] === 1
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                >
                  |{initialBits[q] ?? 0}⟩
                </button>
              </div>
            ))}
          </div>

          {/* Wire lines across all step columns */}
          <div className="relative flex items-start">
            {/* Continuous horizontal qubit wires */}
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{ top: TOP_PAD }}
            >
              {Array.from({ length: numQubits }, (_, q) => (
                <div
                  key={q}
                  className="relative flex items-center"
                  style={{ height: ROW_H }}
                >
                  <div className="w-full h-[1.5px] bg-slate-300" />
                </div>
              ))}
            </div>

            {/* Step Columns */}
            {steps.map((step, sIdx) => {
              const stepNum = sIdx + 1;
              const isInspected = activeStepIndex === stepNum;
              const connectors = findVerticalConnectors(step);

              return (
                <div
                  key={step.id}
                  onClick={() => onSelectStep(stepNum)}
                  style={{ width: COL_W }}
                  className={`relative flex flex-col shrink-0 rounded-md transition-colors cursor-pointer group ${
                    isInspected
                      ? 'bg-blue-50/75 ring-1 ring-blue-400'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* Step column header */}
                  <div className="h-7 flex items-center justify-center gap-1 px-1">
                    <span
                      className={`text-[11px] font-mono tabular-nums ${
                        isInspected ? 'text-blue-700 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      t={stepNum}
                    </span>
                    {editable && steps.length > 1 && onRemoveStep && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveStep(sIdx);
                        }}
                        title="Delete step column"
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-rose-600 transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Vertical multi-qubit connector lines */}
                  <svg
                    width={COL_W}
                    height={numQubits * ROW_H}
                    className="absolute left-0 pointer-events-none"
                    style={{ top: 28 }}
                  >
                    {connectors.map((line) => (
                      <line
                        key={line.id}
                        x1={COL_W / 2}
                        y1={line.minQ * ROW_H + ROW_H / 2}
                        x2={COL_W / 2}
                        y2={line.maxQ * ROW_H + ROW_H / 2}
                        stroke={line.color}
                        strokeWidth={2}
                      />
                    ))}
                  </svg>

                  {/* Wire cells */}
                  {Array.from({ length: numQubits }, (_, q) => {
                    const targetGate = findGateAt(step, q);
                    const controlGate = step.gates.find(
                      (g) => g.control === q || g.control2 === q
                    );
                    const isControl = Boolean(controlGate);
                    const controlRole: 'control' | 'control2' =
                      controlGate?.control2 === q ? 'control2' : 'control';

                    const isDropHovered =
                      hoverCell?.stepIdx === sIdx && hoverCell?.qubit === q;

                    return (
                      <div
                        key={q}
                        style={{ height: ROW_H }}
                        onDragOver={(e) => {
                          if (!editable) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect =
                            dragPayload?.source === 'palette' ? 'copy' : 'move';
                          if (hoverCell?.stepIdx !== sIdx || hoverCell?.qubit !== q) {
                            setHoverCell({ stepIdx: sIdx, qubit: q });
                          }
                        }}
                        onDragLeave={() => {
                          if (hoverCell?.stepIdx === sIdx && hoverCell?.qubit === q) {
                            setHoverCell(null);
                          }
                        }}
                        onDrop={(e) => {
                          if (!editable) return;
                          e.preventDefault();
                          e.stopPropagation();
                          clearDragHover();
                          onDropOnCell?.(sIdx, q);
                        }}
                        onClick={(e) => {
                          if (!editable) return;
                          if (!targetGate && !isControl && armedGate && onPlaceGate) {
                            e.stopPropagation();
                            onPlaceGate(sIdx, q);
                          }
                        }}
                        className={`relative flex items-center justify-center z-10 rounded-md transition-colors ${
                          isDropHovered
                            ? 'bg-blue-100/80 ring-2 ring-blue-500 ring-inset'
                            : isDraggingAny && editable && !targetGate && !isControl
                              ? 'hover:bg-blue-50/40'
                              : ''
                        }`}
                      >
                        {targetGate ? (
                          targetGate.kind === 'CNOT' ? (
                            <button
                              type="button"
                              draggable={editable}
                              onDragStart={(e) =>
                                handleGateDragStart(e, sIdx, targetGate, 'target')
                              }
                              onDragEnd={handleGateDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStep(stepNum);
                                onSelectGate?.(sIdx, targetGate);
                              }}
                              title="CNOT target (⊕) — drag to move or drop in dustbin"
                              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-mono text-base font-bold bg-white transition-transform ${
                                editable
                                  ? 'cursor-grab active:cursor-grabbing'
                                  : 'cursor-pointer'
                              } ${
                                selectedGateId === targetGate.id
                                  ? 'border-blue-600 text-blue-600 ring-2 ring-blue-200 scale-105'
                                  : 'border-blue-700 text-blue-700 hover:scale-105'
                              }`}
                            >
                              +
                            </button>
                          ) : targetGate.kind === 'CCX' ? (
                            <button
                              type="button"
                              draggable={editable}
                              onDragStart={(e) =>
                                handleGateDragStart(e, sIdx, targetGate, 'target')
                              }
                              onDragEnd={handleGateDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStep(stepNum);
                                onSelectGate?.(sIdx, targetGate);
                              }}
                              title="Toffoli target (⊕) — drag to move or drop in dustbin"
                              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-mono text-base font-bold bg-white transition-transform ${
                                editable
                                  ? 'cursor-grab active:cursor-grabbing'
                                  : 'cursor-pointer'
                              } ${
                                selectedGateId === targetGate.id
                                  ? 'border-slate-800 text-slate-900 ring-2 ring-blue-200 scale-105'
                                  : 'border-slate-700 text-slate-800 hover:scale-105'
                              }`}
                            >
                              +
                            </button>
                          ) : targetGate.kind === 'CZ' ? (
                            <button
                              type="button"
                              draggable={editable}
                              onDragStart={(e) =>
                                handleGateDragStart(e, sIdx, targetGate, 'target')
                              }
                              onDragEnd={handleGateDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStep(stepNum);
                                onSelectGate?.(sIdx, targetGate);
                              }}
                              title="Controlled-Z — drag to move or drop in dustbin"
                              className={`w-4 h-4 rounded-full bg-sky-600 border-2 border-white shadow-xs transition-transform ${
                                editable
                                  ? 'cursor-grab active:cursor-grabbing'
                                  : 'cursor-pointer'
                              } ${
                                selectedGateId === targetGate.id
                                  ? 'ring-2 ring-blue-400 scale-125'
                                  : ''
                              }`}
                            />
                          ) : targetGate.kind === 'SWAP' ? (
                            <button
                              type="button"
                              draggable={editable}
                              onDragStart={(e) =>
                                handleGateDragStart(e, sIdx, targetGate, 'target')
                              }
                              onDragEnd={handleGateDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStep(stepNum);
                                onSelectGate?.(sIdx, targetGate);
                              }}
                              title="SWAP — drag to move or drop in dustbin"
                              className={`w-7 h-7 rounded flex items-center justify-center font-mono text-sm font-bold text-indigo-700 bg-white/90 border border-indigo-200 ${
                                editable
                                  ? 'cursor-grab active:cursor-grabbing'
                                  : 'cursor-pointer'
                              } ${
                                selectedGateId === targetGate.id
                                  ? 'ring-2 ring-blue-300'
                                  : ''
                              }`}
                            >
                              ×
                            </button>
                          ) : (
                            <button
                              type="button"
                              draggable={editable}
                              onDragStart={(e) =>
                                handleGateDragStart(e, sIdx, targetGate, 'target')
                              }
                              onDragEnd={handleGateDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStep(stepNum);
                                onSelectGate?.(sIdx, targetGate);
                              }}
                              onContextMenu={(e) => {
                                if (editable && onRemoveGate) {
                                  e.preventDefault();
                                  onRemoveGate(sIdx, targetGate.id);
                                }
                              }}
                              title={
                                editable
                                  ? `${GATE_CATALOG[targetGate.kind].name} — drag to move or drop in dustbin`
                                  : GATE_CATALOG[targetGate.kind].name
                              }
                              style={{
                                borderColor: GATE_CATALOG[targetGate.kind].accentHex,
                                color: GATE_CATALOG[targetGate.kind].accentHex,
                              }}
                              className={`min-w-[42px] px-1.5 py-1.5 rounded-md border bg-white font-mono text-xs font-semibold shadow-2xs transition-all flex flex-col items-center leading-tight ${
                                editable
                                  ? 'cursor-grab active:cursor-grabbing'
                                  : 'cursor-pointer'
                              } ${
                                selectedGateId === targetGate.id
                                  ? 'ring-2 ring-blue-300 scale-105'
                                  : 'hover:scale-105'
                              }`}
                            >
                              <span>{GATE_CATALOG[targetGate.kind].symbol}</span>
                              {GATE_CATALOG[targetGate.kind].hasAngle && (
                                <span className="text-[9px] text-slate-500 font-normal">
                                  {formatAnglePi(targetGate.angle ?? Math.PI / 2)}
                                </span>
                              )}
                            </button>
                          )
                        ) : isControl && controlGate ? (
                          controlGate.kind === 'SWAP' ? (
                            <button
                              type="button"
                              draggable={editable}
                              onDragStart={(e) =>
                                handleGateDragStart(e, sIdx, controlGate, controlRole)
                              }
                              onDragEnd={handleGateDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStep(stepNum);
                                onSelectGate?.(sIdx, controlGate);
                              }}
                              title="SWAP — drag to move or drop in dustbin"
                              className={`w-7 h-7 rounded flex items-center justify-center font-mono text-sm font-bold text-indigo-700 bg-white/90 border border-indigo-200 ${
                                editable
                                  ? 'cursor-grab active:cursor-grabbing'
                                  : 'cursor-pointer'
                              }`}
                            >
                              ×
                            </button>
                          ) : (
                            <button
                              type="button"
                              draggable={editable}
                              onDragStart={(e) =>
                                handleGateDragStart(e, sIdx, controlGate, controlRole)
                              }
                              onDragEnd={handleGateDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStep(stepNum);
                                onSelectGate?.(sIdx, controlGate);
                              }}
                              title={`Control qubit for ${GATE_CATALOG[controlGate.kind].name} — drag to reassign wire or move`}
                              style={{
                                backgroundColor:
                                  GATE_CATALOG[controlGate.kind].accentHex,
                              }}
                              className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs hover:scale-125 transition-transform ${
                                editable
                                  ? 'cursor-grab active:cursor-grabbing'
                                  : 'cursor-pointer'
                              }`}
                            />
                          )
                        ) : editable && armedGate ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlaceGate?.(sIdx, q);
                            }}
                            title={`Place ${GATE_CATALOG[armedGate].name} on q${q} at step ${stepNum}`}
                            className={`w-8 h-8 rounded-md border border-dashed text-[10px] font-mono flex items-center justify-center transition-all cursor-pointer ${
                              isDropHovered
                                ? 'opacity-100 border-blue-600 bg-blue-100 text-blue-700'
                                : 'border-slate-300 opacity-0 hover:opacity-100 hover:border-blue-500 hover:bg-blue-50/80 text-blue-600'
                            }`}
                          >
                            +
                          </button>
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Add Step Column Button (also acts as Drop Zone to create a new column) */}
            {editable && onAddStep && (
              <div className="flex flex-col justify-center pl-2 pt-7">
                <button
                  type="button"
                  onClick={onAddStep}
                  onDragOver={(e) => {
                    if (!editable) return;
                    e.preventDefault();
                    setIsOverNewStep(true);
                  }}
                  onDragLeave={() => setIsOverNewStep(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    clearDragHover();
                    onDropOnNewStep?.(0);
                  }}
                  title="Append empty step column (or drop a gate here)"
                  className={`flex items-center gap-1 px-2.5 py-2 rounded-md border border-dashed text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isOverNewStep
                      ? 'border-blue-600 bg-blue-100 text-blue-800'
                      : 'border-slate-300 text-slate-600 hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50/60'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Step
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Dustbin Drop Zone & Drag Guidance Bar */}
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">
            Drag gates from the palette or between wire slots to rearrange · Drag any gate into the dustbin to delete
          </span>

          <div
            onDragOver={(e) => {
              if (!isDraggingCircuitGate) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (!isOverTrash) setIsOverTrash(true);
            }}
            onDragLeave={() => setIsOverTrash(false)}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              clearDragHover();
              if (isDraggingCircuitGate) {
                onDropOnTrash?.();
              }
            }}
            role="region"
            aria-label="Dustbin gate deletion zone"
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-all select-none ${
              isOverTrash
                ? 'border-rose-600 bg-rose-100 text-rose-800 scale-105 shadow-xs'
                : isDraggingCircuitGate
                  ? 'border-rose-400 bg-rose-50 text-rose-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            <Trash2
              className={`w-3.5 h-3.5 transition-transform ${
                isOverTrash ? 'scale-110 text-rose-700' : ''
              }`}
            />
            <span className="whitespace-nowrap">
              {isOverTrash
                ? 'Release to delete gate'
                : isDraggingCircuitGate
                  ? 'Drop gate here to delete'
                  : 'Dustbin (drop gate to remove)'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
