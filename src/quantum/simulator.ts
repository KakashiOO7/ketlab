import { C0, C1, c, cAdd, cConj, cMagSq, cMul, formatKet } from './complex';
import { GATE_CATALOG, getSingleQubitMatrix } from './gates';
import {
  BlochVector,
  CircuitGate,
  CircuitStep,
  Complex,
  SimulationSnapshot,
} from './types';

export function createIdentityMatrix(dim: number): Complex[][] {
  return Array.from({ length: dim }, (_, r) =>
    Array.from({ length: dim }, (_, col) => (r === col ? C1 : C0))
  );
}

export function tensorProduct(A: Complex[][], B: Complex[][]): Complex[][] {
  const rowsA = A.length;
  const colsA = A[0].length;
  const rowsB = B.length;
  const colsB = B[0].length;
  const result: Complex[][] = Array.from({ length: rowsA * rowsB }, () =>
    Array.from({ length: colsA * colsB }, () => C0)
  );

  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsA; j++) {
      for (let k = 0; k < rowsB; k++) {
        for (let l = 0; l < colsB; l++) {
          result[i * rowsB + k][j * colsB + l] = cMul(A[i][j], B[k][l]);
        }
      }
    }
  }
  return result;
}

export function multiplyMatrices(A: Complex[][], B: Complex[][]): Complex[][] {
  const rows = A.length;
  const cols = B[0].length;
  const inner = B.length;
  const out: Complex[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => C0)
  );

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = C0;
      for (let k = 0; k < inner; k++) {
        sum = cAdd(sum, cMul(A[i][k], B[k][j]));
      }
      out[i][j] = sum;
    }
  }
  return out;
}

export function applyMatrixToVector(M: Complex[][], v: Complex[]): Complex[] {
  return M.map((row) =>
    row.reduce((acc, entry, colIdx) => cAdd(acc, cMul(entry, v[colIdx])), C0)
  );
}

/**
 * Qubit 0 is MSB: bitMask(q) = 1 << (numQubits - 1 - q)
 */
export function buildGateMatrix(gate: CircuitGate, numQubits: number): Complex[][] {
  const dim = 1 << numQubits;

  if (gate.kind === 'CNOT') {
    const ctrl = gate.control ?? 0;
    const tgt = gate.target;
    const ctrlMask = 1 << (numQubits - 1 - ctrl);
    const tgtMask = 1 << (numQubits - 1 - tgt);
    const M = Array.from({ length: dim }, () => Array.from({ length: dim }, () => C0));
    for (let col = 0; col < dim; col++) {
      const row = (col & ctrlMask) !== 0 ? col ^ tgtMask : col;
      M[row][col] = C1;
    }
    return M;
  }

  if (gate.kind === 'CZ') {
    const ctrl = gate.control ?? 0;
    const tgt = gate.target;
    const ctrlMask = 1 << (numQubits - 1 - ctrl);
    const tgtMask = 1 << (numQubits - 1 - tgt);
    const M = createIdentityMatrix(dim);
    for (let i = 0; i < dim; i++) {
      if ((i & ctrlMask) !== 0 && (i & tgtMask) !== 0) {
        M[i][i] = c(-1);
      }
    }
    return M;
  }

  if (gate.kind === 'CP') {
    const ctrl = gate.control ?? 0;
    const tgt = gate.target;
    const angle = gate.angle ?? Math.PI / 2;
    const ctrlMask = 1 << (numQubits - 1 - ctrl);
    const tgtMask = 1 << (numQubits - 1 - tgt);
    const M = createIdentityMatrix(dim);
    const phaseFactor = { re: Math.cos(angle), im: Math.sin(angle) };
    for (let i = 0; i < dim; i++) {
      if ((i & ctrlMask) !== 0 && (i & tgtMask) !== 0) {
        M[i][i] = phaseFactor;
      }
    }
    return M;
  }

  if (gate.kind === 'SWAP') {
    const qA = gate.control ?? 0;
    const qB = gate.target;
    const maskA = 1 << (numQubits - 1 - qA);
    const maskB = 1 << (numQubits - 1 - qB);
    const M = Array.from({ length: dim }, () => Array.from({ length: dim }, () => C0));
    for (let col = 0; col < dim; col++) {
      const bitA = (col & maskA) !== 0 ? 1 : 0;
      const bitB = (col & maskB) !== 0 ? 1 : 0;
      const row = bitA !== bitB ? col ^ maskA ^ maskB : col;
      M[row][col] = C1;
    }
    return M;
  }

  if (gate.kind === 'CCX') {
    const c1 = gate.control ?? 0;
    const c2 = gate.control2 ?? 1;
    const tgt = gate.target;
    const m1 = 1 << (numQubits - 1 - c1);
    const m2 = 1 << (numQubits - 1 - c2);
    const mt = 1 << (numQubits - 1 - tgt);
    const M = Array.from({ length: dim }, () => Array.from({ length: dim }, () => C0));
    for (let col = 0; col < dim; col++) {
      const row = (col & m1) !== 0 && (col & m2) !== 0 ? col ^ mt : col;
      M[row][col] = C1;
    }
    return M;
  }

  // Single-qubit gate embedded via tensor products
  const U = getSingleQubitMatrix(gate.kind, gate.angle);
  const I2 = getSingleQubitMatrix('I');
  let acc: Complex[][] | null = null;
  for (let q = 0; q < numQubits; q++) {
    const factor = q === gate.target ? U : I2;
    acc = acc === null ? factor : tensorProduct(acc, factor);
  }
  return acc ?? createIdentityMatrix(dim);
}

