# Everything OS - Project Management for Design Agency

## Original problem
Build a project management for a design agency with team (regular team member, manager, leadership) and clients. Left sidebar with role-gated tabs: Calendar, Tasks, Projects, Team, Clients, Marketing, Sales, Company, Dashboard, Financials, Login/Profile.

## Phase 1 (implemented)
- Auth: JWT email/password + Emergent Google OAuth (combined)
- Role-based sidebar (leadership/manager/team/client)
- Calendar with project/company/recurring/personal events + leaves
- Tasks (list + kanban) with subtasks, recurring, time tracking, status, assignees, filters, search
- Projects (grid/list/gantt) with billable/retainer/non-billable types, brief/scope, members, deliverables, public share toggle
- Project detail with Overview/Tasks/Calendar/Team tabs (tasks support list+kanban+gantt)
- Team database with stats (tasks open, hours, leaves), filters, in-office/remote, add member
- Clients with companies + contacts + linked projects
- Dashboard: project + team Gantt timelines with today marker, leaves overlay
- Public project share link `/public/projects/:token`
- CSV export for projects, tasks, users, clients, events, leaves
- Seed data: 6 team members + 1 client user, 3 clients, 4 projects, 14 tasks + 2 recurring, 4 events, 3 leaves
- Marketing/Sales/Company/Financials scaffolded as access-controlled placeholders
- Profile page with editable name/title/team/avatar

## Test credentials
No pre-seeded test accounts. Create your account via signup.


## Tech
- Backend: FastAPI + Motor (MongoDB) + bcrypt + PyJWT + httpx
- Frontend: React 19 + React Router 7 + Tailwind + Shadcn primitives + lucide-react
- Fonts: Cabinet Grotesk (display) + General Sans (body) via Fontshare CDN

## Phase 3 (delivered)
- New default landing **Home** page: my open tasks, this-week events, my projects, plus a "Log time off" action
- Calendar events are now clickable → open a populated EventFormModal (edit/delete)
- Recurring events have a frequency dropdown: daily / weekly / bi-weekly / monthly / yearly
- Tasks page:
  - "Only my tasks" toggle, default **ON**
  - Subtasks (create + list + delete) inside the task drawer
  - Both Original deadline and Latest deadline / Completion date as separate fields
  - Task category (free-text with autocomplete from existing categories) + category column + filter
- Timesheets: removed "business days" helper text
- Projects:
  - Type labels: Billable Project / Billable Account / Non-Billable Project
  - Status labels: Pitch / Upcoming / Ongoing / Complete / Hold / Cancelled (with colors)
  - Full Edit Project modal — every field editable
  - Owner / Manager role tags on team members (multi-person allowed for each)
  - Inside Project Detail: Add Task / Add Event buttons, click events to edit, Client Contacts shown under Team
- New shared **GanttTimeline** component:
  - Cleaner header (month band + day band, weekend tint)
  - Vertical "today" line + dedicated **Today** recenter button
  - Drag bar BODY = MOVE only (no expand) — fixed the move-vs-expand bug
  - Drag BOTH left and right edges to resize (anchored opposite edge)
  - Used on Projects gantt, Project Detail task gantt, Dashboard project timeline
- Team page rebuilt:
  - Columns trimmed to Member / Team / Title / Status
  - Row click → side panel with Joined / Birthday / Projects / Leaves / stats
  - Edit pencil opens a Member edit modal (full field editing)

## P2/P3 backlog (next phases)
- File attachments on tasks/projects (object storage)
- Email notifications integration (Resend/SendGrid) layered onto in-app notif system
- Real-time push via SSE or websocket (currently 20s polling for notifications)
- Marketing, Sales, Company, Financials modules
- Two-factor auth, password reset flow
- Invoicing + retainer hour tracking (decrement against allocated)
- Calendar drag-to-create and recurring event materialization
- Optimistic local updates on drag operations (reduce round-trips)

## Phase 2 (delivered)
- Comments on tasks + projects + events with @mentions (suggestions + parsing)
- Per-user real-time timer with sidebar widget, auto-stops previous timer
- Timesheets page with weekly view, KPIs, per-task aggregation, team scope for managers
- Manual time entries from task drawer
- In-app notifications (bell + dropdown + polling): task assigned, status changed, comment, mention, project status/health changed
- HTML5 drag-and-drop Kanban (Tasks page + ProjectDetail) — persists status
- Drag-to-edit Gantt bars (move + right-edge resize) on Projects + ProjectDetail task gantts
- Task detail drawer (right-side panel) with inline edit, assignee toggles, time entries, comments
- Sidebar wiring: notification bell in header, timer bar above profile