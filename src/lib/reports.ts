import { makeSql, type Sql } from "@/lib/db";

// Data-inaccuracy reports - same database and degradation contract as the
// Earthling store: writes throw StoreUnavailableError (API maps it to 503).
// Schema: scripts/init-reports-db.mjs.

export class ReportStoreUnavailableError extends Error {}

let sqlClient: Sql | null = null;
function db(): Sql {
  if (!process.env.DATABASE_URL) throw new ReportStoreUnavailableError("DATABASE_URL is not set");
  if (!sqlClient) sqlClient = makeSql();
  return sqlClient;
}

async function writeQuery<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  try {
    return await fn(db());
  } catch (err) {
    if (err instanceof ReportStoreUnavailableError) throw err;
    console.error("[reports] store write failed", err);
    throw new ReportStoreUnavailableError("report store write failed");
  }
}

/** Fixed-window rate limiting; returns this IP's attempts in the last hour. */
export async function recordReportAttempt(ip: string): Promise<number> {
  return writeQuery(async (sql) => {
    // Cleanup + insert + count in ONE atomic statement (see store.ts note: the
    // count subquery reads the pre-insert snapshot, so +1 for this attempt).
    const rows = (await sql`
      WITH cleanup AS (
        DELETE FROM report_attempts WHERE at < now() - interval '2 hours'
      ), ins AS (
        INSERT INTO report_attempts (ip) VALUES (${ip}) RETURNING at
      )
      SELECT (
        SELECT count(*)::int FROM report_attempts
        WHERE ip = ${ip} AND at > now() - interval '1 hour'
      ) + 1 AS count`) as { count: number }[];
    return rows[0].count;
  });
}

export async function insertReport(r: {
  page: string;
  message: string;
  sourceUrl: string | null;
  email: string | null;
  ip: string;
}): Promise<void> {
  await writeQuery(async (sql) => {
    await sql`
      INSERT INTO data_reports (page, message, source_url, email, ip)
      VALUES (${r.page}, ${r.message}, ${r.sourceUrl}, ${r.email}, ${r.ip})`;
  });
}
