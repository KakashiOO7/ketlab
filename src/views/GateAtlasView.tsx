import React, { useMemo, useState } from 'react';
import { BlochSphere } from '../components/BlochSphere';
import { c, formatAnglePi, formatComplex, formatKet } from '../quantum/complex';
import { GATE_CATALOG, getSingleQubitMatrix } from '../quantum/gates';
import { applyMatrixToVector, buildGateMatrix, computeBlochVectors } from '../quantum/simulator';
import { Complex, GateKind } from '../quantum/types';

const ALL_GATES: GateKind[] = [
  'H',
  'X',
  'Y',
  'Z',
  'S',
  'Sdg',
  'T',
  'Tdg',
  'Rx',
  'Ry',
  'Rz',
  'CNOT',
  'CZ',
  'CP',
  'SWAP',
  'CCX',
];

const INPUT_STATES_1Q: Array<{ id: string; label: string; vec: Complex[] }> = [
  { id: '0', label: '|0⟩', vec: [c(1), c(0)] },
  { id: '1', label: '|1⟩', vec: [c(0), c(1)] },
  { id: '+', label: '|+⟩', vec: [c(Math.SQRT1_2), c(Math.SQRT1_2)] },
  { id: '-', label: '|−⟩', vec: [c(Math.SQRT1_2), c(-Math.SQRT1_2)] },
  { id: 'i', label: '|i⟩', vec: [c(Math.SQRT1_2), c(0, Math.SQRT1_2)] },
];

