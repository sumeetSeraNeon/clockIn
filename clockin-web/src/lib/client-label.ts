/** Display label for client pickers: name · code when code is set. */
export function clientLabel(c: {
  name: string;
  code?: string | null;
}): string {
  return c.code?.trim() ? `${c.name} · ${c.code.trim()}` : c.name;
}
