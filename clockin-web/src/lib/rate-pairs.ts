import { isRateCurrent } from '@/lib/use-rates';
import type { Rate } from '@/types/api';

/** One human-readable row: project + person with cost and bill together. */
export type ProjectPersonRateRow = {
  key: string;
  projectId: string;
  userId: string;
  projectName: string;
  personLabel: string;
  costAmount: string | null;
  billableAmount: string | null;
  currency: string | null;
  marginAmount: string | null;
  marginPercent: number | null;
  effectiveFrom: string | null;
  isCurrent: boolean;
};

function amountNum(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * FIX 1 — join project_user cost + billable into one row per project-person.
 * Input rates should already be filtered to scope project_user (and current/history).
 * Within each pair, keep the first cost and first billable (list is effectiveFrom desc).
 */
export function pairProjectUserRates(rates: Rate[]): ProjectPersonRateRow[] {
  const projectUser = rates.filter(
    (r) => r.scope === 'project_user' && r.projectId && r.userId,
  );

  type Bucket = {
    projectId: string;
    userId: string;
    projectName: string;
    personLabel: string;
    cost?: Rate;
    billable?: Rate;
  };

  const byKey = new Map<string, Bucket>();

  for (const rate of projectUser) {
    const projectId = rate.projectId!;
    const userId = rate.userId!;
    const key = `${projectId}:${userId}`;
    let bucket = byKey.get(key);
    if (!bucket) {
      const person =
        rate.userName ||
        rate.userEmail ||
        'Person';
      bucket = {
        projectId,
        userId,
        projectName: rate.projectName || 'Project',
        personLabel: person,
        cost: undefined,
        billable: undefined,
      };
      byKey.set(key, bucket);
    }
    if (rate.rateType === 'cost' && !bucket.cost) {
      bucket.cost = rate;
    } else if (rate.rateType === 'billable' && !bucket.billable) {
      bucket.billable = rate;
    }
  }

  const rows: ProjectPersonRateRow[] = [];
  for (const [key, bucket] of byKey) {
    const costN = amountNum(bucket.cost?.amount);
    const billN = amountNum(bucket.billable?.amount);
    let marginAmount: string | null = null;
    let marginPercent: number | null = null;
    if (costN != null && billN != null) {
      const margin = billN - costN;
      marginAmount = margin.toFixed(2);
      marginPercent = billN > 0 ? (margin / billN) * 100 : null;
    }
    const fromCandidates = [bucket.cost, bucket.billable]
      .filter(Boolean)
      .map((r) => r!.effectiveFrom.slice(0, 10));
    const effectiveFrom =
      fromCandidates.length > 0
        ? fromCandidates.sort().reverse()[0]
        : null;
    const currency =
      bucket.billable?.currency ?? bucket.cost?.currency ?? null;
    const isCurrent =
      (bucket.cost ? isRateCurrent(bucket.cost) : false) ||
      (bucket.billable ? isRateCurrent(bucket.billable) : false);

    rows.push({
      key,
      projectId: bucket.projectId,
      userId: bucket.userId,
      projectName: bucket.projectName,
      personLabel: bucket.personLabel,
      costAmount:
        costN != null ? costN.toFixed(2) : null,
      billableAmount:
        billN != null ? billN.toFixed(2) : null,
      currency,
      marginAmount,
      marginPercent,
      effectiveFrom,
      isCurrent,
    });
  }

  return rows.sort((a, b) => {
    const p = a.projectName.localeCompare(b.projectName);
    if (p !== 0) return p;
    return a.personLabel.localeCompare(b.personLabel);
  });
}

export function fallbackScopeRates(rates: Rate[]): Rate[] {
  return rates.filter((r) => r.scope !== 'project_user');
}
