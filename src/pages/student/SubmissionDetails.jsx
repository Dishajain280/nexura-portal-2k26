import React from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, Github, Globe, Paperclip, MessageSquareText, CalendarDays, RefreshCcw, ExternalLink } from "lucide-react";
import { useApp } from "../../context/AppContext";
import StatusBadge from "../../components/StatusBadge";
import { formatDateTime, getTaskById } from "../../data/mockData";
import { sanitizeUrl } from "../../lib/sanitizeUrl";
import { isStorageFileUrl, extractStoragePath } from "../../lib/submissionFile";
import SubmissionFilePreview from "../../components/SubmissionFilePreview";

export default function SubmissionDetails() {
  const { id } = useParams();
  const { submissions, getTask, openSubmissionFile } = useApp();
  const sub = submissions.find((s) => s.id === id);

  if (!sub) return <Navigate to="/student/submissions" replace />;
  const task = getTask(sub.taskId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link to="/student/submissions" className="inline-flex items-center gap-1.5 text-sm font-medium text-nexura-300 hover:text-nexura-200">
        <ArrowLeft className="w-4 h-4" /> Back to My Submissions
      </Link>

      <div className="card p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-nexura-400 mb-1.5">{task?.category}</p>
            <h1 className="font-display text-xl font-bold text-white">{task?.title || "Unknown task"}</h1>
          </div>
          <StatusBadge status={sub.status} />
        </div>

        <div className="flex items-center gap-4 mt-4 text-sm text-slate flex-wrap">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Submitted {formatDateTime(sub.submittedAt)}</span>
          {sub.attempt > 1 && <span className="text-nexura-400 font-medium">Attempt {sub.attempt}</span>}
        </div>          <div className="mt-6 space-y-3">
          <h3 className="font-display font-semibold text-white mb-1">Submitted Work</h3>

          {sub.fileName && (
            <SubmissionFilePreview
              fileName={sub.fileName}
              fileUrl={sub.fileUrl || sub.file_url || ""}
              storagePath={isStorageFileUrl(sub.fileUrl || sub.file_url || "") || sub.fileUrl ? extractStoragePath(sub.fileUrl || sub.file_url || "") : ""}
              onOpen={() => openSubmissionFile(sub)}
            />
          )}

          {sub.githubUrl && (
            <div className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm">
              <Github className="w-4 h-4 text-nexura-400 shrink-0" />
              <a href={sanitizeUrl(sub.githubUrl)} target="_blank" rel="noopener noreferrer" className="text-nexura-300 hover:underline truncate">{sub.githubUrl}</a>
            </div>
          )}
          {sub.liveUrl && (
            <div className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm">
              <Globe className="w-4 h-4 text-nexura-400 shrink-0" />
              <a href={sanitizeUrl(sub.liveUrl)} target="_blank" rel="noopener noreferrer" className="text-nexura-300 hover:underline truncate">{sub.liveUrl}</a>
            </div>
          )}
          {!sub.fileName && !sub.githubUrl && !sub.liveUrl && (
            <p className="text-sm text-slate">No attachments were submitted.</p>
          )}
        </div>

        {sub.notes && (
          <div className="mt-6">
            <h3 className="font-display font-semibold text-white mb-2">Your Notes</h3>
            <p className="text-sm text-slate leading-relaxed bg-white/5 rounded-lg p-4">{sub.notes}</p>
          </div>
        )}
      </div>

      {sub.status !== "pending" && sub.feedback && (
        <div className={`card p-6 border-l-4 ${sub.status === "approved" ? "border-l-emerald-500" : "border-l-red-500"}`}>
          <h3 className="font-display font-semibold text-white flex items-center gap-2 mb-2">
            <MessageSquareText className={`w-4.5 h-4.5 ${sub.status === "approved" ? "text-emerald-500" : "text-red-500"}`} /> Coordinator Feedback
          </h3>
          <p className="text-sm text-slate leading-relaxed">{sub.feedback}</p>
          <p className="text-xs text-slate/70 mt-3">Reviewed {formatDateTime(sub.reviewedAt)}</p>
        </div>
      )}

      {sub.status === "rejected" && task && (
        <Link to={`/student/tasks/${task.id}/submit`} className="btn-primary w-full sm:w-auto">
          <RefreshCcw className="w-4 h-4" /> Resubmit Task
        </Link>
      )}
    </div>
  );
}
