import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const SOURCE = join(import.meta.dirname, '..', 'runs', '2026-10-28.jsonl');

let runsDir: string;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  copyFileSync(SOURCE, join(runsDir, '2026-10-28.jsonl'));
  writeFileSync(join(runsDir, '2026-10-30.jsonl'), '');
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

const app = () =>
  createApp({ adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir });

/** Job names in the order they appear in the HTML table body. */
function htmlJobOrder(html: string): string[] {
  return [...html.matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)].map((m) => m[1]);
}

describe('GET /digest/:night (HTML)', () => {
  it('200 for 2026-10-28 with the 5 jobs and the bad line', async () => {
    const res = await app().request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of [
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]) {
      expect(html).toContain(`<td>${job}</td>`);
    }
    expect(html).toContain('did not parse');
  });

  it('404 for a night with no file', async () => {
    const res = await app().request('/digest/2026-10-29');
    expect(res.status).toBe(404);
  });

  it('empty night 2026-10-30 says nothing ran', async () => {
    const res = await app().request('/digest/2026-10-30');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('200 for 2026-10-28 with 5 rows and badLines 1', async () => {
    const res = await app().request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe('2026-10-28');
    expect(body.rows).toHaveLength(5);
    expect(body.badLines).toBe(1);
  });

  it('404 for a night with no file', async () => {
    const res = await app().request('/api/digest/2026-10-29');
    expect(res.status).toBe(404);
  });

  it('empty night 2026-10-30 has rows [] and status 200', async () => {
    const res = await app().request('/api/digest/2026-10-30');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });
});

describe('page and JSON agree', () => {
  it('job order in the HTML table equals JSON rows order', async () => {
    const html = await (await app().request('/digest/2026-10-28')).text();
    const json = (await (await app().request('/api/digest/2026-10-28')).json()) as Night;
    expect(htmlJobOrder(html)).toEqual(json.rows.map((r) => r.job));
  });
});
