/** Live timer display as HH:MM:SS. */
export function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Elapsed whole minutes between two instants (minimum 1). */
export function elapsedMinutes(fromIso: string, to = new Date()): number {
  const start = new Date(fromIso).getTime();
  const ms = Math.max(0, to.getTime() - start);
  return Math.max(1, Math.round(ms / 60000));
}
