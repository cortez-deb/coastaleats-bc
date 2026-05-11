// Returns coefficient of variation (stddev / mean) of an array of numbers.
// Returns null if array length < 2 or mean is 0.
export function coefficientOfVariation(values) {
  if (!Array.isArray(values) || values.length < 2) return null;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  if (mean === 0) return null;

  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stddev = Math.sqrt(variance);

  return stddev / mean;
}
