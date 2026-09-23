// A Telegram polling failure must never reject an unobserved promise and crash the CRM.
export async function runBotPolling(
  start: () => Promise<void>,
  options: {
    stopped: () => boolean;
    onError: (code: number | undefined, retrying: boolean) => void;
    sleep?: (ms: number) => Promise<void>;
  },
) {
  const sleep = options.sleep || ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  let attempt = 0;
  while (!options.stopped()) {
    try {
      await start();
      return;
    } catch (error) {
      if (options.stopped()) return;
      const code = (error as { error_code?: number })?.error_code;
      const retrying = code !== 401 && code !== 404;
      options.onError(code, retrying);
      if (!retrying) return;
      // Includes 409 during Railway's rolling replacement and transient network outages.
      await sleep(Math.min(30_000, 5_000 * 2 ** Math.min(attempt++, 3)));
    }
  }
}
