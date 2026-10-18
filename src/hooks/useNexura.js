import supabase, { isSupabaseConfigured } from "../supabaseClient";
import { isUniversityEmail } from "../lib/roleGuard";
import { getAuthCallbackUrl } from "../lib/authRedirect";

// Real Supabase users have UUID ids; demo/local fallback users do not.
const isDbUuid = (value = "") =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value),
  );

export async function signUpUser(email, password, name, domain = null) {
  if (!isUniversityEmail(email))
    throw new Error("Only .com university emails are allowed");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        // The student's club domain, chosen on the signup form. The database
        // trigger validates this against the five known slugs and ignores
        // anything else: it is metadata, not an authorization decision, so a
        // forged value buys nothing beyond a domain the account may pick at
        // signup anyway.
        domain: domain || null,
      },
      // When the project requires email confirmation, the link in that email
      // has to come back to a route this app actually serves. Without this it
      // fell back to the provider's Site URL and dumped the user on the public
      // landing page, signed in but with no explanation. /auth/callback already
      // completes the exchange and routes by the account's real role, so the
      // confirmation path now lands somewhere that works.
      emailRedirectTo: getAuthCallbackUrl(),
    },
  });

  if (error) {
    // Surface the provider message (e.g. email already in use) instead of
    // inventing our own — the UI already renders form.errors.form.
    throw error;
  }

  if (!data?.user) {
    throw new Error("Signup succeeded but no user was returned.");
  }

  return data;
}

export async function loginUser(email, password) {
  // Strict credential verification: supabase.auth.signInWithPassword validates
  // the email/password pair server-side and returns an AuthApiError (e.g.
  // "Invalid login credentials") when they do not match. That error is
  // propagated to the caller untouched — never swallowed.
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  if (!data?.user) throw new Error("Invalid login credentials");
  if (!data?.user?.email) throw new Error("Invalid login credentials");
  return data;
}

export async function fetchTasks(domain = null) {
  let query = supabase
    .from("tasks")
    .select("*")
    .order("deadline", { ascending: true });

  // Defence in depth. The row-level policies already scope this, so on a
  // correctly migrated database the filter changes nothing — it just means the
  // app requests only what it can render instead of asking for every row and
  // relying on the server to discard most of them.
  if (domain) query = query.eq("domain", domain);

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
}

export async function createTask(taskData) {
  // Role gate: only coordinators/admins may create tasks. The lookup is
  // wrapped in its own try-catch so network errors during the role check
  // don't crash the app — but an explicit authorization denial must always
  // propagate so the caller sees the error.
  let isAuthorized = false;
  try {
    const { data: userData } = await supabase.auth.getUser();
    console.log("[createTask] getUser:", userData?.user?.id);
    if (userData?.user?.id) {
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();

      console.log("[createTask] profile:", profile, "error:", profileErr);
      const role = profile?.role || "student";
      if (["admin", "coordinator", "Faculty Coordinator"].includes(role)) {
        isAuthorized = true;
      }
    }
  } catch (err) {
    console.warn("[createTask] Role lookup failed:", err);
  }

  console.log("[createTask] isAuthorized:", isAuthorized);

  // Fail closed: when a real Supabase backend is configured the DB path
  // below is mandatory. A missing coordinator profile or a failed role lookup
  // means "do not create the task" — never silently fall back to local state,
  // because that would make a coordinator think the task was persisted when it
  // was only added to this browser's in-memory list.
  if (!isSupabaseConfigured) {
    // Unconfigured builds are the only safe local-only creation path. In that
    // mode there is no backend to contradict the UI, so a synthetic task is
    // the correct behavior for demo/development.
    return {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: taskData.title?.trim() || "Untitled Task",
      description: taskData.description?.trim() || "",
      deadline: taskData.deadline || new Date().toISOString(),
      points: Number(taskData.points || 10),
      category: taskData.category || "General",
      domain: taskData.domain || null,
      difficulty: taskData.difficulty || "Medium",
      requirements: Array.isArray(taskData.requirements)
        ? taskData.requirements
        : [],
      assigned_to: Array.isArray(taskData.assignedTo)
        ? taskData.assignedTo
        : [],
      created_at: new Date().toISOString(),
    };
  }

  // Parse the deadline date and set it to end-of-day (23:59:59) so the
  // DB CHECK (deadline > now()) constraint doesn't reject same-day deadlines.
  const deadline = new Date(taskData.deadline);
  if (Number.isNaN(deadline.getTime())) {
    throw new Error("Invalid task deadline date");
  }
  deadline.setHours(23, 59, 59, 999);

  const payload = {
    title: taskData.title?.trim() || "Untitled Task",
    description: taskData.description?.trim() || "",
    deadline: deadline.toISOString(),
    points: Number(taskData.points || 10),
    category: taskData.category || "General",
    // Sent explicitly rather than left for the database trigger to fill: the
    // trigger still has the final say (and rejects a domain the caller cannot
    // reach), but an explicit value keeps the row's intent visible in the
    // request and surfaces a mismatch immediately.
    domain: taskData.domain || null,
    difficulty: taskData.difficulty || "Medium",
    requirements: Array.isArray(taskData.requirements)
      ? taskData.requirements
      : [],
    assigned_to: Array.isArray(taskData.assignedTo) ? taskData.assignedTo : [],
  };

  console.log("[createTask] Payload:", JSON.stringify(payload, null, 2));
  console.log("[createTask] assigned_to type check:", payload.assigned_to.map((id) => ({ id, valid: isDbUuid(id) })));

  const { data, error } = await supabase
    .from("tasks")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("[createTask] Supabase error:", error.message, error.code, error.details, error.hint);
    throw error;
  }
  console.log("[createTask] Success:", data);
  return data;
}

