import { describe, it, expect, beforeEach } from 'vitest';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

let storage;
beforeEach(async () => {
  globalThis.localStorage = new MemoryStorage();
  storage = await import('../js/storage.js');
  storage.resetStorageBackend();
});

describe('cache', () => {
  it('reports fresh data inside the TTL and stale after it', () => {
    const now = 1_000_000;
    storage.saveCached('rates', { USD: 1 }, now);
    expect(storage.loadCached('rates', 3600_000, now + 10_000)).toMatchObject({ fresh: true, data: { USD: 1 } });
    expect(storage.loadCached('rates', 3600_000, now + 3600_001)).toMatchObject({ fresh: false, data: { USD: 1 } });
  });

  it('returns null when nothing is cached or the entry is corrupt', () => {
    expect(storage.loadCached('missing', 1000)).toBeNull();
    globalThis.localStorage.setItem('cc:bad', '{not json');
    expect(storage.loadCached('bad', 1000)).toBeNull();
  });

  it('survives storage that throws', () => {
    globalThis.localStorage = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
      removeItem() { throw new Error('denied'); },
    };
    storage.resetStorageBackend();
    storage.save('k', [1, 2]);
    expect(storage.load('k', null)).toEqual([1, 2]);
  });
});

describe('pushRecent', () => {
  it('adds to the front, de-duplicates and caps the list', () => {
    let list = [];
    for (let i = 0; i < 25; i++) list = storage.pushRecent(list, i, 20);
    expect(list).toHaveLength(20);
    expect(list[0]).toBe(24);
    list = storage.pushRecent(list, 10, 20);
    expect(list[0]).toBe(10);
    expect(list.filter((x) => x === 10)).toHaveLength(1);
  });
});
