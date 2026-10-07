'use client';

import { useEffect, useState } from 'react';

/** Default pause after typing before search triggers an API call. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Returns `value` only after it has been stable for `delayMs`.
 * Use for typeahead search: pass debounced string as list-hook `q`.
 */
export function useDebouncedValue<T>(value: T, delayMs = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
