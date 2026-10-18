// Central mock dataset for the Nexura portal. Frontend-only, in-memory.

// `domain` mirrors what the profiles table holds in production, where every
// account carries the domain it belongs to (chosen at signup or assigned by a
// coordinator). The offline roster previously left the field off every row, so
// the Students page showed the whole club as "No domain yet" and the
// unassigned filter matched everyone — an offline demo that misrepresents what
// the coordinator actually sees.
//
// s1 is deliberately left WITHOUT one: it is the demo student's own row, and
// the one-time domain claim on the profile page needs an unassigned account to
// be reachable offline.
export const STUDENTS = [
  { id: "s1", name: "Aarav Mehta", email: "aarav.mehta@nexura.club", rollNo: "CS21B045", branch: "Computer Science", year: "3rd Year", avatarColor: "#7C3AED", joined: "2024-08-12" },
  { id: "s2", name: "Diya Kapoor", email: "diya.kapoor@nexura.club", rollNo: "CS21B012", branch: "Computer Science", year: "3rd Year", avatarColor: "#C026D3", joined: "2024-08-12", domain: "graphical" },
  { id: "s3", name: "Rohan Iyer", email: "rohan.iyer@nexura.club", rollNo: "EC21B078", branch: "Electronics", year: "3rd Year", avatarColor: "#5B21B6", joined: "2024-09-02", domain: "technical" },
  { id: "s4", name: "Ananya Sharma", email: "ananya.sharma@nexura.club", rollNo: "IT21B033", branch: "Information Tech", year: "2nd Year", avatarColor: "#9F67F5", joined: "2024-09-15", domain: "pr_management" },
  { id: "s5", name: "Kabir Singh", email: "kabir.singh@nexura.club", rollNo: "CS22B091", branch: "Computer Science", year: "2nd Year", avatarColor: "#E879F9", joined: "2025-01-10", domain: "animation_vfx" },
  { id: "s6", name: "Meera Nair", email: "meera.nair@nexura.club", rollNo: "CS21B056", branch: "Computer Science", year: "3rd Year", avatarColor: "#7C3AED", joined: "2024-08-20", domain: "parametric" },
];

export const CURRENT_STUDENT_ID = "s1";

export const ADMIN_USER = {
  id: "a1",
  name: "Prof. Sameer Rao",
  email: "sameer.rao@nexura.club",
  role: "Faculty Coordinator",
  avatarColor: "#5B21B6",
};

export const TASKS = [
  {
    id: "t1",
    title: "Build a Responsive Portfolio Landing Page",
    category: "Web Development",
    description:
      "Design and build a single-page personal portfolio using HTML, CSS and vanilla JS (or React). It must include a hero section, projects grid, and a contact form. Focus on responsiveness and accessibility.",
    requirements: [
      "Mobile-first responsive layout",
      "At least 3 project cards with hover states",
      "Working contact form (client-side validation only)",
      "Deployed link (Vercel/Netlify/GitHub Pages)",
    ],
    deadline: "2026-09-25",
    createdAt: "2026-08-10",
    difficulty: "Intermediate",
    points: 100,
    assignedTo: ["s1", "s2", "s3", "s4", "s5", "s6"],
  },
  {
    id: "t2",
    title: "Implement a REST API for a Task Tracker",
    category: "Backend Development",
    description:
      "Create a REST API using Node.js/Express (or Django/Flask) with CRUD endpoints for tasks. Include basic validation and a Postman collection for testing.",
    requirements: [
      "CRUD endpoints for /tasks",
      "Input validation with meaningful error responses",
      "README with setup instructions",
      "Postman/Insomnia collection exported to repo",
    ],
    deadline: "2026-09-20",
    createdAt: "2026-08-05",
    difficulty: "Advanced",
    points: 150,
    assignedTo: ["s1", "s2", "s6"],
  },
  {
    id: "t3",
    title: "UI/UX Case Study: Redesign a Campus App",
    category: "Design & Animation",
    description:
      "Pick any existing campus utility (canteen, library, attendance) and produce a short case study redesigning its UI. Include wireframes and a Figma prototype link.",
    requirements: [
      "Problem statement and user pain points",
      "Low-fidelity wireframes",
      "High-fidelity Figma prototype link",
      "Before/after comparison",
    ],
    deadline: "2026-09-18",
    createdAt: "2026-08-01",
    difficulty: "Beginner",
    points: 80,
    assignedTo: ["s1", "s3", "s4", "s5"],
  },
  {
    id: "t4",
    title: "Git & GitHub Workflow Challenge",
    category: "Tech & Tools",
    description:
      "Fork the Nexura sample repo, create a feature branch, resolve the seeded merge conflict, and open a PR following the club's contribution guidelines.",
    requirements: [
      "Forked repository link",
      "At least 3 meaningful commits",
      "Resolved merge conflict",
      "Open pull request following template",
    ],
    deadline: "2026-09-30",
    createdAt: "2026-08-02",
    difficulty: "Beginner",
    points: 60,
    assignedTo: ["s1", "s2", "s3", "s4", "s5", "s6"],
  },
  {
    id: "t5",
    title: "Data Structures: Visualize a Graph Traversal",
    category: "Tech & Tools",
    description:
      "Build a small web app that visualizes BFS and DFS traversal on a user-defined graph. Prioritize clarity of animation over visual complexity.",
    requirements: [
      "Interactive graph input (nodes & edges)",
      "Step-by-step BFS animation",
      "Step-by-step DFS animation",
      "Short write-up on time complexity",
    ],
    deadline: "2026-10-10",
    createdAt: "2026-08-15",
    difficulty: "Advanced",
    points: 150,
    assignedTo: ["s1", "s6"],
  },
];

