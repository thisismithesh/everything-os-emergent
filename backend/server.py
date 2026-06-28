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


class SignupIn(BaseModel):
    email: EmailStr
    password: str
    name: str

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
    client_id: Optional[str] = None

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


@api.get("/auth/signup-allowed")
async def signup_allowed():
    """Returns whether self-signup is currently allowed (only when no users exist)."""
    count = await db.users.count_documents({})
    return {"allowed": count == 0}


@api.post("/auth/signup")
async def signup(data: SignupIn, response: Response):
    """Public first-user sign-up. Becomes leadership. Disabled once any user exists."""
    count = await db.users.count_documents({})
    if count > 0:
        raise HTTPException(status_code=403, detail="Sign-up is disabled. Ask an admin to invite you.")
    email = data.email.lower()
    doc = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": "leadership",
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    access = create_access_token(doc["id"], doc["email"])
    refresh = create_refresh_token(doc["id"])
    set_auth_cookies(response, access, refresh)
    return public_user(doc)


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
    prev = await db.projects.find_one({"id": project_id})
    if not prev:
        raise HTTPException(status_code=404, detail="Not found")
    update = data.model_dump()
    await db.projects.update_one({"id": project_id}, {"$set": update})
    p = await db.projects.find_one({"id": project_id}, {"_id": 0})
    # Notify on status / health change
    interesting = []
    if update.get("status") != prev.get("status"):
        interesting.append(("project_status_changed", f"status → {update.get('status')}"))
    if update.get("health") != prev.get("health"):
        interesting.append(("project_health_changed", f"health → {update.get('health')}"))
    if interesting:
        member_ids = [m.get("user_id") for m in (p.get("members") or []) if m.get("user_id")]
        for typ, frag in interesting:
            for uid in member_ids:
                if uid != user["id"]:
                    await notify(uid, typ, f"{user['name']} updated “{p['name']}” {frag}",
                                 link=f"/projects/{p['id']}", actor_id=user["id"])
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
    # Notify assignees
    for uid in (doc.get("assignees") or []):
        if uid != user["id"]:
            await notify(uid, "task_assigned",
                         f"{user['name']} assigned you to “{doc['name']}”",
                         link=f"/tasks?task={doc['id']}", actor_id=user["id"])
    return doc


