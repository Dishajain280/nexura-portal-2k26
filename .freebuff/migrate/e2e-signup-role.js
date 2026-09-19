/* End-to-end role test: sign up through the real Supabase REST endpoint with
 * role='coordinator' smuggled into user metadata, then assert the created
 * profile is 'student'. The test auth user is deleted afterwards (the runner
 * connects as postgres, so auth.users is writable and cascades to profiles). */
const path = require("path");
const fs = require("fs");
const { Client } = require("pg");

function loadEnv(file) {
  const out = {};
  const txt = fs.readFileSync(file, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const env = loadEnv(path.join(__dirname, "..", "..", "Nexura-Portal", ".env"));
  const url = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const anon = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("VITE_SUPABASE_URL/ANON_KEY missing");

  const email = `role-test-${Date.now()}@example.com`;
  console.log("Signing up", email, "with metadata role=coordinator ...");

  const res = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: anon,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: "TestPass123!",
      data: { name: "Role Test", role: "coordinator" },
    }),
  });
  const body = await res.json();
  const userId = body?.user?.id || body?.id;
  if (!userId) {
    console.error("Signup failed:", JSON.stringify(body));
    process.exit(1);
  }
  console.log("Created auth user:", userId);

  // Give the auth trigger a moment, then read the profile.
  await new Promise((r) => setTimeout(r, 1500));
  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows } = await client.query(
    `select id, name, role, created_at from public.profiles where id = $1`,
    [userId],
  );
  console.log("Profile row:", JSON.stringify(rows, null, 1));

  const role = rows[0]?.role;
  if (role === "student") {
    console.log("PASS: new signup with coordinator metadata was created as student.");
  } else {
    console.log(`FAIL: expected 'student', got '${role}'`);
  }

  // Cleanup — delete the test auth user (cascades to profile + submissions).
  const del = await client.query(`delete from auth.users where id = $1`, [userId]);
  console.log(`Cleanup: deleted ${del.rowCount} auth user(s).`);
  const leftover = await client.query(
    `select count(*)::int as n from public.profiles where id = $1`,
    [userId],
  );
  console.log(`Leftover profiles for test user: ${leftover.rows[0].n}`);
  await client.end();
  process.exit(role === "student" ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});