export function buildStepMatrix(gates: CircuitGate[], numQubits: number): Complex[][] {
  const dim = 1 << numQubits;
  if (gates.length === 0) return createIdentityMatrix(dim);

  // Check if all gates are disjoint single-qubit gates -> fast tensor product
  const allSingle = gates.every((g) => GATE_CATALOG[g.kind].qubitsRequired === 1);
  if (allSingle) {
    const I2 = getSingleQubitMatrix('I');
    let acc: Complex[][] | null = null;
    for (let q = 0; q < numQubits; q++) {
      const g = gates.find((item) => item.target === q);
      const factor = g ? getSingleQubitMatrix(g.kind, g.angle) : I2;
      acc = acc === null ? factor : tensorProduct(acc, factor);
    }
    return acc ?? createIdentityMatrix(dim);
  }

  // General case: multiply gate matrices in wire-order
  let combined = createIdentityMatrix(dim);
  for (const g of gates) {
    const gm = buildGateMatrix(g, numQubits);
    combined = multiplyMatrices(gm, combined);
  }
  return combined;
}

export function computeBlochVectors(state: Complex[], numQubits: number): BlochVector[] {
  const dim = state.length;
  const vectors: BlochVector[] = [];

  for (let q = 0; q < numQubits; q++) {
    const bitMask = 1 << (numQubits - 1 - q);
    let rho00 = 0;
    let rho11 = 0;
    let rho01 = C0;

    for (let idx = 0; idx < dim; idx++) {
      if ((idx & bitMask) === 0) {
        const partner = idx | bitMask;
        const a0 = state[idx];
        const a1 = state[partner];
        rho00 += cMagSq(a0);
        rho11 += cMagSq(a1);
        // rho_01 = sum a0 * conj(a1)
        rho01 = cAdd(rho01, cMul(a0, cConj(a1)));
      }
    }

    const x = 2 * rho01.re;
    const y = -2 * rho01.im;
    const z = rho00 - rho11;
    const purity = Math.min(1, Math.hypot(x, y, z));

    vectors.push({
      qubit: q,
      x: Math.abs(x) < 1e-6 ? 0 : x,
      y: Math.abs(y) < 1e-6 ? 0 : y,
      z: Math.abs(z) < 1e-6 ? 0 : z,
      purity: Math.abs(purity) < 1e-6 ? 0 : purity,
      probZero: rho00,
      probOne: rho11,
    });
  }

  return vectors;
}

export function buildInitialState(initialBits: number[]): Complex[] {
  const numQubits = initialBits.length;
  const dim = 1 << numQubits;
  const index = initialBits.reduce((acc, bit, idx) => {
    const shift = numQubits - 1 - idx;
    return acc | ((bit ? 1 : 0) << shift);
  }, 0);
  return Array.from({ length: dim }, (_, i) => (i === index ? C1 : C0));
}

export function simulateCircuit(
  numQubits: number,
  initialBits: number[],
  steps: CircuitStep[]
): SimulationSnapshot[] {
  const initialState = buildInitialState(initialBits.slice(0, numQubits));
  const dim = 1 << numQubits;
  const idMatrix = createIdentityMatrix(dim);

  const snapshots: SimulationSnapshot[] = [
    {
      stepIndex: 0,
      label: `Initial ${formatKet(
        initialBits.slice(0, numQubits).reduce((a, b) => (a << 1) | b, 0),
        numQubits
      )}`,
      note: 'Initial computational basis state before any gates are applied.',
      stateVector: initialState,
      inputVector: initialState,
      stepMatrix: idMatrix,
      blochVectors: computeBlochVectors(initialState, numQubits),
      probabilities: initialState.map((a) => cMagSq(a)),
    },
  ];

  let current = initialState;

  steps.forEach((step, idx) => {
    const stepMatrix = buildStepMatrix(step.gates, numQubits);
    const next = applyMatrixToVector(stepMatrix, current);
    const summaryGates =
      step.gates.length === 0
        ? 'Identity'
        : step.gates.map((g) => GATE_CATALOG[g.kind].symbol).join(' ⊗ ');

    snapshots.push({
      stepIndex: idx + 1,
      label: step.label || `Step ${idx + 1}: ${summaryGates}`,
      note: step.note,
      stateVector: next,
      inputVector: current,
      stepMatrix,
      blochVectors: computeBlochVectors(next, numQubits),
      probabilities: next.map((a) => cMagSq(a)),
    });

    current = next;
  });

  return snapshots;
}

export function sampleShots(probabilities: number[], numShots: number): number[] {
  const counts = Array.from({ length: probabilities.length }, () => 0);
  for (let s = 0; s < numShots; s++) {
    const r = Math.random();
    let cum = 0;
    let chosen = probabilities.length - 1;
    for (let i = 0; i < probabilities.length; i++) {
      cum += probabilities[i];
      if (r <= cum) {
        chosen = i;
        break;
      }
    }
    counts[chosen]++;
  }
  return counts;
}
