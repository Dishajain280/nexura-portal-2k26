// Every auth return address in the app is built here.
//
// Every auth return link — the email-confirmation link sent at
// signup, and any other link Supabase generates — must point at the same route
// on the same origin, because that exact URL is what has to be allowlisted with
// the auth provider (Supabase → Authentication → URL Configuration → Redirect
// URLs) before signup or password recovery works in production. Keeping one
// source of truth means the code and the allowlist cannot drift apart.
//
// VITE_APP_URL wins when set (a fixed production origin); otherwise the current
// origin is correct for wherever the app is actually served from, which makes
// localhost work with no extra configuration.
export const AUTH_CALLBACK_PATH = "/auth/callback";

export const getAppBaseUrl = () =>
  String(import.meta.env.VITE_APP_URL || window.location.origin).replace(
    /\/+$/,
    "",
  );

// Never derive this from the Supabase project URL. Doing so produced a host the
// app does not run on, and therefore a redirect that could never come back.
export const getAuthCallbackUrl = () =>
  `${getAppBaseUrl()}${AUTH_CALLBACK_PATH}`;

export default {
  AUTH_CALLBACK_PATH,
  getAppBaseUrl,
  getAuthCallbackUrl,
};
