// Smooth synthetic bar level (0..1) for bar i at time t (ms). Used when there is no live audio data.
export const synthLevel = (t: number, i: number) =>
  Math.max(0, Math.min(1, 0.4 + 0.3 * Math.sin(t * 0.004 + i * 0.55) * Math.sin(t * 0.0013 + i * 0.21) + 0.2 * Math.sin(t * 0.009 + i * 1.7)))
