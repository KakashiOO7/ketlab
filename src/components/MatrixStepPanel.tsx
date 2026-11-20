import React, { useState } from 'react';
import { cMag, cMul, formatComplex, formatKet } from '../quantum/complex';
import { SimulationSnapshot } from '../quantum/types';

interface MatrixStepPanelProps {
  numQubits: number;
  snapshot: SimulationSnapshot;
  selectedRow: number | null;
  onSelectRow: (row: number | null) => void;
}

export const MatrixStepPanel: React.FC<MatrixStepPanelProps> = ({
  numQubits,
  snapshot,
  selectedRow,
  onSelectRow,
}) => {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const activeRow = hoveredRow ?? selectedRow ?? 0;
  const dim = snapshot.stateVector.length;
  const isCompactMatrix = dim > 8; // 4 qubits = 16x16, show focused active slice or compact cells

  const matrix = snapshot.stepMatrix;
  const inputVec = snapshot.inputVector;
  const outputVec = snapshot.stateVector;

  // Dot product terms for activeRow
  const dotTerms = Array.from({ length: dim }, (_, col) => {
    const mEntry = matrix[activeRow][col];
    const vEntry = inputVec[col];
    const prod = cMul(mEntry, vEntry);
    return {
      col,
      ket: formatKet(col, numQubits),
      mEntry,
      vEntry,
      prod,
      isNonZero: cMag(mEntry) > 1e-5 && cMag(vEntry) > 1e-5,
    };
  });

  const nonZeroTerms = dotTerms.filter((t) => t.isNonZero);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Matrix Transformation · {snapshot.label}
          </h3>
          <p className="text-xs text-slate-500">
            {snapshot.stepIndex === 0
              ? 'Initial state vector before gate matrices are applied.'
              : 'Hover or click any matrix row to trace how U_t multiplies |ψ_{t−1}⟩ into |ψ_t⟩.'}
          </p>
        </div>
        <div className="text-xs font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 tabular-nums">
          {dim} × {dim} Unitary
        </div>
      </div>

      {/* Equation grid: U_t * |psi_{t-1}> = |psi_t> */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex items-center gap-3 min-w-max">
          {/* Matrix U_t */}
          <div className="border-l-2 border-r-2 border-slate-400 rounded-xs px-2 py-1.5 bg-white">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${dim}, minmax(${
                  isCompactMatrix ? '26px' : dim === 8 ? '38px' : '50px'
                }, 1fr))`,
              }}
            >
              {matrix.map((row, rIdx) =>
                row.map((val, cIdx) => {
                  const isRowActive = rIdx === activeRow;
                  const nonZero = cMag(val) > 1e-5;
                  return (
                    <button
                      key={`${rIdx}-${cIdx}`}
                      type="button"
                      onMouseEnter={() => setHoveredRow(rIdx)}
                      onMouseLeave={() => setHoveredRow(null)}
                      onClick={() => onSelectRow(rIdx)}
                      title={`U[${rIdx},${cIdx}] = ${formatComplex(val)}`}
                      className={`font-mono tabular-nums text-center rounded-xs transition-colors cursor-pointer ${
                        isCompactMatrix ? 'text-[9px] py-0.5' : 'text-[11px] py-1 px-1'
                      } ${
                        isRowActive
                          ? nonZero
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-blue-50 text-slate-400'
                          : nonZero
                            ? 'bg-slate-50 text-slate-900 font-medium hover:bg-blue-50'
                            : 'text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {isCompactMatrix && !nonZero ? '·' : formatComplex(val, true)}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <span className="text-sm font-mono text-slate-400">×</span>

          {/* Input vector |psi_{t-1}> */}
          <div className="border-l-2 border-r-2 border-slate-400 rounded-xs px-2 py-1.5 bg-white">
            <div className="flex flex-col gap-1">
              {inputVec.map((val, idx) => {
                const contributes = cMag(matrix[activeRow][idx]) > 1e-5 && cMag(val) > 1e-5;
                return (
                  <div
                    key={idx}
                    className={`font-mono tabular-nums text-right rounded-xs px-1.5 ${
                      isCompactMatrix ? 'text-[9px] py-0.5' : 'text-[11px] py-1'
                    } ${
                      contributes
                        ? 'bg-amber-50 text-amber-900 font-semibold ring-1 ring-amber-300'
                        : cMag(val) > 1e-5
                          ? 'text-slate-800'
                          : 'text-slate-300'
                    }`}
                  >
                    {formatComplex(val, true)}
                  </div>
                );
              })}
            </div>
          </div>

          <span className="text-sm font-mono text-slate-400">=</span>

          {/* Output vector |psi_t> */}
          <div className="border-l-2 border-r-2 border-blue-600 rounded-xs px-2 py-1.5 bg-white">
            <div className="flex flex-col gap-1">
              {outputVec.map((val, idx) => {
                const isRowActive = idx === activeRow;
                return (
                  <button
                    key={idx}
                    type="button"
                    onMouseEnter={() => setHoveredRow(idx)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => onSelectRow(idx)}
                    className={`font-mono tabular-nums text-right rounded-xs px-1.5 transition-colors cursor-pointer ${
                      isCompactMatrix ? 'text-[9px] py-0.5' : 'text-[11px] py-1'
                    } ${
                      isRowActive
                        ? 'bg-blue-600 text-white font-semibold'
                        : cMag(val) > 1e-5
                          ? 'text-slate-900 font-medium hover:bg-blue-50'
                          : 'text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {formatKet(idx, numQubits)} {formatComplex(val, true)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Dot-product calculation breakdown for activeRow */}
      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <span className="text-xs font-medium text-slate-700">
            Row computation for basis state{' '}
            <span className="font-mono font-semibold text-blue-700">
              {formatKet(activeRow, numQubits)}
            </span>
          </span>
          <span className="text-xs font-mono tabular-nums font-semibold text-slate-900">
            Result = {formatComplex(outputVec[activeRow])}
          </span>
        </div>

        <div className="font-mono text-xs tabular-nums text-slate-700 leading-relaxed break-words">
          {nonZeroTerms.length === 0 ? (
            <span className="text-slate-400">
              All contributing terms are 0 → output amplitude is 0
            </span>
          ) : (
            nonZeroTerms.map((term, idx) => (
              <span key={term.col}>
                {idx > 0 && <span className="text-slate-400 mx-1.5">+</span>}
                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                  <span className="text-blue-700 font-medium">
                    ({formatComplex(term.mEntry, true)})
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-amber-800">
                    ({formatComplex(term.vEntry, true)})
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    [{term.ket}]
                  </span>
                </span>
              </span>
            ))
          )}
          {nonZeroTerms.length > 0 && (
            <span className="ml-2 font-semibold text-slate-900">
              = {formatComplex(outputVec[activeRow])}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
