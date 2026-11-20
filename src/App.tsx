/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { CIRCUIT_PRESETS } from './quantum/gates';
import { CircuitStep } from './quantum/types';
import { AlgorithmsView } from './views/AlgorithmsView';
import { CircuitLabView } from './views/CircuitLabView';
import { EvolutionaryView } from './views/EvolutionaryView';
import { GateAtlasView } from './views/GateAtlasView';
import { MatrixMathView } from './views/MatrixMathView';

type AppTab = 'lab' | 'algorithms' | 'evolutionary' | 'atlas' | 'matrix';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('lab');

  // Shared circuit state across Circuit Lab and Matrix Math
  const defaultPreset = CIRCUIT_PRESETS[0];
  const [numQubits, setNumQubits] = useState<number>(defaultPreset.numQubits);
  const [initialBits, setInitialBits] = useState<number[]>(defaultPreset.initialBits);
  const [steps, setSteps] = useState<CircuitStep[]>(defaultPreset.steps);

  const handleLoadIntoLab = (
    nextQubits: number,
    nextInitialBits: number[],
    nextSteps: CircuitStep[]
  ) => {
    setNumQubits(nextQubits);
    setInitialBits(nextInitialBits);
    setSteps(nextSteps);
    setActiveTab('lab');
  };

  const handleNewCircuit = () => {
    setNumQubits(2);
    setInitialBits([0, 0]);
    setSteps([
      {
        id: `fresh-${Date.now()}-1`,
        gates: [{ id: `fg-${Date.now()}-1`, kind: 'H', target: 0 }],
      },
      {
        id: `fresh-${Date.now()}-2`,
        gates: [],
      },
    ]);
    setActiveTab('lab');
  };

  const navItems: Array<{ id: AppTab; label: string }> = [
    { id: 'lab', label: 'Circuit Lab' },
    { id: 'algorithms', label: 'Algorithms' },
    { id: 'evolutionary', label: 'Evolutionary' },
    { id: 'atlas', label: 'Gate Atlas' },
    { id: 'matrix', label: 'Matrix Math' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      {/* Three-Zone Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('lab')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            KetLab
          </button>

          {/* Zone 2: 5 single-line text nav links */}
          <nav
            aria-label="Primary sections"
            className="flex items-center gap-5 sm:gap-7 overflow-x-auto"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-blue-700'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-blue-600" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleNewCircuit}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              New Circuit
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5">
        {activeTab === 'lab' && (
          <CircuitLabView
            numQubits={numQubits}
            initialBits={initialBits}
            steps={steps}
            onChangeNumQubits={setNumQubits}
            onChangeInitialBits={setInitialBits}
            onChangeSteps={setSteps}
          />
        )}

        {activeTab === 'algorithms' && (
          <AlgorithmsView onLoadIntoLab={handleLoadIntoLab} />
        )}

        {activeTab === 'evolutionary' && (
          <EvolutionaryView onLoadIntoLab={handleLoadIntoLab} />
        )}

        {activeTab === 'atlas' && <GateAtlasView />}

        {activeTab === 'matrix' && (
          <MatrixMathView
            numQubits={numQubits}
            initialBits={initialBits}
            steps={steps}
          />
        )}
      </main>
    </div>
  );
}
