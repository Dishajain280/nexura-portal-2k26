/* Verify realtime publication + RLS policies on the live DB. */
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
    "1. supabase_realtime publication membership",
    `select t.relname as table_name
     from pg_publication p
     join pg_publication_rel r on r.prpubid = p.oid
     join pg_class t on t.oid = r.prrelid
     where p.pubname = 'supabase_realtime'
     order by t.relname`,
  );

  await q(
    "2. RLS enabled per table",
    `select relname as table_name, relrowsecurity as rls_enabled
     from pg_class
     where relnamespace='public'::regnamespace
       and relkind='r'
       and relname in ('profiles','tasks','submissions','notifications')
     order by relname`,
  );

  await q(
    "3. RLS policies per table (cmd + roles)",
    `select tablename, policyname, cmd, roles
     from pg_policies
     where schemaname='public'
       and tablename in ('profiles','tasks','submissions','notifications')
     order by tablename, cmd`,
  );

  await q(
    "4. is_admin definition (coordinator counts as admin)",
    `select prosrc from pg_proc where proname='is_admin'`,
  );

  await q(
    "5. triggers guarding writes",
    `select tgrelid::regclass::text as tbl, tgname
     from pg_trigger
     where not tgisinternal
       and tgrelid::regclass::text in
           ('public.profiles','public.submissions','public.tasks','public.notifications')
     order by tbl, tgname`,
  );

  await q(
    "6. sample mutation target: submissions unique(student_id,task_id)",
    `select conname, pg_get_constraintdef(oid) as def
     from pg_constraint
     where conrelid='public.submissions'::regclass and contype='u'`,
  );

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});