// Submission statuses: "not_submitted" | "pending" | "approved" | "rejected"
export const SUBMISSIONS = [
  {
    id: "sub1",
    taskId: "t2",
    studentId: "s1",
    status: "pending",
    submittedAt: "2026-08-20T10:15:00",
    fileName: "task-tracker-api.zip",
    githubUrl: "https://github.com/aaravmehta/task-tracker-api",
    liveUrl: "",
    notes: "Implemented all CRUD routes, added Joi validation. README included.",
    feedback: "",
    reviewedAt: null,
    attempt: 1,
  },
  {
    id: "sub2",
    taskId: "t3",
    studentId: "s1",
    status: "approved",
    submittedAt: "2026-08-14T18:40:00",
    fileName: "campus-app-case-study.pdf",
    githubUrl: "",
    liveUrl: "https://figma.com/proto/campus-canteen-redesign",
    notes: "Focused on the canteen ordering flow. Reduced steps from 6 to 3.",
    feedback: "Excellent problem framing and clean wireframes. Loved the before/after comparison. Great work!",
    reviewedAt: "2026-08-16T09:00:00",
    attempt: 1,
  },
  {
    id: "sub3",
    taskId: "t4",
    studentId: "s1",
    status: "rejected",
    submittedAt: "2026-08-16T14:20:00",
    fileName: "git-workflow-screenshot.png",
    githubUrl: "https://github.com/aaravmehta/nexura-sample-fork",
    liveUrl: "",
    notes: "Resolved the conflict and opened the PR.",
    feedback: "The merge conflict resolution looks correct, but the PR description doesn't follow the club template — please add the checklist sections and link the related issue before resubmitting.",
    reviewedAt: "2026-08-17T11:30:00",
    attempt: 1,
  },
  {
    id: "sub4",
    taskId: "t2",
    studentId: "s2",
    status: "approved",
    submittedAt: "2026-08-19T09:00:00",
    fileName: "task-api-diya.zip",
    githubUrl: "https://github.com/diyakapoor/rest-task-api",
    liveUrl: "",
    notes: "Used Express + MongoDB. Postman collection in /docs.",
    feedback: "Clean structure, good error handling. Approved.",
    reviewedAt: "2026-08-21T08:10:00",
    attempt: 1,
  },
  {
    id: "sub5",
    taskId: "t4",
    studentId: "s2",
    status: "pending",
    submittedAt: "2026-08-21T16:45:00",
    fileName: "",
    githubUrl: "https://github.com/diyakapoor/nexura-sample-fork",
    liveUrl: "",
    notes: "PR opened, following the template this time.",
    feedback: "",
    reviewedAt: null,
    attempt: 1,
  },
  {
    id: "sub6",
    taskId: "t3",
    studentId: "s3",
    status: "rejected",
    submittedAt: "2026-08-13T12:00:00",
    fileName: "library-redesign.pdf",
    githubUrl: "",
    liveUrl: "https://figma.com/proto/library-app-redesign",
    notes: "Redesigned the book search and reservation flow.",
    feedback: "Good direction, but the case study is missing a clear problem statement and user research section. Please add those and resubmit.",
    reviewedAt: "2026-08-15T10:00:00",
    attempt: 1,
  },
  {
    id: "sub7",
    taskId: "t4",
    studentId: "s3",
    status: "approved",
    submittedAt: "2026-08-15T08:30:00",
    fileName: "",
    githubUrl: "https://github.com/rohaniyer/nexura-sample-fork",
    liveUrl: "",
    notes: "3 commits, conflict resolved cleanly.",
    feedback: "Nicely done, clean commit history.",
    reviewedAt: "2026-08-16T09:45:00",
    attempt: 1,
  },
  {
    id: "sub8",
    taskId: "t1",
    studentId: "s4",
    status: "pending",
    submittedAt: "2026-08-22T20:10:00",
    fileName: "portfolio-build.zip",
    githubUrl: "https://github.com/ananyasharma/portfolio",
    liveUrl: "https://ananya-portfolio.vercel.app",
    notes: "Used React + Tailwind. Fully responsive down to 320px.",
    feedback: "",
    reviewedAt: null,
    attempt: 1,
  },
  {
    id: "sub9",
    taskId: "t4",
    studentId: "s6",
    status: "approved",
    submittedAt: "2026-08-14T11:00:00",
    fileName: "",
    githubUrl: "https://github.com/meeranair/nexura-sample-fork",
    liveUrl: "",
    notes: "",
    feedback: "Solid work, well documented commits.",
    reviewedAt: "2026-08-15T09:20:00",
    attempt: 1,
  },
];

