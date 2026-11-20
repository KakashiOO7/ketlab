import { c, cExp } from './complex';
import { CircuitPreset, Complex, GateKind, GateMetadata } from './types';

export const GATE_CATALOG: Record<GateKind, GateMetadata> = {
  I: {
    kind: 'I',
    symbol: 'I',
    name: 'Identity',
    category: 'pauli',
    qubitsRequired: 1,
    summary: 'Leaves the qubit state unchanged while preserving wire timing.',
    blochAction: 'No rotation (0° around any axis)',
    accentHex: '#64748b',
    matrixFormula: '[[1, 0], [0, 1]]',
  },
  H: {
    kind: 'H',
    symbol: 'H',
    name: 'Hadamard',
    category: 'superposition',
    qubitsRequired: 1,
    summary: 'Maps basis states |0⟩ and |1⟩ into equal superpositions |+⟩ and |−⟩.',
    blochAction: '180° rotation around the diagonal (X + Z)/√2 axis',
    accentHex: '#2563eb',
    matrixFormula: '1/√2 [[1, 1], [1, -1]]',
  },
  X: {
    kind: 'X',
    symbol: 'X',
    name: 'Pauli-X (NOT)',
    category: 'pauli',
    qubitsRequired: 1,
    summary: 'Quantum bit-flip: swaps amplitudes of |0⟩ and |1⟩.',
    blochAction: '180° rotation around the X axis',
    accentHex: '#dc2626',
    matrixFormula: '[[0, 1], [1, 0]]',
  },
  Y: {
    kind: 'Y',
    symbol: 'Y',
    name: 'Pauli-Y',
    category: 'pauli',
    qubitsRequired: 1,
    summary: 'Combined bit-flip and phase-flip with ±i imaginary factors.',
    blochAction: '180° rotation around the Y axis',
    accentHex: '#ea580c',
    matrixFormula: '[[0, -i], [i, 0]]',
  },
  Z: {
    kind: 'Z',
    symbol: 'Z',
    name: 'Pauli-Z',
    category: 'phase',
    qubitsRequired: 1,
    summary: 'Phase-flip: leaves |0⟩ unchanged and negates the amplitude of |1⟩.',
    blochAction: '180° rotation around the Z axis',
    accentHex: '#d97706',
    matrixFormula: '[[1, 0], [0, -1]]',
  },
  S: {
    kind: 'S',
    symbol: 'S',
    name: 'Phase (π/2)',
    category: 'phase',
    qubitsRequired: 1,
    summary: 'Applies a quarter-turn (+90°) phase shift to the |1⟩ component.',
    blochAction: '90° rotation around the Z axis',
    accentHex: '#0891b2',
    matrixFormula: '[[1, 0], [0, i]]',
  },
  Sdg: {
    kind: 'Sdg',
    symbol: 'S†',
    name: 'Inverse Phase (-π/2)',
    category: 'phase',
    qubitsRequired: 1,
    summary: 'Applies a −90° phase shift (−i) to the |1⟩ component.',
    blochAction: '−90° rotation around the Z axis',
    accentHex: '#0e7490',
    matrixFormula: '[[1, 0], [0, -i]]',
  },
  T: {
    kind: 'T',
    symbol: 'T',
    name: 'T Gate (π/4)',
    category: 'phase',
    qubitsRequired: 1,
    summary: 'Applies an eighth-turn (+45°) phase shift e^(iπ/4) to |1⟩.',
    blochAction: '45° rotation around the Z axis',
    accentHex: '#0d9488',
    matrixFormula: '[[1, 0], [0, e^(iπ/4)]]',
  },
  Tdg: {
    kind: 'Tdg',
    symbol: 'T†',
    name: 'Inverse T (-π/4)',
    category: 'phase',
    qubitsRequired: 1,
    summary: 'Applies a −45° phase shift e^(−iπ/4) to |1⟩.',
    blochAction: '−45° rotation around the Z axis',
    accentHex: '#0f766e',
    matrixFormula: '[[1, 0], [0, e^(-iπ/4)]]',
  },
  Rx: {
    kind: 'Rx',
    symbol: 'Rx',
    name: 'X-Rotation',
    category: 'rotation',
    qubitsRequired: 1,
    hasAngle: true,
    summary: 'Continuous rotation around the Bloch X axis by angle θ.',
    blochAction: 'θ rotation around the X axis',
    accentHex: '#be123c',
    matrixFormula: '[[cos(θ/2), -i·sin(θ/2)], [-i·sin(θ/2), cos(θ/2)]]',
  },
  Ry: {
    kind: 'Ry',
    symbol: 'Ry',
    name: 'Y-Rotation',
    category: 'rotation',
    qubitsRequired: 1,
    hasAngle: true,
    summary: 'Continuous real-valued rotation around the Bloch Y axis by angle θ.',
    blochAction: 'θ rotation around the Y axis',
    accentHex: '#b45309',
    matrixFormula: '[[cos(θ/2), -sin(θ/2)], [sin(θ/2), cos(θ/2)]]',
  },
  Rz: {
    kind: 'Rz',
    symbol: 'Rz',
    name: 'Z-Rotation',
    category: 'rotation',
    qubitsRequired: 1,
    hasAngle: true,
    summary: 'Continuous relative phase rotation around the Bloch Z axis by angle θ.',
    blochAction: 'θ rotation around the Z axis',
    accentHex: '#0369a1',
    matrixFormula: '[[e^(-iθ/2), 0], [0, e^(iθ/2)]]',
  },
  CNOT: {
    kind: 'CNOT',
    symbol: 'CX',
    name: 'Controlled-NOT',
    category: 'multi',
    qubitsRequired: 2,
    summary: 'Flips the target qubit if and only if the control qubit is |1⟩; creates entanglement.',
    blochAction: 'Conditional X-flip; entangles control and target',
    accentHex: '#1d4ed8',
    matrixFormula: '[[1,0,0,0],[0,1,0,0],[0,0,0,1],[0,0,1,0]]',
  },
  CZ: {
    kind: 'CZ',
    symbol: 'CZ',
    name: 'Controlled-Z',
    category: 'multi',
    qubitsRequired: 2,
    summary: 'Applies a Z phase flip (−1) exclusively to the |11⟩ basis component.',
    blochAction: 'Symmetric conditional phase inversion on |11⟩',
    accentHex: '#0284c7',
    matrixFormula: 'diag(1, 1, 1, -1)',
  },
  CP: {
    kind: 'CP',
    symbol: 'CP',
    name: 'Controlled-Phase',
    category: 'multi',
    qubitsRequired: 2,
    hasAngle: true,
    summary: 'Applies relative phase e^(iθ) to |11⟩; core building block of the Quantum Fourier Transform.',
    blochAction: 'Conditional phase shift on |11⟩ by θ radians',
    accentHex: '#0e7490',
    matrixFormula: 'diag(1, 1, 1, e^(iθ))',
  },
  SWAP: {
    kind: 'SWAP',
    symbol: 'SWAP',
    name: 'Swap',
    category: 'multi',
    qubitsRequired: 2,
    summary: 'Exchanges the quantum states of two qubit wires.',
    blochAction: 'Exchanges states of qubit A and qubit B',
    accentHex: '#4f46e5',
    matrixFormula: '[[1,0,0,0],[0,0,1,0],[0,1,0,0],[0,0,0,1]]',
  },
  CCX: {
    kind: 'CCX',
    symbol: 'CCX',
    name: 'Toffoli (CCNOT)',
    category: 'multi',
    qubitsRequired: 3,
    summary: 'Doubly controlled NOT: flips target only when both control qubits are |1⟩.',
    blochAction: 'Universal classical-reversible controlled bit flip',
    accentHex: '#334155',
    matrixFormula: '8×8 identity with |110⟩ ↔ |111⟩ swapped',
  },
};

