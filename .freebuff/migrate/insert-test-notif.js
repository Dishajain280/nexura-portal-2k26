/* Live realtime test: find the coordinator user id and insert a test notification. */
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

  const { rows: coordRows } = await client.query(
    `select p.id, u.email, p.role
       from public.profiles p
       left join auth.users u on u.id = p.id
      where p.role = 'coordinator'
      order by p.created_at asc`,
  );
  console.log("## coordinators");
  console.log(JSON.stringify(coordRows, null, 1));

  const studentId = process.env.TARGET_USER_ID;
  const target = studentId
    ? { id: studentId, email: "<target>" }
    : coordRows[0];

  const inserted = await client.query(
    `insert into public.notifications (user_id, type, title, message, link, read)
     values ($1, 'info', 'Realtime test notification', 'This notification was inserted directly into the DB to verify live updates. It should appear in the app without a page reload.', '/student/dashboard', false)
     returning id, user_id, created_at`,
    [target.id],
  );
  console.log("## inserted for", target.email);
  console.log(JSON.stringify(inserted.rows, null, 1));

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});