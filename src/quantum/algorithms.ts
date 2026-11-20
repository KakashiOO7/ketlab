import { CircuitGate, CircuitStep } from './types';

export type DeutschOracleType = 'constant-0' | 'constant-1' | 'balanced-x0' | 'balanced-xor';

/**
 * Builds an exact decomposed Grover's Search circuit for n = 2 or n = 3 qubits.
 */
export function buildGroverCircuit(
  numQubits: 2 | 3,
  targetBitstring: string,
  iterations: number
): { initialBits: number[]; steps: CircuitStep[] } {
  const steps: CircuitStep[] = [];
  const bits = targetBitstring.split('').map((b) => (b === '1' ? 1 : 0));

  // Step 1: Uniform Superposition H^{\otimes n}
  steps.push({
    id: 'grover-init-h',
    label: 'Uniform Superposition',
    note: `Hadamard gates place all ${1 << numQubits} basis states into equal positive amplitude 1/√${
      1 << numQubits
    }.`,
    gates: Array.from({ length: numQubits }, (_, q) => ({
      id: `g-h-init-${q}`,
      kind: 'H',
      target: q,
    })),
  });

  const appendMultiControlledZ = (prefix: string, label: string, note: string) => {
    if (numQubits === 2) {
      steps.push({
        id: `${prefix}-cz`,
        label,
        note,
        gates: [{ id: `${prefix}-cz-g`, kind: 'CZ', control: 0, target: 1 }],
      });
    } else {
      // CCZ = (I ⊗ I ⊗ H) · CCX · (I ⊗ I ⊗ H)
      steps.push({
        id: `${prefix}-h1`,
        label: `${label} (Basis Prep)`,
        note: 'Hadamard rotates target qubit q₂ so Toffoli acts as a controlled-Z phase flip.',
        gates: [{ id: `${prefix}-h1-g`, kind: 'H', target: 2 }],
      });
      steps.push({
        id: `${prefix}-ccx`,
        label,
        note,
        gates: [{ id: `${prefix}-ccx-g`, kind: 'CCX', control: 0, control2: 1, target: 2 }],
      });
      steps.push({
        id: `${prefix}-h2`,
        label: `${label} (Restore)`,
        note: 'Second Hadamard returns q₂ to the computational basis with the phase inversion locked in.',
        gates: [{ id: `${prefix}-h2-g`, kind: 'H', target: 2 }],
      });
    }
  };

  for (let iter = 1; iter <= iterations; iter++) {
    const zeroBits = bits
      .map((b, q) => (b === 0 ? q : -1))
      .filter((q) => q >= 0);

    // Oracle Pre-X flips for 0 bits
    if (zeroBits.length > 0) {
      steps.push({
        id: `iter-${iter}-oracle-prex`,
        label: `Iter ${iter}: Oracle Align`,
        note: `Flip qubits with 0 in |${targetBitstring}⟩ so the target state maps temporarily to |${'1'.repeat(
          numQubits
        )}⟩.`,
        gates: zeroBits.map((q) => ({
          id: `iter-${iter}-ox1-${q}`,
          kind: 'X',
          target: q,
        })),
      });
    }

    appendMultiControlledZ(
      `iter-${iter}-oracle`,
      `Iter ${iter}: Oracle Marks |${targetBitstring}⟩`,
      `Phase oracle multiplies the amplitude of |${targetBitstring}⟩ by −1 while leaving all other states untouched.`
    );

    if (zeroBits.length > 0) {
      steps.push({
        id: `iter-${iter}-oracle-postx`,
        label: `Iter ${iter}: Oracle Uncompute`,
        note: `Restore the flipped qubits back to |${targetBitstring}⟩ while preserving its negative sign.`,
        gates: zeroBits.map((q) => ({
          id: `iter-${iter}-ox2-${q}`,
          kind: 'X',
          target: q,
        })),
      });
    }

    // Diffuser: H^{\otimes n} X^{\otimes n} (MCZ) X^{\otimes n} H^{\otimes n}
    steps.push({
      id: `iter-${iter}-diff-h1`,
      label: `Iter ${iter}: Diffuser Basis (H)`,
      note: 'Hadamard maps the uniform superposition back to |0…0⟩ for reflection about the mean.',
      gates: Array.from({ length: numQubits }, (_, q) => ({
        id: `iter-${iter}-dh1-${q}`,
        kind: 'H',
        target: q,
      })),
    });

    steps.push({
      id: `iter-${iter}-diff-x1`,
      label: `Iter ${iter}: Diffuser Flip (X)`,
      note: 'X gates invert all qubits so |0…0⟩ becomes |1…1⟩ for the reflection gate.',
      gates: Array.from({ length: numQubits }, (_, q) => ({
        id: `iter-${iter}-dx1-${q}`,
        kind: 'X',
        target: q,
      })),
    });

    appendMultiControlledZ(
      `iter-${iter}-diff`,
      `Iter ${iter}: Inversion About Mean`,
      `Reflects every amplitude across the average amplitude μ, boosting |${targetBitstring}⟩ and suppressing unmarked states.`
    );

    steps.push({
      id: `iter-${iter}-diff-x2`,
      label: `Iter ${iter}: Diffuser Unflip (X)`,
      note: 'Restores the computational basis labels after reflection.',
      gates: Array.from({ length: numQubits }, (_, q) => ({
        id: `iter-${iter}-dx2-${q}`,
        kind: 'X',
        target: q,
      })),
    });

    steps.push({
      id: `iter-${iter}-diff-h2`,
      label: `Iter ${iter}: Diffuser Complete (H)`,
      note: `Completes Grover iteration ${iter}. Observe the probability concentration on |${targetBitstring}⟩.`,
      gates: Array.from({ length: numQubits }, (_, q) => ({
        id: `iter-${iter}-dh2-${q}`,
        kind: 'H',
        target: q,
      })),
    });
  }

  return {
    initialBits: Array.from({ length: numQubits }, () => 0),
    steps,
  };
}

