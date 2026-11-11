import type { Ticket, TicketType } from '@/types/api';
import { TICKET_TYPE_LABELS } from '@/types/api';

const STATUS_RANK: Record<string, number> = {
  open: 0,
  pending: 1,
  waiting_on_customer: 2,
  waiting_on_third_party: 3,
  assigned_to_ai_agent: 4,
  ready_for_prod_deploy: 5,
  resolved: 6,
  closed: 7,
  legacy_ticket: 8,
};

/** Open / pending first, then reference A–Z. */
export function sortTicketsForPicker(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    const ra = STATUS_RANK[a.status] ?? 9;
    const rb = STATUS_RANK[b.status] ?? 9;
    if (ra !== rb) return ra - rb;
    return a.reference.localeCompare(b.reference, undefined, {
      sensitivity: 'base',
    });
  });
}

export function ticketTypeDisplay(ticketType: string | null | undefined): string {
  if (!ticketType?.trim()) return '';
  return (
    TICKET_TYPE_LABELS[ticketType as TicketType] ??
    ticketType.replace(/_/g, ' ')
  );
}

/** e.g. `103 — Login fails (Change Request)` or `103 (Incident)`. */
export function ticketOptionLabel(ticket: Ticket): string {
  const title = ticket.title?.trim();
  const type = ticketTypeDisplay(ticket.ticketType);
  const typeSuffix = type ? ` (${type})` : '';
  if (title) return `${ticket.reference} — ${title}${typeSuffix}`;
  return `${ticket.reference}${typeSuffix}`;
}
