"""Studio PM — FastAPI backend (single-file for MVP).

Implements:
- JWT email/password auth + Emergent Google OAuth (session_token cookie)
- Users, Teams, Clients, Projects, Tasks (with subtasks), Events, Leaves
- Public project share links + CSV exports
- Seed data on startup
"""

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import csv
import uuid
import logging
import secrets
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from fastapi.responses import StreamingResponse, JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ---------- Configuration ----------
JWT_ALG = "HS256"
ACCESS_TTL = timedelta(minutes=60 * 8)   # 8h working session for a SaaS tool
REFRESH_TTL = timedelta(days=7)
SESSION_TTL = timedelta(days=7)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Studio PM")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("studiopm")

# ---------- Helpers ----------
def new_id() -> str:
    return uuid.uuid4().hex

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str) -> str:
    return jwt.encode(
        {"sub": user_id, "email": email, "type": "access",
         "exp": now_utc() + ACCESS_TTL},
        jwt_secret(), algorithm=JWT_ALG,
    )

def create_refresh_token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "type": "refresh", "exp": now_utc() + REFRESH_TTL},
        jwt_secret(), algorithm=JWT_ALG,
    )

def set_auth_cookies(resp: Response, access: str, refresh: str) -> None:
    resp.set_cookie("access_token", access, httponly=True, secure=True,
                    samesite="none", max_age=int(ACCESS_TTL.total_seconds()), path="/")
    resp.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                    samesite="none", max_age=int(REFRESH_TTL.total_seconds()), path="/")

def set_session_cookie(resp: Response, session_token: str) -> None:
    resp.set_cookie("session_token", session_token, httponly=True, secure=True,
                    samesite="none", max_age=int(SESSION_TTL.total_seconds()), path="/")

def clear_auth_cookies(resp: Response) -> None:
    for k in ("access_token", "refresh_token", "session_token"):
        resp.delete_cookie(k, path="/")

def public_user(u: dict) -> dict:
    u = {k: v for k, v in u.items() if k not in ("_id", "password_hash")}
    return u

# ---------- Auth dependency ----------
async def get_current_user(request: Request) -> dict:
    # Try JWT access_token cookie or Bearer header
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if token:
        try:
            payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALG])
            if payload.get("type") == "access":
                u = await db.users.find_one({"id": payload["sub"]})
                if u:
                    return public_user(u)
        except jwt.PyJWTError:
            pass

    # Try Emergent session_token cookie
    st = request.cookies.get("session_token")
    if st:
        sess = await db.user_sessions.find_one({"session_token": st})
        if sess:
            exp = sess["expires_at"]
            if isinstance(exp, str):
                exp = datetime.fromisoformat(exp)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp >= now_utc():
                u = await db.users.find_one({"id": sess["user_id"]})
                if u:
                    return public_user(u)

    raise HTTPException(status_code=401, detail="Not authenticated")

def require_roles(*roles: str):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return checker

# ---------- Models ----------
Role = Literal["leadership", "manager", "team", "client"]

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Role = "team"
    title: Optional[str] = None
    team: Optional[str] = None
    in_office: Optional[bool] = True
    joining_date: Optional[str] = None
    birthday: Optional[str] = None
    client_id: Optional[str] = None
    avatar: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class EmergentSessionIn(BaseModel):
    session_id: str

class TeamIn(BaseModel):
    name: str
    color: Optional[str] = "#0A0A0A"

class ClientIn(BaseModel):
    company: str
    contacts: Optional[List[dict]] = []
    location: Optional[str] = None

class ProjectMember(BaseModel):
    user_id: str
    role: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class ProjectIn(BaseModel):
    name: str
    type: Literal["billable_regular", "billable_retainer", "non_billable"] = "billable_regular"
    status: str = "planning"
    priority: str = "medium"
    health: str = "on_track"
    lead_source: Optional[str] = None
    brief: Optional[str] = None
    scope: Optional[str] = None
    client_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    hours_allocated: Optional[float] = None
    service_deliverables: Optional[List[str]] = []
    teams_involved: Optional[List[str]] = []
    members: Optional[List[ProjectMember]] = []

