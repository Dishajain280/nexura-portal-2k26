import React, { useMemo, useState } from "react";
import { Mail, Hash, GraduationCap, CalendarDays, Award, CheckCircle2, Save, Layers } from "lucide-react";
import { useApp } from "../../context/AppContext";
import ProgressBar from "../../components/ProgressBar";
import { SkeletonCard } from "../../components/Skeleton";import { formatDate, getSubmissionStatusForTask } from "../../data/mockData";
import { DOMAINS, getAuthDomain, getDomainLabel } from "../../lib/domains";
export default function Profile() {
  const { auth, tasks, submissions, updateProfile, openSubmissionFile } = useApp();
  const student = auth?.user || { name: "Student", email: "student@nexura.club", rollNo: "CS21B045", branch: "Computer Science", year: "3rd Year", joined: "2024-08-12", avatarColor: "#7C3AED" };
  const [name, setName] = useState(student.name || "");
  const [email, setEmail] = useState(student.email || "");
  const [rollNo, setRollNo] = useState(student.rollNo || "");
  const [branch, setBranch] = useState(student.branch || "");
  const [year, setYear] = useState(student.year || "");
  // The domain is not an ordinary editable field: it is chosen once and then
  // owned by the club. It is read through the shared accessor so this page and
  // the coordinator badge cannot disagree about which level of the session
  // carries it.
  const studentDomain = getAuthDomain(auth);
  const [domain, setDomain] = useState("");
  const claimingDomain = !studentDomain;
  const studentId = student.id || "s1";
  const myTasks = useMemo(
    () => tasks.filter((t) => !t.assignedTo || t.assignedTo.length === 0 || t.assignedTo.includes(studentId)),
    [tasks, studentId]
  );
  const approved = myTasks.filter((t) => getSubmissionStatusForTask(submissions, t.id, studentId) === "approved");
  const points = approved.reduce((sum, t) => sum + (t.points || 0), 0);

  if (!auth) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <SkeletonCard />
        <div className="grid sm:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const handleSave = (e) => {
    e.preventDefault();
    updateProfile(name.trim(), email.trim(), {
      roll_no: rollNo.trim(),
      branch: branch.trim(),
      year: year.trim(),
      // Sent only while the account has no domain. The database accepts a domain
      // from a student exactly once — afterwards it is the club's to change — so
      // including it on an ordinary save would turn "Save changes" into an error.
      ...(claimingDomain && domain ? { domain } : {}),
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="card p-6 sm:p-7 flex items-center gap-5 flex-wrap">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-display font-bold shrink-0"
          style={{ backgroundColor: student.avatarColor || "#7C3AED" }}
        >
          {(student.name || "S").charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl font-bold text-white">{student.name || "Student"}</h1>
          <p className="text-sm text-slate">{student.rollNo || "N/A"} · {student.branch || "N/A"}</p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 text-nexura-200 rounded-xl px-4 py-2.5">
          <Award className="w-4.5 h-4.5" />
          <span className="font-display font-bold">{points}</span>
          <span className="text-sm">points earned</span>
        </div>
      </div>

      {claimingDomain && (
        // An account with no domain matches no domain-scoped row, so every task
        // list looks empty. Saying so beats letting the portal look broken.
        <div className="card p-5 border-l-4 border-l-nexura-400">
          <div className="flex items-start gap-3">
            <Layers className="w-5 h-5 text-nexura-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold text-sm">
                You don&apos;t have a domain yet
              </p>
              <p className="text-sm text-slate mt-1">
                Tasks, submissions and notifications are organised by club domain. Choose
                yours under <span className="text-nexura-200">Account Details</span> to see
                your tasks. It can be selected once — ask a coordinator later if it is wrong.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-display font-semibold text-white mb-4">Account Details</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="label-text">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label-text">Roll number</label>
              <input value={rollNo} onChange={(e) => setRollNo(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label-text">Branch</label>
              <input value={branch} onChange={(e) => setBranch(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label-text">Year</label>
              <input value={year} onChange={(e) => setYear(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label-text">Domain</label>
              {claimingDomain ? (
                <>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="input-field appearance-none"
                  >
                    <option value="">Select your club domain…</option>
                    {DOMAINS.map((d) => (
                      <option key={d.slug} value={d.slug}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate mt-1">
                    Tasks and submissions are organised by domain. Choose carefully — this
                    can only be set once.
                  </p>
                </>
              ) : (
                <>
                  {/* Read-only once set: the database refuses a change from here, and a
                      dropdown that cannot save only invited the mistake. */}
                  <div
                    className="input-field flex items-center gap-2 bg-white/5 cursor-not-allowed"
                    aria-readonly="true"
                  >
                    <Layers className="w-4 h-4 text-nexura-400 shrink-0" />
                    <span className="text-white">{getDomainLabel(studentDomain) || studentDomain}</span>
                  </div>
                  <p className="text-xs text-slate mt-1">
                    Set by the club — ask a coordinator if this is wrong.
                  </p>
                </>
              )}
            </div>
            <div>
              <label className="label-text">Email</label>
              <input value={email} readOnly className="input-field bg-white/5 cursor-not-allowed" />
              <p className="text-xs text-slate mt-1">Managed by your account — cannot be changed here.</p>
            </div>
            <button type="submit" className="btn-primary w-full">
              <Save className="w-4 h-4" /> Save changes
            </button>
          </form>
        </div>

        <div className="card p-6 space-y-4">
          <h3 className="font-display font-semibold text-white mb-1">Club Information</h3>
          <div className="flex items-center gap-3 text-sm">
            <Hash className="w-4 h-4 text-nexura-400 shrink-0" />
            <span className="text-slate">Roll number</span>
            <span className="ml-auto font-medium text-white">{student.rollNo}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <GraduationCap className="w-4 h-4 text-nexura-400 shrink-0" />
            <span className="text-slate">Branch & year</span>
            <span className="ml-auto font-medium text-white">{student.branch}, {student.year}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-nexura-400 shrink-0" />
            <span className="text-slate">Email</span>
            <span className="ml-auto font-medium text-white truncate">{student.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Layers className="w-4 h-4 text-nexura-400 shrink-0" />
            <span className="text-slate">Domain</span>
            <span className="ml-auto font-medium text-white truncate">
              {getDomainLabel(studentDomain) || "Not assigned"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CalendarDays className="w-4 h-4 text-nexura-400 shrink-0" />
            <span className="text-slate">Member since</span>
            <span className="ml-auto font-medium text-white">{formatDate(student.joined)}</span>
          </div>

          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-slate flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-nexura-400" /> Task completion</span>
            </div>
            <ProgressBar value={approved.length} max={myTasks.length || 1} showLabel={false} />
            <p className="text-xs text-slate mt-1.5">{approved.length} of {myTasks.length} tasks approved</p>
          </div>
        </div>
      </div>
    </div>
  );
}
