import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  X,
  Send,
  Users,
  Code2,
  ChevronDown,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { DIFFICULTIES } from "../../data/mockData";

// Available categories for tasks (dropdown choices)
export const TASK_CATEGORIES = [
  "Technical domain",
  "Graphical domain",
  "PR and Management domain",
  "3D Animation and VFX domain",
  "Parametric Modelling and Simulation domain",
];

export default function CreateTask() {
  const { students, createTask } = useApp();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(TASK_CATEGORIES[0]);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[1]);
  const [points, setPoints] = useState(100);
  const [deadline, setDeadline] = useState("");
  const [requirements, setRequirements] = useState(["", ""]);
  const [assignedTo, setAssignedTo] = useState([]);
  const [errors, setErrors] = useState({});

  // Always sync assignedTo with the current students list. This ensures
  // that when DB data replaces mock data (after syncLiveData), the
  // assignedTo array contains real UUIDs — not mock IDs like "s1" which
  // would fail the DB's uuid[] column type.
  React.useEffect(() => {
    if (students && students.length > 0) {
      setAssignedTo(students.map((s) => s.id));
    }
  }, [students]);

  const updateRequirement = (i, value) => {
    setRequirements((prev) => prev.map((r, idx) => (idx === i ? value : r)));
  };
  const addRequirement = () => setRequirements((prev) => [...prev, ""]);
  const removeRequirement = (i) =>
    setRequirements((prev) => prev.filter((_, idx) => idx !== i));

  const toggleStudent = (id) => {
    setAssignedTo((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    setAssignedTo((prev) =>
      prev.length === students.length ? [] : students.map((s) => s.id),
    );
  };

  const validate = () => {
    const errs = {};
    if (!title.trim()) errs.title = "Title is required";
    if (!description.trim()) errs.description = "Description is required";
    if (!deadline) errs.deadline = "Deadline is required";
    if (assignedTo.length === 0)
      errs.assignedTo = "Assign at least one student";
    const reqs = requirements.filter((r) => r.trim());
    if (reqs.length === 0) errs.requirements = "Add at least one requirement";
    return errs;
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      console.log("[CreateTask] Submitting:", {
        title: title.trim(),
        assignedTo,
        deadline,
      });
      const result = await createTask({
        title: title.trim(),
        category: category.trim(),
        description: description.trim(),
        difficulty,
        points: Number(points),
        deadline,
        requirements: requirements.filter((r) => r.trim()),
        assignedTo,
      });
      console.log("[CreateTask] Result:", result);
      // Only navigate if the task was actually created (result is not null).
      // If createTask returns null, the DB insert failed and an error toast
      // was already shown — stay on the form so the user can retry.
      if (result) {
        navigate("/coordinator/tasks");
      }
    } catch (err) {
      setErrors({ form: err.message || "Failed to create task" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to="/coordinator/tasks"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-nexura-300 hover:text-nexura-200"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Manage Tasks
      </Link>

      <form onSubmit={handleSubmit} className="card p-6 sm:p-7 space-y-5">
        <div>
          <label className="label-text">Task title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Build a Responsive Portfolio Landing Page"
            className="input-field"
          />
          {errors.title && (
            <p className="text-xs text-red-400 mt-1">{errors.title}</p>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label-text">Category</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field appearance-none pr-10"
              >
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-nexura-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="label-text">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="input-field"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text">Points</label>
            <input
              type="number"
              min={0}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="label-text">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Describe the task in detail..."
            className="input-field resize-none"
          />
          {errors.description && (
            <p className="text-xs text-red-400 mt-1">{errors.description}</p>
          )}
        </div>

        <div>
          <label className="label-text">Deadline</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="input-field"
          />
          {errors.deadline && (
            <p className="text-xs text-red-400 mt-1">{errors.deadline}</p>
          )}
        </div>

        <div>
          <label className="label-text">Requirements</label>
          <div className="space-y-2.5">
            {requirements.map((req, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={req}
                  onChange={(e) => updateRequirement(i, e.target.value)}
                  placeholder={`Requirement ${i + 1}`}
                  className="input-field"
                />
                {requirements.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRequirement(i)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-slate hover:bg-red-500/10 hover:text-red-400 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addRequirement}
            className="btn-ghost text-sm mt-2.5 bg-white/5"
          >
            <Plus className="w-4 h-4" /> Add requirement
          </button>
          {errors.requirements && (
            <p className="text-xs text-red-400 mt-1">{errors.requirements}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <label className="label-text flex items-center gap-2 mb-0">
              <Users className="w-4 h-4 text-nexura-400" /> Assign to students
            </label>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-semibold text-nexura-300 hover:text-nexura-200"
            >
              {assignedTo.length === students.length
                ? "Deselect all"
                : "Select all"}
            </button>
          </div>
          <div className="border border-white/10 rounded-xl divide-y divide-white/5 max-h-64 overflow-y-auto">
            {students.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={assignedTo.includes(s.id)}
                  onChange={() => toggleStudent(s.id)}
                  className="w-4 h-4 rounded accent-nexura-500"
                />
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                  style={{ backgroundColor: s.avatarColor }}
                >
                  {s.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {s.name}
                  </p>
                  <p className="text-xs text-slate truncate">
                    {s.rollNo} · {s.branch}
                  </p>
                </div>
              </label>
            ))}
          </div>
          {errors.assignedTo && (
            <p className="text-xs text-red-400 mt-1">{errors.assignedTo}</p>
          )}
        </div>

        {errors.form && (
          <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3.5 py-2.5">
            {errors.form}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full py-3"
        >
          {submitting ? (
            "Creating Task..."
          ) : (
            <>
              Create & Assign Task <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
