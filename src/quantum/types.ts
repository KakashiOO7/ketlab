export interface Complex {
  re: number;
  im: number;
}

export type GateKind =
  | 'I'
  | 'H'
  | 'X'
  | 'Y'
  | 'Z'
  | 'S'
  | 'Sdg'
  | 'T'
  | 'Tdg'
  | 'Rx'
  | 'Ry'
  | 'Rz'
  | 'CNOT'
  | 'CZ'
  | 'CP'
  | 'SWAP'
  | 'CCX';

export interface GateMetadata {
  kind: GateKind;
  symbol: string;
  name: string;
  category: 'pauli' | 'superposition' | 'phase' | 'rotation' | 'multi';
  qubitsRequired: 1 | 2 | 3;
  hasAngle?: boolean;
  summary: string;
  blochAction: string;
  accentHex: string;
  matrixFormula: string;
}

export interface CircuitGate {
  id: string;
  kind: GateKind;
  /** Target qubit index (0 is top wire). For SWAP, first swapped qubit. */
  target: number;
  /** Control qubit index for 2-qubit gates, or second swapped qubit for SWAP. */
  control?: number;
  /** Second control qubit index for 3-qubit Toffoli (CCX). */
  control2?: number;
  /** Rotation angle in radians for Rx, Ry, Rz. */
  angle?: number;
}

export interface CircuitStep {
  id: string;
  label?: string;
  note?: string;
  gates: CircuitGate[];
}

export interface BlochVector {
  qubit: number;
  x: number;
  y: number;
  z: number;
  purity: number;
  probZero: number;
  probOne: number;
}

export interface SimulationSnapshot {
  stepIndex: number; // 0 = initial state, 1..N = after step k
  label: string;
  note?: string;
  stateVector: Complex[];
  inputVector: Complex[];
  stepMatrix: Complex[][]; // 2^n x 2^n unitary matrix for this step
  blochVectors: BlochVector[];
  probabilities: number[];
}

export interface CircuitPreset {
  id: string;
  title: string;
  subtitle: string;
  numQubits: number;
  initialBits: number[];
  steps: CircuitStep[];
}
