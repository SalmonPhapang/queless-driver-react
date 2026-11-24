/**
 * Dart interpolates thrown values directly (`'$e'`). JavaScript Error objects
 * otherwise stringify with an unwanted `Error:` prefix, so user-facing ports
 * unwrap them here.
 */
export const errorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return String(error);
};
