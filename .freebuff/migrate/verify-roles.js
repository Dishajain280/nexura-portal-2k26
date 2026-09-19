/* Verify role hardening on the live DB.
 * Runs simulated anon-user attempts inside transactions that are rolled back,
 * so nothing persists. Also reports the connection role so we know whether a
 * real REST signup test can be cleaned up afterwards. */
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

  const { rows } = await client.query(
    `select current_user as conn_role, current_setting('role') as eff_role`,
  );
  console.log("## connection role\n" + JSON.stringify(rows));

  await q(
    "guard trigger attached to profiles",
    `select tgname from pg_trigger
     where tgrelid='public.profiles'::regclass and tgname='trg_profiles_role_guard'`,
  );

  await q(
    "handle_new_user forces student (no metadata role)",
    `select prosrc from pg_proc where proname='handle_new_user'`,
  );

  // Grab ids for simulated attempts.
  const { rows: users } = await client.query(
    `select id, role from public.profiles where role in ('student','coordinator') order by role limit 3`,
  );
  const studentId = users.find((u) => u.role === "student")?.id;
  const coordId = users.find((u) => u.role === "coordinator")?.id;
  console.log("## test subjects\n" + JSON.stringify(users));

  const tryAs = async (label, sub, sql) => {
    await client.query("begin");
    await client.query(`set local role anon`);
    await client.query(
      `set local request.jwt.claims = '{"sub": ${JSON.stringify(sub)}, "role": "authenticated"}'`,
    );
    try {
      await client.query(sql);
      console.log(`## ${label}\nALLOWED (unexpected for attack tests)`);
    } catch (e) {
      console.log(`## ${label}\nBLOCKED: ${e.message}`);
    } finally {
      await client.query("rollback");
    }
  };

  await tryAs(
    "A. student tries to self-promote via UPDATE",
    studentId,
    `update public.profiles set role='coordinator' where id='${studentId}'`,
  );

  await tryAs(
    "B. student tries to INSERT own profile as coordinator",
    studentId,
    `insert into public.profiles (id, name, role) values ('${studentId}', 'x', 'coordinator')`,
  );

  await tryAs(
    "C. signup-trigger path (no session uid) with role coordinator",
    null,
    `insert into public.profiles (id, name, role) values ('${studentId}', 'x', 'coordinator') on conflict (id) do nothing`,
  );

  await tryAs(
    "D. signup-trigger path (no session uid) with role student",
    null,
    `insert into public.profiles (id, name, role) values ('${studentId}', 'x', 'student') on conflict (id) do nothing`,
  );

  if (coordId && studentId) {
    await tryAs(
      "E. coordinator can still promote a student (admin path works)",
      coordId,
      `update public.profiles set role='coordinator' where id='${studentId}'`,
    );
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});