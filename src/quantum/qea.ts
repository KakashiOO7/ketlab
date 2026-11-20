export type QEAVariant =
  | 'standard'
  | 'adaptive'
  | 'catastrophe'
  | 'qga-crossover';

export type QEAProblemId = 'knapsack' | 'trap' | 'onemax';

export interface QBit {
  alpha: number; // cos(theta), amplitude for |0>
  beta: number;  // sin(theta), amplitude for |1>
  theta: number; // angle in radians [0, pi/2] typically
  lastDelta: number; // last rotation applied
}

export interface QIndividual {
  id: number;
  qbits: QBit[];
  observedBits: number[];
  fitness: number;
  isFeasible: boolean;
}

export interface GenerationMetric {
  generation: number;
  bestFitness: number;
  meanFitness: number;
  entropy: number; // normalized [0..1] quantum superposition diversity
  catastropheTriggered?: boolean;
}

export interface QEAState {
  generation: number;
  population: QIndividual[];
  bestBits: number[];
  bestFitness: number;
  maxPossibleFitness: number;
  stagnantGenerations: number;
  history: GenerationMetric[];
  lastEventNote: string;
}

export interface KnapsackItem {
  name: string;
  weight: number;
  value: number;
}

export const KNAPSACK_ITEMS: KnapsackItem[] = [
  { name: 'Cryo Sensor', weight: 2, value: 14 },
  { name: 'Laser Diode', weight: 3, value: 21 },
  { name: 'RF Cavity', weight: 4, value: 26 },
  { name: 'Flux Coil', weight: 5, value: 33 },
  { name: 'Waveguide', weight: 3, value: 18 },
  { name: 'Shield Plate', weight: 6, value: 31 },
];
export const KNAPSACK_CAPACITY = 12;

export const QEA_VARIANTS: Record<
  QEAVariant,
  {
    title: string;
    shortName: string;
    yearOrOrigin: string;
    description: string;
    mechanism: string;
  }
> = {
  standard: {
    title: 'Standard QEA (Han & Kim)',
    shortName: 'Standard QEA',
    yearOrOrigin: 'Han & Kim, 2002',
    description:
      'Represents individuals as vectors of Q-bits initialized in equal superposition |+⟩. Samples binary candidates and rotates Q-bits toward the best solution using a fixed Δθ lookup table.',
    mechanism: 'Fixed rotation angle Δθ₀ with elitist global best guidance.',
  },
  adaptive: {
    title: 'Adaptive Rotation QEA',
    shortName: 'Adaptive Δθ',
    yearOrOrigin: 'Dynamic Step Control',
    description:
      'Adjusts the rotation angle Δθ(t) dynamically based on generation progress and the fitness gap between candidate and global best—taking bold steps early and precise steps near convergence.',
    mechanism: 'Δθ scales with (f_best − f_x) and decays smoothly over generations.',
  },
  catastrophe: {
    title: 'Catastrophic QEA (Restart)',
    shortName: 'Catastrophic',
    yearOrOrigin: 'Premature Convergence Escape',
    description:
      'Monitors population quantum entropy and stagnation. When Q-bits collapse near 0/1 without improving best fitness, a quantum catastrophe resets non-elite individuals back to |+⟩ superposition.',
    mechanism: 'Resets stagnant non-elite Q-bits to θ = π/4 when entropy drops < 0.18.',
  },
  'qga-crossover': {
    title: 'QGA with Quantum Crossover & Mutation',
    shortName: 'QGA Crossover',
    yearOrOrigin: 'Hybrid Quantum Genetic',
    description:
      'Combines Q-gate rotation with two-point Quantum Crossover across high-fitness Q-bit chromosomes and probabilistic Pauli-X amplitude swaps to maintain multi-locus exploration.',
    mechanism: 'Exchanges Q-bit segments between top parents + 4% Pauli-X bit inversion.',
  },
};

export function getProblemLength(problem: QEAProblemId): number {
  if (problem === 'knapsack') return 6;
  if (problem === 'trap') return 6;
  return 8;
}

export function evaluateFitness(
  bits: number[],
  problem: QEAProblemId
): { fitness: number; isFeasible: boolean; maxFitness: number } {
  if (problem === 'knapsack') {
    let totalW = 0;
    let totalV = 0;
    bits.forEach((b, i) => {
      if (b === 1 && KNAPSACK_ITEMS[i]) {
        totalW += KNAPSACK_ITEMS[i].weight;
        totalV += KNAPSACK_ITEMS[i].value;
      }
    });
    if (totalW <= KNAPSACK_CAPACITY) {
      return { fitness: totalV, isFeasible: true, maxFitness: 80 }; // Optimal = 2+3+4+3=12 -> 14+21+26+18 = 79, or 2+5+4=11 -> 14+33+26 = 73, or 3+4+5=12 -> 21+26+33 = 80!
    }
    // Soft penalty for overweight solutions so gradient guides back into feasible space
    const penalty = (totalW - KNAPSACK_CAPACITY) * 14;
    return {
      fitness: Math.max(0, totalV - penalty),
      isFeasible: false,
      maxFitness: 80,
    };
  }

  if (problem === 'trap') {
    // Two 3-bit deceptive trap blocks:
    // For each 3-bit block: u = sum of 1s. If u == 3 -> 30, else (2 - u) * 8 (so 000 gives 16, 001 gives 8, 011 gives 0, 111 gives 30!)
    let score = 0;
    for (let block = 0; block < 2; block++) {
      const slice = bits.slice(block * 3, block * 3 + 3);
      const ones = slice.reduce((a, b) => a + b, 0);
      score += ones === 3 ? 30 : (2 - ones) * 8;
    }
    return { fitness: score, isFeasible: true, maxFitness: 60 };
  }

  // OneMax (8 bits)
  const ones = bits.reduce((a, b) => a + b, 0);
  return { fitness: ones * 10, isFeasible: true, maxFitness: bits.length * 10 };
}

