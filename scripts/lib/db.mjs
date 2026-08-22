import { Client } from "pg";
import { readFileSync } from "node:fs";

// The init scripts' database client, over the Postgres wire protocol.
//
// Same reason as src/lib/db.ts: the Neon HTTP driver can only reach Neon's
// proxy, and these scripts have to be able to create the schema in RDS - which
// is the whole point of being able to move the database at all.
//
// A single Client, not a Pool: a script connects once, runs its DDL and exits.

/** Loads .env.local, which a bare node script does not get for free. */
export function loadEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    const path = new URL("../../.env.local", import.meta.url);
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env.local; rely on the real environment */ }
}

/**
 * Connection settings with TLS decided explicitly rather than by URL parameter.
 *
 * `sslmode` is stripped from the URL and the `ssl` option carries the whole
 * decision. node-postgres is mid-way through changing what `sslmode=require`
 * means (today: encrypt, do not verify; soon: verify-full), and a connection
 * whose security depends on which driver version is installed is not a
 * connection anyone can reason about.
 *
 * The certificate is VERIFIED, against the RDS certificate authority when the
 * bundle is present. RDS presents a cert from its OWN CA, which is not in
 * Node's trust store, so verification fails with SELF_SIGNED_CERT_IN_CHAIN
 * unless that CA is supplied. The tempting fix is `rejectUnauthorized: false`,
 * which "works" by no longer checking who it is talking to - on a database
 * holding passport numbers. The public bundle is committed instead.
 */
export function clientConfig(rawUrl) {
  const url = new URL(rawUrl);
  url.searchParams.delete("sslmode");
  let ca;
  try {
    ca = readFileSync(new URL("../../certs/rds-ap-south-1.pem", import.meta.url), "utf8");
  } catch {
    // Absent when pointed at a local Postgres, where the system store is right.
  }
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ca },
  };
}

/**
 * Connects and returns a tagged template with the same shape the scripts were
 * written against: `await sql\`SELECT ...\`` resolving to the rows array.
 * Returns [sql, close].
 */
export async function connect() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const client = new Client(clientConfig(process.env.DATABASE_URL));
  await client.connect();
  const sql = async (strings, ...values) => {
    const text = strings.reduce(
      (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""),
      ""
    );
    return (await client.query(text, values)).rows;
  };
  return [sql, () => client.end()];
}