/**
 * Builds Deutsch-Jozsa for 2 input qubits (q0, q1) and 1 ancilla qubit (q2 = |1⟩).
 */
export function buildDeutschJozsaCircuit(oracleType: DeutschOracleType): {
  initialBits: number[];
  steps: CircuitStep[];
} {
  const steps: CircuitStep[] = [
    {
      id: 'dj-h-init',
      label: 'Superposition & |−⟩ Ancilla',
      note: 'Hadamards put input register q₀q₁ into equal superposition and ancilla q₂ into |−⟩ for phase kickback.',
      gates: [
        { id: 'dj-h0', kind: 'H', target: 0 },
        { id: 'dj-h1', kind: 'H', target: 1 },
        { id: 'dj-h2', kind: 'H', target: 2 },
      ],
    },
  ];

  if (oracleType === 'constant-0') {
    steps.push({
      id: 'dj-oracle-c0',
      label: 'Oracle U_f (Constant 0)',
      note: 'f(x) = 0 for all inputs: the oracle applies Identity to the ancilla, introducing zero phase shifts.',
      gates: [{ id: 'dj-id', kind: 'I', target: 2 }],
    });
  } else if (oracleType === 'constant-1') {
    steps.push({
      id: 'dj-oracle-c1',
      label: 'Oracle U_f (Constant 1)',
      note: 'f(x) = 1 for all inputs: X flips the |−⟩ ancilla, adding a uniform global −1 phase across all inputs.',
      gates: [{ id: 'dj-x2', kind: 'X', target: 2 }],
    });
  } else if (oracleType === 'balanced-x0') {
    steps.push({
      id: 'dj-oracle-bx0',
      label: 'Oracle U_f (Balanced: x₀)',
      note: 'CNOT from q₀ to |−⟩ ancilla kicks back a −1 phase whenever x₀ = 1.',
      gates: [{ id: 'dj-cx0', kind: 'CNOT', control: 0, target: 2 }],
    });
  } else {
    steps.push({
      id: 'dj-oracle-bxor-1',
      label: 'Oracle U_f (Balanced: x₀ ⊕ x₁, part 1)',
      note: 'First CNOT flips ancilla when x₀ = 1, kicking back phase onto q₀.',
      gates: [{ id: 'dj-cx-a', kind: 'CNOT', control: 0, target: 2 }],
    });
    steps.push({
      id: 'dj-oracle-bxor-2',
      label: 'Oracle U_f (Balanced: x₀ ⊕ x₁, part 2)',
      note: 'Second CNOT flips ancilla when x₁ = 1, encoding f(x) = x₀ ⊕ x₁ in relative signs.',
      gates: [{ id: 'dj-cx-b', kind: 'CNOT', control: 1, target: 2 }],
    });
  }

  steps.push({
    id: 'dj-h-final',
    label: 'Final Interference (H on q₀, q₁)',
    note: 'If f is constant, input amplitudes constructively interfere back to |00⟩. If balanced, |00⟩ cancels to 0%!',
    gates: [
      { id: 'dj-hf0', kind: 'H', target: 0 },
      { id: 'dj-hf1', kind: 'H', target: 1 },
    ],
  });

  return {
    initialBits: [0, 0, 1],
    steps,
  };
}

