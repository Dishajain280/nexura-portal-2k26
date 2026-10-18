import React, { useMemo, useState } from "react";
import { Layers, Pencil, Search, Users } from "lucide-react";
import { useApp } from "../../context/AppContext";
import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import {
  DOMAINS,
  getAuthDomain,
  getDomainShortLabel,
} from "../../lib/domains";

// The filter value for accounts that have not chosen a domain yet. It is not
// a real slug, so it can never collide with one of the five.
const UNASSIGNED = "unassigned";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getSubmissionStatusForTask = (submissions, taskId, studentId) => {
  if (!Array.isArray(submissions)) return "pending";

  const match = submissions.find(
    (submission) =>
      submission.taskId === taskId &&
      submission.studentId === studentId,
  );

  return match?.status || "pending";
};

export default function Students() {
  const {
    students: contextStudents,
    tasks,
    submissions,
    auth,
    updateStudentProfile,
    pushToast,
  } = useApp();
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  // The row being edited, as a draft copy. Null when the dialog is closed —
  // the draft exists so cancelling simply discards it instead of mutating the
  // live student record field by field.
  const [draft, setDraft] = useState(null);

  // Null for the unscoped super-admin, who may place a student in any domain;
  // a domain coordinator may only place one in their own — the same rule the
  // database enforces, applied here so the form cannot offer a choice the
  // server would refuse.
  const callerDomain = getAuthDomain(auth);
  const assignableDomains = callerDomain
    ? DOMAINS.filter((domain) => domain.slug === callerDomain)
    : DOMAINS;

  const students = contextStudents.filter(
    (s) => !s.role || s.role === "student",
  );

  const domainCounts = useMemo(() => {
    const counts = { [UNASSIGNED]: 0 };
    students.forEach((student) => {
      const key = student.domain || UNASSIGNED;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [students]);

  const filterChips = useMemo(() => {
    const chips = [
      { value: "", label: "All domains", count: students.length },
    ];
    DOMAINS.forEach((domain) => {
      if (domainCounts[domain.slug]) {
        chips.push({
          value: domain.slug,
          label: getDomainShortLabel(domain.slug),
          count: domainCounts[domain.slug],
        });
      }
    });
    if (domainCounts[UNASSIGNED]) {
      chips.push({
        value: UNASSIGNED,
        label: "Unassigned",
        count: domainCounts[UNASSIGNED],
      });
    }
    // A roster that contains a single domain group gains nothing from a row
    // of chips that could only ever pick one thing.
    return chips.length > 2 ? chips : [];
  }, [domainCounts, students.length]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return students.filter((student) => {
      const matchesQuery =
        !term ||
        (student.name || "").toLowerCase().includes(term) ||
        (student.rollNo || "").toLowerCase().includes(term);
      const matchesDomain =
        !domainFilter ||
        (domainFilter === UNASSIGNED
          ? !student.domain
          : student.domain === domainFilter);
      return matchesQuery && matchesDomain;
    });
  }, [students, query, domainFilter]);

  const statsFor = (studentId) => {
    const assignedTasks = tasks.filter((task) => {
      const assigned = Array.isArray(task.assignedTo) ? task.assignedTo : [];
      return (
        assigned.length === 0 ||
        assigned.includes(studentId)
      );
    });

    const approved = assignedTasks.filter(
      (task) =>
        getSubmissionStatusForTask(submissions, task.id, studentId) ===
        "approved",
    ).length;

    const pending = assignedTasks.filter(
      (task) =>
        getSubmissionStatusForTask(submissions, task.id, studentId) ===
        "pending",
    ).length;

    return {
      total: assignedTasks.length,
      approved,
      pending,
    };
  };

  const openEditor = (student) =>
    setDraft({
      id: student.id,
      name: student.name || "",
      rollNo: student.rollNo || "",
      branch: student.branch || "",
      year: student.year || "",
      domain: student.domain || "",
      locked: Boolean(student.domain),
    });

  const handleSave = async (event) => {
    event.preventDefault();
    if (!draft?.name.trim()) {
      pushToast("A student's name cannot be empty.", "warning");
      return;
    }

    const payload = {
      name: draft.name.trim(),
      roll_no: draft.rollNo.trim(),
      branch: draft.branch.trim(),
      year: draft.year.trim(),
    };
    // Sent only while the student has no domain: the database accepts a
    // domain from staff exactly in that state and refuses it afterwards, so
    // resending a locked one would fail a save that changed nothing else.
    if (!draft.locked && draft.domain) payload.domain = draft.domain;

    const saved = await updateStudentProfile(draft.id, payload);
    if (saved) setDraft(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 w-full sm:w-80 shadow-sm">
        <Search className="w-4 h-4 text-slate shrink-0" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or roll number..."
          className="bg-transparent outline-none text-sm w-full placeholder:text-slate/60"
        />
      </div>

      {filterChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filterChips.map((chip) => {
            const active = domainFilter === chip.value;
            return (
              <button
                key={chip.value || "all"}
                type="button"
                onClick={() => setDomainFilter(chip.value)}
                className={
                  active
                    ? "text-xs rounded-full px-3 py-1.5 font-medium bg-cta-gradient text-white"
                    : "text-xs rounded-full px-3 py-1.5 font-medium bg-white/5 border border-white/10 text-slate hover:text-white hover:bg-white/10 transition-colors"
                }
              >
                {chip.label}{" "}
                <span className={active ? "text-white/80" : "text-slate/70"}>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title="No students found"
            message="Try a different search term."
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((student) => {
            const stats = statsFor(student.id);
            return (
              <div key={student.id} className="card p-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-display font-semibold shrink-0"
                    style={{
                      backgroundColor: student.avatarColor || "#7C3AED",
                    }}
                  >
                    {(student.name || "S").charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate">
                      {student.name}
                    </p>
                    <p className="text-xs text-slate truncate">
                      {student.rollNo}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditor(student)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    aria-label={`Edit ${student.name || "student"}`}
                    title="Edit student"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-3">
                  <span
                    className={
                      student.domain
                        ? "inline-flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1 bg-white/5 border border-white/10 text-nexura-200"
                        : "inline-flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1 bg-amber-400/10 border border-amber-400/20 text-amber-300"
                    }
                  >
                    <Layers className="w-3.5 h-3.5" />
                    {student.domain
                      ? getDomainShortLabel(student.domain) || student.domain
                      : "No domain yet"}
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-slate">
                  <div className="flex justify-between">
                    <span>Branch</span>
                    <span className="text-white font-medium">
                      {student.branch}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Year</span>
                    <span className="text-white font-medium">
                      {student.year}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Joined</span>
                    <span className="text-white font-medium">
                      {formatDate(student.joined)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                  <div className="flex-1 text-center">
                    <p className="font-display font-bold text-white">
                      {stats.total}
                    </p>
                    <p className="text-xs text-slate">Assigned</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="font-display font-bold text-emerald-400">
                      {stats.approved}
                    </p>
                    <p className="text-xs text-slate">Approved</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="font-display font-bold text-amber-400">
                      {stats.pending}
                    </p>
                    <p className="text-xs text-slate">Pending</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <Modal
          isOpen
          onClose={() => setDraft(null)}
          title="Edit student"
          footer={
            <>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-student-form"
                className="btn-primary"
              >
                Save changes
              </button>
            </>
          }
        >
          <form
            id="edit-student-form"
            onSubmit={handleSave}
            className="space-y-4"
          >
            <div>
              <label className="label-text">Full name</label>
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                className="input-field"
                required
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label-text">Roll number</label>
                <input
                  value={draft.rollNo}
                  onChange={(event) =>
                    setDraft({ ...draft, rollNo: event.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Year</label>
                <input
                  value={draft.year}
                  onChange={(event) =>
                    setDraft({ ...draft, year: event.target.value })
                  }
                  className="input-field"
                />
              </div>
            </div>
            <div>
              <label className="label-text">Branch</label>
              <input
                value={draft.branch}
                onChange={(event) =>
                  setDraft({ ...draft, branch: event.target.value })
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Domain</label>
              {draft.locked ? (
                <>
                  {/* Read-only: the database refuses a staff domain change on
                      a student who already has one, and a control that cannot
                      save only invites the mistake. */}
                  <div
                    className="input-field flex items-center gap-2 bg-white/5 cursor-not-allowed"
                    aria-readonly="true"
                  >
                    <Layers className="w-4 h-4 text-nexura-400 shrink-0" />
                    <span className="text-white">
                      {getDomainShortLabel(draft.domain) || draft.domain}
                    </span>
                  </div>
                  <p className="text-xs text-slate mt-1">
                    Locked once set — it is the club's to change, not the
                    student's or yours.
                  </p>
                </>
              ) : (
                <>
                  <select
                    value={draft.domain}
                    onChange={(event) =>
                      setDraft({ ...draft, domain: event.target.value })
                    }
                    className="input-field appearance-none"
                  >
                    <option value="">
                      Leave unassigned — the student can claim one
                    </option>
                    {assignableDomains.map((domain) => (
                      <option key={domain.slug} value={domain.slug}>
                        {domain.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate mt-1">
                    {callerDomain
                      ? "You can place an unassigned student into your own domain."
                      : "Choose the club domain this student belongs to."}
                  </p>
                </>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
