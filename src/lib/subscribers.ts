import { neon } from "@neondatabase/serverless";

// Visa-access change subscribers - same Neon database and degradation contract
// as the reports store: writes throw StoreUnavailableError (API maps it to 503).
// Schema: scripts/init-subscribers-db.mjs.

export class SubscriberStoreUnavailableError extends Error {}

type Sql = ReturnType<typeof neon>;
let sqlClient: Sql | null = null;
function db(): Sql {
  if (!process.env.DATABASE_URL) throw new SubscriberStoreUnavailableError("DATABASE_URL is not set");
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

async function writeQuery<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  try {
    return await fn(db());
  } catch (err) {
    if (err instanceof SubscriberStoreUnavailableError) throw err;
    console.error("[subscribers] store write failed", err);
    throw new SubscriberStoreUnavailableError("subscriber store write failed");
  }
}

/** Fixed-window rate limiting; returns this IP's attempts in the last hour. */
export async function recordSubscribeAttempt(ip: string): Promise<number> {
  return writeQuery(async (sql) => {
    // Cleanup + insert + count in ONE atomic statement (see reports.ts note: the
    // count subquery reads the pre-insert snapshot, so +1 for this attempt).
    const rows = (await sql`
      WITH cleanup AS (
        DELETE FROM subscribe_attempts WHERE at < now() - interval '2 hours'
      ), ins AS (
        INSERT INTO subscribe_attempts (ip) VALUES (${ip}) RETURNING at
      )
      SELECT (
        SELECT count(*)::int FROM subscribe_attempts
        WHERE ip = ${ip} AND at > now() - interval '1 hour'
      ) + 1 AS count`) as { count: number }[];
    return rows[0].count;
  });
}

export async function insertSubscriber(r: {
  email: string;
  passports: string[];
  ip: string;
}): Promise<void> {
  await writeQuery(async (sql) => {
    await sql`
      INSERT INTO subscribers (email, passports, ip)
      VALUES (${r.email}, ${r.passports}, ${r.ip})`;
  });
}
