// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

/** One parsed line of runs/<night>.jsonl. */
export type RunLine = {
  at: string; // ISO 8601 with the log's own offset; never converted to UTC
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

/** One row per job for a night. */
export type DigestRow = {
  job: string;
  /** Last non-null owner seen for the job, else null (rendered as `—`). */
  owner: string | null;
  /** Number of lines for the job. */
  runs: number;
  /** Number of lines with status `retry`. */
  retries: number;
  /** Status of the job's last line (by position in the file). */
  lastStatus: RunStatus;
  /** Most recent `error` seen for the job, else null. */
  lastError: string | null;
  /** `at` of the job's first and last line, as written in the log. */
  firstAt: string;
  lastAt: string;
};

export type StatusCounts = Record<RunStatus, number>;

export type Night = {
  night: string; // YYYY-MM-DD
  /** Sorted by job. Empty for an empty file. */
  rows: DigestRow[];
  /** Lines that did not parse or were not a valid RunLine. Counted, never thrown. */
  badLines: number;
  /** Count of valid lines per status, for the board. */
  counts: StatusCounts;
};

/**
 * Reads runs/<night>.jsonl from runsDir. Returns null when the file does not exist
 * (routes answer 404). Implemented in src/digest/reader.ts.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;
