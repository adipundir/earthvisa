import { Pool } from "pg";
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

let pool: Pool | null = null;

export function makeSql(): Sql {
  if (!pool) {
    // TLS is decided here, explicitly, and `sslmode` is stripped from the URL.
    // node-postgres is mid-way through changing what `sslmode=require` means
    // (today: encrypt, do not verify; soon: verify-full), and a connection
    // whose security depends on which driver version is installed is not a
    // connection anyone can reason about.
    //
    // The certificate is VERIFIED, against the RDS CA above when it is present
    // and the system store otherwise.
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.delete("sslmode");
    pool = new Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: true, ca: rdsCa() },
      // One long-lived Fargate task, not many single-request Lambdas, so a
      // slightly wider pool costs nothing and stops unrelated requests
      // queueing behind each other. db.t4g.micro allows ~112 connections and
      // this is one container.
      max: 10,
      idleTimeoutMillis: 10_000,
      // Without these, a stalled query is UNBOUNDED. pg-pool only attaches a
      // timer to a waiting caller when connectionTimeoutMillis is set
      // (pg-pool/index.js): otherwise the waiter sits in _pendingQueue with no
      // timer and can never be rejected. The ALB hands the client a 504 at 60s
      // while the promise stays pending for ever, the queue grows, nothing
      // throws - so the *StoreUnavailableError -> 503 paths never fire and
      // CloudWatch records no error at all.
      connectionTimeoutMillis: 5_000,
      query_timeout: 15_000,
    });

    // A Postgres backend can close a connection that is sitting idle in the
    // pool - RDS maintenance, a failover, storage autoscaling, an idle TCP
    // reap. pg-pool surfaces that as an 'error' event on the POOL, and an
    // EventEmitter with no 'error' listener rethrows as an uncaught exception,
    // which exits the process. That is not one failed request: it is the whole
    // site, every prerendered corridor page included, down until ECS pulls a
    // multi-gigabyte image again.
    //
    // pg has already removed and destroyed that client by this point, so
    // logging is the complete and correct handling - the next query checks out
    // a fresh connection.
    pool.on("error", (err) => {
      console.error("[db] idle client error (connection discarded)", err);
    });
  }
  const p = pool;
  return async (strings, ...values) => {
    // Interpolations become numbered parameters, never string splices - the
    // same guarantee the Neon template gave, kept under the same syntax.
    const text = strings.reduce(
      (sql, part, i) => sql + part + (i < values.length ? `$${i + 1}` : ""),
      ""
    );
    return (await p.query(text, values)).rows;
  };
}
