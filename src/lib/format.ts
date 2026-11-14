/** Fixed-decimal number with thousands separators. */
export const formatNumber = (x: number, digits: number): string =>
  x.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Signed number using a true minus sign (e.g. "+0.25", "−1.10"). */
export const formatSigned = (x: number, digits: number): string =>
  (x > 0 ? "+" : x < 0 ? "−" : "") + formatNumber(Math.abs(x), digits);

export const formatPValue = (p: number): string =>
  p < 0.001 ? "p < 0.001" : "p = " + formatNumber(p, p < 0.1 ? 3 : 2);

export const formatCoord = (lat: number, lon: number): string =>
  `${formatNumber(Math.abs(lat), 1)}°${lat >= 0 ? "N" : "S"}, ${formatNumber(Math.abs(lon), 1)}°${lon >= 0 ? "E" : "W"}`;
