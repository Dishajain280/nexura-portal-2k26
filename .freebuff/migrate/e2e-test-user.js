/* Create a throwaway auth user (known password) for preview E2E login tests.
 * Prints id + email. Clean up afterwards with cleanup-e2e-users.js. */
const path = require("path");
const fs = require("fs");

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
  const email = `e2e-login-${Date.now()}@example.com`;
  const password = "E2eTestPass!123";

  const res = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      data: { name: "E2E Login Test" },
    }),
  });
  const body = await res.json();
  const userId = body?.user?.id || body?.id;
  if (!userId) {
    console.error("Signup failed:", JSON.stringify(body));
    process.exit(1);
  }
  console.log(JSON.stringify({
    userId,
    email,
    password,
    confirmationEnabled: !body?.session,
  }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});