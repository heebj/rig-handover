import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const tmpDirs: string[] = [];

function nightDir(night: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  tmpDirs.push(dir);
  writeFileSync(join(dir, `${night}.jsonl`), content);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('finds 5 jobs, sorted, and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night!.night).toBe('2026-10-28');
    expect(night!.badLines).toBe(1);
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night!.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('summarises fixtures/refresh', () => {
    const row = night!.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps the failure of notes/backup', () => {
    const row = night!.rows.find((r) => r.job === 'notes/backup');
    expect(row?.lastStatus).toBe('fail');
    expect(row?.lastError).toBe('quota exceeded');
  });

  it('keeps digest/render with a null owner', () => {
    const row = night!.rows.find((r) => r.job === 'digest/render');
    expect(row?.owner).toBeNull();
    expect(row?.lastError).toBeNull();
  });
});

describe('readNight edge cases', () => {
  it('returns null for a missing night', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });

  it('gives no rows and zero counts for an empty file', () => {
    const dir = nightDir('2026-11-01', '');
    expect(readNight(dir, '2026-11-01')).toEqual({
      night: '2026-11-01',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('keeps the last non-null owner and counts invalid RunLines as bad', () => {
    const lines = [
      '{"at":"2026-11-02T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
      '{"at":"2026-11-02T02:00:00+01:00","job":"a","status":"retry","owner":null,"error":"boom"}',
      '{"at":"2026-11-02T03:00:00+01:00","job":"a","status":"ok","owner":null}',
      '{"at":"2026-11-02T04:00:00+01:00","job":"b","status":"ok","owner":null}',
      '{"at":"2026-11-02T05:00:00+01:00","job":"a","status":"done","owner":"rook"}',
      '{"job":"a","status":"ok","owner":"rook"}',
      '[1,2]',
      'not json',
      '',
    ];
    const dir = nightDir('2026-11-02', lines.join('\n'));
    const night = readNight(dir, '2026-11-02')!;
    expect(night.badLines).toBe(4);
    expect(night.counts).toEqual({ ok: 3, retry: 1, fail: 0 });
    expect(night.rows).toHaveLength(2);
    expect(night.rows[0]).toMatchObject({
      job: 'a',
      owner: 'rook',
      runs: 3,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'boom',
    });
    expect(night.rows[1]).toMatchObject({ job: 'b', owner: null, lastError: null });
  });
});
