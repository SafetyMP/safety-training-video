/**
 * Wraps a promise with a timeout. Rejects with an Error if the timeout is reached.
 * Note: the underlying promise is not cancelled; the operation may still run to completion.
 * For true cancellation (e.g. fetch, OpenAI), pass an AbortSignal and abort on timeout.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = 'Request timed out'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
