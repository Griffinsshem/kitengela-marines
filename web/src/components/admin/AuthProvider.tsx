"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  API_URL,
  type SessionUser,
  fetchCurrentUser,
  readCsrfToken,
  requestAccessToken,
} from "@/lib/session";

/**
 * Holds the signed-in session.
 *
 * The access token lives in memory only, never in localStorage: anything in
 * storage can be read by any script that gets onto the page, and this token
 * opens the club's whole administration. The cost is that a refresh loses it,
 * so on every load the app quietly asks the API for a new one using the
 * HttpOnly refresh cookie, which no script can read.
 *
 * None of this is the security boundary. The API checks capability and team
 * scope on every request; this only decides what the interface offers.
 */

type Status = "loading" | "authenticated" | "anonymous";

type AuthValue = {
  status: Status;
  user: SessionUser | null;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
  /** Fetch against the API with the current token, refreshing once if it expired. */
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  // A ref, not state: authFetch must read the current token without being
  // recreated every time it changes.
  const tokenRef = useRef<string | null>(null);

  const adopt = useCallback(async (token: string) => {
    tokenRef.current = token;
    const current = await fetchCurrentUser(token);
    setUser(current);
    setStatus(current ? "authenticated" : "anonymous");
    return current;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const token = await requestAccessToken();
      if (cancelled) return;
      if (!token) {
        setStatus("anonymous");
        return;
      }
      await adopt(token);
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [adopt]);

  const signIn = useCallback<AuthValue["signIn"]>(
    async (email, password) => {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          (body as { error?: { message?: string } })?.error?.message ??
          "Sign in failed. Please try again.";
        return { ok: false, error: message };
      }

      const body: unknown = await response.json();
      const token = (body as { access_token?: string }).access_token;
      if (typeof token !== "string") return { ok: false, error: "Sign in failed." };

      const current = await adopt(token);
      return current ? { ok: true } : { ok: false, error: "Sign in failed." };
    },
    [adopt],
  );

  const signOut = useCallback(async () => {
    const csrf = readCsrfToken();
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: csrf ? { "X-CSRF-TOKEN": csrf } : {},
    }).catch(() => null);

    tokenRef.current = null;
    setUser(null);
    setStatus("anonymous");
  }, []);

  const authFetch = useCallback<AuthValue["authFetch"]>(async (path, init) => {
    const call = (token: string | null) =>
      fetch(`${API_URL}/api/v1${path}`, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

    const response = await call(tokenRef.current);
    // A 15-minute token will expire mid-session. One silent refresh and retry
    // keeps that invisible; a second failure means the session is really over.
    if (response.status !== 401) return response;

    const token = await requestAccessToken();
    if (!token) return response;
    tokenRef.current = token;
    return call(token);
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, signIn, signOut, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}
