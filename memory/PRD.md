# Studio PM - Project Management for Design Agency

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

## Test credentials (auto-seeded)
- Leadership: admin@studio.com / admin123
- Manager:    maya@studio.com / password123
- Team:       arjun@studio.com / password123
- Client:     client@acme.com / password123

## Tech
- Backend: FastAPI + Motor (MongoDB) + bcrypt + PyJWT + httpx
- Frontend: React 19 + React Router 7 + Tailwind + Shadcn primitives + lucide-react
- Fonts: Cabinet Grotesk (display) + General Sans (body) via Fontshare CDN

## P1/P2 backlog (next phases)
- Inline edit + drag-drop kanban
- File attachments + comments on tasks
- Real-time updates (websocket or polling)
- Marketing, Sales, Company, Financials modules
- Time tracking timer (start/stop) and timesheets
- Notifications (email + in-app)
- Two-factor auth, password reset flow
- Invoicing + retainer hour tracking (decrement against allocated)
- Calendar drag-to-create and recurring event materialization
