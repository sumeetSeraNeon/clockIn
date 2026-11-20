import { describe, expect, it } from 'vitest';
import {
  clockFromWallIso,
  formatWallClock,
  minutesFromWallClock,
  wallIsoFromDateAndClock,
  wallIsoToLocalDate,
} from './wall-clock';

describe('wall-clock', () => {
  it('encodes HH:mm as UTC components', () => {
    expect(wallIsoFromDateAndClock('2026-11-17', '09:00')).toBe(
      '2026-11-17T09:00:00.000Z',
    );
  });

  it('reads minutes from wall ISO independent of host TZ', () => {
    expect(minutesFromWallClock('2026-11-17T09:00:00.000Z')).toBe(9 * 60);
    expect(minutesFromWallClock('09:30')).toBe(9 * 60 + 30);
  });

  it('formats wall clock for display', () => {
    expect(formatWallClock('2026-11-17T09:00:00.000Z')).toBe('9:00 AM');
    expect(formatWallClock('2026-11-17T13:30:00.000Z')).toBe('1:30 PM');
  });

  it('round-trips clock from wall ISO', () => {
    expect(clockFromWallIso('2026-11-17T09:05:00.000Z')).toBe('09:05');
  });

  it('builds local Date for calendar at wall hour', () => {
    const d = wallIsoToLocalDate('2026-11-17T09:00:00.000Z', '2026-11-17')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(17);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });
});
