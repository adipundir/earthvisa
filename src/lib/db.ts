import { Pool } from "pg";
import { AuthTypes, Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import { readFileSync } from "node:fs";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// One Postgres client for every store, as a tagged template.
//
// node-postgres over the wire protocol, not Neon's serverless HTTP driver. The
// HTTP driver can only reach Neon's own proxy; this client reaches anything
// that speaks Postgres - RDS in production, Neon or localhost in development -
// under the same DATABASE_URL contract the stores already have.
//
// The interface is deliberately the Neon driver's: a tagged template that
// resolves to the rows array. Every store was written against that shape, and
// a driver swap must not become a rewrite of forty call sites.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Sql = (
  strings: TemplateStringsArray,
  ...values: any[]
) => Promise<Record<string, any>[]>;

/// Amazon RDS presents a certificate from its OWN certificate authority, which
/// is not in Node's bundled trust store. Verification therefore fails with
/// SELF_SIGNED_CERT_IN_CHAIN unless that CA is supplied explicitly.
///
/// The tempting fix is `rejectUnauthorized: false`, which "works" by no longer
/// checking who it is talking to - on a database holding passport numbers and
/// session tokens. So the regional bundle is shipped in the repo instead. It is
/// public, it is three certificates, and it makes verification real.
let caBundle: string | null | undefined;
function rdsCa(): string | undefined {
  if (caBundle === undefined) {
    try {
      caBundle = readFileSync(
        path.join(process.cwd(), "certs", "rds-ap-south-1.pem"), "utf8");
    } catch {
      // Absent in local development against a non-RDS Postgres, where the
      // system trust store is the right answer anyway.
      caBundle = null;
    }
  }
  return caBundle ?? undefined;
}

let poolPromise: Promise<Pool> | null = null;
let connector: Connector | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || (
    process.env.CLOUD_SQL_CONNECTION_NAME && process.env.PGUSER && process.env.PGDATABASE
  ));
}

async function createPool(): Promise<Pool> {
  let pool: Pool;
  if (process.env.CLOUD_SQL_CONNECTION_NAME) {
    if (!process.env.PGUSER || !process.env.PGDATABASE) {
      throw new Error("Cloud SQL user and database are required");
    }
    // The connector verifies TLS and refreshes short-lived IAM credentials.
    // Cloud Run uses its runtime service account; no database password is stored.
    connector ??= new Connector();
    const options = await connector.getOptions({
      instanceConnectionName: process.env.CLOUD_SQL_CONNECTION_NAME,
      authType: AuthTypes.IAM,
      ipType: IpAddressTypes.PUBLIC,
    });
    pool = new Pool({ ...options, user: process.env.PGUSER,
      database: process.env.PGDATABASE, max: 5,
      idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000,
      query_timeout: 15_000, statement_timeout: 15_000 });
  } else {
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.delete("sslmode");
    pool = new Pool({ connectionString: url.toString(),
      ssl: { rejectUnauthorized: true, ca: rdsCa() }, max: 10,
      idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000,
      query_timeout: 15_000 });
  }
  pool.on("error", (err) => {
    console.error("[db] idle client error (connection discarded)", err.name);
  });
  return pool;
}

function getPool(): Promise<Pool> {
  poolPromise ??= createPool().catch((error: unknown) => {
    poolPromise = null;
    throw error;
  });
  return poolPromise;
}

export function makeSql(): Sql {
  return async (strings, ...values) => {
    // Interpolations become numbered parameters, never string splices - the
    // same guarantee the Neon template gave, kept under the same syntax.
    const text = strings.reduce(
      (sql, part, i) => sql + part + (i < values.length ? `$${i + 1}` : ""),
      ""
    );
    return (await (await getPool()).query(text, values)).rows;
  };
}
