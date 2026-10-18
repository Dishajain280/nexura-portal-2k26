# Nexura Portal — UI/UX Transformation Vision

## Product Identity
**Nexura** is a student task management portal for a college technical club. It bridges students and coordinators through task assignment, submission, review, and feedback. The experience must feel **premium, trustworthy, motivating, and modern** — like the tooling top students and faculty would choose by preference, not obligation.

## Design Principles

### 1. Clarity over cleverness
The UI communicates structure instantly. Hierarchy is obvious. Students should never wonder "what do I do next?" Coordinators should never hunt for "which submission needs review?" We use whitespace, typography scale, color intent, and motion to guide attention — not decoration.

### 2. Motivating progression
This is a productivity tool. The UI should make progress feel visible and rewarding. Points earned, tasks approved, completion rates, streaks — these should feel like achievements, not just numbers. Celebrate wins subtly; make the "next action" always clear.

### 3. Calm confidence
Dark theme, but not gloomy. Rich surfaces, subtle depth, refined typography. Transitions are purposeful, not flashy. Every state (empty, loading, error, success) is handled with dignity. Loading is a skeleton that mirrors final layout; success is a moment; errors are helpful, not alarming.

### 4. Cohesive personality
One voice across all surfaces. The brand color (Nexura purple + accent fuchsia gradient) is used with restraint and intention — for CTAs, active states, accents, not for backgrounds everywhere. Iconography is consistent (Lucide, 1.5px stroke, coherent sizing). Typography is elegant and readable (Sora for display, Inter for body, JetBrains Mono for code/data).

### 5. Every screen earns its place
Each page has a primary job. The layout serves that job first. Dashboards surface the next actions and the state of the world. Detail pages focus on one thing and its context. Forms are tight and reassuring. Lists are scannable and actionable.

## Visual Direction

### Color system (refined from current)
- **Surface**: deep near-black base `#0B0614` (nexura-950), elevated panels `#150B27` (nexura-900) → `#1E1038` (nexura-800)
- **Brand accent**: Nexura purple `#7C3AED` → `#5B21B6` → `#3D1F6E`; CTA gradient `#7C3AED → #C026D3`
- **Semantic colors**: success `#10B981`, warning `#F59E0B`, danger `#EF4444`, info `#3B82F6`
- **Text**: white headings, `#9F67F5` (nexura-300) secondary, `#C7A8FA` (nexura-200) subtle labels, `#64748B` (slate) muted/metadata
- **Glass**: panels at `bg-white/[0.06]` with `backdrop-blur-xl` and `border-white/10`; interactive hover lifts to `bg-white/[0.09]` with brighter border

### Typography
- **Display**: Sora — used for headings, brand, big numbers, labels that need personality
- **Body**: Inter — for paragraphs, descriptions, table cells, nav items, input text
- **Mono**: JetBrains Mono — for code snippets, roll numbers, IDs, technical metadata
- Scale: 12 / 13 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 / 60px
- Body line-height 1.6; headings tighter 1.2–1.3

### Motion philosophy
- **Entrance**: content fades in + rises slightly (12–16px), staggered 50–80ms between cards/rows
- **Interactions**: 150ms ease for hover/active; 200ms for layout shifts; scale on press (0.98)
- **Feedback**: toast slides up from bottom-right; badge pulses subtly on unread; stat cards lift on hover
- **Reduced motion respected**: disables non-essential animation

### Spatial system
- Base unit 4px; spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- Card padding: 20–24px standard, 28–32px for featured surfaces
- Section gaps: 24–40px depending on density
- Max content width: 1280px centered; inner reading columns max 720–800px
- Sidebar: 280px wide, full height, sticky; collapses to overlay drawer on mobile

### Elevation and depth
- Cards: subtle shadow `0 4px 24px rgba(0,0,0,0.35)`, lift on hover to `0 8px 32px rgba(124,58,237,0.18)`
- Modals/dialogs: deeper shadow `0 20px 60px rgba(0,0,0,0.5)`
- Floating elements (toasts, dropdowns): shadow + rounded-xl, backdrop blur
- No heavy borders everywhere — borders used for grouping, not structure

## Layout Approach

### Public pages (Landing, Login, Signup)
- Centered, focused, editorial but modern
- Login/Signup: glass panel floating in space, clean form, brand mark above, single column, generous padding
- Landing: hero with headline + subhead + primary CTA + visual accent; feature grid; maybe social proof / stats band; footer minimal

