import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cMag, cMul, formatComplex, formatKet } from '../quantum/complex';
import { GATE_CATALOG, getSingleQubitMatrix } from '../quantum/gates';
import {
  createIdentityMatrix,
  multiplyMatrices,
  simulateCircuit,
  tensorProduct,
} from '../quantum/simulator';
import { CircuitStep, Complex, GateKind } from '../quantum/types';

interface MatrixMathViewProps {
  numQubits: number;
  initialBits: number[];
  steps: CircuitStep[];
}

const TENSOR_GATES: GateKind[] = ['I', 'H', 'X', 'Y', 'Z', 'S', 'T'];

export const MatrixMathView: React.FC<MatrixMathViewProps> = ({
  numQubits,
  initialBits,
  steps,
}) => {
  const [gateA, setGateA] = useState<GateKind>('H');
  const [gateB, setGateB] = useState<GateKind>('X');
  const [hoverTensorCell, setHoverTensorCell] = useState<{
    r: number;
    c: number;
  } | null>(null);

  const snapshots = useMemo(
    () => simulateCircuit(numQubits, initialBits, steps),
    [numQubits, initialBits, steps]
  );

  // Combined overall unitary U_total = U_T * ... * U_2 * U_1
  const totalUnitary = useMemo(() => {
    const dim = 1 << numQubits;
    let acc = createIdentityMatrix(dim);
    for (let i = 1; i < snapshots.length; i++) {
      acc = multiplyMatrices(snapshots[i].stepMatrix, acc);
    }
    return acc;
  }, [snapshots, numQubits]);

  const matA = useMemo(() => getSingleQubitMatrix(gateA), [gateA]);
  const matB = useMemo(() => getSingleQubitMatrix(gateB), [gateB]);
  const tensorAB = useMemo(() => tensorProduct(matA, matB), [matA, matB]);

  const formatStateKetSummary = (vec: Complex[]) => {
    const terms: string[] = [];
    vec.forEach((amp, idx) => {
      if (cMag(amp) > 1e-4) {
        const coeff = formatComplex(amp);
        const ket = formatKet(idx, numQubits);
        if (coeff === '1') {
          terms.push(ket);
        } else if (coeff === '-1') {
          terms.push(`−${ket}`);
        } else {
          terms.push(`(${coeff})${ket}`);
        }
      }
    });
    return terms.join(' + ').replace(/\+ −/g, '− ') || '0';
  };

  return (
    <div className="space-y-4">
      {/* Section 1: Sequential Matrix Chain from Active Circuit */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Sequential Matrix Multiplication Chain
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Each column in your Circuit Lab is a unitary matrix U_t acting on the previous vector: |ψ_t⟩ = U_t · |ψ_{'{t−1}'}⟩. Notice matrix order reads right-to-left algebraically!
            </p>
          </div>
          <div className="font-mono text-xs bg-slate-100 border border-slate-200 px-3 py-1.5 rounded text-slate-800">
            |ψ_final⟩ ={' '}
            {steps.length > 0
              ? `${steps
                  .map((_, i) => `U${i + 1}`)
                  .reverse()
                  .join(' · ')} · |ψ₀⟩`
              : '|ψ₀⟩'}
          </div>
        </div>

        {/* Step-by-step state vector evolution pipeline */}
        <div className="overflow-x-auto pb-2">
          <div className="inline-flex items-stretch gap-2.5 min-w-max">
            {snapshots.map((snap, idx) => (
              <React.Fragment key={snap.stepIndex}>
                {idx > 0 && (
                  <div className="flex flex-col items-center justify-center px-1 text-slate-400">
                    <span className="font-mono text-[11px] font-semibold text-blue-700 mb-1">
                      U{idx}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                )}

                <div
                  className={`min-w-[170px] max-w-[230px] p-3 rounded-lg border flex flex-col justify-between ${
                    idx === snapshots.length - 1
                      ? 'bg-blue-50/40 border-blue-300'
                      : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="text-[11px] font-mono font-semibold text-slate-500">
                      {idx === 0 ? 'Initial |ψ₀⟩' : `After Step ${idx} · |ψ${idx}⟩`}
                    </div>
                    <div className="text-xs font-medium text-slate-900 mt-0.5 truncate">
                      {snap.label}
                    </div>
                  </div>

                  <div className="my-2.5 px-2 py-2 bg-white border border-slate-200 rounded font-mono text-xs text-slate-900 leading-relaxed break-words">
                    {formatStateKetSummary(snap.stateVector)}
                  </div>

                  <div className="space-y-0.5">
                    {snap.stateVector.slice(0, 8).map((val, bIdx) =>
                      cMag(val) > 1e-4 ? (
                        <div
                          key={bIdx}
                          className="flex justify-between text-[11px] font-mono tabular-nums text-slate-600"
                        >
                          <span>{formatKet(bIdx, numQubits)}</span>
                          <span className="font-medium text-slate-900">
                            {formatComplex(val, true)}
                          </span>
                        </div>
                      ) : null
                    )}
                    {snap.stateVector.length > 8 && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        ({snap.stateVector.length} total dimensions)
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Combined Total Circuit Unitary */}
        <div className="pt-3 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="max-w-md space-y-1">
            <div className="text-xs font-semibold text-slate-900">
              Combined Circuit Unitary U_total
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Because matrix multiplication is associative, applying gates one after another is equivalent to multiplying the initial vector by this single combined {1 << numQubits}×{1 << numQubits} matrix.
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="inline-block border-l-2 border-r-2 border-slate-400 px-2.5 py-1.5 bg-slate-50 rounded-xs">
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${totalUnitary.length}, minmax(${
                    totalUnitary.length > 8 ? '28px' : '46px'
                  }, 1fr))`,
                }}
              >
                {totalUnitary.map((row, r) =>
                  row.map((val, col) => {
                    const nz = cMag(val) > 1e-5;
                    return (
                      <div
                        key={`${r}-${col}`}
                        className={`text-center font-mono tabular-nums py-0.5 px-1 rounded-xs ${
                          totalUnitary.length > 8 ? 'text-[9px]' : 'text-[11px]'
                        } ${
                          nz
                            ? 'bg-white border border-slate-200 font-semibold text-slate-900'
                            : 'text-slate-300'
                        }`}
                      >
                        {totalUnitary.length > 8 && !nz ? '·' : formatComplex(val, true)}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Interactive Kronecker Tensor Product Builder (A ⊗ B) */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              How Parallel Gates Form Larger Matrices (Tensor Product A ⊗ B)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Hover any cell in the 4×4 result matrix to see which entry of Gate A (q₀) multiplies which entry of Gate B (q₁).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600 flex items-center gap-1.5">
              <span>q₀ Gate:</span>
              <select
                value={gateA}
                onChange={(e) => setGateA(e.target.value as GateKind)}
                className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-900"
              >
                {TENSOR_GATES.map((g) => (
                  <option key={g} value={g}>
                    {GATE_CATALOG[g].symbol} ({GATE_CATALOG[g].name})
                  </option>
                ))}
              </select>
            </label>
            <span className="font-mono text-slate-400">⊗</span>
            <label className="text-xs text-slate-600 flex items-center gap-1.5">
              <span>q₁ Gate:</span>
              <select
                value={gateB}
                onChange={(e) => setGateB(e.target.value as GateKind)}
                className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-900"
              >
                {TENSOR_GATES.map((g) => (
                  <option key={g} value={g}>
                    {GATE_CATALOG[g].symbol} ({GATE_CATALOG[g].name})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 py-2">
          {/* Matrix A */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-xs font-mono font-semibold text-blue-700">
              {gateA} (q₀)
            </span>
            <div className="border-l-2 border-r-2 border-blue-400 px-2.5 py-2 bg-blue-50/30 grid grid-cols-2 gap-1.5">
              {matA.map((row, r) =>
                row.map((val, col) => {
                  const active =
                    hoverTensorCell &&
                    Math.floor(hoverTensorCell.r / 2) === r &&
                    Math.floor(hoverTensorCell.c / 2) === col;
                  return (
                    <div
                      key={`${r}-${col}`}
                      className={`w-14 py-1.5 text-center font-mono text-xs tabular-nums rounded ${
                        active
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-white border border-slate-200 text-slate-800'
                      }`}
                    >
                      {formatComplex(val, true)}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <span className="text-lg font-mono text-slate-400">⊗</span>

          {/* Matrix B */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-xs font-mono font-semibold text-cyan-700">
              {gateB} (q₁)
            </span>
            <div className="border-l-2 border-r-2 border-cyan-400 px-2.5 py-2 bg-cyan-50/30 grid grid-cols-2 gap-1.5">
              {matB.map((row, r) =>
                row.map((val, col) => {
                  const active =
                    hoverTensorCell &&
                    hoverTensorCell.r % 2 === r &&
                    hoverTensorCell.c % 2 === col;
                  return (
                    <div
                      key={`${r}-${col}`}
                      className={`w-14 py-1.5 text-center font-mono text-xs tabular-nums rounded ${
                        active
                          ? 'bg-cyan-600 text-white font-bold'
                          : 'bg-white border border-slate-200 text-slate-800'
                      }`}
                    >
                      {formatComplex(val, true)}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <span className="text-lg font-mono text-slate-400">=</span>

          {/* Result 4x4 Tensor Product */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-xs font-mono font-semibold text-slate-800">
              {gateA} ⊗ {gateB} (4 × 4 System Unitary)
            </span>
            <div className="border-l-2 border-r-2 border-slate-500 px-3 py-2 bg-slate-50 grid grid-cols-4 gap-1.5">
              {tensorAB.map((row, r) =>
                row.map((val, col) => {
                  const isHovered =
                    hoverTensorCell?.r === r && hoverTensorCell?.c === col;
                  const nz = cMag(val) > 1e-5;
                  return (
                    <div
                      key={`${r}-${col}`}
                      onMouseEnter={() => setHoverTensorCell({ r, c: col })}
                      onMouseLeave={() => setHoverTensorCell(null)}
                      className={`w-14 py-1.5 text-center font-mono text-xs tabular-nums rounded cursor-pointer transition-colors ${
                        isHovered
                          ? 'bg-slate-900 text-white font-bold'
                          : nz
                            ? 'bg-white border border-slate-200 text-slate-900 font-medium hover:border-blue-400'
                            : 'bg-white/60 border border-slate-200/60 text-slate-300'
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

        {/* Live cell explanation */}
        <div className="px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 text-center">
          {hoverTensorCell ? (
            (() => {
              const aR = Math.floor(hoverTensorCell.r / 2);
              const aC = Math.floor(hoverTensorCell.c / 2);
              const bR = hoverTensorCell.r % 2;
              const bC = hoverTensorCell.c % 2;
              const valA = matA[aR][aC];
              const valB = matB[bR][bC];
              const prod = cMul(valA, valB);
              return (
                <>
                  Entry ({hoverTensorCell.r}, {hoverTensorCell.c}) ={' '}
                  <span className="text-blue-700 font-semibold">
                    A[{aR},{aC}] ({formatComplex(valA, true)})
                  </span>{' '}
                  ×{' '}
                  <span className="text-cyan-700 font-semibold">
                    B[{bR},{bC}] ({formatComplex(valB, true)})
                  </span>{' '}
                  ={' '}
                  <span className="font-bold text-slate-900">
                    {formatComplex(prod, true)}
                  </span>
                </>
              );
            })()
          ) : (
            <span className="font-sans text-slate-500">
              Hover any cell in the 4×4 matrix above to inspect its Kronecker product formula A[i,j] · B[k,l].
            </span>
          )}
        </div>
      </section>
    </div>
  );
};