@api.patch("/tasks/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, user: dict = Depends(require_roles("leadership", "manager", "team"))):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        t = await db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not t:
            raise HTTPException(status_code=404, detail="Not found")
        return t
    prev = await db.tasks.find_one({"id": task_id})
    if not prev:
        raise HTTPException(status_code=404, detail="Not found")
    await db.tasks.update_one({"id": task_id}, {"$set": update})
    t = await db.tasks.find_one({"id": task_id}, {"_id": 0})

    # Notify on status change
    if "status" in update and update["status"] != prev.get("status"):
        for uid in (t.get("assignees") or []):
            if uid != user["id"]:
                await notify(uid, "task_status_changed",
                             f"{user['name']} moved “{t['name']}” → {update['status']}",
                             link=f"/tasks?task={t['id']}", actor_id=user["id"])
    # Notify newly added assignees
    if "assignees" in update:
        new_assignees = set(update["assignees"] or []) - set(prev.get("assignees") or [])
        for uid in new_assignees:
            if uid != user["id"]:
                await notify(uid, "task_assigned",
                             f"{user['name']} assigned you to “{t['name']}”",
                             link=f"/tasks?task={t['id']}", actor_id=user["id"])
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


# ---------- Comments ----------
ENTITY_TYPES = ("task", "project", "event")


class CommentIn(BaseModel):
    entity_type: Literal["task", "project", "event"]
    entity_id: str
    body: str
    mentions: Optional[List[str]] = []


async def _entity_recipients(entity_type: str, entity_id: str) -> List[str]:
    if entity_type == "task":
        t = await db.tasks.find_one({"id": entity_id})
        return list(set(t.get("assignees") or [])) if t else []
    if entity_type == "project":
        p = await db.projects.find_one({"id": entity_id})
        return [m.get("user_id") for m in (p.get("members") or []) if m.get("user_id")] if p else []
    if entity_type == "event":
        e = await db.events.find_one({"id": entity_id})
        return list(set(e.get("attendees") or [])) if e else []
    return []


async def _entity_label(entity_type: str, entity_id: str) -> str:
    coll = {"task": db.tasks, "project": db.projects, "event": db.events}[entity_type]
    d = await coll.find_one({"id": entity_id})
    return d.get("name", "") if d else ""


@api.get("/comments")
async def list_comments(entity_type: str, entity_id: str, user: dict = Depends(get_current_user)):
    if entity_type not in ENTITY_TYPES:
        raise HTTPException(status_code=400, detail="Invalid entity_type")
    rows = await db.comments.find({"entity_type": entity_type, "entity_id": entity_id}, {"_id": 0}) \
        .sort("created_at", 1).to_list(1000)
    return rows


@api.post("/comments")
async def create_comment(data: CommentIn, user: dict = Depends(get_current_user)):
    if user["role"] == "client":
        # clients can only comment on their own projects
        if data.entity_type == "project":
            p = await db.projects.find_one({"id": data.entity_id})
            if not p or p.get("client_id") != user.get("client_id"):
                raise HTTPException(status_code=403, detail="Forbidden")
        else:
            raise HTTPException(status_code=403, detail="Forbidden")
    doc = {
        "id": new_id(),
        "entity_type": data.entity_type, "entity_id": data.entity_id,
        "body": data.body, "mentions": data.mentions or [],
        "user_id": user["id"], "user_name": user["name"], "user_avatar": user.get("avatar"),
        "created_at": now_utc().isoformat(),
    }
    await db.comments.insert_one(doc)
    doc.pop("_id", None)

    # Notify entity watchers + mentions
    label = await _entity_label(data.entity_type, data.entity_id)
    link_map = {
        "task": f"/tasks?task={data.entity_id}",
        "project": f"/projects/{data.entity_id}",
        "event": "/calendar",
    }
    link = link_map[data.entity_type]
    watchers = set(await _entity_recipients(data.entity_type, data.entity_id))
    mentions = set(data.mentions or [])
    # Mentions
    for uid in mentions:
        if uid != user["id"]:
            await notify(uid, "comment_mention",
                         f"{user['name']} mentioned you on “{label}”",
                         link=link, actor_id=user["id"])
    # Watchers (excluding mentioned & self)
    for uid in watchers - mentions - {user["id"]}:
        await notify(uid, "comment_new",
                     f"{user['name']} commented on “{label}”",
                     link=link, actor_id=user["id"])
    return doc


@api.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, user: dict = Depends(get_current_user)):
    c = await db.comments.find_one({"id": comment_id})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    if c["user_id"] != user["id"] and user["role"] not in ("leadership", "manager"):
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.comments.delete_one({"id": comment_id})
    return {"ok": True}


# ---------- Time entries & timer ----------
class TimerStartIn(BaseModel):
    task_id: str
    note: Optional[str] = None


class TimeEntryIn(BaseModel):
    task_id: str
    start_time: str
    end_time: str
    note: Optional[str] = None


async def _recompute_task_time(task_id: str) -> None:
    entries = await db.time_entries.find({"task_id": task_id}, {"duration_minutes": 1, "_id": 0}).to_list(5000)
    total_minutes = sum(e.get("duration_minutes") or 0 for e in entries)
    hours = round(total_minutes / 60, 2)
    await db.tasks.update_one({"id": task_id}, {"$set": {"time_spent": hours}})


@api.post("/timer/start")
async def timer_start(data: TimerStartIn, user: dict = Depends(require_roles("leadership", "manager", "team"))):
    # Stop any active timer first
    await db.active_timers.delete_one({"user_id": user["id"]})
    doc = {
        "user_id": user["id"], "task_id": data.task_id, "note": data.note,
        "started_at": now_utc().isoformat(),
    }
    await db.active_timers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/timer/stop")