export function getSingleQubitMatrix(kind: GateKind, angle = Math.PI / 2): Complex[][] {
  const s = Math.SQRT1_2;
  switch (kind) {
    case 'I':
      return [
        [c(1), c(0)],
        [c(0), c(1)],
      ];
    case 'H':
      return [
        [c(s), c(s)],
        [c(s), c(-s)],
      ];
    case 'X':
      return [
        [c(0), c(1)],
        [c(1), c(0)],
      ];
    case 'Y':
      return [
        [c(0), c(0, -1)],
        [c(0, 1), c(0)],
      ];
    case 'Z':
      return [
        [c(1), c(0)],
        [c(0), c(-1)],
      ];
    case 'S':
      return [
        [c(1), c(0)],
        [c(0), c(0, 1)],
      ];
    case 'Sdg':
      return [
        [c(1), c(0)],
        [c(0), c(0, -1)],
      ];
    case 'T':
      return [
        [c(1), c(0)],
        [c(0), cExp(Math.PI / 4)],
      ];
    case 'Tdg':
      return [
        [c(1), c(0)],
        [c(0), cExp(-Math.PI / 4)],
      ];
    case 'Rx': {
      const half = angle / 2;
      return [
        [c(Math.cos(half)), c(0, -Math.sin(half))],
        [c(0, -Math.sin(half)), c(Math.cos(half))],
      ];
    }
    case 'Ry': {
      const half = angle / 2;
      return [
        [c(Math.cos(half)), c(-Math.sin(half))],
        [c(Math.sin(half)), c(Math.cos(half))],
      ];
    }
    case 'Rz': {
      const half = angle / 2;
      return [
        [cExp(-half), c(0)],
        [c(0), cExp(half)],
      ];
    }
    default:
      return [
        [c(1), c(0)],
        [c(0), c(1)],
      ];
  }
}

