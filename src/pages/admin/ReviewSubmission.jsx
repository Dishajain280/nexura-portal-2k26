import React, { useState } from "react";
import { useParams, useNavigate, Link, Navigate } from "react-router-dom";
import { ArrowLeft, Github, Globe, Paperclip, CalendarDays, CheckCircle2, XCircle, Trash2, FileText, ExternalLink } from "lucide-react";
import { useApp } from "../../context/AppContext";
import StatusBadge from "../../components/StatusBadge";
import Modal from "../../components/Modal";
import ConfirmDialog from "../../components/ConfirmDialog";
import { formatDateTime, getStudentById, getTaskById } from "../../data/mockData";
import { sanitizeUrl } from "../../lib/sanitizeUrl";
import SubmissionFilePreview from "../../components/SubmissionFilePreview";

export default function ReviewSubmission() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { submissions, reviewSubmission, removeSubmission, getStudent, getTask, openSubmissionFile } = useApp();
  const sub = submissions.find((s) => s.id === id);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!sub) return <Navigate to="/coordinator/submissions" replace />;

  const student = getStudent(sub.studentId);
  const task = getTask(sub.taskId);

  const handleApprove = () => {
    reviewSubmission(sub.id, "approved", "Great work — this meets all the requirements. Approved!");
    setConfirmApprove(false);
  };

  const handleReject = () => {
    if (!feedback.trim()) {
      setFeedbackError("Feedback is required so the student knows what to fix.");
      return;
    }
    reviewSubmission(sub.id, "rejected", feedback.trim());
    setRejectOpen(false);
    setFeedback("");
  };

  const handleRemove = () => {
    removeSubmission(sub.id);
    navigate("/coordinator/submissions");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/coordinator/submissions" className="inline-flex items-center gap-1.5 text-sm font-medium text-nexura-300 hover:text-nexura-200">
        <ArrowLeft className="w-4 h-4" /> Back to Submissions
      </Link>

      <div className="card p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-display font-semibold shrink-0"
              style={{ backgroundColor: student?.avatarColor || "#7C3AED" }}
            >
              {student?.name?.charAt(0) || "?"}
            </div>
            <div>
              <p className="font-display font-semibold text-white">{student?.name || "Unknown student"}</p>
              <p className="text-sm text-slate">{student?.rollNo} · {student?.branch}</p>
            </div>
          </div>
          <StatusBadge status={sub.status} />
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-xs font-semibold text-nexura-400 mb-1">{task?.category}</p>
          <h1 className="font-display text-xl font-bold text-white">{task?.title || "Unknown task"}</h1>
          <div className="flex items-center gap-4 mt-3 text-sm text-slate flex-wrap">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Submitted {formatDateTime(sub.submittedAt)}</span>
            {sub.attempt > 1 && <span className="text-nexura-400 font-medium">Attempt {sub.attempt}</span>}
          </div>
        </div>          <div className="mt-6 space-y-3">
          <h3 className="font-display font-semibold text-white">Submitted Work</h3>

          {(sub.fileName || sub.fileUrl || sub.file_url) && (
            <SubmissionFilePreview
              fileName={sub.fileName}
              fileUrl={sub.fileUrl || sub.file_url || ""}
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
          {!sub.fileName && !sub.githubUrl && !sub.liveUrl && <p className="text-sm text-slate">No attachments were submitted.</p>}
        </div>

        {sub.notes && (
        <div className="mt-6">
          <h3 className="font-display font-semibold text-white mb-2 flex items-center gap-2"><FileText className="w-4.5 h-4.5 text-nexura-400" /> Student Notes</h3>
          <p className="text-sm text-slate leading-relaxed bg-white/5 rounded-lg p-4">{sub.notes}</p>

          {sub.fileName && (
            <div className="mt-4 rounded-lg border border-white/10 px-4 py-3 flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2.5 text-nexura-100">
                <Paperclip className="w-4 h-4 text-nexura-400 shrink-0" />
                <span className="truncate">{sub.fileName}</span>
              </span>
              <button
                type="button"
                onClick={() => openSubmissionFile(sub)}
                className="shrink-0 text-nexura-300 hover:text-nexura-100 hover:underline flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open file
              </button>
            </div>
          )}
          </div>
        )}

        {sub.feedback && (
          <div className={`mt-6 rounded-lg p-4 border-l-4 ${sub.status === "approved" ? "border-l-emerald-500 bg-emerald-500/10" : "border-l-red-500 bg-red-500/10"}`}>
            <p className="text-sm font-semibold text-white mb-1">Feedback given</p>
            <p className="text-sm text-slate">{sub.feedback}</p>
          </div>
        )}

        <div className="mt-7 pt-6 border-t border-white/10 flex flex-wrap items-center gap-3">
          {sub.status === "pending" ? (
            <>
              <button onClick={() => setConfirmApprove(true)} className="btn-primary">
                <CheckCircle2 className="w-4 h-4" /> Approve Submission
              </button>
              <button onClick={() => setRejectOpen(true)} className="btn-danger">
                <XCircle className="w-4 h-4" /> Reject with Feedback
              </button>
            </>
          ) : (
            <p className="text-sm text-slate">This submission has already been reviewed. You can still remove it below.</p>
          )}
          <button onClick={() => setConfirmRemove(true)} className="btn-ghost text-sm ml-auto text-slate hover:text-red-400">
            <Trash2 className="w-4 h-4" /> Remove
          </button>
        </div>
      </div>

      <Modal
        isOpen={rejectOpen}
        onClose={() => { setRejectOpen(false); setFeedbackError(""); }}
        title="Reject Submission"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setRejectOpen(false)}>Cancel</button>
            <button className="btn-danger" onClick={handleReject}>Send Feedback & Reject</button>
          </>
        }
      >
        <label className="label-text">Feedback for {student?.name}</label>
        <textarea
          value={feedback}
          onChange={(e) => { setFeedback(e.target.value); if (feedbackError) setFeedbackError(""); }}
          rows={5}
          placeholder="Explain what needs to change before this can be approved..."
          className="input-field resize-none"
        />
        {feedbackError && <p className="text-xs text-red-400 mt-1">{feedbackError}</p>}
      </Modal>

      <ConfirmDialog
        isOpen={confirmApprove}
        onClose={() => setConfirmApprove(false)}
        onConfirm={handleApprove}
        title="Approve this submission?"
        message={`This will mark the submission from ${student?.name} as approved and notify them.`}
        confirmLabel="Approve"
      />

      <ConfirmDialog
        isOpen={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={handleRemove}
        title="Remove this submission?"
        message="This will permanently delete the submission record. This action cannot be undone."
        confirmLabel="Remove Submission"
        danger
      />
    </div>
  );
}
