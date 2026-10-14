import type { Ticket } from '@/types/api';

const STATUS_RANK: Record<string, number> = {
  open: 0,
  in_progress: 1,
  resolved: 2,
  closed: 3,
};

/** Open / in-progress first, then reference A–Z. */
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

export function ticketOptionLabel(ticket: Ticket): string {
  const title = ticket.title?.trim();
  if (title) return `${ticket.reference} — ${title}`;
  return ticket.reference;
}
