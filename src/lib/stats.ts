// Statistical primitives used by the trend analysis. No dependencies.

export const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
export const mean = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;

export function median(a: number[]): number {
  const b = [...a].sort((x, y) => x - y);
  const n = b.length;
  return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2;
}

// ---------- Special functions (Numerical Recipes) ----------

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
  let y = x;
  let t = x + 5.5;
  t -= (x + 0.5) * Math.log(t);
  let s = 1.000000000190015;
  for (let j = 0; j < 6; j++) s += c[j] / ++y;
  return -t + Math.log((2.5066282746310005 * s) / x);
}

/** Continued fraction for the incomplete beta function. */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const TINY = 1e-30;
  const guard = (v: number) => (Math.abs(v) < TINY ? TINY : v);
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 / guard(1 - (qab * x) / qap);
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 / guard(1 + aa * d);
    c = guard(1 + aa / c);
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 / guard(1 + aa * d);
    c = guard(1 + aa / c);
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-12) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (bt * betaContinuedFraction(a, b, x)) / a
    : 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Two-tailed p-value of Student's t distribution. */
export const studentTwoTailedP = (t: number, df: number): number =>
  df > 0 ? incompleteBeta(df / 2, 0.5, df / (df + t * t)) : 1;

/** Critical t value for a two-tailed 95% interval (bisection). */
export function tCritical95(df: number): number {
  let lo = 0;
  let hi = 200;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (studentTwoTailedP(mid, df) > 0.05) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Two-tailed p-value of the standard normal distribution (Abramowitz–Stegun approximation). */
export function normalTwoTailedP(z: number): number {
  z = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const q = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return Math.min(1, 2 * q);
}

// ---------- Ordinary least squares with lag-1 autocorrelation correction ----------

export interface OlsResult {
  n: number;
  /** Slope per x unit (per year). */
  slope: number;
  intercept: number;
  meanX: number;
  sxx: number;
  /** Residual standard error using the effective degrees of freedom. */
  residualSe: number;
  slopeSe: number;
  t: number;
  df: number;
  /** Lag-1 autocorrelation of residuals. */
  r1: number;
  effectiveN: number;
  p: number;
  /** 95% confidence interval of the slope. */
  lo: number;
  hi: number;
  tCrit: number;
  r2: number;
  /** Residual standard deviation using n − 2 degrees of freedom. */
  residualSd: number;
}

export function ols(x: number[], y: number[]): OlsResult {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - mx) ** 2;
    sxy += (x[i] - mx) * (y[i] - my);
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const residuals = y.map((v, i) => v - intercept - slope * x[i]);
  const sse = residuals.reduce((s, r) => s + r * r, 0);
  const sst = y.reduce((s, v) => s + (v - my) ** 2, 0);

  let lagSum = 0;
  for (let i = 1; i < n; i++) lagSum += residuals[i] * residuals[i - 1];
  const r1 = sse > 0 ? lagSum / sse : 0;
  const effectiveN = clamp(r1 > 0 ? (n * (1 - r1)) / (1 + r1) : n, 3, n);
  const df = effectiveN - 2;

  const residualSe = Math.sqrt(sse / Math.max(df, 1));
  const slopeSe = residualSe / Math.sqrt(sxx);
  const t = slopeSe > 0 ? slope / slopeSe : 0;
  const tCrit = tCritical95(Math.max(df, 1));

  return {
    n, slope, intercept, meanX: mx, sxx, residualSe, slopeSe, t, df, r1, effectiveN,
    p: slopeSe > 0 ? studentTwoTailedP(t, df) : 1,
    lo: slope - tCrit * slopeSe,
    hi: slope + tCrit * slopeSe,
    tCrit,
    r2: sst > 0 ? 1 - sse / sst : 0,
    residualSd: Math.sqrt(sse / Math.max(n - 2, 1)),
  };
}

// ---------- Mann-Kendall test + Sen's slope ----------

export interface MannKendallResult {
  S: number;
  Z: number;
  p: number;
  /** Sen's slope (median pairwise slope, per x unit). */
  sen: number;
  /** Intercept so that y ≈ senIntercept + sen · x. */
  senIntercept: number;
  tau: number;
}

export function mannKendall(x: number[], y: number[]): MannKendallResult {
  const n = y.length;
  const slopes: number[] = [];
  let S = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      S += Math.sign(y[j] - y[i]);
      slopes.push((y[j] - y[i]) / (x[j] - x[i]));
    }
  }
  const ties = new Map<number, number>();
  for (const v of y) ties.set(v, (ties.get(v) ?? 0) + 1);
  let variance = n * (n - 1) * (2 * n + 5);
  for (const t of ties.values()) if (t > 1) variance -= t * (t - 1) * (2 * t + 5);
  variance /= 18;

  const Z = variance > 0 ? (S > 0 ? (S - 1) / Math.sqrt(variance) : S < 0 ? (S + 1) / Math.sqrt(variance) : 0) : 0;
  const sen = median(slopes);
  const senIntercept = median(y.map((v, i) => v - sen * x[i]));
  return { S, Z, p: normalTwoTailedP(Z), sen, senIntercept, tau: S / ((n * (n - 1)) / 2) };
}
