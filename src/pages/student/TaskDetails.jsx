import React from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { CalendarDays, Award, Layers, CheckCircle2, ArrowLeft, ArrowRight, Github, Globe, Paperclip, MessageSquareText } from "lucide-react";
import { useApp } from "../../context/AppContext";
import StatusBadge from "../../components/StatusBadge";
import EmptyState from "../../components/EmptyState";
import { formatDate, formatDateTime, daysUntil, getLatestSubmission, getSubmissionStatusForTask, isOverdue } from "../../data/mockData";
import { sanitizeUrl } from "../../lib/sanitizeUrl";

const DIFFICULTY_COLOR = {
  Beginner: "text-emerald-400 bg-emerald-500/10",
  Intermediate: "text-amber-400 bg-amber-500/10",
  Advanced: "text-red-400 bg-red-500/10",
};

export default function TaskDetails() {
  const { id } = useParams();
  const { auth, tasks, submissions } = useApp();
  const task = tasks.find((t) => t.id === id);

  if (!task) return <Navigate to="/student/tasks" replace />;

  const studentId = auth?.user?.id || "s1";
  const status = getSubmissionStatusForTask(submissions, task.id, studentId);
  const latestSub = getLatestSubmission(submissions, task.id, studentId);
  const overdue = isOverdue(task.deadline, status);
  const days = daysUntil(task.deadline);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/student/tasks" className="inline-flex items-center gap-1.5 text-sm font-medium text-nexura-300 hover:text-nexura-200">
        <ArrowLeft className="w-4 h-4" /> Back to My Tasks
      </Link>

      <div className="card p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-nexura-400 mb-1.5">{task.category || "Web Development"}</p>
            <h1 className="font-display text-2xl font-bold text-white">{task.title}</h1>
          </div>
          <StatusBadge status={overdue && status === "not_submitted" ? "overdue" : status} />
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <span className="inline-flex items-center gap-1.5 text-sm text-slate bg-white/5 rounded-lg px-3 py-1.5">
            <CalendarDays className="w-4 h-4" /> Due {formatDate(task.deadline)}
          </span>
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 ${DIFFICULTY_COLOR[task.difficulty] || DIFFICULTY_COLOR.Intermediate}`}>
            <Layers className="w-4 h-4" /> {task.difficulty}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-slate bg-white/5 rounded-lg px-3 py-1.5">
            <Award className="w-4 h-4" /> {task.points} points
          </span>
          {status === "not_submitted" && (
            <span className={`text-sm font-medium ${overdue ? "text-red-400" : "text-nexura-300"}`}>
              {overdue ? `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}` : days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} left`}
            </span>
          )}
        </div>

        <div className="mt-6">
          <h3 className="font-display font-semibold text-white mb-2">Description</h3>
          <p className="text-sm text-slate leading-relaxed">{task.description}</p>
        </div>

        <div className="mt-6">
          <h3 className="font-display font-semibold text-white mb-3">Requirements</h3>
          <ul className="space-y-2.5">
            {(task.requirements || []).map((req, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate">
                <CheckCircle2 className="w-4 h-4 text-nexura-400 shrink-0 mt-0.5" />
                {req}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-7 pt-6 border-t border-white/10 flex flex-wrap items-center gap-3">
          {status === "not_submitted" || status === "rejected" ? (
            <Link to={`/student/tasks/${task.id}/submit`} className="btn-primary">
              {status === "rejected" ? "Resubmit Task" : "Submit Task"} <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link to={`/student/submissions/${latestSub?.id}`} className="btn-secondary">
              View Submission
            </Link>
          )}
        </div>
      </div>

      {status === "rejected" && latestSub?.feedback && (
        <div className="card p-6 border-l-4 border-l-red-500">
          <h3 className="font-display font-semibold text-white flex items-center gap-2 mb-2">
            <MessageSquareText className="w-4.5 h-4.5 text-red-500" /> Coordinator Feedback
          </h3>
          <p className="text-sm text-slate leading-relaxed">{latestSub.feedback}</p>
          <p className="text-xs text-slate/70 mt-3">Reviewed {formatDateTime(latestSub.reviewedAt)}</p>
        </div>
      )}

      {status !== "not_submitted" && latestSub && (
        <div className="card p-6">
          <h3 className="font-display font-semibold text-white mb-4">Your Submission</h3>
          <div className="space-y-3 text-sm">
            {latestSub.fileName && (
              <div className="flex items-center gap-2.5 text-slate">
                <Paperclip className="w-4 h-4 text-nexura-400 shrink-0" /> {latestSub.fileName}
              </div>
            )}
            {latestSub.githubUrl && (
              <div className="flex items-center gap-2.5 text-slate">
                <Github className="w-4 h-4 text-nexura-400 shrink-0" />
                <a href={sanitizeUrl(latestSub.githubUrl)} target="_blank" rel="noopener noreferrer" className="text-nexura-300 hover:underline truncate">{latestSub.githubUrl}</a>
              </div>
            )}
            {latestSub.liveUrl && (
              <div className="flex items-center gap-2.5 text-slate">
                <Globe className="w-4 h-4 text-nexura-400 shrink-0" />
                <a href={sanitizeUrl(latestSub.liveUrl)} target="_blank" rel="noopener noreferrer" className="text-nexura-300 hover:underline truncate">{latestSub.liveUrl}</a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
