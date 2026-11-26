/** Small TTL cache to stay inside the fair-use limits of the free upstream services. */
export class TtlCache<T> {
  private readonly map = new Map<string, { value: T; expires: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.map.size >= this.maxEntries) this.map.delete(this.map.keys().next().value as string);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}

/**
 * GET + JSON with a timeout. Never throws: returns null on any network, HTTP or parse failure
 * so callers can fall through to the next source. Details are dropped on purpose (URLs can
 * contain what the customer typed).
 */
export async function fetchJsonOrNull<T>(
  url: string,
  options: {
    headers?: Record<string, string>;
    signal?: AbortSignal | undefined;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<T | null> {
  const { headers = {}, signal, fetchImpl = fetch, timeoutMs = 8000 } = options;
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { accept: 'application/json', ...headers },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Runs tasks one at a time with at least `minIntervalMs` between the start of consecutive tasks. */
export function createThrottle(minIntervalMs: number) {
  let chain: Promise<void> = Promise.resolve();
  let lastStart = 0;
  return function throttle<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const wait = lastStart + minIntervalMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastStart = Date.now();
      return task();
    });
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
