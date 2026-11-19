/** Spreadsheet utilisation: available = planned − leaveDays×8; util% = tracked ÷ available. */
export function utilisationFromHours(
  plannedHours: number,
  leaveDays: number,
  trackedHours: number,
): {
  leaveHours: number;
  availableHours: number;
  utilisationPct: number | null;
} {
  const leaveHours = leaveDays * 8;
  const availableHours = plannedHours - leaveHours;
  const utilisationPct =
    availableHours > 0
      ? Number(((trackedHours / availableHours) * 100).toFixed(1))
      : null;
  return { leaveHours, availableHours, utilisationPct };
}
