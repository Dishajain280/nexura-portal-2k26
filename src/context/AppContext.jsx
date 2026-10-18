import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import {
  STUDENTS,
  TASKS,
  SUBMISSIONS,
  ADMIN_USER,
  NOTIFICATIONS_STUDENT,
  NOTIFICATIONS_ADMIN,
  getStudentById as getMockStudentById,
  getTaskById as getMockTaskById,
} from "../data/mockData";
import supabase, { isSupabaseConfigured } from "../supabaseClient";
import {
  loginUser,
  signUpUser,
  fetchTasks as fetchDbTasks,
  createTask as createDbTask,
  submitTask as submitDbTask,
} from "../hooks/useNexura";
import { normalizeRole } from "../lib/roleGuard";
import { getAuthDomain } from "../lib/domains";
import { openSafeUrl } from "../lib/sanitizeUrl";
import { extractStoragePath, isStorageFileUrl } from "../lib/submissionFile";

const AppContext = createContext(null);

// Use crypto.randomUUID() for unique IDs that survive HMR. The old
// module-level counter reset on every hot reload, producing duplicate keys
// in React lists.
const nextId = (prefix) => `${prefix}_${crypto.randomUUID()}`;

// Real Supabase users have UUID ids; demo/local fallback users do not.
const isDbUuid = (value = "") =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value),
  );

// Demo/local sessions have no real join date. Persist the first-seen date per
// email so "Member since" stays stable across sessions instead of showing the
// current date, which visibly churns day to day (e.g. Sept 30 -> Oct 1).
const DEFAULT_JOINED = "2024-08-12";
const getLocalJoinedDate = (email = "") => {
  try {
    const key = `nexura_local_joined:${String(email).toLowerCase()}`;
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(key, today);
    return today;
  } catch {
    return DEFAULT_JOINED;
  }
};

const normalizeTask = (row, fallbackStudentIds = []) => {
  const assigned =
    Array.isArray(row.assignedTo) && row.assignedTo.length > 0
      ? row.assignedTo
      : Array.isArray(row.assigned_to) && row.assigned_to.length > 0
        ? row.assigned_to
        : fallbackStudentIds.length > 0
          ? fallbackStudentIds
          : STUDENTS.map((s) => s.id);

  return {
    id: row.id,
    title: row.title || "Untitled task",
    category: row.category || "Web Development",
    description: row.description || "",
    requirements: Array.isArray(row.requirements) ? row.requirements : [],
    deadline: row.deadline
      ? new Date(row.deadline).toISOString().slice(0, 10)
      : "2026-09-30",
    createdAt: row.created_at
      ? new Date(row.created_at).toISOString().slice(0, 10)
      : "2026-09-01",
    difficulty: row.difficulty || "Intermediate",
    points: Number(row.points || 100),
    assignedTo: assigned,
  };
};

const normalizeSubmission = (row) => ({
  id: row.id,
  taskId: row.task_id || row.taskId,
  studentId: row.student_id || row.studentId,
  status: row.status || "pending",
  submittedAt: row.created_at || row.submittedAt || new Date().toISOString(),
  fileUrl: row.file_url || row.fileUrl || "",
  // Only treat file_url as an attachment when it really points at storage:
  // older rows stored an external link there, which must not render as a
  // fake filename/paperclip. Also drop any ?token= query from signed URLs.
  fileName: isStorageFileUrl(row.file_url || "")
    ? decodeURIComponent(String(row.file_url).split("/").pop().split("?")[0])
    : row.fileName || "",
  githubUrl: row.github_url || row.githubUrl || "",
  liveUrl: row.live_url || row.liveUrl || "",
  notes: row.notes || row.note || "",
  feedback: row.feedback || "",
  reviewedAt: row.reviewed_at || row.reviewedAt || null,
  attempt: row.attempt || 1,
});

const fetchCurrentProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  } catch (err) {
    console.warn("fetchCurrentProfile failed:", err);
    return null;
  }
};

const safeSupabaseQuery = async (queryBuilder, fallback = { data: null }) => {
  try {
    const result = await queryBuilder;
    return result ?? fallback;
  } catch (error) {
    console.warn("Supabase query failed:", error);
    return fallback;
  }
};

const buildAuthState = (user, profile) => {
  // The database profile is the single source of truth for the role. Never
  // trust user_metadata.role — it is client-supplied at signup and could be
  // forged to request coordinator access.
  const role = normalizeRole(profile?.role || "student");
  // The domain comes from the profile row, never from user metadata. It decides
  // which tasks and submissions this account can reach, so it is server data:
  // client-supplied metadata is fine for choosing a domain at signup, but not
  // for deciding what that domain grants.
  const domain = profile?.domain || null;
  // normalizeRole folds `admin` into `coordinator` so routing treats the
  // super-admin like staff — which means auth.role alone can no longer tell an
  // unscoped super-admin (sees every domain by design) apart from a domain
  // coordinator who simply has no domain yet (must see nothing). Keep the raw
  // flag for the roster scope in syncLiveData.
  const superAdmin = profile?.role === "admin";
  return {
    role,
    domain,
    superAdmin,
    user: {
      id: user.id,
      email: user.email,
      name:
        profile?.name || user.user_metadata?.name || user.email.split("@")[0],
      role,
      domain,
      avatarColor: role === "coordinator" ? "#5B21B6" : "#7C3AED",
      rollNo: profile?.roll_no || "CS21B045",
      branch: profile?.branch || "Computer Science",
      year: profile?.year || "3rd Year",
      joined: profile?.created_at
        ? new Date(profile.created_at).toISOString().slice(0, 10)
        : "2024-08-12",
    },
  };
};

