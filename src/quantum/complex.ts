import { Complex } from './types';

export const C0: Complex = { re: 0, im: 0 };
export const C1: Complex = { re: 1, im: 0 };

export function c(re: number, im = 0): Complex {
  return { re, im };
}

export function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function cConj(a: Complex): Complex {
  return { re: a.re, im: -a.im };
}

export function cScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

export function cMagSq(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

export function cMag(a: Complex): number {
  return Math.hypot(a.re, a.im);
}

export function cPhase(a: Complex): number {
  if (cMag(a) < 1e-9) return 0;
  return Math.atan2(a.im, a.re);
}

export function cExp(theta: number): Complex {
  return { re: Math.cos(theta), im: Math.sin(theta) };
}

export function cleanZero(v: number, eps = 1e-6): number {
  return Math.abs(v) < eps ? 0 : v;
}

export function formatRealSymbolic(v: number): string {
  const x = cleanZero(v);
  if (x === 0) return '0';
  const sign = x < 0 ? '-' : '';
  const abs = Math.abs(x);

  const specials: Array<[number, string]> = [
    [1, '1'],
    [0.5, '1/2'],
    [Math.SQRT1_2, '1/√2'],
    [Math.sqrt(3) / 2, '√3/2'],
    [0.25, '1/4'],
    [0.75, '3/4'],
    [Math.sqrt(0.125), '1/√8'],
    [1 / 3, '1/3'],
    [2 / 3, '2/3'],
  ];

  for (const [val, label] of specials) {
    if (Math.abs(abs - val) < 1e-4) {
      return `${sign}${label}`;
    }
  }
  return `${sign}${abs.toFixed(3).replace(/\.?0+$/, '')}`;
}

export function formatComplex(z: Complex, compact = false): string {
  const re = cleanZero(z.re);
  const im = cleanZero(z.im);

  if (re === 0 && im === 0) return '0';
  if (im === 0) return formatRealSymbolic(re);
  if (re === 0) {
    const imStr = formatRealSymbolic(Math.abs(im));
    const sign = im < 0 ? '-' : '';
    return imStr === '1' ? `${sign}i` : `${sign}${imStr}i`;
  }

  const reStr = formatRealSymbolic(re);
  const imAbsStr = formatRealSymbolic(Math.abs(im));
  const op = im < 0 ? (compact ? '-' : ' - ') : compact ? '+' : ' + ';
  const imTerm = imAbsStr === '1' ? 'i' : `${imAbsStr}i`;
  return `${reStr}${op}${imTerm}`;
}

export function formatAnglePi(rad: number): string {
  const normalized = cleanZero(rad);
  if (normalized === 0) return '0';
  const ratio = normalized / Math.PI;
  const fractions: Array<[number, string]> = [
    [1, 'π'],
    [-1, '-π'],
    [0.5, 'π/2'],
    [-0.5, '-π/2'],
    [0.25, 'π/4'],
    [-0.25, '-π/4'],
    [0.75, '3π/4'],
    [-0.75, '-3π/4'],
    [2, '2π'],
    [-2, '-2π'],
    [1 / 3, 'π/3'],
    [-1 / 3, '-π/3'],
    [2 / 3, '2π/3'],
    [-2 / 3, '-2π/3'],
  ];
  for (const [f, text] of fractions) {
    if (Math.abs(ratio - f) < 0.015) return text;
  }
  return `${normalized.toFixed(2)} rad`;
}

export function formatKet(index: number, numQubits: number): string {
  return `|${index.toString(2).padStart(numQubits, '0')}⟩`;
}
