# Auth Testing Playbook (Studio PM)

## Custom Email/Password (JWT) Auth
Endpoints (prefixed with `/api/auth`):
- POST `/register` — body `{email, password, name, role}` (admin only for team roles)
- POST `/login` — body `{email, password}` → sets `access_token` + `refresh_token` httpOnly cookies + returns user JSON
- POST `/logout` — clears cookies
- GET `/me` — returns current user (uses cookie or Authorization Bearer)
- POST `/refresh` — refreshes access token using refresh cookie

### Test
```
API=https://creative-command-14.preview.emergentagent.com
curl -c c.txt -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@studio.com","password":"admin123"}'
curl -b c.txt $API/api/auth/me
```

### Seed users (auto-created on startup)
- admin@studio.com / admin123 — leadership
- maya@studio.com / password123 — manager
- arjun@studio.com / password123 — team
- client@acme.com / password123 — client

## Emergent Google OAuth
- Frontend builds redirect URL dynamically: `window.location.origin + '/dashboard'`
- After Google auth, browser lands at `…/dashboard#session_id=<id>`
- `AuthCallback` posts to `/api/auth/emergent-session` with the id; backend calls
  `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data` and creates/upserts the user,
  setting an httpOnly `session_token` cookie (7-day expiry).
- `/api/auth/me` validates either JWT access_token OR session_token cookie.

## Role-based access
- `leadership` / `manager` see Clients, Sales, Dashboard, Financials.
- `team` sees Tasks, Team, Marketing, Company (and shared pages).
- `client` only sees their assigned Projects + Calendar.