export const CIRCUIT_PRESETS: CircuitPreset[] = [
  {
    id: 'bell-pair',
    title: 'Bell Entanglement',
    subtitle: 'Creates the maximally entangled state (|00⟩ + |11⟩)/√2',
    numQubits: 2,
    initialBits: [0, 0],
    steps: [
      {
        id: 'bp-1',
        label: 'Superposition',
        note: 'Hadamard puts q₀ into (|0⟩ + |1⟩)/√2, splitting the state across |00⟩ and |10⟩.',
        gates: [{ id: 'g1', kind: 'H', target: 0 }],
      },
      {
        id: 'bp-2',
        label: 'Entangle',
        note: 'CNOT flips q₁ when q₀ = 1, shifting amplitude from |10⟩ into |11⟩.',
        gates: [{ id: 'g2', kind: 'CNOT', control: 0, target: 1 }],
      },
    ],
  },
  {
    id: 'interference',
    title: 'Quantum Interference (H·Z·H)',
    subtitle: 'Demonstrates how relative phase turns |0⟩ into |1⟩ via interference',
    numQubits: 1,
    initialBits: [0],
    steps: [
      {
        id: 'int-1',
        label: 'Create |+⟩',
        note: 'First Hadamard creates equal positive amplitudes for |0⟩ and |1⟩.',
        gates: [{ id: 'ig1', kind: 'H', target: 0 }],
      },
      {
        id: 'int-2',
        label: 'Phase Flip',
        note: 'Z flips the sign of |1⟩ to negative, moving from |+⟩ to |−⟩ without changing probabilities.',
        gates: [{ id: 'ig2', kind: 'Z', target: 0 }],
      },
      {
        id: 'int-3',
        label: 'Interfere',
        note: 'Second Hadamard constructively interferes |1⟩ and cancels |0⟩ completely.',
        gates: [{ id: 'ig3', kind: 'H', target: 0 }],
      },
    ],
  },
  {
    id: 'ghz-3',
    title: '3-Qubit GHZ State',
    subtitle: 'Multipartite entanglement (|000⟩ + |111⟩)/√2',
    numQubits: 3,
    initialBits: [0, 0, 0],
    steps: [
      {
        id: 'ghz-1',
        label: 'H on q₀',
        note: 'Places q₀ into an equal superposition.',
        gates: [{ id: 'gg1', kind: 'H', target: 0 }],
      },
      {
        id: 'ghz-2',
        label: 'CNOT q₀→q₁',
        note: 'Correlates q₁ with q₀.',
        gates: [{ id: 'gg2', kind: 'CNOT', control: 0, target: 1 }],
      },
      {
        id: 'ghz-3',
        label: 'CNOT q₁→q₂',
        note: 'Extends entanglement across all three qubits.',
        gates: [{ id: 'gg3', kind: 'CNOT', control: 1, target: 2 }],
      },
    ],
  },
  {
    id: 'phase-kickback',
    title: 'Phase Kickback',
    subtitle: 'Eigenphase on target kicks back onto the control qubit',
    numQubits: 2,
    initialBits: [0, 1],
    steps: [
      {
        id: 'pk-1',
        label: 'Prepare |+⟩|−⟩',
        note: 'Hadamard on both qubits creates |+⟩ on q₀ and |−⟩ on q₁.',
        gates: [
          { id: 'pk-g1', kind: 'H', target: 0 },
          { id: 'pk-g2', kind: 'H', target: 1 },
        ],
      },
      {
        id: 'pk-2',
        label: 'CNOT Kickback',
        note: 'Because q₁ is in the −1 eigenstate |−⟩ of X, CNOT kicks a −1 phase onto q₀.',
        gates: [{ id: 'pk-g3', kind: 'CNOT', control: 0, target: 1 }],
      },
      {
        id: 'pk-3',
        label: 'Readout q₀',
        note: 'Hadamard converts the kicked-back |−⟩ state on q₀ into |1⟩.',
        gates: [{ id: 'pk-g4', kind: 'H', target: 0 }],
      },
    ],
  },
];