class TaskIn(BaseModel):
    name: str
    project_id: Optional[str] = None
    parent_task_id: Optional[str] = None
    estimated_hours: Optional[float] = 0
    time_spent: Optional[float] = 0
    original_deadline: Optional[str] = None
    latest_deadline: Optional[str] = None
    completion_date: Optional[str] = None
    category: Optional[str] = None
    status: str = "todo"
    assignees: Optional[List[str]] = []
    is_recurring: Optional[bool] = False
    recurrence_rule: Optional[str] = None

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    project_id: Optional[str] = None
    parent_task_id: Optional[str] = None
    estimated_hours: Optional[float] = None
    time_spent: Optional[float] = None
    original_deadline: Optional[str] = None
    latest_deadline: Optional[str] = None
    completion_date: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    assignees: Optional[List[str]] = None
    is_recurring: Optional[bool] = None
    recurrence_rule: Optional[str] = None

class EventIn(BaseModel):
    name: str
    date: str
    end_date: Optional[str] = None
    time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    attendees: Optional[List[str]] = []
    type: Literal["project", "company", "recurring", "personal"] = "project"
    project_id: Optional[str] = None
    recurrence_rule: Optional[str] = None

class LeaveIn(BaseModel):
    user_id: str
    start_date: str
    end_date: str
    type: Optional[str] = "vacation"
    note: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    team: Optional[str] = None
    in_office: Optional[bool] = None
    joining_date: Optional[str] = None
    birthday: Optional[str] = None
    avatar: Optional[str] = None
    role: Optional[Role] = None

# ---------- Auth endpoints ----------
@api.post("/auth/register")
async def register(data: RegisterIn, response: Response, current=Depends(get_current_user)):
    # Only leadership/manager can register new users via this endpoint
    if current["role"] not in ("leadership", "manager"):
        raise HTTPException(status_code=403, detail="Only managers can create accounts")
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": data.role,
        "title": data.title,
        "team": data.team,
        "in_office": data.in_office,
        "joining_date": data.joining_date,
        "birthday": data.birthday,
        "client_id": data.client_id,
        "avatar": data.avatar,
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    return public_user(doc)


@api.post("/auth/login")
async def login(data: LoginIn, response: Response):
    email = data.email.lower()
    u = await db.users.find_one({"email": email})
    if not u or not u.get("password_hash") or not verify_password(data.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access = create_access_token(u["id"], u["email"])
    refresh = create_refresh_token(u["id"])
    set_auth_cookies(response, access, refresh)
    return public_user(u)


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    st = request.cookies.get("session_token")
    if st:
        await db.user_sessions.delete_one({"session_token": st})
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    rt = request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(rt, jwt_secret(), algorithms=[JWT_ALG])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    u = await db.users.find_one({"id": payload["sub"]})
    if not u:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(u["id"], u["email"])
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=int(ACCESS_TTL.total_seconds()), path="/")
    return {"ok": True}


@api.post("/auth/emergent-session")
async def emergent_session(data: EmergentSessionIn, response: Response):
    """Exchange Emergent session_id for our session_token cookie."""
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": data.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    info = r.json()
    email = info["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        # New Google user — default to team role
        user = {
            "id": new_id(),
            "email": email,
            "name": info.get("name", email.split("@")[0]),
            "role": "team",
            "avatar": info.get("picture"),
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user)
    else:
        if info.get("picture") and not user.get("avatar"):
            await db.users.update_one({"id": user["id"]}, {"$set": {"avatar": info["picture"]}})
            user["avatar"] = info["picture"]

    session_token = info["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user["id"],
        "session_token": session_token,
        "expires_at": (now_utc() + SESSION_TTL).isoformat(),
        "created_at": now_utc().isoformat(),
    })
    set_session_cookie(response, session_token)
    return public_user(user)


# ---------- Users / Team ----------
@api.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    users = await db.users.find({}).to_list(1000)
    return [public_user(u) for u in users]


