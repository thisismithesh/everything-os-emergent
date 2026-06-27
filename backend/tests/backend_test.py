"""Backend tests for Studio PM."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://creative-command-14.preview.emergentagent.com").rstrip("/")
# Also try from frontend/.env
try:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break
except Exception:
    pass

API = f"{BASE_URL}/api"

CREDS = {
    "admin":   ("admin@studio.com", "admin123", "leadership"),
    "manager": ("maya@studio.com", "password123", "manager"),
    "team":    ("arjun@studio.com", "password123", "team"),
    "client":  ("client@acme.com", "password123", "client"),
}


def _session(role):
    s = requests.Session()
    email, pw, _ = CREDS[role]
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, f"login {role} failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def admin(): return _session("admin")
@pytest.fixture(scope="session")
def manager(): return _session("manager")
@pytest.fixture(scope="session")
def team(): return _session("team")
@pytest.fixture(scope="session")
def client_user(): return _session("client")


# --- Auth ---
class TestAuth:
    def test_login_sets_cookies(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": "admin@studio.com", "password": "admin123"})
        assert r.status_code == 200
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies
        body = r.json()
        assert body["email"] == "admin@studio.com"
        assert body["role"] == "leadership"
        assert "password_hash" not in body
        assert "_id" not in body

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@studio.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, admin):
        r = admin.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == "admin@studio.com"

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    @pytest.mark.parametrize("role", ["admin", "manager", "team", "client"])
    def test_all_seeded_logins(self, role):
        email, pw, expected_role = CREDS[role]
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200, f"{role}: {r.text}"
        assert r.json()["role"] == expected_role


# --- Role-based access ---
class TestRBAC:
    def test_clients_leadership_ok(self, admin):
        r = admin.get(f"{API}/clients")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_clients_manager_ok(self, manager):
        assert manager.get(f"{API}/clients").status_code == 200

    def test_clients_team_forbidden(self, team):
        assert team.get(f"{API}/clients").status_code == 403

    def test_clients_client_forbidden(self, client_user):
        assert client_user.get(f"{API}/clients").status_code == 403

    def test_gantt_leadership(self, admin):
        r = admin.get(f"{API}/dashboard/gantt")
        assert r.status_code == 200
        data = r.json()
        for k in ("projects", "users", "leaves", "member_blocks"):
            assert k in data

    def test_gantt_manager(self, manager):
        assert manager.get(f"{API}/dashboard/gantt").status_code == 200

    def test_gantt_team_forbidden(self, team):
        assert team.get(f"{API}/dashboard/gantt").status_code == 403

    def test_gantt_client_forbidden(self, client_user):
        assert client_user.get(f"{API}/dashboard/gantt").status_code == 403

    def test_projects_client_filtered(self, client_user, admin):
        cli = client_user.get(f"{API}/projects").json()
        adm = admin.get(f"{API}/projects").json()
        assert len(adm) >= len(cli)
        # Acme client should only see Acme project(s)
        for p in cli:
            assert p.get("client_id") is not None
            assert "Acme" in p["name"]

    def test_leaves_client_empty(self, client_user):
        r = client_user.get(f"{API}/leaves")
        assert r.status_code == 200
        assert r.json() == []

    def test_tasks_client_forbidden(self, client_user):
        assert client_user.get(f"{API}/tasks").status_code == 403


# --- Projects CRUD + public share ---
class TestProjects:
    def test_full_flow(self, admin):
        # CREATE
        payload = {"name": "TEST_Project_E2E", "type": "billable_regular",
                   "status": "planning", "priority": "medium", "health": "on_track"}
        r = admin.post(f"{API}/projects", json=payload)
        assert r.status_code == 200, r.text
        proj = r.json()
        pid = proj["id"]
        assert proj["name"] == "TEST_Project_E2E"
        assert proj["public_enabled"] is False
        assert proj.get("share_token")

        # GET
        r = admin.get(f"{API}/projects/{pid}")
        assert r.status_code == 200
        assert r.json()["id"] == pid

        # Toggle public
        r = admin.post(f"{API}/projects/{pid}/toggle-public")
        assert r.status_code == 200
        body = r.json()
        assert body["public_enabled"] is True
        token = body["share_token"]

        # Public endpoint (no auth)
        r = requests.get(f"{API}/public/projects/{token}")
        assert r.status_code == 200
        data = r.json()
        for k in ("project", "tasks", "events", "members"):
            assert k in data
        assert data["project"]["id"] == pid

        # Cleanup
        admin.delete(f"{API}/projects/{pid}")

    def test_team_cannot_create_project(self, team):
        r = team.post(f"{API}/projects", json={"name": "TEST_X"})
        assert r.status_code == 403

    def test_public_project_acme(self, admin):
        projs = admin.get(f"{API}/projects").json()
        acme = next((p for p in projs if "Acme" in p["name"]), None)
        assert acme, "Acme project must be seeded"
        assert acme.get("public_enabled") is True
        r = requests.get(f"{API}/public/projects/{acme['share_token']}")
        assert r.status_code == 200
        data = r.json()
        assert data["project"]["id"] == acme["id"]
        assert len(data["tasks"]) >= 1


# --- Tasks CRUD ---
class TestTasks:
    def test_full_flow(self, admin):
        projs = admin.get(f"{API}/projects").json()
        pid = projs[0]["id"]
        # CREATE
        r = admin.post(f"{API}/tasks", json={"name": "TEST_Task", "project_id": pid})
        assert r.status_code == 200, r.text
        t = r.json()
        tid = t["id"]
        assert t["name"] == "TEST_Task"
        assert t["status"] == "todo"

        # FILTER
        r = admin.get(f"{API}/tasks", params={"project_id": pid})
        assert r.status_code == 200
        assert any(x["id"] == tid for x in r.json())

        # UPDATE
        r = admin.patch(f"{API}/tasks/{tid}", json={"status": "in_progress"})
        assert r.status_code == 200
        assert r.json()["status"] == "in_progress"

        # Subtask + cascade delete
        r = admin.post(f"{API}/tasks", json={"name": "TEST_Sub", "parent_task_id": tid})
        assert r.status_code == 200
        sub_id = r.json()["id"]

        admin.delete(f"{API}/tasks/{tid}")
        all_tasks = admin.get(f"{API}/tasks").json()
        ids = {x["id"] for x in all_tasks}
        assert tid not in ids
        assert sub_id not in ids  # cascaded


# --- Events + Leaves ---
class TestEventsLeaves:
    def test_event_create_list(self, admin):
        users = admin.get(f"{API}/users").json()
        aid = users[0]["id"]
        r = admin.post(f"{API}/events", json={
            "name": "TEST_Event", "date": "2026-02-01", "attendees": [aid], "type": "company"
        })
        assert r.status_code == 200
        eid = r.json()["id"]
        events = admin.get(f"{API}/events").json()
        assert any(e["id"] == eid for e in events)
        admin.delete(f"{API}/events/{eid}")

    def test_leave_create_list(self, admin):
        users = admin.get(f"{API}/users").json()
        uid = users[0]["id"]
        r = admin.post(f"{API}/leaves", json={
            "user_id": uid, "start_date": "2026-03-01", "end_date": "2026-03-03", "type": "vacation"
        })
        assert r.status_code == 200
        lid = r.json()["id"]
        leaves = admin.get(f"{API}/leaves").json()
        assert any(l["id"] == lid for l in leaves)
        admin.delete(f"{API}/leaves/{lid}")


# --- CSV exports ---
class TestCSVExport:
    @pytest.mark.parametrize("resource", ["projects", "tasks", "users", "events"])
    def test_export(self, admin, resource):
        r = admin.get(f"{API}/export/{resource}.csv")
        assert r.status_code == 200, f"{resource}: {r.status_code} {r.text[:200]}"
        ct = r.headers.get("content-type", "")
        assert "text/csv" in ct
        assert len(r.text) > 0
        # has header row
        assert "\n" in r.text or "," in r.text
