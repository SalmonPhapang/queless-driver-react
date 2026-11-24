/** Tiny class-name joiner (no dependency needed). */
export const cn = (...values: Array<string | false | null | undefined>): string =>
  values.filter(Boolean).join(' ');