@api.get("/users/{user_id}")
async def get_user(user_id: str, user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return public_user(u)


@api.patch("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, user: dict = Depends(get_current_user)):
    if user["role"] not in ("leadership", "manager") and user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        u = await db.users.find_one({"id": user_id})
        return public_user(u) if u else {}
    if user["role"] not in ("leadership", "manager") and "role" in update:
        update.pop("role")
    await db.users.update_one({"id": user_id}, {"$set": update})
    u = await db.users.find_one({"id": user_id})
    return public_user(u)


# ---------- Teams ----------
@api.get("/teams")
async def list_teams(user: dict = Depends(get_current_user)):
    return await db.teams.find({}, {"_id": 0}).to_list(1000)


@api.post("/teams")
async def create_team(data: TeamIn, user: dict = Depends(require_roles("leadership", "manager"))):
    doc = {"id": new_id(), **data.model_dump(), "created_at": now_utc().isoformat()}
    await db.teams.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------- Clients ----------
@api.get("/clients")
async def list_clients(user: dict = Depends(require_roles("leadership", "manager"))):
    return await db.clients.find({}, {"_id": 0}).to_list(1000)


@api.post("/clients")
async def create_client(data: ClientIn, user: dict = Depends(require_roles("leadership", "manager"))):
    doc = {"id": new_id(), **data.model_dump(), "created_at": now_utc().isoformat()}
    await db.clients.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/clients/{client_id}")
async def update_client(client_id: str, data: ClientIn, user: dict = Depends(require_roles("leadership", "manager"))):
    await db.clients.update_one({"id": client_id}, {"$set": data.model_dump()})
    c = await db.clients.find_one({"id": client_id}, {"_id": 0})
    return c


@api.delete("/clients/{client_id}")
async def delete_client(client_id: str, user: dict = Depends(require_roles("leadership", "manager"))):
    await db.clients.delete_one({"id": client_id})
    return {"ok": True}


# ---------- Projects ----------
def _visible_projects_filter(user: dict) -> dict:
    if user["role"] == "client":
        return {"client_id": user.get("client_id")}
    return {}


@api.get("/projects")
async def list_projects(user: dict = Depends(get_current_user)):
    flt = _visible_projects_filter(user)
    return await db.projects.find(flt, {"_id": 0}).to_list(1000)


@api.post("/projects")
async def create_project(data: ProjectIn, user: dict = Depends(require_roles("leadership", "manager"))):
    doc = {"id": new_id(), **data.model_dump(),
           "share_token": secrets.token_urlsafe(16),
           "public_enabled": False,
           "created_at": now_utc().isoformat()}
    await db.projects.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    p = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    if user["role"] == "client" and p.get("client_id") != user.get("client_id"):
        raise HTTPException(status_code=403, detail="Forbidden")
    return p


@api.patch("/projects/{project_id}")
async def update_project(project_id: str, data: ProjectIn, user: dict = Depends(require_roles("leadership", "manager"))):
    await db.projects.update_one({"id": project_id}, {"$set": data.model_dump()})
    p = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return p


@api.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(require_roles("leadership", "manager"))):
    await db.projects.delete_one({"id": project_id})
    await db.tasks.delete_many({"project_id": project_id})
    await db.events.delete_many({"project_id": project_id})
    return {"ok": True}


@api.post("/projects/{project_id}/toggle-public")
async def toggle_public(project_id: str, user: dict = Depends(require_roles("leadership", "manager"))):
    p = await db.projects.find_one({"id": project_id})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    enabled = not p.get("public_enabled", False)
    token = p.get("share_token") or secrets.token_urlsafe(16)
    await db.projects.update_one({"id": project_id},
                                 {"$set": {"public_enabled": enabled, "share_token": token}})
    return {"public_enabled": enabled, "share_token": token}


# Public (unauthenticated) project view
@api.get("/public/projects/{share_token}")
async def public_project(share_token: str):
    p = await db.projects.find_one({"share_token": share_token, "public_enabled": True}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found or not public")
    tasks = await db.tasks.find({"project_id": p["id"]}, {"_id": 0}).to_list(1000)
    events = await db.events.find({"project_id": p["id"]}, {"_id": 0}).to_list(1000)
    members = []
    for m in p.get("members", []) or []:
        u = await db.users.find_one({"id": m.get("user_id")})
        if u:
            members.append({"user_id": u["id"], "name": u["name"], "role": m.get("role"),
                            "avatar": u.get("avatar"), "title": u.get("title")})
    client_doc = None
    if p.get("client_id"):
        client_doc = await db.clients.find_one({"id": p["client_id"]}, {"_id": 0})
    return {"project": p, "tasks": tasks, "events": events, "members": members, "client": client_doc}


# ---------- Tasks ----------
@api.get("/tasks")
async def list_tasks(
    project_id: Optional[str] = None,
    assignee_id: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = {}
    if project_id:
        q["project_id"] = project_id
    if assignee_id:
        q["assignees"] = assignee_id
    if status:
        q["status"] = status
    if user["role"] == "client":
        # clients see no tasks (not allowed)
        raise HTTPException(status_code=403, detail="Forbidden")
    tasks = await db.tasks.find(q, {"_id": 0}).to_list(2000)
    return tasks


@api.post("/tasks")
async def create_task(data: TaskIn, user: dict = Depends(require_roles("leadership", "manager", "team"))):
    doc = {"id": new_id(), **data.model_dump(),
           "created_by": user["id"], "created_at": now_utc().isoformat()}
    await db.tasks.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/tasks/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, user: dict = Depends(require_roles("leadership", "manager", "team"))):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.tasks.update_one({"id": task_id}, {"$set": update})
    t = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    return t


@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: dict = Depends(require_roles("leadership", "manager", "team"))):
    await db.tasks.delete_one({"id": task_id})
    await db.tasks.delete_many({"parent_task_id": task_id})
    return {"ok": True}


# ---------- Events ----------
@api.get("/events")
async def list_events(user: dict = Depends(get_current_user)):
    q: dict = {}
    if user["role"] == "client":
        # clients see only events of their projects + company events
        projects = await db.projects.find({"client_id": user.get("client_id")}, {"id": 1, "_id": 0}).to_list(1000)
        ids = [p["id"] for p in projects]
        q = {"$or": [{"type": "company"}, {"project_id": {"$in": ids}}]}
    return await db.events.find(q, {"_id": 0}).to_list(2000)


@api.post("/events")
async def create_event(data: EventIn, user: dict = Depends(require_roles("leadership", "manager", "team"))):
    doc = {"id": new_id(), **data.model_dump(),
           "created_by": user["id"], "created_at": now_utc().isoformat()}
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/events/{event_id}")
async def update_event(event_id: str, data: EventIn, user: dict = Depends(require_roles("leadership", "manager", "team"))):
    await db.events.update_one({"id": event_id}, {"$set": data.model_dump()})
    e = await db.events.find_one({"id": event_id}, {"_id": 0})
    return e


@api.delete("/events/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(require_roles("leadership", "manager", "team"))):
    await db.events.delete_one({"id": event_id})
    return {"ok": True}


# ---------- Leaves ----------
@api.get("/leaves")
async def list_leaves(user: dict = Depends(get_current_user)):
    if user["role"] == "client":
        return []
    return await db.leaves.find({}, {"_id": 0}).to_list(2000)


@api.post("/leaves")
async def create_leave(data: LeaveIn, user: dict = Depends(require_roles("leadership", "manager", "team"))):
    doc = {"id": new_id(), **data.model_dump(), "created_at": now_utc().isoformat()}
    await db.leaves.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/leaves/{leave_id}")
async def delete_leave(leave_id: str, user: dict = Depends(require_roles("leadership", "manager", "team"))):
    await db.leaves.delete_one({"id": leave_id})
    return {"ok": True}


# ---------- Dashboard (project + team gantt) ----------
@api.get("/dashboard/gantt")
async def dashboard_gantt(user: dict = Depends(require_roles("leadership", "manager"))):
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    users = await db.users.find({"role": {"$ne": "client"}}, {"_id": 0}).to_list(1000)
    leaves = await db.leaves.find({}, {"_id": 0}).to_list(1000)
    # team member assignment ranges from project.members
    member_blocks = []
    for p in projects:
        for m in p.get("members", []) or []:
            member_blocks.append({
                "user_id": m.get("user_id"),
                "project_id": p["id"],
                "project_name": p["name"],
                "start_date": m.get("start_date") or p.get("start_date"),
                "end_date": m.get("end_date") or p.get("end_date"),
                "type": "project",
            })
    return {
        "projects": projects,
        "users": [public_user(u) for u in users],
        "leaves": leaves,
        "member_blocks": member_blocks,
    }


# ---------- CSV Export ----------
@api.get("/export/{resource}.csv")
async def export_csv(resource: str, user: dict = Depends(get_current_user)):
    if resource not in ("projects", "tasks", "users", "clients", "events", "leaves"):
        raise HTTPException(status_code=404, detail="Unknown resource")
    # Clients can only export their own projects + events; everything else is team-only.
    if user["role"] == "client" and resource not in ("projects", "events"):
        raise HTTPException(status_code=403, detail="Forbidden")
    if resource == "clients" and user["role"] not in ("leadership", "manager"):
        raise HTTPException(status_code=403, detail="Forbidden")

    coll = getattr(db, resource)
    flt = {}
    if user["role"] == "client":
        if resource == "projects":
            flt = {"client_id": user.get("client_id")}
        elif resource == "events":
            owned = await db.projects.find({"client_id": user.get("client_id")}, {"id": 1, "_id": 0}).to_list(1000)
            ids = [p["id"] for p in owned]
            flt = {"$or": [{"type": "company"}, {"project_id": {"$in": ids}}]}
    rows = await coll.find(flt, {"_id": 0}).to_list(5000)
    if not rows:
        rows = [{"info": "No data"}]
    headers = sorted({k for r in rows for k in r.keys()})
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=headers)
    w.writeheader()
    for r in rows:
        w.writerow({h: (",".join(map(str, r[h])) if isinstance(r.get(h), list) else r.get(h, "")) for h in headers})
    buf.seek(0)
    return StreamingResponse(
        iter([buf.read()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{resource}.csv"'},
    )


# ---------- Health ----------
@api.get("/")
async def root():
    return {"name": "Studio PM", "status": "ok"}


# ---------- App wiring ----------
app.include_router(api)

origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Seed ----------
SEED_TEAMS = [
    {"name": "Design", "color": "#0A0A0A"},
    {"name": "Engineering", "color": "#2563EB"},
    {"name": "Strategy", "color": "#9333EA"},
    {"name": "Operations", "color": "#16A34A"},
]

SEED_USERS = [
    # admin
    {"email": "admin@studio.com", "password": "admin123", "name": "Aanya Iyer",
     "role": "leadership", "title": "Founder & Creative Director", "team": "Strategy",
     "in_office": True, "joining_date": "2019-04-01", "birthday": "1986-09-12",
     "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop"},
    {"email": "maya@studio.com", "password": "password123", "name": "Maya Sharma",
     "role": "manager", "title": "Design Director", "team": "Design",
     "in_office": True, "joining_date": "2020-06-15", "birthday": "1990-03-22",
     "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop"},
    {"email": "arjun@studio.com", "password": "password123", "name": "Arjun Patel",
     "role": "team", "title": "Senior Product Designer", "team": "Design",
     "in_office": False, "joining_date": "2022-01-10", "birthday": "1993-11-04",
     "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop"},
    {"email": "leo@studio.com", "password": "password123", "name": "Leo Tanaka",
     "role": "team", "title": "Brand Designer", "team": "Design",
     "in_office": True, "joining_date": "2023-03-21", "birthday": "1995-07-18",
     "avatar": "https://images.unsplash.com/photo-1607503873903-c5e95f80d7b9?w=200&h=200&fit=crop"},
    {"email": "ira@studio.com", "password": "password123", "name": "Ira Mendoza",
     "role": "team", "title": "Frontend Engineer", "team": "Engineering",
     "in_office": False, "joining_date": "2022-09-01", "birthday": "1992-02-08",
     "avatar": "https://images.unsplash.com/photo-1573497019418-b400bb3ab074?w=200&h=200&fit=crop"},
    {"email": "noah@studio.com", "password": "password123", "name": "Noah Becker",
     "role": "team", "title": "Strategist", "team": "Strategy",
     "in_office": True, "joining_date": "2021-11-12", "birthday": "1988-05-30",
     "avatar": "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop"},
]

SEED_CLIENTS = [
    {"company": "Acme Beverages", "location": "Mumbai, IN",
     "contacts": [{"name": "Rohan Mehta", "email": "rohan@acme.com", "phone": "+91 98765 43210", "role": "Marketing Head"}]},
    {"company": "Northwind Health", "location": "Berlin, DE",
     "contacts": [{"name": "Eva Koehler", "email": "eva@northwind.health", "phone": "+49 30 1234567", "role": "VP Product"}]},
    {"company": "Lumen Studios", "location": "New York, US",
     "contacts": [{"name": "Devon Park", "email": "devon@lumen.co", "phone": "+1 212 555 0142", "role": "Founder"}]},
]


async def seed_db():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.projects.create_index("id", unique=True)
    await db.projects.create_index("share_token")
    await db.tasks.create_index("id", unique=True)
    await db.tasks.create_index("project_id")
    await db.events.create_index("id", unique=True)
    await db.clients.create_index("id", unique=True)
    await db.teams.create_index("id", unique=True)
    await db.leaves.create_index("id", unique=True)

    # Teams
    teams = {}
    for t in SEED_TEAMS:
        existing = await db.teams.find_one({"name": t["name"]})
        if existing:
            teams[t["name"]] = existing["id"]
        else:
            tid = new_id()
            await db.teams.insert_one({"id": tid, **t, "created_at": now_utc().isoformat()})
            teams[t["name"]] = tid

    # Users
    user_ids = {}
    for u in SEED_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            user_ids[u["email"]] = existing["id"]
            # ensure password is up-to-date with .env admin password
            if u["email"] == "admin@studio.com":
                env_pw = os.environ.get("ADMIN_PASSWORD", u["password"])
                if not verify_password(env_pw, existing["password_hash"]):
                    await db.users.update_one({"id": existing["id"]},
                                              {"$set": {"password_hash": hash_password(env_pw)}})
            continue
        uid = new_id()
        pw = os.environ.get("ADMIN_PASSWORD", "admin123") if u["email"] == "admin@studio.com" else u["password"]
        doc = {"id": uid, **u, "password_hash": hash_password(pw),
               "created_at": now_utc().isoformat()}
        doc.pop("password")
        await db.users.insert_one(doc)
        user_ids[u["email"]] = uid

    # Clients
    client_ids = {}
    for c in SEED_CLIENTS:
        existing = await db.clients.find_one({"company": c["company"]})
        if existing:
            client_ids[c["company"]] = existing["id"]
            continue
        cid = new_id()
        await db.clients.insert_one({"id": cid, **c, "created_at": now_utc().isoformat()})
        client_ids[c["company"]] = cid

    # Client user — link to first client
    acme_id = client_ids["Acme Beverages"]
    if not await db.users.find_one({"email": "client@acme.com"}):
        cuid = new_id()
        await db.users.insert_one({
            "id": cuid, "email": "client@acme.com",
            "password_hash": hash_password("password123"),
            "name": "Rohan Mehta", "role": "client", "client_id": acme_id,
            "title": "Marketing Head — Acme Beverages",
            "avatar": "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=200&h=200&fit=crop",
            "created_at": now_utc().isoformat(),
        })

    # Projects (idempotent by name)
    today = date.today()

    def iso(d):
        return d.isoformat()

    seed_projects = [
        {
            "name": "Acme — Brand Refresh 2026",
            "type": "billable_regular", "status": "in_progress",
            "priority": "high", "health": "on_track",
            "lead_source": "Referral", "brief": "Refresh visual identity, packaging, and brand guidelines.",
            "scope": "Logo, palette, type system, packaging system, brand book.",
            "client_id": client_ids["Acme Beverages"],
            "start_date": iso(today - timedelta(days=20)),
            "end_date": iso(today + timedelta(days=40)),
            "service_deliverables": ["Brand Strategy", "Visual Identity", "Brand Guidelines", "Packaging"],
            "teams_involved": [teams["Design"], teams["Strategy"]],
            "members": [
                {"user_id": user_ids["maya@studio.com"], "role": "Lead Designer"},
                {"user_id": user_ids["arjun@studio.com"], "role": "Senior Designer"},
                {"user_id": user_ids["leo@studio.com"], "role": "Brand Designer"},
                {"user_id": user_ids["noah@studio.com"], "role": "Strategist"},
            ],
        },
        {
            "name": "Northwind — Patient App MVP",
            "type": "billable_regular", "status": "in_progress",
            "priority": "high", "health": "at_risk",
            "lead_source": "Inbound", "brief": "Design + build MVP for patient companion app.",
            "scope": "Product design, MVP frontend in React Native.",
            "client_id": client_ids["Northwind Health"],
            "start_date": iso(today - timedelta(days=35)),
            "end_date": iso(today + timedelta(days=55)),
            "service_deliverables": ["UX Research", "Product Design", "Frontend Build"],
            "teams_involved": [teams["Design"], teams["Engineering"]],
            "members": [
                {"user_id": user_ids["arjun@studio.com"], "role": "Product Designer"},
                {"user_id": user_ids["ira@studio.com"], "role": "Frontend Engineer"},
            ],
        },
        {
            "name": "Lumen — Always-On Retainer",
            "type": "billable_retainer", "status": "in_progress",
            "priority": "medium", "health": "on_track",
            "lead_source": "Repeat client", "brief": "Ongoing creative retainer — 60h/month.",
            "scope": "Campaign assets, social, web updates.",
            "client_id": client_ids["Lumen Studios"],
            "start_date": iso(today - timedelta(days=60)),
            "end_date": iso(today + timedelta(days=300)),
            "hours_allocated": 60,
            "service_deliverables": ["Campaigns", "Social", "Web"],
            "teams_involved": [teams["Design"]],
            "members": [
                {"user_id": user_ids["leo@studio.com"], "role": "Designer"},
                {"user_id": user_ids["maya@studio.com"], "role": "Reviewer"},
            ],
        },
        {
            "name": "Studio — Website Refresh",
            "type": "non_billable", "status": "planning",
            "priority": "low", "health": "on_track",
            "lead_source": "Internal", "brief": "Refresh our own website with new case studies.",
            "scope": "Site IA, copy, design, dev.",
            "client_id": None,
            "start_date": iso(today + timedelta(days=10)),
            "end_date": iso(today + timedelta(days=80)),
            "service_deliverables": ["Site Design", "Site Build"],
            "teams_involved": [teams["Design"], teams["Engineering"]],
            "members": [
                {"user_id": user_ids["ira@studio.com"], "role": "Engineer"},
                {"user_id": user_ids["arjun@studio.com"], "role": "Designer"},
            ],
        },
    ]
    project_ids = {}
    for p in seed_projects:
        existing = await db.projects.find_one({"name": p["name"]})
        if existing:
            project_ids[p["name"]] = existing["id"]
            continue
        pid = new_id()
        await db.projects.insert_one({
            "id": pid, **p,
            "share_token": secrets.token_urlsafe(16),
            "public_enabled": True if "Acme" in p["name"] else False,
            "created_at": now_utc().isoformat(),
        })
        project_ids[p["name"]] = pid

    # Tasks
    if await db.tasks.count_documents({}) == 0:
        tasks = [
            ("Acme — Brand Refresh 2026", "Audit existing brand", "Research", "done", 8, 7, -18, -12, user_ids["noah@studio.com"]),
            ("Acme — Brand Refresh 2026", "Mood boards", "Design", "done", 12, 14, -10, -5, user_ids["leo@studio.com"]),
            ("Acme — Brand Refresh 2026", "Logo concepts v1", "Design", "in_progress", 20, 12, -3, 5, user_ids["maya@studio.com"]),
            ("Acme — Brand Refresh 2026", "Type system exploration", "Design", "todo", 16, 0, 5, 12, user_ids["arjun@studio.com"]),
            ("Acme — Brand Refresh 2026", "Packaging system", "Design", "todo", 30, 0, 14, 30, user_ids["leo@studio.com"]),
            ("Northwind — Patient App MVP", "User interviews", "Research", "done", 16, 18, -25, -15, user_ids["arjun@studio.com"]),
            ("Northwind — Patient App MVP", "Information architecture", "Design", "in_progress", 12, 8, -10, 2, user_ids["arjun@studio.com"]),
            ("Northwind — Patient App MVP", "Hi-fi screens — Onboarding", "Design", "in_progress", 18, 11, -5, 7, user_ids["arjun@studio.com"]),
            ("Northwind — Patient App MVP", "Frontend setup", "Engineering", "todo", 8, 0, 5, 10, user_ids["ira@studio.com"]),
            ("Northwind — Patient App MVP", "Build onboarding screens", "Engineering", "todo", 24, 0, 12, 26, user_ids["ira@studio.com"]),
            ("Lumen — Always-On Retainer", "March social pack", "Design", "review", 10, 9, -2, 3, user_ids["leo@studio.com"]),
            ("Lumen — Always-On Retainer", "Spring campaign visuals", "Design", "todo", 24, 0, 6, 18, user_ids["leo@studio.com"]),
            ("Studio — Website Refresh", "Case study selection", "Strategy", "todo", 6, 0, 12, 18, user_ids["maya@studio.com"]),
            ("Studio — Website Refresh", "New site IA", "Design", "todo", 10, 0, 16, 24, user_ids["arjun@studio.com"]),
        ]
        for pname, name, cat, status, est, spent, start_off, end_off, assignee in tasks:
            await db.tasks.insert_one({
                "id": new_id(),
                "project_id": project_ids[pname],
                "parent_task_id": None,
                "name": name,
                "estimated_hours": est, "time_spent": spent,
                "original_deadline": iso(today + timedelta(days=end_off)),
                "latest_deadline": iso(today + timedelta(days=end_off)),
                "completion_date": iso(today + timedelta(days=end_off)) if status == "done" else None,
                "category": cat, "status": status,
                "assignees": [assignee],
                "is_recurring": False,
                "created_at": now_utc().isoformat(),
            })

        # A couple of recurring non-billable tasks
        for name in ["Weekly studio standup", "Monthly portfolio update"]:
            await db.tasks.insert_one({
                "id": new_id(), "project_id": None, "parent_task_id": None,
                "name": name, "estimated_hours": 1, "time_spent": 0,
                "category": None, "status": "todo",
                "assignees": [user_ids["maya@studio.com"]],
                "is_recurring": True, "recurrence_rule": "weekly" if "Weekly" in name else "monthly",
                "created_at": now_utc().isoformat(),
            })

    # Events
    if await db.events.count_documents({}) == 0:
        events = [
            ("Kickoff — Acme Brand Refresh", -20, "10:00", "11:00", "Studio HQ", "project",
             project_ids["Acme — Brand Refresh 2026"],
             [user_ids["maya@studio.com"], user_ids["arjun@studio.com"], user_ids["leo@studio.com"]]),
            ("Northwind weekly sync", 1, "15:00", "15:45", "Zoom", "project",
             project_ids["Northwind — Patient App MVP"],
             [user_ids["arjun@studio.com"], user_ids["ira@studio.com"]]),
            ("All-hands", 3, "11:00", "12:00", "Studio HQ", "company", None,
             [user_ids["admin@studio.com"], user_ids["maya@studio.com"], user_ids["arjun@studio.com"]]),
            ("Studio offsite", 14, "09:00", "18:00", "Lonavala", "company", None,
             [user_ids[u["email"]] for u in SEED_USERS]),
        ]
        for name, off, t1, t2, loc, typ, pid, atts in events:
            await db.events.insert_one({
                "id": new_id(), "name": name,
                "date": iso(today + timedelta(days=off)),
                "end_date": iso(today + timedelta(days=off)),
                "time": t1, "end_time": t2, "location": loc,
                "type": typ, "project_id": pid, "attendees": atts,
                "created_at": now_utc().isoformat(),
            })

    # Leaves
    if await db.leaves.count_documents({}) == 0:
        leaves = [
            (user_ids["arjun@studio.com"], 7, 9, "vacation"),
            (user_ids["leo@studio.com"], 20, 22, "vacation"),
            (user_ids["ira@studio.com"], -2, -1, "sick"),
        ]
        for uid, s_off, e_off, typ in leaves:
            await db.leaves.insert_one({
                "id": new_id(), "user_id": uid,
                "start_date": iso(today + timedelta(days=s_off)),
                "end_date": iso(today + timedelta(days=e_off)),
                "type": typ, "note": None,
                "created_at": now_utc().isoformat(),
            })

    log.info("Seed complete.")


@app.on_event("startup")
async def on_startup():
    try:
        await seed_db()
    except Exception as e:
        log.exception("Seed failed: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