export async function submitTask(file, taskId, studentId, metadata = {}) {
  if (!file) throw new Error("File is required");

  const folder = `${studentId}`;
  const path = `${folder}/${taskId}/${studentId}-${Date.now()}-${file.name.replace(/\s+/g, "-")}`;

  const { error: uploadError } = await supabase.storage
    .from("task-submissions")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("task-submissions")
    .createSignedUrl(path, 60 * 60 * 24);

  if (signedUrlError) throw signedUrlError;

  // Check if a submission already exists for this student+task pair
  const { data: existingSubmission, error: checkError } = await supabase
    .from("submissions")
    .select("id")
    .eq("student_id", studentId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (checkError && checkError.code !== "PGRST116") throw checkError;

  let result;

  if (existingSubmission?.id) {
    // Update existing submission (resubmission)
    const { data, error } = await supabase
      .from("submissions")
      .update({
        file_url: signedUrlData.signedUrl,
        github_url: metadata.githubUrl || "",
        live_url: metadata.liveUrl || "",
        notes: metadata.notes || "",
        attempt: metadata.attempt || 1,
        // created_at drives the "Submitted" timestamp shown in the UI, so a
        // resubmission must advance it to now.
        created_at: new Date().toISOString(),
        status: "pending",
      })
      .eq("id", existingSubmission.id)
      .select()
      .single();

    if (error) throw error;
    result = data;
  } else {
    // Insert new submission
    const { data, error } = await supabase
      .from("submissions")
      .insert([
        {
          student_id: studentId,
          task_id: taskId,
          file_url: signedUrlData.signedUrl,
          github_url: metadata.githubUrl || "",
          live_url: metadata.liveUrl || "",
          notes: metadata.notes || "",
          attempt: metadata.attempt || 1,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (error) throw error;
    result = data;
  }

  return result;
}

export async function fetchLeaderboard() {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      name,
      role,
      submissions (
        status,
        tasks (points)
      )
    `,
    )
    .eq("role", "student");

  if (error) throw error;

  return (data ?? [])
    .map((profile) => {
      const points = (profile.submissions ?? [])
        .filter((submission) => submission.status === "approved")
        .reduce((sum, submission) => sum + (submission.tasks?.points ?? 0), 0);

      return {
        studentId: profile.id,
        name: profile.name,
        points,
      };
    })
    .filter((entry) => entry.points > 0)
    .sort((a, b) => b.points - a.points);
}

export default {
  signUpUser,
  loginUser,
  fetchTasks,
  createTask,
  submitTask,
  fetchLeaderboard,
};