export function AppProvider({ children }) {
  const [auth, setAuth] = useState(null);
  // Set once the one-time session bootstrap below has finished deciding
  // whether a session exists. Without it, ProtectedRoute sees `auth === null`
  // for the tick before the async restore lands and redirects a hard refresh
  // of e.g. /student/profile away — the URL the user asked for is lost.
  const [authReady, setAuthReady] = useState(false);
  // The seeded roster is demo data: in live mode the profiles table is the
  // only source of truth, and starting from the mock list flashed six fake
  // students — from domains other than the caller's — on every cold load of
  // the Students page before the first sync replaced them.
  const [students, setStudents] = useState(
    isSupabaseConfigured ? [] : STUDENTS
  );
  // Like the roster above: the seeded tasks/submissions are demo data. In
  // live mode they flashed fake counts, statuses and names on the dashboard
  // for the beat before the first sync replaced them — and stayed on screen
  // whenever that sync failed. Start empty in live mode; only the database
  // fills these. Demo builds (no backend configured) keep the seed.
  const [tasks, setTasks] = useState(isSupabaseConfigured ? [] : TASKS);
  const [submissions, setSubmissions] = useState(
    isSupabaseConfigured ? [] : SUBMISSIONS
  );
  // Seeded inboxes are demo data: they belong to the mock session only. In
  // live mode the DB is the source of truth, and starting from the seeded
  // rows made a real coordinator's bell flash "3 unread" notifications that
  // do not exist for their account until the first sync replaced them —
  // phantom rows pointing at demo content the RLS policies would never
  // return. Start empty in live mode so what the bell shows is only ever
  // what the caller is actually allowed to read.
  const [studentNotifs, setStudentNotifs] = useState(
    isSupabaseConfigured ? [] : NOTIFICATIONS_STUDENT
  );
  const [adminNotifs, setAdminNotifs] = useState(
    isSupabaseConfigured ? [] : NOTIFICATIONS_ADMIN
  );
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((message, type = "success") => {
    const id = nextId("toast");
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const syncLiveData = useCallback(async (authOverride) => {
    // Demo mode has no external source of truth, so there is nothing to
    // refresh — and re-seeding the mock data here actively destroys this
    // session's own work. This callback is also the polling/realtime handler,
    // so it runs again a few seconds after any change: a student's freshly
    // submitted work (and a coordinator's review or roster edit) silently
    // reverted to the seeded row, which read as "my submission disappeared".
    // The initial state already comes from the same mock data, so returning
    // early loses nothing.
    if (!isSupabaseConfigured) return;

    // Before sign-in there is no JWT to present: every request below would go
    // out as the `anon` role, which holds no SELECT privilege on these tables,
    // so each one returns 401 — and the bootstrap runs this on the public
    // landing page too, littering the console of a visitor who has not logged
    // in yet. getSession() reads the locally persisted session (no network
    // round trip), so a signed-in caller continues immediately and a
    // signed-out one returns quietly instead of firing requests it cannot win.
    const { data: sessionProbe } = await supabase.auth.getSession();
    if (!sessionProbe?.session) return;

    try {
      // The auth THIS sync should operate on. Callers that have just changed
      // the session (login, the bootstrap restore) pass the state they
      // committed, because the closure variable still holds the previous
      // render's value at that moment: syncing against a null auth applied the
      // fail-closed roster rule below to everyone (Total Students showed 0)
      // and skipped the notification fetch entirely — wrong dashboard numbers
      // until a later poll or reload caught up.
      const liveAuth = authOverride || auth;
      // The caller's domain. getAuthDomain() reads the session level first and
      // falls back to auth.user — every constructor (buildAuthState and the
      // hand-built demo states) writes both levels from the same value, so
      // auth?.user changing identity remains the change signal this callback is
      // keyed on. Null for a super-admin or an account that has not chosen one
      // yet — both see the unfiltered request, and the database policies decide
      // what actually comes back.
      const callerDomain = getAuthDomain(liveAuth);

      const [taskRows, profileRows, submissionRows] = await Promise.all([
        fetchDbTasks(callerDomain).catch(() => []),
        safeSupabaseQuery(
          supabase
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: false }),
        ),
        safeSupabaseQuery(
          supabase
            .from("submissions")
            .select("*")
            .order("created_at", { ascending: false }),
        ),
      ]);

      // A real Supabase backend is configured here (see the guard at the top of
      // this callback), so use ONLY DB data — never the mock fallback.
      let liveStudents = [];
      if (profileRows?.data && profileRows.data.length > 0) {
        liveStudents = profileRows.data
          .filter((p) => p.role === "student" || !p.role || p.role === "")
          .map((p) => ({
            id: p.id,
            name: p.name || p.email?.split("@")[0] || "Student User",
            email: p.email || "",
            role: p.role || "student",
            rollNo:
              p.roll_no ||
              p.rollNo ||
              `CS21B${String(p.id).slice(0, 3).toUpperCase()}`,
            branch: p.branch || "Computer Science",
            year: p.year || "3rd Year",
            // Carried through so the roster can show which domain a student is
            // in, and know when one is still unassigned (unassigned = the
            // coordinator may place them; assigned = the club owns it).
            domain: p.domain || null,
            avatarColor: "#7C3AED",
            joined: p.created_at
              ? new Date(p.created_at).toISOString().slice(0, 10)
              : "2024-08-12",
          }));
      }

      if (liveAuth?.user) {
        const userInList = liveStudents.find((s) => s.id === liveAuth.user.id);
        if (!userInList && liveAuth.user.role === "student") {
          liveStudents.unshift(liveAuth.user);
        } else if (userInList) {
          Object.assign(userInList, {
            name: liveAuth.user.name || userInList.name,
            email: liveAuth.user.email || userInList.email,
          });
        }
      }

      // Rosters are domain-scoped: a coordinator sees only their own domain's
      // students — the same rule the profiles SELECT policy enforces server-
      // side (migrations/2026-10-18-profiles-read-domain-scoping.sql). The
      // unscoped super-admin keeps every domain; anyone else without a domain
      // fails closed to an empty roster rather than inheriting everyone's.
      if (!liveAuth?.superAdmin) {
        liveStudents = callerDomain
          ? liveStudents.filter((s) => s.domain === callerDomain)
          : [];
      }

      setStudents(liveStudents);

      const allStudentIds = liveStudents.map((s) => s.id);

      // Use ONLY DB data. If the DB returns empty arrays, set empty state —
      // never fall back to mock data.
      const dbTasks = taskRows?.length > 0
        ? taskRows.map((t) => normalizeTask(t, allStudentIds))
        : [];
      setTasks(dbTasks);

      // Submissions carry no domain of their own — their domain is their
      // task's. The tasks above are already scoped, so keeping only
      // submissions against a visible task matches what the policies allow
      // and stops the UI rendering a row whose task the user cannot open.
      const visibleTaskIds = new Set(dbTasks.map((t) => t.id));
      const dbSubs = submissionRows?.data?.length > 0
        ? submissionRows.data
            .map(normalizeSubmission)
            .filter((s) => !callerDomain || visibleTaskIds.has(s.taskId))
        : [];
      setSubmissions(dbSubs);

      // Persistent notifications (real Supabase users only — demo/local
      // sessions keep the seeded mock notifications).
      if (liveAuth?.user && isDbUuid(liveAuth.user.id)) {
        const notifResult = await safeSupabaseQuery(
          supabase
            .from("notifications")
            .select("*")
            .eq("user_id", liveAuth.user.id)
            .order("created_at", { ascending: false })
            .limit(50),
        );
        if (Array.isArray(notifResult?.data)) {
          const dbNotifs = notifResult.data.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            link: n.link,
            read: n.read,
            time: n.created_at,
          }));
          if (normalizeRole(liveAuth.user.role) === "coordinator") {
            setAdminNotifs(dbNotifs);
          } else {
            setStudentNotifs(dbNotifs);
          }
        }
      }
    } catch (error) {
      console.warn("Supabase sync failed, using current state.", error);
    }
  }, [auth?.user]);

  // The bootstrap effect below must run ONCE per mount. It restores the demo
  // session from localStorage and re-reads the backend session, so having it
  // depend on syncLiveData (which is keyed on auth.user and therefore changes
  // identity on every profile edit) made it re-run and re-restore the SAVED
  // session after each save — silently reverting a just-claimed domain to the
  // stale value on disk. The ref keeps the effect stable while still calling
  // the newest closure.
  const syncLiveDataRef = useRef(syncLiveData);
  syncLiveDataRef.current = syncLiveData;

  const commitAuth = useCallback((nextAuthState) => {
    setAuth((prev) => {
      if (
        prev &&
        prev.user &&
        nextAuthState?.user &&
        JSON.stringify(prev.user) === JSON.stringify(nextAuthState.user)
      ) {
        // Same session/profile content: keep the previous object identity.
        // Otherwise derived callbacks (e.g. syncLiveData, keyed off
        // auth.user) change identity, re-running the bootstrap effect, which
        // re-subscribes to onAuthStateChange and replays INITIAL_SESSION,
        // producing an infinite refetch/request loop (ERR_INSUFFICIENT_RESOURCES).
        return prev;
      }
      return nextAuthState;
    });
  }, []);

  const hydrateAuthFromUser = useCallback(
    async (user) => {
      if (!user) {
        setAuth(null);
        return null;
      }

      // Returns the state it committed so the bootstrap's first sync can run
      // against the REAL auth instead of the still-null closure value.
      try {
        const profile = await fetchCurrentProfile(user.id);
        const next = buildAuthState(user, profile);
        commitAuth(next);
        return next;
      } catch (error) {
        console.warn("Profile hydration failed", error);
        const fallback = {
          role: "student",
          user: {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email.split("@")[0],
            role: "student",
            avatarColor: "#7C3AED",
            rollNo: "CS21B045",
            branch: "Computer Science",
            year: "3rd Year",
            joined: "2024-08-12",
          },
        };
        commitAuth(fallback);
        return fallback;
      }
    },
    [commitAuth],
  );

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      // The auth actually restored this boot, handed to the first sync below.
      let restoredAuth = null;
      try {
        const sessionRes = supabase?.auth?.getSession
          ? await supabase.auth
              .getSession()
              .catch(() => ({ data: { session: null } }))
          : { data: { session: null } };
        const session = sessionRes?.data?.session;

        if (active && session?.user) {
          restoredAuth = (await hydrateAuthFromUser(session.user)) || null;
        }

        // When no real session exists at bootstrap (e.g. a fresh reload in
        // demo mode, or a real backend with no stored session), rehydrate
        // from a persisted local session so a refresh does not silently drop
        // the user back to /login. The persisted session is a demo-only
        // concept — it is never trusted when a real Supabase backend is
        // configured.
        if (active && !session?.user && !isSupabaseConfigured) {
          const saved = localStorage.getItem("nexura_session");
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed?.user && parsed?.role) {
                // Restore the saved session exactly as it was saved.
                //
                // Funnelling it through hydrateAuthFromUser() treated an auth
                // SESSION as a Supabase USER: that path reads user.id to fetch a
                // profile and user.email to derive a name, and neither exists on
                // a session object, so the fallback in its catch block threw on
                // user.email.split() and this catch deleted the key. Every reload
                // therefore dropped a demo coordinator — back to signed out, or
                // back as a student with no domain.
                restoredAuth = { ...parsed, domain: getAuthDomain(parsed) };
                commitAuth(restoredAuth);
              }
            } catch (err) {
              console.warn("Saved demo session was unreadable:", err);
              localStorage.removeItem("nexura_session");
            }
          }
        }

        if (active) {
          await syncLiveDataRef.current(restoredAuth || undefined);
        }
      } catch (error) {
        console.warn("Session bootstrap failed", error);
      } finally {
        // A failed or empty bootstrap must still settle the gate, otherwise a
        // signed-out visitor would wait forever on a blank screen instead of
        // reaching /login.
        if (active) setAuthReady(true);
      }
    };

    bootstrap();

    let channel = null;
    let pollTimer = null;
    let joinCheckTimer = null;

    // Live-refresh via Supabase Realtime. Each listener is registered as its
    // own statement instead of chaining `.on(...)` calls: the post-deployment
    // bundle threw "TypeError: ...channel(...).on(...).on is not a function"
    // whenever the bundled @supabase/realtime-js `.on()` did not return a
    // chainable channel (dependency version drift at build/deploy time).
    // Calling `.on()` per statement only relies on listener side effects, and
    // the feature checks + try/catch make realtime failures degrade to the
    // polling fallback instead of crashing the app bootstrap.
    const setupRealtime = () => {
      if (typeof supabase?.channel !== "function") return;

      try {
        const realtimeChannel = supabase.channel("nexura-realtime-sync");
        if (typeof realtimeChannel?.on !== "function") return;

        const onTableChange = (table) => {
          realtimeChannel.on(
            "postgres_changes",
            { event: "*", schema: "public", table },
            () => {
              if (active) syncLiveDataRef.current();
            },
          );
        };

        onTableChange("tasks");
        onTableChange("submissions");
        onTableChange("profiles");
        onTableChange("notifications");

        let joined = false;
        const startFallbackPolling = () => {
          if (pollTimer || !active) return;
          pollTimer = setInterval(() => {
            if (active) syncLiveDataRef.current();
          }, 25000);
        };

        if (typeof realtimeChannel.subscribe === "function") {
          realtimeChannel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              joined = true;
              if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
              }
            } else if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT" ||
              status === "CLOSED"
            ) {
              startFallbackPolling();
            }
          });
        }
        channel = realtimeChannel;

        // If the realtime socket never confirms within 6s (e.g. the project
        // has realtime disabled), fall back to polling so data and
        // notifications still refresh in other sessions.
        joinCheckTimer = setTimeout(() => {
          if (!joined && active) startFallbackPolling();
        }, 6000);
      } catch (error) {
        console.warn("Realtime sync setup failed:", error);
      }
    };

    setupRealtime();

    if (!channel) {
      // Realtime channel unavailable: keep live data fresh via polling.
      pollTimer = setInterval(() => {
        if (active) syncLiveDataRef.current();
      }, 25000);
    }

    let subscription = null;
    if (supabase?.auth?.onAuthStateChange) {
      const { data } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!active) return;

          try {
            if (session?.user) {
              await hydrateAuthFromUser(session.user);
            } else if (event === "SIGNED_OUT") {
              // Logout can also arrive as an auth event from another open tab
              // (auth-js broadcasts across tabs). Clear React state so
              // ProtectedRoute redirects to /login instead of leaving a ghost
              // logged-in UI.
              setAuth(null);
            }
            await syncLiveDataRef.current();
          } catch (error) {
            console.warn("Auth change sync failed", error);
          }
        },
      );
      subscription = data?.subscription ?? null;
    }

    return () => {
      active = false;
      if (pollTimer) clearInterval(pollTimer);
      if (joinCheckTimer) clearTimeout(joinCheckTimer);
      if (subscription && typeof subscription.unsubscribe === "function") {
        subscription.unsubscribe();
      }
      if (channel && typeof channel.unsubscribe === "function") {
        channel.unsubscribe();
      }
    };
  }, [commitAuth, hydrateAuthFromUser]);

  const login = useCallback(
    async (role, email, password) => {
      const requestedRole = normalizeRole(role || "student");

      try {
        // Strict credential verification: loginUser delegates to
        // supabase.auth.signInWithPassword and throws the native Supabase
        // error ("Invalid login credentials") when the password does not
        // match — never a silent local login.
        const { user } = await loginUser(email, password);
        if (!user?.id) throw new Error("Invalid login credentials");

        // The database profile is the single source of truth for the role.
        const profile = await fetchCurrentProfile(user.id);
        const effectiveRole = normalizeRole(profile?.role || "student");

        // Strict role gate: the account's database role must match the portal
        // tab the user selected. On mismatch the session is revoked
        // server-side and the login is rejected — a student picking the
        // Coordinator tab gets "Access Denied" instead of being silently
        // redirected (and vice versa).
        if (requestedRole !== effectiveRole) {
          try {
            await supabase.auth.signOut({ scope: "global" });
          } catch (signOutErr) {
            console.warn(
              "Session revocation after role mismatch failed:",
              signOutErr,
            );
          }
          const deniedMessage =
            requestedRole === "coordinator"
              ? "Access Denied: this account is registered as a student — you do not have coordinator access."
              : "Access Denied: this account is a coordinator — use the coordinator portal.";
          // Toast from the context (not the page) so the message survives the
          // redirect bounce the revoked session causes.
          pushToast(deniedMessage, "danger");
          throw new Error(deniedMessage);
        }

        const authState = buildAuthState(
          user,
          profile || { role: effectiveRole },
        );
        setAuth(authState);
        // Pass the just-committed state: this callback still closes over the
        // PREVIOUS auth (null on a fresh login), which would sync against no
        // caller at all — empty roster, no notifications — on the very first
        // dashboard render after logging in.
        await syncLiveData(authState);
        return authState;
      } catch (err) {
        // Demo fallback ONLY when no real Supabase backend is configured
        // (noop client — env vars missing at build time). With a real
        // backend, every failure — wrong password, unknown email, network
        // error — is rethrown so the login attempt is explicitly rejected.
        if (!isSupabaseConfigured) {
          // Demo mode (no backend configured): the Coordinator tab opens a
          // seeded local coordinator session so the whole assign → submit →
          // review loop can be demoed offline. This branch is unreachable
          // when a real Supabase backend is configured — production roles
          // still come exclusively from the database profile above.
          if (requestedRole === "coordinator") {
            const demoCoordinator = {
              ...ADMIN_USER,
              email: email || ADMIN_USER.email,
              role: "coordinator",
              // Real coordinators are seeded with a domain (see
              // migrations/2026-10-15-seed-domain-coordinators.sql), so the
              // demo one carries one too. Without it the offline build could
              // not show the domain badge or the locked task-form field, and
              // demo mode would silently misrepresent the coordinator UI.
              domain: "technical",
              branch: "Computer Science",
              year: "Faculty",
              joined: "2024-08-12",
            };
            const coordinatorState = {
              role: "coordinator",
              // Same two levels buildAuthState() sets, so every reader — the
              // domain badge, the locked task field, the filtered fetch — sees
              // the domain no matter which level it consults.
              domain: demoCoordinator.domain,
              user: demoCoordinator,
            };
            setAuth(coordinatorState);
            try {
              localStorage.setItem(
                "nexura_session",
                JSON.stringify(coordinatorState),
              );
            } catch (e) {
              console.warn("Could not persist demo session:", e);
            }
            pushToast(
              "Demo coordinator session (no backend configured).",
              "warning",
            );
            return coordinatorState;
          }
          const demoUser = {
            id: "s1",
            email,
            name: email.split("@")[0]
              ? email.split("@")[0].replace(".", " ")
              : "Aarav Mehta",
            role: "student",
            avatarColor: "#7C3AED",
            rollNo: "CS21B045",
            branch: "Computer Science",
            year: "3rd Year",
            joined: getLocalJoinedDate(email),
          };

          const authState = {
            role: demoUser.role,
            domain: demoUser.domain || null,
            user: demoUser,
          };
          setAuth(authState);
          try {
            localStorage.setItem(
              "nexura_session",
              JSON.stringify(authState),
            );
          } catch (e) {
            console.warn("Could not persist demo session:", e);
          }
          return authState;
        }
        throw err;
      }
    },
    [pushToast, syncLiveData],
  );

  const signup = useCallback(
    async (name, email, password, role = "student", domain = null) => {
      try {
        const result = await signUpUser(email, password, name, domain);
        const user = result?.user;

        if (user) {
          const profile = await fetchCurrentProfile(user.id);
          // Strictly student by default: the DB trigger creates the profile
          // with role 'student', and the role guard rejects anything else for
          // non-admin signups. Never honor a requested role here.
          const effectiveRole = profile?.role || "student";

          if (
            role === "coordinator" &&
            effectiveRole !== "coordinator" &&
            typeof pushToast === "function"
          ) {
            pushToast(
              "Coordinator accounts are not created via signup. You joined as a student.",
              "warning",
            );
          }

          const authState = buildAuthState(
            user,
            profile || { role: effectiveRole },
          );
          setAuth(authState);
          await syncLiveData();
          return authState;
        }
      } catch (err) {
        // With a real backend configured, a failed signup must reach the user.
        // Swallowing it and falling through to the local session below minted a
        // "signed in" student whose account does not exist in the database:
        // registration looked successful while every later write failed. The
        // demo fallback is only legitimate when there is no backend at all.
        if (isSupabaseConfigured) throw err;
        console.warn("Supabase unavailable, using local demo session:", err);
      }

      // Demo-mode-only fallback session (no backend configured): always a
      // student. Same rule as login — this path must never mint a coordinator.
      const localUser = {
        id: `u_${Date.now()}`,
        email,
        name,
        role: "student",
        // Mirrors production, where handle_new_user() stores the domain chosen
        // on the form (migrations/2026-10-15-signup-domain.sql). Demo accounts
        // should have the same shape as real ones.
        domain: domain || null,
        avatarColor: "#7C3AED",
        rollNo: "CS21B" + Math.floor(100 + Math.random() * 900),
        branch: "Computer Science",
        year: "1st Year",
        joined: getLocalJoinedDate(email),
      };

      setStudents((prev) => [localUser, ...prev]);

      const authState = {
        role: "student",
        domain: localUser.domain || null,
        user: localUser,
      };
      setAuth(authState);
      return authState;
    },
    [pushToast, syncLiveData],
  );

  const logout = useCallback(async () => {
    // 1. Purge React auth state FIRST so the UI responds instantly and
    //    ProtectedRoute redirects away regardless of network conditions.
    //    Waiting on signOut() made logout hang whenever the auth request
    //    stalled on a flaky network, leaving the user stuck on the dashboard.
    setAuth(null);

    // 2. Revoke the session server-side. scope "global" calls
    //    POST /auth/v1/logout?scope=global, which invalidates the refresh
    //    token — backend JWTs are actually revoked, not just dropped from
    //    this browser's storage.
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (e) {
      // Best-effort: if the network is down the local purge below still
      // guarantees the user is signed out in this browser.
      console.warn("Sign out error (local purge continues):", e);
    }

    // 3. Wipe app-owned browser storage: Supabase auth tokens ("sb-...")
    //    and local demo keys ("nexura_..."). This is a targeted wipe, not
    //    localStorage.clear(), so unrelated site data is preserved.
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sb-") || key.startsWith("nexura_") || key === "nexura_session")) {
          doomed.push(key);
        }
      }
      doomed.forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch (e) {
      console.warn("Storage wipe failed:", e);
    }

    // 4. Full-page redirect to the root. A hard navigation (not a router
    //    push) guarantees a fresh app bootstrap — no stale React state,
    //    subscriptions, or in-memory data can survive in this tab, and any
    //    pending framework work is discarded cleanly instead of crashing on
    //    the unmounted tree.
    try {
      window.location.replace("/");
    } catch (e) {
      console.warn("Redirect failed:", e);
    }
  }, []);

  // A scoped coordinator always files into their own domain. Hoisted out of the
  // callback so the dependency is an ordinary value rather than a member access
  // the React Compiler has to infer from inside and cannot reconcile with the
  // manual dependency array.
  const callerDomainForTasks = getAuthDomain(auth);

  const createTask = useCallback(
    async (taskData) => {
      const allStudentIds = students.map((s) => s.id);
      const assigned =
        Array.isArray(taskData.assignedTo) && taskData.assignedTo.length > 0
          ? taskData.assignedTo
          : allStudentIds;

      console.log("[context createTask] Starting. assigned:", assigned);

      try {
        // The domain is not the client's to choose: a scoped coordinator always
        // writes into their own domain, and the database trigger enforces the
        // same rule on the row itself. A super-admin has no domain of their
        // own, so they pick one on the form.
        const created = await createDbTask({
          ...taskData,
          domain: callerDomainForTasks || taskData.domain || null,
        });
        console.log("[context createTask] createDbTask returned:", created);

        // The DB call returned — but only treat it as success when the
        // returned row is actually usable. A null/undefined response means
        // the insert did not produce a task row, so this must not toast
        // success and must not update React state.
        if (!created) {
          throw new Error("Task creation returned no data");
        }

        const normalized = normalizeTask(created);
        const merged = { ...normalized, assignedTo: assigned };
        setTasks((prev) => [merged, ...prev]);
        pushToast("Task created successfully!");
        return merged;
      } catch (err) {
        console.error("[context createTask] Database task creation failed:", err?.message || err);
      }

      pushToast(
        "Could not save task to the database. Check your connection and try again.",
        "danger",
      );
      return null;
    },
    [callerDomainForTasks, pushToast, students],
  );

  const updateTask = useCallback(
    async (taskId, updates) => {
      // Optimistic update in React state (camelCase).
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
      );
      try {
        // Convert camelCase keys to snake_case for the DB.
        const dbUpdates = {};
        if (updates.title !== undefined) dbUpdates.title = updates.title;
        if (updates.description !== undefined) dbUpdates.description = updates.description;
        if (updates.category !== undefined) dbUpdates.category = updates.category;
        if (updates.difficulty !== undefined) dbUpdates.difficulty = updates.difficulty;
        if (updates.points !== undefined) dbUpdates.points = updates.points;
        if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline;
        if (updates.assignedTo !== undefined) dbUpdates.assigned_to = updates.assignedTo;
        if (updates.requirements !== undefined) dbUpdates.requirements = updates.requirements;

        const { error } = await supabase
          .from("tasks")
          .update(dbUpdates)
          .eq("id", taskId);
        if (error) throw error;
      } catch (e) {
        console.warn("Supabase task update failed, reverting:", e);
        pushToast("Task update could not be saved.", "danger");
        await syncLiveData(); // Revert optimistic state to DB truth.
        return;
      }
      pushToast("Task updated successfully!");
      return;

    // Local/demo update: the change lives in React state only. This branch
    // is only reachable when no real Supabase backend is configured, so there
    // is no DB to reconcile with — the optimistic update above already updated
    // the UI, and we keep it there for the rest of the session.
    if (!isSupabaseConfigured) {
      pushToast("Task updated (local session only — resets on reload).", "warning");
      return;
    }

    pushToast("Task update could not be saved.", "danger");
    },
    [pushToast, syncLiveData],
  );

  const deleteTask = useCallback(
    async (taskId) => {
      try {
        // Delete the task first; if it succeeds, cascade-delete its
        // submissions. This avoids orphaned tasks when the task delete
        // fails after submissions are already gone.
        const { error: taskErr } = await supabase
          .from("tasks")
          .delete()
          .eq("id", taskId);
        if (taskErr) throw taskErr;

        await supabase.from("submissions").delete().eq("task_id", taskId);
      } catch (e) {
        console.warn("Supabase task delete failed:", e);
        pushToast("Could not delete task from the database.", "danger");
        await syncLiveData(); // Revert optimistic state.
        return;
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSubmissions((prev) => prev.filter((s) => s.taskId !== taskId));
      pushToast("Task removed", "danger");
    },
    [pushToast, syncLiveData],
  );

  const submitTask = useCallback(
    async (taskId, studentId, payload, attempt = 1) => {
      const subId = `sub_${Date.now()}`;
      const effStudentId = studentId || auth?.user?.id || "s1";

      const newSub = {
        id: subId,
        taskId,
        studentId: effStudentId,
        status: "pending",
        submittedAt: new Date().toISOString(),
        fileName: payload?.fileName || (payload?.file ? payload.file.name : ""),
        githubUrl: payload?.githubUrl || "",
        liveUrl: payload?.liveUrl || "",
        notes: payload?.notes || "",
        feedback: "",
        reviewedAt: null,
        attempt: attempt || 1,
      };

      // Demo mode (no backend): keep the submission in memory like every
      // other demo record. Nothing is persisted — a reload resets it, and
      // the demo coordinator sees it because both sessions share state.
      if (!isSupabaseConfigured) {
        setSubmissions((prev) => [
          newSub,
          ...prev.filter((s) => s.id !== newSub.id),
        ]);
        pushToast(
          attempt > 1
            ? "Resubmitted successfully!"
            : "Task submitted successfully!",
        );
        return newSub;
      }

      try {
        let dbRes;
        if (payload?.file) {
          dbRes = await submitDbTask(payload.file, taskId, effStudentId, {
            githubUrl: payload?.githubUrl || "",
            liveUrl: payload?.liveUrl || "",
            notes: payload?.notes || "",
            attempt: attempt || 1,
          });
        } else {
          // Link-only submission. submissions has unique(student_id, task_id),
          // so a resubmission must UPDATE the existing row — a plain insert
          // fails with a duplicate-key error. file_url is reserved for real
          // uploads; external links belong in github_url/live_url.
          const { data: existing, error: lookupError } = await supabase
            .from("submissions")
            .select("id")
            .eq("student_id", effStudentId)
            .eq("task_id", taskId)
            .maybeSingle();

          if (lookupError && lookupError.code !== "PGRST116") {
            throw lookupError;
          }

          const row = {
            github_url: payload?.githubUrl || "",
            live_url: payload?.liveUrl || "",
            notes: payload?.notes || "",
            status: "pending",
            attempt: attempt || 1,
            // created_at drives the "Submitted" timestamp in the UI, so a
            // resubmission must advance it to now.
            ...(existing?.id ? { created_at: new Date().toISOString() } : {}),
          };

          const query = existing?.id
            ? supabase
                .from("submissions")
                .update(row)
                .eq("id", existing.id)
                .select()
                .single()
            : supabase
                .from("submissions")
                .insert([
                  {
                    ...row,
                    student_id: effStudentId,
                    task_id: taskId,
                    file_url: null,
                  },
                ])
                .select()
                .single();

          const { data, error } = await query;
          if (error) throw error;
          dbRes = data;
        }

        if (dbRes) {
          const normalized = normalizeSubmission(dbRes);
          const merged = { ...newSub, ...normalized };
          setSubmissions((prev) => [
            merged,
            ...prev.filter((s) => s.id !== merged.id),
          ]);
          pushToast(
            attempt > 1
              ? "Resubmitted successfully!"
              : "Task submitted successfully!",
          );
          return merged;
        }
      } catch (err) {
        console.warn("Database submission failed:", err);
      }

      // DB insert failed — do NOT create a local-only submission. It would
      // be invisible to the coordinator and disappear on reload.
      pushToast(
        "Could not save submission to the database. Check your connection and try again.",
        "danger",
      );
      return null;
    },
    [auth?.user?.id, pushToast],
  );

  const reviewSubmission = useCallback(
    async (submissionId, status, feedback) => {
      const reviewedAt = new Date().toISOString();

      // Optimistic update so the UI feels instant.
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? { ...s, status, feedback, reviewedAt }
            : s,
        ),
      );

      try {
        const { data, error } = await supabase
          .from("submissions")
          .update({ status, feedback, reviewed_at: reviewedAt })
          .eq("id", submissionId)
          .select()
          .single();

        if (error) throw error;

        // Replace with the authoritative DB row so a reload agrees with the UI.
        if (data) {
          const normalized = normalizeSubmission(data);
          setSubmissions((prev) =>
            prev.map((s) =>
              s.id === submissionId ? { ...s, ...normalized } : s,
            ),
          );
        }
      } catch (err) {
        console.warn("Database review update failed:", err);
        pushToast("Review could not be saved to the database.", "danger");
        await syncLiveData(); // Revert optimistic state to DB truth.
        return;
      }        // The student-facing notification is created by the DB trigger on the
      // status change, so it survives reloads and reaches the student's
      // account even in a different session.
      if (isSupabaseConfigured) {
        pushToast(
          status === "approved"
            ? "Submission approved"
            : "Submission rejected with feedback",
          status === "approved" ? "success" : "danger",
        );
        return;
      }

      // Demo mode: there is no DB trigger, so create the student-facing
      // notification in React state so the student actually sees the result
      // of the review during an offline demo.
      const studentId = (
        submissions.find((s) => s.id === submissionId)?.studentId ||
        ""
      );
      if (studentId) {
        const inbox = role === "coordinator" ? adminNotifs : studentNotifs;
        const setter = role === "coordinator" ? setAdminNotifs : setStudentNotifs;
        const existingUnread = [
          ...inbox,
        ].filter((n) => !n.read && n.link?.startsWith(`/student/submissions/${submissionId}`)).length;
        setter((prev) => [
          {
            id: `notif_${Date.now()}_${submissionId}`,
            type: status === "approved" ? "approved" : "rejected",
            title: status === "approved" ? "Submission approved" : "Changes requested",
            message: status === "approved"
              ? "Your submission was approved by the coordinator."
              : feedback || "The coordinator requested changes on your submission.",
            link: `/student/submissions/${submissionId}`,
            read: false,
            time: reviewedAt,
          },
          ...prev,
        ]);
        if (role === "student" && !existingUnread) {
          setter((prev) => [
            {
              id: `notif_${Date.now()}_${submissionId}`,
              type: status === "approved" ? "approved" : "rejected",
              title: status === "approved" ? "Submission approved" : "Changes requested",
              message: status === "approved"
                ? "Your submission was approved by the coordinator."
                : feedback || "The coordinator requested changes on your submission.",
              link: `/student/submissions/${submissionId}`,
              read: false,
              time: reviewedAt,
            },
            ...prev,
          ]);
        }
      }

      pushToast(
        status === "approved"
          ? "Submission approved"
          : "Submission rejected with feedback",
        status === "approved" ? "success" : "danger",
      );
    },
    [pushToast, syncLiveData],
  );

  const removeSubmission = useCallback(
    async (submissionId) => {
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      try {
        await supabase.from("submissions").delete().eq("id", submissionId);
      } catch (e) {
        console.warn("Supabase remove submission error:", e);
      }
      pushToast("Submission removed", "danger");
    },
    [pushToast],
  );

  const updateProfile = useCallback(
    async (name, email, extras = {}) => {
      if (!auth?.user) return;

      // Destructured BEFORE the demo-mode branch below, not after it: the demo
      // branch writes the claimed domain too, and reaching it before this
      // declaration put `domain` in its temporal dead zone — every demo-mode
      // save threw "domain is not defined" and the form silently did nothing.
      const { roll_no, branch, year, domain } = extras;

      const nextName = name || auth.user.name;
      const nextEmail = email || auth.user.email;
      const updatedUser = { ...auth.user, name: nextName, email: nextEmail };
      setAuth((prev) => (prev ? { ...prev, user: updatedUser } : prev));

      if (!isSupabaseConfigured) {
        // Demo mode: the change lives in this session's state — and is written
        // back to the persisted demo session.
        //
        // A claimed domain has to be reflected at BOTH levels of the session,
        // the way buildAuthState writes it, because getAuthDomain() reads
        // either. Writing only one is what made the coordinator badge and the
        // locked task field invisible in demo mode while looking right in
        // production.
        //
        // Persisting matters because the session itself already survives a
        // refresh (the bootstrap restores it from localStorage): keeping only
        // the in-memory copy meant the next mount restored the OLD row and the
        // freshly claimed domain vanished, so the save looked like a no-op.
        // roll no / branch / year were previously dropped on this path: only
        // name and email reached the session, so in demo mode the form saved
        // nothing but the name and the profile card kept the old roll number
        // even though the field above it showed the new one.
        // They are carried here rather than into updatedUser so production
        // keeps showing them only once the database has accepted the write.
        const nextAuth = {
          ...auth,
          user: {
            ...updatedUser,
            ...(roll_no ? { rollNo: roll_no } : {}),
            ...(branch ? { branch } : {}),
            ...(year ? { year } : {}),
            ...(domain ? { domain } : {}),
          },
          ...(domain ? { domain } : {}),
        };
        setAuth(nextAuth);
        try {
          localStorage.setItem("nexura_session", JSON.stringify(nextAuth));
        } catch (e) {
          console.warn("Could not persist demo session:", e);
        }
        pushToast("Profile updated for this demo session.", "warning");
        return;
      }

      // Email is controlled by Auth and synced by the DB trigger; the portal
      // edits it only for display purposes in the UI, never as an independent
      // profile field. When the request comes from the editable profile form,
      // keep the existing email untouched on the server side.
      const profileUpdates = { name: nextName };
      if (roll_no !== undefined) profileUpdates.roll_no = roll_no;
      if (branch !== undefined) profileUpdates.branch = branch;
      if (year !== undefined) profileUpdates.year = year;
      // A domain travels only when one was chosen, and the database accepts it
      // only while the account has none — a one-time claim. Every other kind of
      // domain change from the browser is refused by
      // prevent_profile_role_escalation(), so sending one on a normal profile
      // save would turn "Save changes" into an error rather than a no-op.
      if (domain) profileUpdates.domain = domain;

      try {
        // Persist both name and email to the profiles table so the change
        // survives page reloads. The returned error MUST be checked:
        // supabase-js resolves with { error } instead of throwing, so
        // skipping this check toasted success even when the write was
        // rejected (e.g. before profiles.email existed in the schema).
        const { error } = await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("id", auth.user.id);
        if (error) throw error;
        // The database now holds the claimed domain, but the session in memory
        // does not: mirror it so the locked field, the domain badge and the
        // domain-scoped task list update on the spot instead of only after the
        // next reload re-reads the profile row.
        if (domain) {
          setAuth((prev) =>
            prev ? { ...prev, domain, user: { ...prev.user, domain } } : prev,
          );
        }
        pushToast(
          domain
            ? `Profile updated — you are now in the ${domain} domain.`
            : "Profile updated successfully!",
        );
      } catch (e) {
        console.warn("Profile update failed:", e);
        pushToast(
          `Could not save profile changes: ${e?.message || "database error"}`,
          "danger",
        );
      }
    },
    [auth?.user, pushToast],
  );

  // A coordinator maintaining the roster of their own domain — and the
  // super-admin maintaining everyone's. WHICH rows may be touched is the
  // database's decision ("Profiles update self or staff"), and WHICH columns
  // may change is the guard's (a domain may be set only while it is absent,
  // and only into a domain the caller can access), so this function does no
  // authorization of its own: it sends the change, mirrors it in local state,
  // and surfaces whatever the database says.
  const updateStudentProfile = useCallback(
    async (studentId, updates = {}) => {
      if (!studentId || !auth?.user) return false;

      const clean = {};
      if (updates.name !== undefined) clean.name = updates.name;
      if (updates.roll_no !== undefined) clean.roll_no = updates.roll_no;
      if (updates.branch !== undefined) clean.branch = updates.branch;
      if (updates.year !== undefined) clean.year = updates.year;
      // Only ever sent while the account has no domain: sending one on an
      // ordinary roster edit would turn a save into a refused domain change.
      if (updates.domain) clean.domain = updates.domain;
      if (Object.keys(clean).length === 0) return true;

      const applyLocally = () =>
        setStudents((prev) =>
          prev.map((row) => {
            if (row.id !== studentId) return row;
            return {
              ...row,
              ...(clean.name !== undefined ? { name: clean.name } : {}),
              ...(clean.roll_no !== undefined ? { rollNo: clean.roll_no } : {}),
              ...(clean.branch !== undefined ? { branch: clean.branch } : {}),
              ...(clean.year !== undefined ? { year: clean.year } : {}),
              ...(clean.domain !== undefined ? { domain: clean.domain } : {}),
            };
          }),
        );

      if (!isSupabaseConfigured) {
        applyLocally();
        pushToast(
          "Roster updated for this demo session (resets on reload).",
          "warning",
        );
        return true;
      }

      try {
        // The error MUST be checked: supabase-js resolves with { error }
        // instead of throwing, so skipping it would toast success on a
        // write the policy just rejected (e.g. assigning a student to a
        // domain this coordinator does not own).
        const { error } = await supabase
          .from("profiles")
          .update(clean)
          .eq("id", studentId);
        if (error) throw error;
        applyLocally();
        pushToast("Student record updated.");
        return true;
      } catch (e) {
        console.warn("Roster update failed:", e);
        pushToast(
          `Could not update student: ${e?.message || "database error"}`,
          "danger",
        );
        return false;
      }
    },
    [auth?.user, pushToast],
  );

  const openSubmissionFile = useCallback(
    async (submission) => {
      const fileUrl = submission?.fileUrl || submission?.file_url || "";

      if (!fileUrl) {
        pushToast("This submission has no uploaded file.", "warning");
        return;
      }
      if (!isSupabaseConfigured) {
        pushToast("Demo mode: files are not stored locally.", "warning");
        return;
      }
      // Legacy rows stored an external link here — open it safely as-is.
      if (!isStorageFileUrl(fileUrl)) {
        if (!openSafeUrl(fileUrl)) {
          pushToast("That file link is not safe to open.", "danger");
        }
        return;
      }

      // Signed URLs expire after an hour; the embedded object path never
      // does, so mint a fresh signed URL at click time.
      const path = extractStoragePath(fileUrl);
      if (!path) {
        pushToast("Could not read the file location.", "danger");
        return;
      }

      try {
        const { data, error } = await supabase.storage
          .from("task-submissions")
          .createSignedUrl(path, 60 * 60);
        if (error) throw error;
        if (!data?.signedUrl) throw new Error("No signed URL returned");
        openSafeUrl(data.signedUrl);
      } catch (err) {
        console.warn("Could not open submission file:", err);
        pushToast("Could not open the file. Please try again.", "danger");
      }
    },
    [pushToast],
  );

  const getStudent = useCallback(
    (id) => {
      // When a real backend is configured, only return data from the DB
      // (context state). Never fall back to mock data — it would show
      // phantom students that don't exist in the database.
      if (isSupabaseConfigured) {
        return students.find((s) => s.id === id) || null;
      }
      // Demo mode: fall back to mock data.
      return (
        students.find((s) => s.id === id) ||
        getMockStudentById(id) || {
          id: id || "s1",
          name: "Student",
          rollNo: "CS21B000",
          branch: "Computer Science",
          year: "3rd Year",
          avatarColor: "#7C3AED",
        }
      );
    },
    [students],
  );

  const getTask = useCallback(
    (id) => {
      // Same as getStudent: no mock fallback when the real backend is live.
      if (isSupabaseConfigured) {
        return tasks.find((t) => t.id === id) || null;
      }
      return (
        tasks.find((t) => t.id === id) ||
        getMockTaskById(id) ||
        TASKS.find((t) => t.id === id)
      );
    },
    [tasks],
  );

  const persistNotifRead = useCallback(
    async (id) => {
      const userId = auth?.user?.id;
      if (!userId || !isDbUuid(userId) || !isDbUuid(id)) return true; // local-only, no DB needed
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ read: true })
          .eq("id", id)
          .eq("user_id", userId);
        return !error;
      } catch (err) {
        console.warn("Failed to mark notification read:", err);
        return false;
      }
    },
    [auth?.user?.id],
  );

  const markNotifRead = useCallback(
    (role, id) => {
      // Optimistic update: mark as read in UI immediately.
      const setter = role === "student" ? setStudentNotifs : setAdminNotifs;
      setter((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );

      // Persist to DB; revert if it fails so UI stays in sync with DB.
      persistNotifRead(id).then((ok) => {
        if (!ok) {
          setter((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: false } : n)),
          );
        }
      });
    },
    [persistNotifRead],
  );

  const markAllNotifRead = useCallback(
    async (role) => {
      // Snapshot the current state so we can revert on DB failure.
      const setter = role === "student" ? setStudentNotifs : setAdminNotifs;
      let previousNotifs = [];
      setter((prev) => {
        previousNotifs = prev;
        return prev.map((n) => ({ ...n, read: true }));
      });

      const userId = auth?.user?.id;
      if (userId && isDbUuid(userId)) {
        try {
          const { error } = await supabase
            .from("notifications")
            .update({ read: true })
            .eq("user_id", userId)
            .eq("read", false);
          if (error) throw error;
        } catch (err) {
          console.warn("Failed to mark all notifications read:", err);
          // Revert to the snapshot so UI stays in sync with DB.
          setter(previousNotifs);
        }
      }
    },
    [auth?.user?.id],
  );

  const value = useMemo(
    () => ({
      auth,
      authReady,
      login,
      signup,
      logout,
      students,
      tasks,
      submissions,
      studentNotifs,
      adminNotifs,
      toasts,
      pushToast,
      dismissToast,
      createTask,
      updateTask,
      deleteTask,
      submitTask,
      reviewSubmission,
      removeSubmission,
      updateProfile,
      updateStudentProfile,
      openSubmissionFile,
      getStudent,
      getTask,
      markNotifRead,
      markAllNotifRead,
    }),
    [
      auth,
      authReady,
      login,
      signup,
      logout,
      students,
      tasks,
      submissions,
      studentNotifs,
      adminNotifs,
      toasts,
      pushToast,
      dismissToast,
      createTask,
      updateTask,
      deleteTask,
      submitTask,
      reviewSubmission,
      removeSubmission,
      updateProfile,
      updateStudentProfile,
      openSubmissionFile,
      getStudent,
      getTask,
      markNotifRead,
      markAllNotifRead,
    ],
  );

  return (
    <AppContext.Provider value={value}>{children}</AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
