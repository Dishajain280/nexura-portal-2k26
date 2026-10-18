import React, { useMemo, useState } from "react";
import { Mail, ShieldCheck, CalendarDays, Users, ListChecks, Save } from "lucide-react";
import { useApp } from "../../context/AppContext";

export default function Profile() {
  const { auth, students, tasks, submissions, updateProfile } = useApp();
  const admin = auth?.user || { name: "Prof. Sameer Rao", email: "sameer.rao@nexura.club", role: "Faculty Coordinator", avatarColor: "#5B21B6" };
  const [name, setName] = useState(admin.name || "");
  const [email, setEmail] = useState(admin.email || "");

  const stats = useMemo(() => {
    const approved = submissions.filter((s) => s.status === "approved").length;
    const reviewed = submissions.filter((s) => s.status !== "pending").length;
    return { approved, reviewed, totalStudents: students.length, totalTasks: tasks.length };
  }, [students, tasks, submissions]);

  const handleSave = (e) => {
    e.preventDefault();
    updateProfile(name.trim(), email.trim());
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="card p-6 sm:p-7 flex items-center gap-5 flex-wrap">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-display font-bold shrink-0"
          style={{ backgroundColor: admin.avatarColor || "#5B21B6" }}
        >
          {(admin.name || "A").charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl font-bold text-white">{admin.name || "Coordinator"}</h1>
          <p className="text-sm text-slate flex items-center gap-1.5 mt-0.5"><ShieldCheck className="w-4 h-4 text-nexura-400" /> {admin.role || "Coordinator"}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-display font-semibold text-white mb-4">Account Details</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="label-text">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label-text">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
            </div>
            <button type="submit" className="btn-primary w-full">
              <Save className="w-4 h-4" /> Save changes
            </button>
            <p className="text-xs text-slate mt-2">Coordinator details are managed by the team.</p>
          </form>
        </div>

        <div className="card p-6 space-y-4">
          <h3 className="font-display font-semibold text-white mb-1">Coordinator Stats</h3>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-nexura-400 shrink-0" />
            <span className="text-slate">Email</span>
            <span className="ml-auto font-medium text-white truncate">{admin.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Users className="w-4 h-4 text-nexura-400 shrink-0" />
            <span className="text-slate">Students managed</span>
            <span className="ml-auto font-medium text-white">{stats.totalStudents}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <ListChecks className="w-4 h-4 text-nexura-400 shrink-0" />
            <span className="text-slate">Tasks created</span>
            <span className="ml-auto font-medium text-white">{stats.totalTasks}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CalendarDays className="w-4 h-4 text-nexura-400 shrink-0" />
            <span className="text-slate">Submissions reviewed</span>
            <span className="ml-auto font-medium text-white">{stats.reviewed}</span>
          </div>
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-sm">
            <span className="text-slate">Approval rate</span>
            <span className="font-display font-bold text-nexura-300">
              {stats.reviewed > 0 ? Math.round((stats.approved / stats.reviewed) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
