/* Delete throwaway e2e test users (email LIKE 'e2e-%@example.com'). */
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
  const { rows } = await client.query(
    `select id, email from auth.users where email like 'e2e-%@example.com'`,
  );
  console.log("Found test users:", JSON.stringify(rows));
  if (rows.length > 0) {
    const del = await client.query(
      `delete from auth.users where email like 'e2e-%@example.com'`,
    );
    console.log(`Deleted ${del.rowCount} auth user(s) (profiles cascade).`);
  }
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});