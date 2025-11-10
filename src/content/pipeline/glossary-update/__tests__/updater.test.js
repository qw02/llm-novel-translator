import { describe, it, expect } from 'vitest';
import { AsyncMutex, GlossaryUpdater } from './../updater.js';
import { parseJSONFromLLM } from '../../../utils/data-extraction.js';

vi.mock('../../../utils/data-extraction.js', () => ({
  parseJSONFromLLM: vi.fn().mockImplementation(() => [{ action: 'none' }]),
}));

function deferred() {
  let resolve, reject;
  const p = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { p, resolve, reject };
}

function immediateClient(payload) {
  return { request: vi.fn().mockResolvedValue(payload) };
}

describe('AsyncMutex', () => {
  it('serializes runExclusive', async () => {
    const m = new AsyncMutex();
    let depth = 0;
    const seen = [];

    const work = (id) => m.runExclusive(async () => {
      expect(depth).toBe(0);
      depth++;
      seen.push(id);
      await Promise.resolve(); // one tick
      depth--;
    });

    await Promise.all([work(1), work(2), work(3)]);
    expect(seen).toEqual([1, 2, 3]); // FIFO-ish by implementation
  });
});

describe('_findConflicts', () => {
  it('detects key intersections', () => {
    const updater = new GlossaryUpdater({}, {});
    const dict = {
      entries: [
        { id: 1, keys: ['a', 'b'], value: 'A' },
        { id: 2, keys: ['x'], value: 'X' },
      ],
    };
    const newEntry = { keys: ['b', 'y'], value: 'B' };
    const conflicts = updater._findConflicts(dict, newEntry);
    expect(conflicts.map(c => c.id)).toEqual([1]);
  });
});

describe('update scheduling without real LLM', () => {
  it('adds non-conflicting entries immediately and never calls client', async () => {
    const client = { request: vi.fn() };
    const promptBuilder = { build: vi.fn() };
    const updater = new GlossaryUpdater(client, promptBuilder);

    const existing = { entries: [{ id: 1, keys: ['a'], value: 'A' }] };
    const newEntries = [{ keys: ['x'], value: 'X' }, { keys: ['y'], value: 'Y' }];

    const res = await updater.update(existing, newEntries);
    expect(client.request).not.toHaveBeenCalled();
    expect(res.entries).toHaveLength(3);
    const added = res.entries.filter(e => e.id !== 1);
    expect(added.map(e => e.value).sort()).toEqual(['X', 'Y']);
  });

  it('schedules disjoint conflicts concurrently', async () => {
    const d1 = deferred();
    const d2 = deferred();
    const client = { request: vi.fn()
        .mockReturnValueOnce(d1.p)
        .mockReturnValueOnce(d2.p),
    };
    const promptBuilder = { build: vi.fn().mockReturnValue('prompt') };
    const updater = new GlossaryUpdater(client, promptBuilder);

    const existing = {
      entries: [
        { id: 1, keys: ['a'], value: 'A' },
        { id: 2, keys: ['b'], value: 'B' },
      ],
    };
    const news = [{ keys: ['a'], value: 'A2' }, { keys: ['b'], value: 'B2' }];

    const promise = updater.update(existing, news);

    // Allow initial scheduling turn
    await Promise.resolve();

    // Both scheduled before any resolve
    expect(client.request).toHaveBeenCalledTimes(2);

    // Complete both with any payload; parseJSONFromLLM will map to [{action:'none'}]
    d1.resolve('ok1');
    d2.resolve('ok2');

    const result = await promise;
    expect(result.entries.map(e => e.value).sort()).toEqual(['A', 'B']); // none => no change
    expect(parseJSONFromLLM).toHaveBeenCalledTimes(2);
  });


  it('blocks scheduling when lock sets intersect', async () => {
    const d1 = deferred();
    const d2 = deferred();
    const client = { request: vi.fn()
        .mockReturnValueOnce(d1.p)
        .mockReturnValueOnce(d2.p),
    };
    const promptBuilder = { build: vi.fn().mockReturnValue('prompt') };
    const updater = new GlossaryUpdater(client, promptBuilder);

    const existing = [{ id: 1, keys: ['a','c'], value: 'AC' }];
    const dict = { entries: existing };
    const news = [{ keys: ['a'], value: 'X' }, { keys: ['c'], value: 'Y' }];

    const p = updater.update(dict, news);
    await Promise.resolve();

    expect(client.request).toHaveBeenCalledTimes(1);
    d1.resolve('ok');

    // Wait for the second request to be called.
    await vi.waitFor(() => {
      expect(client.request).toHaveBeenCalledTimes(2);
    });

    // Clean up by resolving the second request
    d2.resolve('ok');
    await p;
  });
});

describe('LLM result application without real LLM', () => {
  it('applies update action', async () => {
    parseJSONFromLLM.mockReturnValue([{ action: 'update', id: 1, data: 'NEW' }]);
    const client = immediateClient('whatever');
    const updater = new GlossaryUpdater(client, { build: vi.fn() });

    const existing = { entries: [{ id: 1, keys: ['a'], value: 'old' }] };
    const newEntries = [{ keys: ['a'], value: 'irrelevant' }];

    const res = await updater.update(existing, newEntries);
    expect(res.entries.find(e => e.id === 1).value).toBe('NEW');
  });

  it('ignores invalid actions and continues', async () => {
    // Silence the log from the invalid action
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    parseJSONFromLLM.mockReturnValue([{ action: 'delete', id: 999 }]); // not in conflicts
    const client = immediateClient('x');
    const updater = new GlossaryUpdater(client, { build: vi.fn() });

    const existing = { entries: [{ id: 1, keys: ['a'], value: 'v' }] };
    const res = await updater.update(existing, [{ keys: ['a'], value: 'x' }]);
    expect(res.entries.map(e => e.id)).toContain(1);
  });
});