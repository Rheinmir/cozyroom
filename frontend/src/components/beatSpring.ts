// Spring-driven beat bars for the vinyl waveform.
// The old formula mapped loudness on a 60 dB log scale: music is loud almost all the time, so
// every bar sat near one height. Here a bar reacts to how far its level jumps ABOVE its own
// recent average (the beat), and moves with a spring (velocity + damping) so it overshoots.
export type BeatState = { cur: number[]; vel: number[]; avg: number[] }

export const beatInit = (n: number): BeatState =>
  ({ cur: Array(n).fill(1), vel: Array(n).fill(0), avg: Array(n).fill(0) })

// Calibration knobs: AVG = how fast the "normal level" follows; PUNCH = beat gain;
// K = spring stiffness; DAMP = velocity kept per frame (lower = settles faster, less wobble).
const AVG = 0.06, PUNCH = 2.4, BASE = 0.25, K = 0.3, DAMP = 0.7

/** levels: 0..1 per bar. shape: the static bar heights (px). Returns scaleY per bar. */
export function beatStep(s: BeatState, levels: number[], shape: number[]): number[] {
  return shape.map((h, i) => {
    const raw = levels[i] ?? 0
    s.avg[i] += (raw - s.avg[i]) * AVG
    const v = Math.min(1, BASE * raw + PUNCH * Math.max(0, raw - s.avg[i]))
    const target = (3 + v * 33 * (0.45 + 0.55 * h / 36)) / h   // the bar shape stays the envelope
    s.vel[i] = (s.vel[i] + (target - s.cur[i]) * K) * DAMP
    s.cur[i] = Math.max(0.1, s.cur[i] + s.vel[i])
    return s.cur[i]
  })
}