export const NOTIFICATIONS_STUDENT = [
  { id: "n1", type: "approved", title: "Submission approved", message: "Your submission for 'UI/UX Case Study: Redesign a Campus App' was approved.", time: "2026-08-16T09:00:00", read: false, link: "/student/submissions/sub2" },
  { id: "n2", type: "rejected", title: "Changes requested", message: "Your submission for 'Git & GitHub Workflow Challenge' needs changes before it can be approved.", time: "2026-08-17T11:30:00", read: false, link: "/student/submissions/sub3" },
  { id: "n3", type: "task", title: "New task assigned", message: "'Data Structures: Visualize a Graph Traversal' has been assigned to you. Due Oct 10.", time: "2026-08-15T09:00:00", read: true, link: "/student/tasks/t5" },
  { id: "n4", type: "reminder", title: "Deadline approaching", message: "'Build a Responsive Portfolio Landing Page' is due on Sep 25.", time: "2026-08-28T09:00:00", read: true, link: "/student/tasks/t1" },
  { id: "n5", type: "pending", title: "Submission received", message: "We've received your submission for 'Implement a REST API for a Task Tracker'. It's pending review.", time: "2026-08-20T10:15:00", read: true, link: "/student/submissions/sub1" },
];

export const NOTIFICATIONS_ADMIN = [
  { id: "an1", type: "pending", title: "New submission", message: "Aarav Mehta submitted 'Implement a REST API for a Task Tracker'.", time: "2026-08-20T10:15:00", read: false, link: "/coordinator/submissions/sub1" },
  { id: "an2", type: "pending", title: "New submission", message: "Ananya Sharma submitted 'Build a Responsive Portfolio Landing Page'.", time: "2026-08-22T20:10:00", read: false, link: "/coordinator/submissions/sub8" },
  { id: "an3", type: "pending", title: "New submission", message: "Diya Kapoor submitted 'Git & GitHub Workflow Challenge'.", time: "2026-08-21T16:45:00", read: false, link: "/coordinator/submissions/sub5" },
  { id: "an4", type: "task", title: "Task deadline soon", message: "'Git & GitHub Workflow Challenge' deadline is Sep 30 with 2 students yet to submit.", time: "2026-08-16T09:00:00", read: true, link: "/coordinator/tasks" },
  { id: "an5", type: "info", title: "New member joined", message: "Kabir Singh joined Nexura and was added to the roster.", time: "2026-01-10T09:00:00", read: true, link: "/coordinator/students" },
];

export const CATEGORIES = ["Web Development", "Backend Development", "Design & Animation", "Graphics & Design", "PR & Management", "Tech & Tools"];
export const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];

// ---- Helpers ----
export function getStudentById(id) {
  return STUDENTS.find((s) => s.id === id);
}

export function getTaskById(id) {
  return TASKS.find((t) => t.id === id);
}

export function getSubmissionStatusForTask(submissions, taskId, studentId) {
  const subs = submissions
    .filter((s) => s.taskId === taskId && s.studentId === studentId)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  if (subs.length === 0) return "not_submitted";
  return subs[0].status;
}

export function getLatestSubmission(submissions, taskId, studentId) {
  const subs = submissions
    .filter((s) => s.taskId === taskId && s.studentId === studentId)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  return subs[0] || null;
}

// Parse a date value for display/comparison. Date-only strings ("2026-10-01")
// are treated as LOCAL midnight; full timestamps parse as-is. Plain
// `new Date("2026-10-01")` parses as UTC midnight, which shifts the calendar
// date by a day for timezones west of UTC.
const toLocalDate = (value) => {
  if (!value) return null;
  const str = String(value);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(str)
    ? new Date(`${str}T00:00:00`)
    : new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
};

// "Now" as local calendar midnight, so day counts are whole days.
const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export function isOverdue(deadline, status) {
  if (status === "approved") return false;
  const d = toLocalDate(deadline);
  return !!d && d < startOfToday();
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = toLocalDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  const d = toLocalDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function timeAgo(dateStr) {
  const now = new Date();
  const then = toLocalDate(dateStr);
  if (!then) return "—";
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

export function daysUntil(dateStr) {
  const target = toLocalDate(dateStr);
  if (!target) return 0;
  const diff = Math.ceil((target - startOfToday()) / (1000 * 60 * 60 * 24));
  return diff;
}
