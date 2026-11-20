import React, { useState } from 'react';
import { cMag, cMagSq, cPhase, formatComplex, formatKet } from '../quantum/complex';
import { Complex } from '../quantum/types';

interface StateVectorViewProps {
  numQubits: number;
  stateVector: Complex[];
  previousVector?: Complex[];
  markedBitstring?: string;
  showMeanLine?: boolean;
  onSelectBasisRow?: (index: number) => void;
  selectedBasisRow?: number | null;
}

export const StateVectorView: React.FC<StateVectorViewProps> = ({
  numQubits,
  stateVector,
  previousVector,
  markedBitstring,
  showMeanLine = false,
  onSelectBasisRow,
  selectedBasisRow,
}) => {
  const [mode, setMode] = useState<'amplitude' | 'probability'>('amplitude');

  const dim = stateVector.length;
  const meanReal =
    stateVector.reduce((acc, z) => acc + z.re, 0) / Math.max(1, dim);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Quantum State Vector |ψ⟩
          </h3>
          <p className="text-xs text-slate-500">
            Amplitude magnitude, complex phase angle, and measurement probability across {dim} basis states
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setMode('amplitude')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'amplitude'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Amplitude &amp; Phase
          </button>
          <button
            type="button"
            onClick={() => setMode('probability')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'probability'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Probabilities |α|²
          </button>
        </div>
      </div>

      {/* Optional Mean Amplitude Reference for Grover's */}
      {showMeanLine && mode === 'amplitude' && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
          <span>Inversion-about-mean reference (μ = mean real amplitude)</span>
          <span className="font-mono tabular-nums font-medium text-slate-900">
            μ = {meanReal.toFixed(3)}
          </span>
        </div>
      )}

      {/* Basis rows */}
      <div className="space-y-1.5 overflow-y-auto pr-1">
        {stateVector.map((amp, idx) => {
          const bitstr = idx.toString(2).padStart(numQubits, '0');
          const ket = formatKet(idx, numQubits);
          const prob = cMagSq(amp);
          const mag = cMag(amp);
          const phase = cPhase(amp);
          const prevMag = previousVector ? cMag(previousVector[idx]) : mag;
          const prevProb = previousVector ? cMagSq(previousVector[idx]) : prob;
          const isMarked = markedBitstring === bitstr;
          const isSelected = selectedBasisRow === idx;

          // Color coding by phase quadrant (never hue-only; paired with explicit numeric text)
          const hasImag = Math.abs(amp.im) > 1e-4;
          const isNegative = !hasImag && amp.re < -1e-4;
          const barColor = isMarked
            ? 'bg-emerald-600'
            : hasImag
              ? 'bg-cyan-600'
              : isNegative
                ? 'bg-amber-600'
                : 'bg-blue-600';

          // Signed real bar calculation for amplitude mode
          const signedVal = hasImag ? mag : amp.re;
          const barWidthPct =
            mode === 'probability'
              ? Math.min(100, prob * 100)
              : Math.min(100, Math.abs(signedVal) * 100);

          const probDelta = prob - prevProb;

          return (
            <button
              key={bitstr}
              type="button"
              onClick={() => onSelectBasisRow?.(idx)}
              className={`w-full text-left grid grid-cols-[68px_36px_1fr_118px_68px] items-center gap-2.5 px-2.5 py-1.5 rounded-md border transition-colors ${
                onSelectBasisRow ? 'cursor-pointer' : 'cursor-default'
              } ${
                isSelected
                  ? 'bg-blue-50/70 border-blue-300'
                  : isMarked
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              {/* Ket label */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`font-mono text-xs font-semibold tabular-nums ${
                    isMarked ? 'text-emerald-700' : 'text-slate-800'
                  }`}
                >
                  {ket}
                </span>
                {isMarked && (
                  <span className="text-[10px] font-medium text-emerald-700">
                    ★
                  </span>
                )}
              </div>

              {/* Phasor Clock Dial */}
              <div className="flex items-center justify-center" title={`Phase: ${((phase * 180) / Math.PI).toFixed(0)}°`}>
                <svg width="26" height="26" viewBox="0 0 26 26">
                  <circle
                    cx="13"
                    cy="13"
                    r="10.5"
                    fill="#f8fafc"
                    stroke={mag > 1e-4 ? '#cbd5e1' : '#e2e8f0'}
                    strokeWidth="1"
                  />
                  {mag > 1e-4 && (
                    <>
                      <line
                        x1="13"
                        y1="13"
                        x2={13 + Math.cos(phase) * Math.max(3, mag * 9.5)}
                        y2={13 - Math.sin(phase) * Math.max(3, mag * 9.5)}
                        stroke={
                          isMarked
                            ? '#059669'
                            : hasImag
                              ? '#0891b2'
                              : isNegative
                                ? '#d97706'
                                : '#2563eb'
                        }
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <circle
                        cx={13 + Math.cos(phase) * Math.max(3, mag * 9.5)}
                        cy={13 - Math.sin(phase) * Math.max(3, mag * 9.5)}
                        r="1.8"
                        fill={
                          isMarked
                            ? '#059669'
                            : hasImag
                              ? '#0891b2'
                              : isNegative
                                ? '#d97706'
                                : '#2563eb'
                        }
                      />
                    </>
                  )}
                </svg>
              </div>

              {/* Magnitude / Signed Bar */}
              <div className="relative h-5 bg-slate-100 rounded-sm overflow-hidden flex items-center">
                {mode === 'amplitude' ? (
                  <>
                    {/* Center zero line at 50% */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300 z-10" />
                    {/* Optional mean line */}
                    {showMeanLine && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 border-l border-dashed border-slate-700 z-20"
                        style={{
                          left: `${50 + Math.max(-48, Math.min(48, meanReal * 50))}%`,
                        }}
                      />
                    )}
                    {/* Signed bar from center */}
                    {mag > 1e-4 && (
                      <div
                        className={`absolute top-1 bottom-1 rounded-[2px] transition-all duration-200 ${barColor}`}
                        style={{
                          left:
                            signedVal >= 0
                              ? '50%'
                              : `${50 - barWidthPct / 2}%`,
                          width: `${Math.max(1.5, barWidthPct / 2)}%`,
                        }}
                      />
                    )}
                  </>
                ) : (
                  <div
                    className={`h-full transition-all duration-200 ${barColor}`}
                    style={{ width: `${barWidthPct}%` }}
                  />
                )}
              </div>

              {/* Complex Amplitude Readout */}
              <div className="text-right font-mono text-xs tabular-nums text-slate-800 truncate">
                {formatComplex(amp)}
                {previousVector && Math.abs(mag - prevMag) > 0.01 && (
                  <span className="ml-1 text-[10px] text-slate-400">
                    {mag > prevMag ? '↑' : '↓'}
                  </span>
                )}
              </div>

              {/* Probability Readout */}
              <div className="text-right font-mono text-xs tabular-nums">
                <span
                  className={
                    prob > 0.001 ? 'font-semibold text-slate-900' : 'text-slate-400'
                  }
                >
                  {(prob * 100).toFixed(1)}%
                </span>
                {previousVector && Math.abs(probDelta) > 0.005 && (
                  <span
                    className={`block text-[10px] ${
                      probDelta > 0 ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {probDelta > 0 ? '+' : ''}
                    {(probDelta * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Compact phase & sign legend */}
      <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
          Positive real (+α)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
          Negative real (−α, 180° phase)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-cyan-600 inline-block" />
          Complex phase (a + bi)
        </span>
      </div>
    </div>
  );
};
