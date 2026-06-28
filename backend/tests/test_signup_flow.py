"""
Tests for the first-user signup flow.
Covers:
- GET /api/auth/signup-allowed reflects DB state
- POST /api/auth/signup creates first user as leadership, sets cookies
- Second signup is locked (403)
- /api/auth/me works with the session cookie
- /api/auth/login works with the newly created credentials
- Cleanup: deletes the test user so DB returns to empty
"""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://creative-command-14.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

TEST_EMAIL = "first@studio.com"
TEST_PASSWORD = "firstuser123"
TEST_NAME = "First Owner"

SECOND_EMAIL = "second@studio.com"


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module", autouse=True)
def clean_users_before_and_after(mongo_db):
    """Wipe users so we are guaranteed to start empty, and clean up after."""
    mongo_db.users.delete_many({})
    mongo_db.user_sessions.delete_many({})
    yield
    # Final cleanup so the DB returns to fully empty
    mongo_db.users.delete_many({})
    mongo_db.user_sessions.delete_many({})


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestSignupFlow:
    """End-to-end signup, signup-lock, /me, and re-login coverage."""

    def test_01_signup_allowed_when_db_empty(self, session):
        r = session.get(f"{BASE_URL}/api/auth/signup-allowed")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body == {"allowed": True}, body

    def test_02_signup_creates_first_user_as_leadership(self, session):
        r = session.post(
            f"{BASE_URL}/api/auth/signup",
            json={"name": TEST_NAME, "email": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == TEST_EMAIL
        assert data["name"] == TEST_NAME
        assert data["role"] == "leadership"
        assert "id" in data and isinstance(data["id"], str) and len(data["id"]) > 0
        # password_hash must NOT leak in the response
        assert "password_hash" not in data

        # httpOnly cookies set
        cookie_names = {c.name for c in session.cookies}
        assert "access_token" in cookie_names, f"missing access_token cookie. Got: {cookie_names}"
        assert "refresh_token" in cookie_names, f"missing refresh_token cookie. Got: {cookie_names}"

    def test_03_me_returns_first_user(self, session):
        r = session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == TEST_EMAIL
        assert data["role"] == "leadership"
        assert data["name"] == TEST_NAME

    def test_04_signup_allowed_false_after_first_user(self, session):
        # Use a fresh session to avoid the cookie auth header on this public endpoint
        s2 = requests.Session()
        r = s2.get(f"{BASE_URL}/api/auth/signup-allowed")
        assert r.status_code == 200, r.text
        assert r.json() == {"allowed": False}

    def test_05_second_signup_returns_403(self):
        s2 = requests.Session()
        r = s2.post(
            f"{BASE_URL}/api/auth/signup",
            json={"name": "Second", "email": SECOND_EMAIL, "password": "anotherpass1"},
        )
        assert r.status_code == 403, r.text
        body = r.json()
        # FastAPI default error shape: {"detail": "..."}
        detail = body.get("detail", "")
        assert "Sign-up is disabled" in detail, body
        assert "invite" in detail.lower(), body

    def test_06_login_with_first_user(self):
        s2 = requests.Session()
        s2.headers.update({"Content-Type": "application/json"})
        r = s2.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == TEST_EMAIL
        assert data["role"] == "leadership"
        cookie_names = {c.name for c in s2.cookies}
        assert "access_token" in cookie_names
        assert "refresh_token" in cookie_names

        # /me with the same session
        r2 = s2.get(f"{BASE_URL}/api/auth/me")
        assert r2.status_code == 200
        assert r2.json()["email"] == TEST_EMAIL

    def test_07_login_with_wrong_password_returns_401(self):
        s2 = requests.Session()
        r = s2.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": "wrongpass1234"},
        )
        assert r.status_code == 401, r.text


class TestDbEmptyState:
    """Verifies the DB is empty (no seed data) for non-user collections."""

    def test_collections_empty_on_startup(self, mongo_db):
        # users will be populated by the test above; check it separately below
        collections = [
            "projects", "tasks", "events", "leaves", "clients", "teams",
            "comments", "time_entries", "active_timers", "notifications",
        ]
        non_empty = {c: mongo_db[c].count_documents({}) for c in collections if mongo_db[c].count_documents({}) > 0}
        assert non_empty == {}, f"Expected empty collections, found data in: {non_empty}"
