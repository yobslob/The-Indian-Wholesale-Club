"""A small Supabase client for the photo worker (D-103): signs in as the worker account (role `worker`), calls the
worker_* database functions and moves files. Only what the worker needs; never a service-role key."""

import time
from urllib.parse import quote

import httpx


class SupabaseError(RuntimeError):
    pass


class Supabase:
    def __init__(self, url: str, anon_key: str, email: str, password: str):
        self.url = url.rstrip("/")
        self.anon_key = anon_key
        self.email = email
        self.password = password
        self.http = httpx.Client(timeout=httpx.Timeout(60.0, connect=15.0))
        self.access_token: str | None = None
        self.refresh_token: str | None = None
        self.expires_at = 0.0

    # --- session -------------------------------------------------------------------------------------------------
    def _take(self, session: dict) -> None:
        self.access_token = session["access_token"]
        self.refresh_token = session["refresh_token"]
        self.expires_at = time.time() + int(session.get("expires_in", 3600)) - 60

    def _sign_in(self) -> None:
        if self.refresh_token:
            r = self.http.post(f"{self.url}/auth/v1/token?grant_type=refresh_token",
                               headers={"apikey": self.anon_key}, json={"refresh_token": self.refresh_token})
            if r.status_code == 200:
                self._take(r.json())
                return
        r = self.http.post(f"{self.url}/auth/v1/token?grant_type=password", headers={"apikey": self.anon_key},
                           json={"email": self.email, "password": self.password})
        if r.status_code != 200:
            raise SupabaseError(f"sign-in failed: {r.status_code} {r.text[:200]}")
        self._take(r.json())

    def _headers(self, extra: dict | None = None) -> dict:
        if not self.access_token or time.time() >= self.expires_at:
            self._sign_in()
        headers = {"apikey": self.anon_key, "Authorization": f"Bearer {self.access_token}"}
        headers.update(extra or {})
        return headers

    # --- database ------------------------------------------------------------------------------------------------
    def rpc(self, function: str, args: dict | None = None):
        r = self.http.post(f"{self.url}/rest/v1/rpc/{function}", headers=self._headers(), json=args or {})
        if r.status_code >= 400:
            raise SupabaseError(f"{function}: {r.status_code} {r.text[:300]}")
        return r.json() if r.content else None

    # --- storage -------------------------------------------------------------------------------------------------
    def download(self, bucket: str, path: str) -> bytes:
        r = self.http.get(f"{self.url}/storage/v1/object/authenticated/{bucket}/{quote(path)}", headers=self._headers())
        if r.status_code != 200:
            raise SupabaseError(f"download {bucket}/{path}: {r.status_code} {r.text[:200]}")
        return r.content

    def download_public(self, bucket: str, path: str) -> bytes:
        r = self.http.get(f"{self.url}/storage/v1/object/public/{bucket}/{quote(path)}")
        if r.status_code != 200:
            raise SupabaseError(f"download {bucket}/{path}: {r.status_code}")
        return r.content

    def upload(self, bucket: str, path: str, data: bytes, content_type: str = "image/jpeg") -> None:
        r = self.http.post(f"{self.url}/storage/v1/object/{bucket}/{quote(path)}", content=data,
                           headers=self._headers({"Content-Type": content_type, "x-upsert": "true"}))
        if r.status_code >= 400:
            raise SupabaseError(f"upload {bucket}/{path}: {r.status_code} {r.text[:200]}")
