/** Freshdesk-aligned ticket enums (stored snake_case). */

export const TICKET_TYPES = [
  'incident',
  'change',
  'question',
  'service_request',
  'problem',
] as const;
export type TicketTypeValue = (typeof TICKET_TYPES)[number];

export const TICKET_STATUSES = [
  'open',
  'pending',
  'resolved',
  'closed',
  'waiting_on_customer',
  'waiting_on_third_party',
  'legacy_ticket',
  'ready_for_prod_deploy',
  'assigned_to_ai_agent',
] as const;
export type TicketStatusValue = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;
export type TicketPriorityValue = (typeof TICKET_PRIORITIES)[number];

export const TICKET_PRIORITY_CODES = ['p1', 'p2', 'p3', 'p4'] as const;
export type TicketPriorityCode = (typeof TICKET_PRIORITY_CODES)[number];

/** Sheet / UI label → stored value */
export const TICKET_TYPE_FROM_LABEL: Record<string, TicketTypeValue> = {
  incident: 'incident',
  change: 'change',
  question: 'question',
  'service request': 'service_request',
  service_request: 'service_request',
  problem: 'problem',
};

export const TICKET_STATUS_FROM_LABEL: Record<string, TicketStatusValue> = {
  open: 'open',
  pending: 'pending',
  resolved: 'resolved',
  closed: 'closed',
  'waiting on customer': 'waiting_on_customer',
  waiting_on_customer: 'waiting_on_customer',
  'waiting on third party': 'waiting_on_third_party',
  waiting_on_third_party: 'waiting_on_third_party',
  'legacy ticket': 'legacy_ticket',
  legacy_ticket: 'legacy_ticket',
  'ready for prod deplc': 'ready_for_prod_deploy',
  'ready for prod deploy': 'ready_for_prod_deploy',
  ready_for_prod_deploy: 'ready_for_prod_deploy',
  'assigned to ai agent': 'assigned_to_ai_agent',
  assigned_to_ai_agent: 'assigned_to_ai_agent',
  // legacy ClockIn value mapped in migration; keep parse tolerant
  in_progress: 'pending',
  'in progress': 'pending',
};

export const TICKET_PRIORITY_FROM_LABEL: Record<string, TicketPriorityValue> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'critical',
  critical: 'critical',
};

export const TICKET_PRIORITY_CODE_FROM_LABEL: Record<string, TicketPriorityCode> =
  {
    p1: 'p1',
    p2: 'p2',
    p3: 'p3',
    p4: 'p4',
  };

export function normalizeTicketTypeLabel(
  raw: string | null | undefined,
): TicketTypeValue | null {
  if (!raw?.trim()) return null;
  return TICKET_TYPE_FROM_LABEL[raw.trim().toLowerCase()] ?? null;
}

export function normalizeTicketStatusLabel(
  raw: string | null | undefined,
): TicketStatusValue | null {
  if (!raw?.trim()) return null;
  return TICKET_STATUS_FROM_LABEL[raw.trim().toLowerCase()] ?? null;
}

export function normalizeTicketPriorityLabel(
  raw: string | null | undefined,
): TicketPriorityValue | null {
  if (!raw?.trim()) return null;
  return TICKET_PRIORITY_FROM_LABEL[raw.trim().toLowerCase()] ?? null;
}

export function normalizeTicketPriorityCode(
  raw: string | null | undefined,
): TicketPriorityCode | null {
  if (!raw?.trim()) return null;
  return TICKET_PRIORITY_CODE_FROM_LABEL[raw.trim().toLowerCase()] ?? null;
}
