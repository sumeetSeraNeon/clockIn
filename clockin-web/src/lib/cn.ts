/** Tiny className joiner — prefer tokens over ad-hoc styles. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