function makeSuperpositionQBit(): QBit {
  const theta = Math.PI / 4;
  return {
    theta,
    alpha: Math.cos(theta),
    beta: Math.sin(theta),
    lastDelta: 0,
  };
}

function observeQBits(qbits: QBit[]): number[] {
  return qbits.map((q) => (Math.random() < q.beta * q.beta ? 1 : 0));
}

function computePopulationEntropy(population: QIndividual[]): number {
  let total = 0;
  let count = 0;
  for (const ind of population) {
    for (const q of ind.qbits) {
      const p0 = Math.max(1e-9, Math.min(1 - 1e-9, q.alpha * q.alpha));
      const p1 = 1 - p0;
      const h = -(p0 * Math.log2(p0) + p1 * Math.log2(p1));
      total += h;
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}

export function initializeQEA(
  populationSize: number,
  problem: QEAProblemId
): QEAState {
  const len = getProblemLength(problem);
  const population: QIndividual[] = [];
  let bestBits = Array.from({ length: len }, () => 0);
  let bestFitness = -Infinity;
  let maxPossibleFitness = 80;

  for (let i = 0; i < populationSize; i++) {
    const qbits = Array.from({ length: len }, () => makeSuperpositionQBit());
    const observedBits = observeQBits(qbits);
    const evalRes = evaluateFitness(observedBits, problem);
    maxPossibleFitness = evalRes.maxFitness;

    population.push({
      id: i,
      qbits,
      observedBits,
      fitness: evalRes.fitness,
      isFeasible: evalRes.isFeasible,
    });

    if (evalRes.fitness > bestFitness) {
      bestFitness = evalRes.fitness;
      bestBits = [...observedBits];
    }
  }

  const meanFitness =
    population.reduce((acc, ind) => acc + ind.fitness, 0) / population.length;
  const entropy = computePopulationEntropy(population);

  return {
    generation: 0,
    population,
    bestBits,
    bestFitness,
    maxPossibleFitness,
    stagnantGenerations: 0,
    history: [
      {
        generation: 0,
        bestFitness,
        meanFitness,
        entropy,
      },
    ],
    lastEventNote:
      'Initialized all Q-bit registers in uniform superposition |+⟩ (θ = π/4, P(|0⟩)=P(|1⟩)=50%) and sampled generation 0.',
  };
}

/**
 * Han & Kim rotation direction sign based on x_i, b_i, and fitness comparison.
 * Rotates (alpha, beta)^T toward b_i when candidate is worse than b.
 */
export function lookupRotationSign(
  xBit: number,
  bBit: number,
  fCandidateGeqBest: boolean
): -1 | 0 | 1 {
  if (xBit === bBit) return 0;
  if (!fCandidateGeqBest) {
    // Candidate is worse than global best -> rotate toward bBit
    // When bBit = 1 (target |1>, sin(theta) grows), delta > 0
    // When bBit = 0 (target |0>, cos(theta) grows), delta < 0
    return bBit === 1 ? 1 : -1;
  }
  // Candidate >= best -> reinforce xBit
  return xBit === 1 ? 1 : -1;
}

export function stepQEAGeneration(
  state: QEAState,
  variant: QEAVariant,
  problem: QEAProblemId,
  baseDeltaTheta: number
): QEAState {
  const nextGen = state.generation + 1;
  const len = getProblemLength(problem);
  let nextBestBits = [...state.bestBits];
  let nextBestFitness = state.bestFitness;
  let improved = false;

  // 1. Update Q-bits of each individual using Q-gate rotation U(Delta theta)
  let updatedPop: QIndividual[] = state.population.map((ind) => {
    const fGeq = ind.fitness >= state.bestFitness;

    // Variant-specific step size scaling
    let stepMag = baseDeltaTheta;
    if (variant === 'adaptive') {
      const gapRatio =
        state.maxPossibleFitness > 0
          ? Math.max(0.2, (state.bestFitness - ind.fitness) / state.maxPossibleFitness)
          : 0.5;
      const decay = Math.max(0.35, 1 - nextGen * 0.015);
      stepMag = baseDeltaTheta * (0.55 + gapRatio * 1.1) * decay;
    }

    const rotatedQBits: QBit[] = ind.qbits.map((q, bitIdx) => {
      const sign = lookupRotationSign(
        ind.observedBits[bitIdx],
        state.bestBits[bitIdx],
        fGeq
      );
      const delta = sign * stepMag;
      // Keep theta softly inside [0.04, pi/2 - 0.04] to preserve minimal quantum fluctuation
      // unless standard convergence reaches tight bounds
      const rawTheta = q.theta + delta;
      const minBound = 0.03;
      const maxBound = Math.PI / 2 - 0.03;
      const clampedTheta = Math.max(minBound, Math.min(maxBound, rawTheta));

      return {
        theta: clampedTheta,
        alpha: Math.cos(clampedTheta),
        beta: Math.sin(clampedTheta),
        lastDelta: clampedTheta - q.theta,
      };
    });

    return {
      ...ind,
      qbits: rotatedQBits,
    };
  });

  // Variant: QGA Quantum Crossover & Pauli-X Mutation
  if (variant === 'qga-crossover' && updatedPop.length >= 2) {
    const sorted = [...updatedPop].sort((a, b) => b.fitness - a.fitness);
    const eliteA = sorted[0];
    const eliteB = sorted[1];

    updatedPop = updatedPop.map((ind, idx) => {
      if (idx === 0) return ind; // preserve top individual
      const cut1 = Math.floor(len / 3);
      const cut2 = Math.floor((2 * len) / 3);
      const newQBits = ind.qbits.map((q, bIdx) => {
        let nextQ = q;
        if (bIdx >= cut1 && bIdx < cut2) {
          // Quantum crossover splice from top parent
          const donor = idx % 2 === 0 ? eliteA.qbits[bIdx] : eliteB.qbits[bIdx];
          nextQ = { ...donor };
        }
        // Probabilistic Quantum Mutation (Pauli-X angle reflection: theta -> pi/2 - theta)
        if (Math.random() < 0.04) {
          const flippedTheta = Math.PI / 2 - nextQ.theta;
          nextQ = {
            theta: flippedTheta,
            alpha: Math.cos(flippedTheta),
            beta: Math.sin(flippedTheta),
            lastDelta: flippedTheta - nextQ.theta,
          };
        }
        return nextQ;
      });
      return { ...ind, qbits: newQBits };
    });
  }

  // 2. Observe (Collapse) new candidate solutions & evaluate fitness
  updatedPop = updatedPop.map((ind) => {
    const observedBits = observeQBits(ind.qbits);
    const evalRes = evaluateFitness(observedBits, problem);
    if (evalRes.fitness > nextBestFitness) {
      nextBestFitness = evalRes.fitness;
      nextBestBits = [...observedBits];
      improved = true;
    }
    return {
      ...ind,
      observedBits,
      fitness: evalRes.fitness,
      isFeasible: evalRes.isFeasible,
    };
  });

  let entropy = computePopulationEntropy(updatedPop);
  let stagnant = improved ? 0 : state.stagnantGenerations + 1;
  let catastropheTriggered = false;

  // Variant: Quantum Catastrophe if prematurely converged on suboptimal state
  if (
    variant === 'catastrophe' &&
    stagnant >= 4 &&
    entropy < 0.22 &&
    nextBestFitness < state.maxPossibleFitness
  ) {
    catastropheTriggered = true;
    stagnant = 0;
    // Keep individual 0 biased toward best, reset all others back to |+> superposition
    updatedPop = updatedPop.map((ind, idx) => {
      if (idx === 0) return ind;
      const freshQ = Array.from({ length: len }, () => makeSuperpositionQBit());
      const obs = observeQBits(freshQ);
      const ev = evaluateFitness(obs, problem);
      if (ev.fitness > nextBestFitness) {
        nextBestFitness = ev.fitness;
        nextBestBits = [...obs];
      }
      return {
        ...ind,
        qbits: freshQ,
        observedBits: obs,
        fitness: ev.fitness,
        isFeasible: ev.isFeasible,
      };
    });
    entropy = computePopulationEntropy(updatedPop);
  }

  const meanFitness =
    updatedPop.reduce((acc, ind) => acc + ind.fitness, 0) / updatedPop.length;

  const lastEventNote = catastropheTriggered
    ? `Gen ${nextGen}: Quantum Catastrophe triggered! Entropy collapsed below 0.22 while stagnant—reset non-elite Q-bits to |+⟩ superposition.`
    : improved
      ? `Gen ${nextGen}: Discovered improved solution |${nextBestBits.join('')}⟩ with fitness ${nextBestFitness}/${state.maxPossibleFitness}.`
      : `Gen ${nextGen}: Rotated Q-bit amplitudes via U(Δθ). Mean fitness ${meanFitness.toFixed(1)}, quantum entropy ${entropy.toFixed(2)}.`;

  return {
    generation: nextGen,
    population: updatedPop,
    bestBits: nextBestBits,
    bestFitness: nextBestFitness,
    maxPossibleFitness: state.maxPossibleFitness,
    stagnantGenerations: stagnant,
    history: [
      ...state.history.slice(-79),
      {
        generation: nextGen,
        bestFitness: nextBestFitness,
        meanFitness,
        entropy,
        catastropheTriggered,
      },
    ],
    lastEventNote,
  };
}