export const GateAtlasView: React.FC = () => {
  const [selectedKind, setSelectedKind] = useState<GateKind>('H');
  const [angle, setAngle] = useState<number>(Math.PI / 2);
  const [inputPresetId, setInputPresetId] = useState<string>('0');
  const [multiInputIdx, setMultiInputIdx] = useState<number>(2); // e.g. |10⟩

  const meta = GATE_CATALOG[selectedKind];
  const isSingle = meta.qubitsRequired === 1;

  const matrix = useMemo(() => {
    if (isSingle) {
      return getSingleQubitMatrix(selectedKind, angle);
    }
    if (meta.qubitsRequired === 2) {
      return buildGateMatrix(
        { id: 'atlas', kind: selectedKind, control: 0, target: 1, angle },
        2
      );
    }
    return buildGateMatrix(
      { id: 'atlas', kind: selectedKind, control: 0, control2: 1, target: 2 },
      3
    );
  }, [selectedKind, angle, isSingle, meta.qubitsRequired]);

  const singleInputVec = useMemo(() => {
    return INPUT_STATES_1Q.find((s) => s.id === inputPresetId)?.vec ?? INPUT_STATES_1Q[0].vec;
  }, [inputPresetId]);

  const singleOutputVec = useMemo(() => {
    if (!isSingle) return [c(1), c(0)];
    return applyMatrixToVector(matrix, singleInputVec);
  }, [isSingle, matrix, singleInputVec]);

  const inputBloch = useMemo(
    () => computeBlochVectors(singleInputVec, 1)[0],
    [singleInputVec]
  );
  const outputBloch = useMemo(
    () => computeBlochVectors(singleOutputVec, 1)[0],
    [singleOutputVec]
  );

  // Multi-qubit basis test
  const multiDim = 1 << meta.qubitsRequired;
  const safeMultiIdx = Math.min(multiInputIdx, multiDim - 1);
  const multiInputVec = useMemo(
    () => Array.from({ length: multiDim }, (_, i) => (i === safeMultiIdx ? c(1) : c(0))),
    [multiDim, safeMultiIdx]
  );
  const multiOutputVec = useMemo(
    () => (isSingle ? [] : applyMatrixToVector(matrix, multiInputVec)),
    [isSingle, matrix, multiInputVec]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
      {/* Gate Directory */}
      <aside className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Quantum Gate Atlas
          </h2>
          <p className="text-xs text-slate-500">
            Select any unitary operator to inspect its matrix and Bloch rotation.
          </p>
        </div>

        <div className="space-y-1">
          {ALL_GATES.map((kind) => {
            const item = GATE_CATALOG[kind];
            const active = selectedKind === kind;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setSelectedKind(kind)}
                className={`w-full text-left px-3 py-2 rounded-md border flex items-center justify-between transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-50 border-blue-400'
                    : 'bg-white border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-8 text-center font-mono text-xs font-bold shrink-0"
                    style={{ color: item.accentHex }}
                  >
                    {item.symbol}
                  </span>
                  <span className="text-xs font-medium text-slate-800 truncate">
                    {item.name}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {item.qubitsRequired}Q
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Gate Detail & Interactive Testbench */}
      <div className="space-y-4 min-w-0">
        {/* Header & Exact Unitary Matrix */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <span className="capitalize">{meta.category} Gate</span>
                <span aria-hidden="true">·</span>
                <span>{meta.qubitsRequired}-Qubit Unitary Operator</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {meta.name} ({meta.symbol})
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                {meta.summary}
              </p>
            </div>

            {meta.hasAngle && (
              <div className="w-full sm:w-64 p-3 rounded-md bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Rotation θ</span>
                  <span className="font-mono font-semibold text-blue-700 tabular-nums">
                    {formatAnglePi(angle)}
                  </span>
                </div>
                <input
                  type="range"
                  min={-Math.PI * 2}
                  max={Math.PI * 2}
                  step={Math.PI / 16}
                  value={angle}
                  onChange={(e) => setAngle(parseFloat(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Unitary Matrix Display */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-800">
                Unitary Matrix Representation U
              </div>
              <div className="overflow-x-auto">
                <div className="inline-block border-l-2 border-r-2 border-slate-400 px-3 py-2 bg-slate-50/70 rounded-xs">
                  <div
                    className="grid gap-1.5"
                    style={{
                      gridTemplateColumns: `repeat(${matrix.length}, minmax(${
                        matrix.length === 8 ? '34px' : '58px'
                      }, 1fr))`,
                    }}
                  >
                    {matrix.map((row, rIdx) =>
                      row.map((val, cIdx) => {
                        const nonZero = Math.hypot(val.re, val.im) > 1e-5;
                        return (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            className={`text-center font-mono tabular-nums py-1 px-1 rounded-xs ${
                              matrix.length === 8 ? 'text-[10px]' : 'text-xs'
                            } ${
                              nonZero
                                ? 'bg-white border border-slate-200 font-semibold text-slate-900'
                                : 'text-slate-300'
                            }`}
                          >
                            {formatComplex(val, true)}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Properties Summary */}
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
                <div className="text-slate-500 mb-0.5">Geometric Bloch Action</div>
                <div className="font-medium text-slate-900">{meta.blochAction}</div>
              </div>
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
                <div className="text-slate-500 mb-0.5">Symbolic Definition</div>
                <div className="font-mono text-slate-800">{meta.matrixFormula}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Before -> After Testbench */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Interactive Before → After State Testbench
              </h3>
              <p className="text-xs text-slate-500">
                Test how {meta.symbol} transforms an input quantum state vector.
              </p>
            </div>

            {isSingle ? (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                {INPUT_STATES_1Q.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setInputPresetId(st.id)}
                    className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                      inputPresetId === st.id
                        ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                {Array.from({ length: multiDim }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMultiInputIdx(i)}
                    className={`px-2 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                      safeMultiIdx === i
                        ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {formatKet(i, meta.qubitsRequired)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isSingle ? (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col items-center">
                <BlochSphere
                  vector={inputBloch}
                  size={210}
                  label={`Input ${
                    INPUT_STATES_1Q.find((s) => s.id === inputPresetId)?.label
                  }`}
                />
                <div className="mt-2 font-mono text-xs text-slate-700 tabular-nums">
                  [{formatComplex(singleInputVec[0])}, {formatComplex(singleInputVec[1])}]ᵀ
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-1 text-center px-2">
                <span className="text-xs font-mono font-bold text-blue-700 px-2.5 py-1 rounded border border-blue-200 bg-blue-50">
                  {meta.symbol}
                  {meta.hasAngle ? `(${formatAnglePi(angle)})` : ''}
                </span>
                <span className="text-xs text-slate-400">maps to</span>
              </div>

              <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/30 flex flex-col items-center">
                <BlochSphere
                  vector={outputBloch}
                  previousVector={inputBloch}
                  actingGate={{ id: 'atlas-test', kind: selectedKind, target: 0, angle }}
                  animateTransition={true}
                  size={210}
                  label="Output State"
                />
                <div className="mt-2 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                  [{formatComplex(singleOutputVec[0])}, {formatComplex(singleOutputVec[1])}]ᵀ
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-center p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-center space-y-1">
                <div className="text-xs text-slate-500">Input Basis Vector</div>
                <div className="font-mono text-lg font-bold text-slate-900">
                  {formatKet(safeMultiIdx, meta.qubitsRequired)}
                </div>
              </div>
              <div className="text-center font-mono text-xs font-semibold text-blue-700 px-3 py-1 bg-white border border-blue-200 rounded">
                Apply {meta.symbol}
              </div>
              <div className="text-center space-y-1">
                <div className="text-xs text-slate-500">Transformed Output State</div>
                <div className="font-mono text-lg font-bold text-blue-700">
                  {multiOutputVec
                    .map((amp, i) => {
                      const m = Math.hypot(amp.re, amp.im);
                      if (m < 1e-5) return null;
                      const coeff = formatComplex(amp);
                      return `${coeff === '1' ? '' : coeff}${formatKet(
                        i,
                        meta.qubitsRequired
                      )}`;
                    })
                    .filter(Boolean)
                    .join(' + ') || '0'}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
