type Entry<T> = {
  ts: number;
  val: T;
  inflight?: Promise<T>;
};

const store = new Map<string, Entry<unknown>>();

export async function swr<T>(key: string, loader: () => Promise<T>, ttlMs = 400): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  const now = Date.now();
  if (hit && now - hit.ts < ttlMs) {
    return hit.val;
  }
  if (hit?.inflight) {
    return hit.inflight;
  }

  const inflight = loader()
    .then((value) => {
      store.set(key, { ts: Date.now(), val: value });
      return value;
    })
    .finally(() => {
      const entry = store.get(key);
      if (entry) {
        entry.inflight = undefined;
      }
    });

  store.set(key, { ts: hit?.ts ?? 0, val: hit?.val as T, inflight });
  return inflight;
}
