/** Small timeout helper for UI loads that must not block the whole screen. */

export class TimeoutError extends Error {
  constructor(label: string) {
    super(`${label} timed out`);
    this.name = 'TimeoutError';
  }
}

export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  label = 'Request',
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