/**
 * Builds Quantum Teleportation for 3 qubits:
 * q0 = Alice's payload |ψ⟩ = Rz(phi) · Ry(theta) |0⟩
 * q1 = Alice's half of Bell pair
 * q2 = Bob's half of Bell pair
 */
export function buildTeleportationCircuit(
  theta: number,
  phi: number,
  outcomeM0: 0 | 1,
  outcomeM1: 0 | 1
): { initialBits: number[]; steps: CircuitStep[] } {
  const steps: CircuitStep[] = [
    {
      id: 'tp-prep-theta',
      label: 'Prepare Payload Amplitude (Ry)',
      note: 'Rotates Alice’s qubit q₀ by θ around the Y axis to set the |0⟩/|1⟩ probability balance.',
      gates: [{ id: 'tp-ry', kind: 'Ry', target: 0, angle: theta }],
    },
    {
      id: 'tp-prep-phi',
      label: 'Prepare Payload Phase (Rz)',
      note: 'Rotates q₀ by φ around the Z axis, encoding the unknown quantum state |ψ⟩ to teleport.',
      gates: [{ id: 'tp-rz', kind: 'Rz', target: 0, angle: phi }],
    },
    {
      id: 'tp-bell-h',
      label: 'Create Bell Pair (H on q₁)',
      note: 'Places Alice’s channel qubit q₁ into superposition before entangling with Bob’s q₂.',
      gates: [{ id: 'tp-h1', kind: 'H', target: 1 }],
    },
    {
      id: 'tp-bell-cx',
      label: 'Entangle Channel (CNOT q₁→q₂)',
      note: 'q₁ and q₂ now form an entangled Bell pair (|00⟩ + |11⟩)/√2 shared between Alice and Bob.',
      gates: [{ id: 'tp-cx12', kind: 'CNOT', control: 1, target: 2 }],
    },
    {
      id: 'tp-alice-cx',
      label: 'Alice Bell Coupling (CNOT q₀→q₁)',
      note: 'Alice couples her payload qubit q₀ to her entangled partner q₁.',
      gates: [{ id: 'tp-cx01', kind: 'CNOT', control: 0, target: 1 }],
    },
    {
      id: 'tp-alice-h',
      label: 'Alice Bell Rotation (H on q₀)',
      note: 'Hadamard completes the Bell basis projection, spreading |ψ⟩’s coefficients across all four outcomes.',
      gates: [{ id: 'tp-h0', kind: 'H', target: 0 }],
    },
  ];

  // Note: In a unitary circuit without mid-circuit projection, Bob's conditional gates
  // CX(q1->q2) and CZ(q0->q2) algebraically reconstruct |ψ⟩ on q2 cleanly for every branch!
  // We also show explicit conditional corrections based on classical bits (m0, m1) or coherent deferred gates.
  const correctionGates: CircuitGate[] = [];
  if (outcomeM1 === 1) {
    correctionGates.push({ id: 'tp-corr-x', kind: 'CNOT', control: 1, target: 2 });
  }
  if (outcomeM0 === 1) {
    correctionGates.push({ id: 'tp-corr-z', kind: 'CZ', control: 0, target: 2 });
  }

  // Coherent deferred measurement always recovers exact |ψ⟩ on q2 unconditionally!
  steps.push({
    id: 'tp-bob-x',
    label: 'Bob Conditional X (CNOT q₁→q₂)',
    note: 'Applies X to Bob’s qubit q₂ conditioned on Alice’s second bit m₁ = 1.',
    gates: [{ id: 'tp-cx-bob', kind: 'CNOT', control: 1, target: 2 }],
  });

  steps.push({
    id: 'tp-bob-z',
    label: 'Bob Conditional Z (CZ q₀→q₂)',
    note: 'Applies Z to Bob’s qubit q₂ conditioned on Alice’s first bit m₀ = 1. Bob’s Bloch vector now matches Alice’s original |ψ⟩!',
    gates: [{ id: 'tp-cz-bob', kind: 'CZ', control: 0, target: 2 }],
  });

  return {
    initialBits: [0, 0, 0],
    steps,
  };
}

