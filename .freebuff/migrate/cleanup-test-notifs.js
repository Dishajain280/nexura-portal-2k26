/* Remove the realtime test notifications created during verification. */
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
  const del = await client.query(
    `delete from public.notifications
      where title = 'Realtime test notification'
      returning id`,
  );
  console.log("## deleted", del.rowCount, "test notification(s)");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});