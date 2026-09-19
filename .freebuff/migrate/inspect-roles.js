/* Inspect live triggers + functions for role enforcement. */
const path = require("path");
const { Client } = require("pg");

function loadEnv(file) {
  const out = {};
  const txt = require("fs").readFileSync(file, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const env = loadEnv(path.join(__dirname, "..", "..", "Nexura-Portal", ".env"));
  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const q = async (label, sql) => {
    const { rows } = await client.query(sql);
    console.log("##", label);
    console.log(JSON.stringify(rows, null, 1));
  };
  await q(
    "all triggers on profiles",
    `select tgname, pg_get_triggerdef(t.oid) as def
     from pg_trigger t where tgrelid='public.profiles'::regclass and not tgisinternal`,
  );
  await q(
    "all triggers on auth.users",
    `select tgname from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal`,
  );
  await q(
    "functions present",
    `select proname from pg_proc where pronamespace='public'::regnamespace
     and proname in ('handle_new_user','prevent_profile_role_escalation','is_admin','prevent_submission_ownership_changes')`,
  );
  await q(
    "guard body",
    `select prosrc from pg_proc where proname='prevent_profile_role_escalation'`,
  );
  await q(
    "handle_new_user body",
    `select prosrc from pg_proc where proname='handle_new_user'`,
  );
  await q(
    "is_admin body",
    `select prosrc from pg_proc where proname='is_admin'`,
  );
  await q(
    "profile role distribution",
    `select role, count(*) from public.profiles group by role order by role`,
  );
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});