"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Leaf, User, Mail, Building, ArrowRight, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      router.push("/dashboard");
    }, 600);
  };

  return (
    <div className="rounded border border-border bg-panel p-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded bg-accent p-0.5">
          <div className="flex h-full w-full items-center justify-center rounded bg-bg">
            <Leaf className="h-6 w-6 text-success" />
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-text">
          Create EcoTrace Account
        </h1>
        <p className="text-xs text-text-muted">
          Register your organization for real-time sustainability observability
        </p>
      </div>

      <form className="space-y-4 font-mono text-xs" onSubmit={handleSubmit}>
        <div>
          <label className="block text-text-muted mb-1.5">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-text-faint" />
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full rounded border border-border bg-elevated/40 pl-10 pr-3 py-2.5 text-text placeholder-text-faint focus:border-accent focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-text-muted mb-1.5">Organization Name</label>
          <div className="relative">
            <Building className="absolute left-3 top-3 h-4 w-4 text-text-faint" />
            <input
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Sustainability Corp"
              className="w-full rounded border border-border bg-elevated/40 pl-10 pr-3 py-2.5 text-text placeholder-text-faint focus:border-accent focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-text-muted mb-1.5">Work Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-text-faint" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@acme.com"
              className="w-full rounded border border-border bg-elevated/40 pl-10 pr-3 py-2.5 text-text placeholder-text-faint focus:border-accent focus:outline-none transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded bg-accent py-3 font-mono text-xs font-semibold text-bg hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Provisioning Workspace...</span>
            </>
          ) : (
            <>
              <span>Create Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="text-center text-xs text-text-faint pt-2 border-t border-border">
        Already have an account?{" "}
        <Link href="/login" className="text-accent font-semibold hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  );
}
