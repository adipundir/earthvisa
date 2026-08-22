// Runs every schema script, in order, in one process.
//
//   node scripts/migrate.mjs
//
// This exists so migrations can run as a one-off Fargate task INSIDE the VPC
// (see deploy/deploy.sh migrate). That matters more than the convenience: the
// alternative is reaching RDS from a laptop, which needs a hole in the database
// security group pinned to one home IP address - an address that moves, and a
// hole that then has to be remembered and closed before launch.
//
// Each script is an ES module with top-level await that does its own DDL and
// closes its own connection, so importing it IS running it. They are all
// idempotent (CREATE TABLE IF NOT EXISTS throughout), so re-running is the
// normal case rather than the exception.
//
// Order matters and is asserted by the scripts themselves: filing references
// `accounts`, and enquiries asserts BOTH `accounts` and filing's `outbox`
// before it will create anything - so auth, then filing, then enquiries.
//
// Anything missing from this list is not a loud failure. The tables simply are
// never created, migration reports success, the health check stays green, and
// the endpoints backed by those tables answer 503 for ever with only a line in
// CloudWatch. So this list must stay exhaustive: when a new init-*.mjs is
// added to scripts/, add it here in the same commit.
const STEPS = [
  "./init-auth-db.mjs",
  "./init-earthling-db.mjs",
  "./init-reports-db.mjs",
  "./init-subscribers-db.mjs",
  "./init-filing-db.mjs",
  "./init-enquiries-db.mjs",
];

// Enforce the "keep it exhaustive" rule rather than merely asking for it. An
// init script that exists on disk but is absent from STEPS is precisely the
// failure described above, and it is invisible at run time.
const { readdirSync } = await import("node:fs");
const { dirname } = await import("node:path");
const { fileURLToPath } = await import("node:url");
const onDisk = readdirSync(dirname(fileURLToPath(import.meta.url)))
  .filter((f) => /^init-.*-db\.mjs$/.test(f))
  .map((f) => `./${f}`);
const missing = onDisk.filter((f) => !STEPS.includes(f));
if (missing.length) {
  console.error("These schema scripts exist but are not in STEPS:");
  for (const f of missing) console.error(`  ${f}`);
  console.error("Add them (in dependency order) or migrations will silently skip them.");
  process.exit(1);
}

for (const step of STEPS) {
  console.log(`\n── ${step} ──`);
  try {
    await import(step);
  } catch (err) {
    // Fail loudly and immediately. A half-applied schema that reports success
    // is how the application starts up and then throws on its first real
    // request, with nothing in the deploy log to explain why.
    console.error(`FAILED: ${step}`);
    console.error(err);
    process.exit(1);
  }
}

console.log("\nall migrations applied");