### Student portal
- Sidebar + top header (sticky), content area scrollable
- Dashboard: welcome banner with greeting + personalized summary + next-action CTA; stat cards (total tasks, pending, approved, rejected) with icons and optional trend; progress overview (overall progress bar + brief context); upcoming deadlines list (deadline, status, quick link); recent activity timeline
- My Tasks: filter/search bar; task cards grid (category tag, title, description truncate, deadline, difficulty pill, points, status badge, hover to view details)
- Task Details: back link, header (title, category, status badge, deadline/difficulty/points chips), description, requirements checklist, submit/resubmit CTA prominent when eligible, past submission info when exists, coordinator feedback block when rejected
- Submit Task: form with file upload (drag-drop zone), GitHub URL, live URL, notes textarea, validation inline, submit button; resubmit shows previous feedback prominently
- My Submissions: filter/search; list/table of submissions with status, task, submitted date, links, quick actions
- Submission Details: task context, status badge, submitted work (file preview, GitHub link, live link), notes, feedback block, resubmit CTA when rejected
- Notifications: list of notifications with icon, title, message, time, read/unread state, mark all read
- Profile: avatar + name + role, account details form (name, roll, branch, year), contact info display, stats (points, tasks completed), member since

### Coordinator portal
- Same shell as student but with coordinator nav and role-aware content
- Dashboard: welcome banner with pending review count + "review now" CTA; stat cards (students, tasks, pending reviews, approved, rejected); recent submissions table (student, task, submitted, status, review action)
- Manage Tasks: search bar; task cards grid with title, description, deadline, assigned count, submission count, view submissions + delete actions; create task CTA prominent
- Create Task: form with title, category select, difficulty select, points, description textarea, deadline date picker, requirements dynamic list (add/remove), student assignment multi-select with avatars, validation, create button
- Students: search bar; student cards grid with avatar, name, roll, branch, year, joined date, stats (assigned, approved, pending)
- Submissions: search + status filter; table with student, task, submitted, links, status, actions (review, remove)
- Review Submission: student header (avatar, name, roll, branch), task info, submitted work (file preview, links, notes), previous feedback, approve/reject actions, remove action; approve needs confirm; reject requires feedback via modal
- Notifications: similar to student but coordinator notifications
- Profile: coordinator profile with avatar, name, role, contact, stats (students managed, tasks created, reviewed, approval rate)

## Component Standards

### Buttons
- Primary: gradient background, white text, rounded-xl, shadow-glow-purple, hover brightness 110%, active scale 0.98
- Secondary: transparent with border, hover fills subtly
- Ghost: text only with hover background
- Danger: red variant for destructive actions
- All buttons: consistent height (40px default), icon + label, loading state with spinner, disabled state

### Inputs
- Height 40px, rounded-lg, bg-white/5, border-white/15, focus border-nexura-300 with ring
- Label above, helper text below, error state with red border + message
- Textarea: resizable, same style
- Select: custom styled with chevron

### Cards
- Rounded-xl2 (1.25rem), background nexura-900/60 with backdrop blur, border white/10, shadow-card
- Interactive cards lift on hover with brighter border and deeper shadow
- Consistent padding 20–24px

### Tables
- Full width, hover row highlight, subtle borders, status badges inline
- Action column with icon buttons
- Empty state when no data

### Badges/Tags
- Rounded-full, small, with subtle background and text color
- Status colors: pending amber, approved emerald, rejected red, overdue red, not submitted neutral

### Feedback
- Toast: bottom-right stack, auto-dismiss, icon + message + close, color-coded by type
- Confirm dialog: modal with title, message, cancel/confirm buttons, danger variant for destructive
- Empty states: illustration area + title + helpful message + optional action
- Loading: skeleton screens matching content layout, not spinners everywhere

## Accessibility
- Focus visible styles (2px Nexura purple outline with offset)
- aria-labels on icon-only buttons
- Semantic HTML (nav, main, section, article, button vs div)
- Color not sole conveyor of meaning (icons + text + color)
- Keyboard navigable
- Reduced motion support

## Tone of Voice (microcopy)
- Warm but professional, encouraging but not childish
- "Welcome back, {name}" not "Hello user"
- "You have 3 submissions waiting for your review" not "Pending: 3"
- Button labels action-oriented: "View my tasks", "Submit work", "Review submission"
- Errors: explain what happened and what to do, not just "Error"
- Empty states: reassuring, suggest next step

## Conversion goals
For public pages:
- Clear value proposition above the fold
- Single primary action (Sign up / Log in) emphasized
- Low friction: pre-filled demo hints, clear password rules, the domain choice explained inline
- Trust signals: club name, purpose, what happens after signup

For logged-in students:
- Clear next task / next action
- Make submitting feel easy and rewarding
- Encourage completion and progress

For coordinators:
- Reduce review friction: see what needs attention fast
- Approve/reject from one place with context
- Manage tasks and students efficiently

## Quality bar
No rough edges:
- No clipped text, no overlapping elements
- Consistent spacing rhythm
- Consistent border radius
- Consistent icon sizes in context
- Consistent button heights
- Loading, empty, error, and zero-data states everywhere
- Mobile responsive (sidebar becomes drawer, grids collapse, tables scroll)
- No console errors
