// Let the sent bubble register before displaying an instant/sample reply.
// Slow provider replies incur no additional delay.
export function waitForPartnerBeat(
  startedAt: number,
  signal: AbortSignal,
): Promise<void> {
  const remaining = Math.max(0, 550 - (Date.now() - startedAt));
  if (signal.aborted || !remaining) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, remaining);
    signal.addEventListener("abort", finish, { once: true });
  });
}
