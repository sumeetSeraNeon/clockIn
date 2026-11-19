import { utilisationFromHours } from './utilisation-math';

describe('utilisationFromHours', () => {
  it('matches spreadsheet: tracked ÷ (planned − leave×8)', () => {
    const r = utilisationFromHours(160, 2, 144);
    expect(r.leaveHours).toBe(16);
    expect(r.availableHours).toBe(144);
    expect(r.utilisationPct).toBe(100);
  });

  it('allows half leave days', () => {
    const r = utilisationFromHours(160, 0.5, 156);
    expect(r.leaveHours).toBe(4);
    expect(r.availableHours).toBe(156);
    expect(r.utilisationPct).toBe(100);
  });

  it('returns null util when available is 0', () => {
    const r = utilisationFromHours(16, 2, 8);
    expect(r.availableHours).toBe(0);
    expect(r.utilisationPct).toBeNull();
  });
});