async def timer_stop(user: dict = Depends(require_roles("leadership", "manager", "team"))):
    active = await db.active_timers.find_one({"user_id": user["id"]})
    if not active:
        raise HTTPException(status_code=400, detail="No active timer")
    started = datetime.fromisoformat(active["started_at"])
    ended = now_utc()
    duration_minutes = max(1, int((ended - started).total_seconds() // 60))
    entry = {
        "id": new_id(),
        "task_id": active["task_id"], "user_id": user["id"],
        "start_time": active["started_at"], "end_time": ended.isoformat(),
        "duration_minutes": duration_minutes,
        "note": active.get("note"),
        "source": "timer",
        "created_at": ended.isoformat(),
    }
    await db.time_entries.insert_one(entry)
    await db.active_timers.delete_one({"user_id": user["id"]})
    await _recompute_task_time(active["task_id"])
    entry.pop("_id", None)
    return entry


@api.get("/timer/active")
async def timer_active(user: dict = Depends(get_current_user)):
    a = await db.active_timers.find_one({"user_id": user["id"]}, {"_id": 0})
    return a or None


@api.get("/time-entries")
async def list_time_entries(
    task_id: Optional[str] = None,
    user_id: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    if user["role"] == "client":
        raise HTTPException(status_code=403, detail="Forbidden")
    q: dict = {}
    if task_id:
        q["task_id"] = task_id
    if user_id:
        q["user_id"] = user_id
    if start or end:
        rng: dict = {}
        if start:
            rng["$gte"] = start
        if end:
            rng["$lte"] = end + "T23:59:59"
        q["start_time"] = rng
    return await db.time_entries.find(q, {"_id": 0}).sort("start_time", -1).to_list(5000)


@api.post("/time-entries")
async def create_time_entry(data: TimeEntryIn, user: dict = Depends(require_roles("leadership", "manager", "team"))):
    start_dt = datetime.fromisoformat(data.start_time)
    end_dt = datetime.fromisoformat(data.end_time)
    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    duration_minutes = int((end_dt - start_dt).total_seconds() // 60)
    doc = {
        "id": new_id(),
        "task_id": data.task_id, "user_id": user["id"],
        "start_time": data.start_time, "end_time": data.end_time,
        "duration_minutes": duration_minutes,
        "note": data.note, "source": "manual",
        "created_at": now_utc().isoformat(),
    }
    await db.time_entries.insert_one(doc)
    await _recompute_task_time(data.task_id)
    doc.pop("_id", None)
    return doc


@api.delete("/time-entries/{entry_id}")
async def delete_time_entry(entry_id: str, user: dict = Depends(require_roles("leadership", "manager", "team"))):
    e = await db.time_entries.find_one({"id": entry_id})
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    if e["user_id"] != user["id"] and user["role"] not in ("leadership", "manager"):
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.time_entries.delete_one({"id": entry_id})
    await _recompute_task_time(e["task_id"])
    return {"ok": True}


# ---------- Notifications ----------
async def notify(user_id: str, type_: str, message: str, link: Optional[str] = None,
                 actor_id: Optional[str] = None) -> None:
    if not user_id:
        return
    await db.notifications.insert_one({
        "id": new_id(),
        "user_id": user_id, "type": type_, "message": message,
        "link": link, "actor_id": actor_id, "read": False,
        "created_at": now_utc().isoformat(),
    })


@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}) \
        .sort("created_at", -1).limit(100).to_list(100)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"items": items, "unread": unread}


@api.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notif_id, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False}, {"$set": {"read": True}})
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


# ---------- Seed (indexes only, no users) ----------
async def seed_db():
    # Indexes (idempotent)
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
    await db.comments.create_index([("entity_type", 1), ("entity_id", 1)])
    await db.comments.create_index("id", unique=True)
    await db.time_entries.create_index("id", unique=True)
    await db.time_entries.create_index([("user_id", 1), ("start_time", -1)])
    await db.time_entries.create_index("task_id")
    await db.active_timers.create_index("user_id", unique=True)
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.notifications.create_index("id", unique=True)

    log.info("Indexes ensured. No seed users — first user is created via /auth/signup.")


@app.on_event("startup")
async def on_startup():
    try:
        await seed_db()
    except Exception as e:
        log.exception("Seed failed: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
