"""Phase 3 tests: Marketing, Sales, Company endpoints.

Uses leadership account phase3_lead@studio.com / Pass1234! (existing).
Creates transient team + client users for RBAC checks (signed up via /auth/signup).
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break
API = f"{BASE_URL}/api"

LEAD = ("phase3_lead@studio.com", "Pass1234!")
# Use unique emails per test run to avoid collisions with leftover seed data
RUN_ID = f"phase3run{int(time.time())}"
TEAM = (f"team_{RUN_ID}@studio.com", "Pass1234!", "Test Team User", "team")
CLIENT = (f"client_{RUN_ID}@studio.com", "Pass1234!", "Test Client User", "client")


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return s


def _signup(email, pw, name, role):
    s = requests.Session()
    r = s.post(f"{API}/auth/signup", json={"email": email, "password": pw, "name": name, "role": role}, timeout=30)
    # If user already exists from a previous run, fall back to login
    if r.status_code == 400 and "already" in r.text.lower():
        return _login(email, pw)
    assert r.status_code == 200, f"signup {email} ({role}) failed: {r.status_code} {r.text}"
    body = r.json()
    assert body["role"] == role, f"expected role {role}, got {body.get('role')}"
    return s


@pytest.fixture(scope="module")
def lead():
    return _login(*LEAD)


@pytest.fixture(scope="module")
def team_user():
    return _signup(*TEAM)


@pytest.fixture(scope="module")
def client_user():
    return _signup(*CLIENT)


# ---------------- Marketing Documents (Plan) ----------------
class TestDocuments:
    def test_create_list_update_delete_marketing_doc(self, lead):
        r = lead.post(f"{API}/documents", json={
            "title": "TEST_PlanDoc", "body": "Q1 plan body", "tags": ["q1", "campaign"], "scope": "marketing"
        })
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["title"] == "TEST_PlanDoc"
        assert doc["scope"] == "marketing"
        assert doc["tags"] == ["q1", "campaign"]
        assert "_id" not in doc
        did = doc["id"]

        # LIST scope=marketing
        rows = lead.get(f"{API}/documents", params={"scope": "marketing"}).json()
        assert any(x["id"] == did for x in rows)

        # LIST scope=wiki should NOT include this doc
        wiki_rows = lead.get(f"{API}/documents", params={"scope": "wiki"}).json()
        assert not any(x["id"] == did for x in wiki_rows)

        # UPDATE
        r = lead.patch(f"{API}/documents/{did}", json={"title": "TEST_PlanDoc_v2"})
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_PlanDoc_v2"

        # DELETE
        assert lead.delete(f"{API}/documents/{did}").status_code == 200
        rows2 = lead.get(f"{API}/documents", params={"scope": "marketing"}).json()
        assert not any(x["id"] == did for x in rows2)

    def test_wiki_scope_isolation(self, lead):
        r = lead.post(f"{API}/documents", json={"title": "TEST_WikiDoc", "scope": "wiki", "tags": ["wiki"]})
        assert r.status_code == 200
        did = r.json()["id"]
        # Should appear in wiki list
        rows = lead.get(f"{API}/documents", params={"scope": "wiki"}).json()
        assert any(x["id"] == did for x in rows)
        # Should NOT appear in marketing list
        mrows = lead.get(f"{API}/documents", params={"scope": "marketing"}).json()
        assert not any(x["id"] == did for x in mrows)
        lead.delete(f"{API}/documents/{did}")

    def test_bad_scope_rejected(self, lead):
        r = lead.get(f"{API}/documents", params={"scope": "garbage"})
        assert r.status_code == 400

    def test_client_cannot_access_documents(self, client_user):
        assert client_user.get(f"{API}/documents", params={"scope": "marketing"}).status_code == 403
        assert client_user.post(f"{API}/documents", json={"title": "x", "scope": "marketing"}).status_code == 403


# ---------------- Marketing Tracker tasks ----------------
class TestMarketingTracker:
    def test_create_move_through_columns(self, lead):
        r = lead.post(f"{API}/marketing/tasks", json={"title": "TEST_Mtask", "description": "desc"})
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["status"] == "backlog"
        tid = t["id"]
        # active
        r = lead.patch(f"{API}/marketing/tasks/{tid}", json={"status": "active"})
        assert r.status_code == 200
        assert r.json()["status"] == "active"
        # completed
        r = lead.patch(f"{API}/marketing/tasks/{tid}", json={"status": "completed"})
        assert r.json()["status"] == "completed"
        lead.delete(f"{API}/marketing/tasks/{tid}")

    def test_team_can_use_tracker(self, team_user):
        r = team_user.post(f"{API}/marketing/tasks", json={"title": "TEST_TeamMtask"})
        assert r.status_code == 200, r.text
        team_user.delete(f"{API}/marketing/tasks/{r.json()['id']}")

    def test_client_forbidden_tracker(self, client_user):
        assert client_user.get(f"{API}/marketing/tasks").status_code == 403
        assert client_user.post(f"{API}/marketing/tasks", json={"title": "x"}).status_code == 403


# ---------------- Marketing Materials database ----------------
class TestMaterials:
    def test_full_flow_with_posted_toggle(self, lead):
        r = lead.post(f"{API}/marketing/materials", json={
            "title": "TEST_Material", "link": "https://example.com", "post_date": "2026-01-15",
            "posted": False, "tags": ["instagram"]
        })
        assert r.status_code == 200, r.text
        m = r.json()
        mid = m["id"]
        assert m["posted"] is False
        # Toggle posted -> True
        r = lead.patch(f"{API}/marketing/materials/{mid}", json={"posted": True})
        assert r.status_code == 200
        assert r.json()["posted"] is True
        # Verify persistence via list
        rows = lead.get(f"{API}/marketing/materials").json()
        match = next((x for x in rows if x["id"] == mid), None)
        assert match and match["posted"] is True
        lead.delete(f"{API}/marketing/materials/{mid}")

    def test_client_forbidden_materials(self, client_user):
        assert client_user.get(f"{API}/marketing/materials").status_code == 403


# ---------------- Sales Leads ----------------
class TestLeads:
    def test_lead_full_flow(self, lead):
        r = lead.post(f"{API}/leads", json={
            "name": "TEST_Lead Acme Co", "company": "AcmeCo", "value": 250000,
            "status": "new", "source": "referral"
        })
        assert r.status_code == 200, r.text
        l = r.json()
        lid = l["id"]
        assert l["status"] == "new"
        assert l["value"] == 250000
        # Move to contacted
        r = lead.patch(f"{API}/leads/{lid}", json={"status": "contacted"})
        assert r.status_code == 200
        assert r.json()["status"] == "contacted"
        # Mark Won
        r = lead.patch(f"{API}/leads/{lid}", json={"status": "won"})
        assert r.json()["status"] == "won"
        # In list
        rows = lead.get(f"{API}/leads").json()
        assert any(x["id"] == lid for x in rows)
        lead.delete(f"{API}/leads/{lid}")

    def test_team_forbidden_leads(self, team_user):
        assert team_user.get(f"{API}/leads").status_code == 403
        assert team_user.post(f"{API}/leads", json={"name": "x"}).status_code == 403

    def test_client_forbidden_leads(self, client_user):
        assert client_user.get(f"{API}/leads").status_code == 403


# ---------------- Company Posts (Message Board) ----------------
class TestPosts:
    def test_three_post_types(self, lead):
        ids = []
        for t, body in [("announcement", "TEST_All-hands tomorrow"),
                        ("appreciation", "TEST_Thanks team"),
                        ("boast", "TEST_Closed APTA")]:
            r = lead.post(f"{API}/posts", json={"type": t, "body": body})
            assert r.status_code == 200, r.text
            p = r.json()
            assert p["type"] == t
            assert p["body"] == body
            assert p["author_id"]
            ids.append(p["id"])
        rows = lead.get(f"{API}/posts").json()
        rids = {x["id"] for x in rows}
        for i in ids:
            assert i in rids
        for i in ids:
            lead.delete(f"{API}/posts/{i}")

    def test_appreciation_with_target_user(self, lead, team_user):
        me = team_user.get(f"{API}/auth/me").json()
        r = lead.post(f"{API}/posts", json={
            "type": "appreciation", "body": "TEST_Great work", "appreciate_user_id": me["id"]
        })
        assert r.status_code == 200
        assert r.json()["appreciate_user_id"] == me["id"]
        lead.delete(f"{API}/posts/{r.json()['id']}")

    def test_client_forbidden_posts(self, client_user):
        assert client_user.get(f"{API}/posts").status_code == 403


# ---------------- Company Activities ----------------
class TestActivities:
    def test_activity_crud(self, lead):
        r = lead.post(f"{API}/activities", json={
            "name": "TEST_Book Club", "description": "Weekly reads", "type": "recurring",
            "cadence": "weekly", "status": "active"
        })
        assert r.status_code == 200, r.text
        a = r.json()
        aid = a["id"]
        assert a["cadence"] == "weekly"
        # Update
        r = lead.patch(f"{API}/activities/{aid}", json={"status": "paused"})
        assert r.json()["status"] == "paused"
        lead.delete(f"{API}/activities/{aid}")

    def test_client_forbidden_activities(self, client_user):
        assert client_user.get(f"{API}/activities").status_code == 403


# ---------------- Career Journal ----------------
class TestJournal:
    def test_journal_private_per_user(self, lead, team_user):
        # Lead creates an entry
        r = lead.post(f"{API}/journal", json={"date": "2026-01-15", "mood": "great", "body": "TEST_lead entry"})
        assert r.status_code == 200, r.text
        lead_jid = r.json()["id"]
        assert r.json()["mood"] == "great"

        # Team creates own entry
        r = team_user.post(f"{API}/journal", json={"date": "2026-01-15", "mood": "ok", "body": "TEST_team entry"})
        assert r.status_code == 200
        team_jid = r.json()["id"]

        # Lead list should NOT include team's entry
        lead_rows = lead.get(f"{API}/journal").json()
        lead_ids = {x["id"] for x in lead_rows}
        assert lead_jid in lead_ids
        assert team_jid not in lead_ids

        # Team list should only see its own
        team_rows = team_user.get(f"{API}/journal").json()
        team_ids = {x["id"] for x in team_rows}
        assert team_jid in team_ids
        assert lead_jid not in team_ids

        # Lead cannot edit/delete team's entry
        r = lead.patch(f"{API}/journal/{team_jid}", json={"body": "hijack"})
        assert r.status_code == 403
        r = lead.delete(f"{API}/journal/{team_jid}")
        assert r.status_code == 403

        # Cleanup
        lead.delete(f"{API}/journal/{lead_jid}")
        team_user.delete(f"{API}/journal/{team_jid}")

    def test_client_forbidden_journal(self, client_user):
        assert client_user.get(f"{API}/journal").status_code == 403
        assert client_user.post(f"{API}/journal", json={"date": "2026-01-15", "body": "x"}).status_code == 403


# ---------------- Auth/me sanity ----------------
class TestMe:
    def test_lead_role(self, lead):
        me = lead.get(f"{API}/auth/me").json()
        assert me["role"] == "leadership"
        assert me["email"] == LEAD[0]

    def test_team_role(self, team_user):
        assert team_user.get(f"{API}/auth/me").json()["role"] == "team"

    def test_client_role(self, client_user):
        assert client_user.get(f"{API}/auth/me").json()["role"] == "client"
