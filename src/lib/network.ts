export const NETWORK_TIMEOUT_MS = 15000;

export const NETWORK_HELP =
  "If this keeps failing, try Wi-Fi instead of mobile data, disable a VPN/ad-blocker, or contact support.";

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number = NETWORK_TIMEOUT_MS,
  label: string = "Request"
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out. Please check your connection and try again.`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
