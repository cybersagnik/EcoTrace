// Phase-later. Wired up alongside app/(auth)/* and lib/auth.ts.
export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "member";
}

export interface Session {
  user: AuthUser | null;
  expires_at: string | null;
}