/**
 * Builds 3-qubit Quantum Fourier Transform on computational input index 0..7.
 */
export function buildQFT3Circuit(inputIndex: number): {
  initialBits: number[];
  steps: CircuitStep[];
} {
  const initialBits = [
    (inputIndex >> 2) & 1,
    (inputIndex >> 1) & 1,
    inputIndex & 1,
  ];

  const steps: CircuitStep[] = [
    {
      id: 'qft-h0',
      label: 'Hadamard on q₀',
      note: 'Extracts the most significant bit into a ±1 phase rotation on q₀.',
      gates: [{ id: 'qft-g1', kind: 'H', target: 0 }],
    },
    {
      id: 'qft-cp10',
      label: 'Controlled-R₂ (q₁ → q₀, π/2)',
      note: 'Adds a π/2 phase rotation to q₀ if q₁ = 1, encoding the second bit into q₀’s phase.',
      gates: [{ id: 'qft-g2', kind: 'CP', control: 1, target: 0, angle: Math.PI / 2 }],
    },
    {
      id: 'qft-cp20',
      label: 'Controlled-R₃ (q₂ → q₀, π/4)',
      note: 'Adds a finer π/4 phase rotation to q₀ if q₂ = 1.',
      gates: [{ id: 'qft-g3', kind: 'CP', control: 2, target: 0, angle: Math.PI / 4 }],
    },
    {
      id: 'qft-h1',
      label: 'Hadamard on q₁',
      note: 'Places q₁ into superposition with its half-turn frequency component.',
      gates: [{ id: 'qft-g4', kind: 'H', target: 1 }],
    },
    {
      id: 'qft-cp21',
      label: 'Controlled-R₂ (q₂ → q₁, π/2)',
      note: 'Adds a π/2 phase shift to q₁ controlled by q₂.',
      gates: [{ id: 'qft-g5', kind: 'CP', control: 2, target: 1, angle: Math.PI / 2 }],
    },
    {
      id: 'qft-h2',
      label: 'Hadamard on q₂',
      note: 'Transforms the least significant qubit q₂ into the highest-frequency Fourier basis.',
      gates: [{ id: 'qft-g6', kind: 'H', target: 2 }],
    },
    {
      id: 'qft-swap',
      label: 'Bit-Reversal SWAP (q₀ ↔ q₂)',
      note: 'Reorders qubits so the output phase spiral matches |000⟩..|111⟩ ascending frequency k.',
      gates: [{ id: 'qft-g7', kind: 'SWAP', control: 0, target: 2 }],
    },
  ];

  return { initialBits, steps };
}
