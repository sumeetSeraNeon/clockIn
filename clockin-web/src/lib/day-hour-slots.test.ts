import { describe, expect, it } from 'vitest';
import {
  buildDayHourBuckets,
  busyFromEntries,
  formatHoursLabel,
  formatSlotRange,
  freeClickRange,
  minutesFromClock,
  slotAxisTickMinutes,
  suggestNextRange,
} from './day-hour-slots';

describe('formatSlotRange', () => {
  it('formats 2h bucket ranges in 24h', () => {
    expect(formatSlotRange(0, 120)).toBe('00:00–02:00');
    expect(formatSlotRange(22 * 60, 24 * 60)).toBe('22:00–24:00');
  });

  it('formats partial ranges with minutes', () => {
    expect(formatSlotRange(9 * 60 + 30, 14 * 60)).toBe('09:30–14:00');
  });
});

describe('slotAxisTickMinutes', () => {
  it('returns thirteen 2h boundary marks including 24:00', () => {
    const ticks = slotAxisTickMinutes();
    expect(ticks).toHaveLength(13);
    expect(ticks[0]).toBe(0);
    expect(ticks[1]).toBe(120);
    expect(ticks[12]).toBe(24 * 60);
  });
});

describe('minutesFromClock', () => {
  it('parses HH:mm', () => {
    expect(minutesFromClock('09:30')).toBe(9 * 60 + 30);
  });

  it('parses wall ISO using UTC clock components', () => {
    expect(minutesFromClock('2026-11-17T09:00:00.000Z')).toBe(9 * 60);
  });
});

describe('buildDayHourBuckets', () => {
  it('emits twelve free 2h slots when empty', () => {
    const buckets = buildDayHourBuckets([]);
    expect(buckets).toHaveLength(12);
    expect(
      buckets.every(
        (b) => b.segments.length === 1 && b.segments[0].kind === 'free',
      ),
    ).toBe(true);
    expect(buckets[0].endMin - buckets[0].startMin).toBe(120);
  });

  it('splits an 8–10 slot into 1h free + 1h busy', () => {
    const buckets = buildDayHourBuckets([
      { startMin: 9 * 60, endMin: 10 * 60, entryId: 'e1' },
    ]);
    const eight = buckets.find((b) => b.startMin === 8 * 60)!;
    expect(eight.segments).toEqual([
      { startMin: 8 * 60, endMin: 9 * 60, kind: 'free' },
      {
        startMin: 9 * 60,
        endMin: 10 * 60,
        kind: 'busy',
        entryId: 'e1',
        label: undefined,
      },
    ]);
    expect(formatHoursLabel(120)).toBe('2h');
  });

  it('handles half-hour booking', () => {
    const buckets = buildDayHourBuckets([
      { startMin: 9 * 60, endMin: 9 * 60 + 30, entryId: 'e1' },
    ]);
    const eight = buckets.find((b) => b.startMin === 8 * 60)!;
    expect(eight.segments[0]).toMatchObject({
      kind: 'free',
      startMin: 480,
      endMin: 540,
    });
    expect(eight.segments[1]).toMatchObject({
      kind: 'busy',
      startMin: 540,
      endMin: 570,
    });
    expect(eight.segments[2]).toMatchObject({
      kind: 'free',
      startMin: 570,
      endMin: 600,
    });
  });

  it('handles multiple bookings in one bucket', () => {
    const buckets = buildDayHourBuckets([
      { startMin: 8 * 60, endMin: 8 * 60 + 30, entryId: 'a' },
      { startMin: 9 * 60, endMin: 10 * 60, entryId: 'b' },
    ]);
    const eight = buckets.find((b) => b.startMin === 8 * 60)!;
    expect(eight.segments.map((s) => s.kind)).toEqual([
      'busy',
      'free',
      'busy',
    ]);
  });
});

describe('freeClickRange', () => {
  it('uses full remnant when under 1h', () => {
    expect(freeClickRange(9 * 60 + 30, 10 * 60)).toEqual({
      startTime: '09:30',
      endTime: '10:00',
    });
  });

  it('caps remnant at 1h even inside a 2h free slot', () => {
    expect(freeClickRange(0, 4 * 60)).toEqual({
      startTime: '00:00',
      endTime: '01:00',
    });
  });

  it('clamps end-of-day to 23:59', () => {
    expect(freeClickRange(23 * 60, 24 * 60)).toEqual({
      startTime: '23:00',
      endTime: '23:59',
    });
  });
});

describe('suggestNextRange', () => {
  it('starts after last booking', () => {
    const range = suggestNextRange(
      [
        {
          id: '1',
          entryDate: '2026-11-19',
          startTime: '09:00',
          endTime: '10:30',
        },
      ],
      '2026-11-19',
      new Date('2026-11-19T15:00:00'),
    );
    expect(range.startTime).toBe('10:30');
    expect(range.endTime).toBe('11:30');
  });

  it('uses current hour when empty', () => {
    const range = suggestNextRange(
      [],
      '2026-11-19',
      new Date('2026-11-19T14:20:00'),
    );
    expect(range.startTime).toBe('14:00');
    expect(range.endTime).toBe('15:00');
  });
});

describe('busyFromEntries', () => {
  it('ignores duration-only entries without endTime', () => {
    expect(
      busyFromEntries(
        [
          {
            id: '1',
            entryDate: '2026-11-19',
            startTime: '09:00',
            endTime: null,
          },
        ],
        '2026-11-19',
      ),
    ).toEqual([]);
  });
});
