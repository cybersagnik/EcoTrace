"use client";

import { useState } from "react";
import Link from "next/link";
import { Leaf, Mail, ArrowRight, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
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
          Reset Password
        </h1>
        <p className="text-xs text-text-muted">
          Enter your registered work email to receive password reset instructions.
        </p>
      </div>

      {submitted ? (
        <div className="rounded border border-accent/30 bg-accent/10 p-5 text-center space-y-3 animate-fade-in font-mono text-xs">
          <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
          <h3 className="font-bold text-text">Reset Link Sent</h3>
          <p className="text-text-muted text-[11px] leading-relaxed">
            We sent password reset instructions to <span className="text-accent">{email}</span>. Please check your inbox.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="text-accent hover:underline text-[11px] font-semibold"
          >
            Resend Email
          </button>
        </div>
      ) : (
        <form className="space-y-4 font-mono text-xs" onSubmit={handleSubmit}>
          <div>
            <label className="block text-text-muted mb-1.5">Work Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-text-faint" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ecotrace.io"
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
                <span>Sending Reset Link...</span>
              </>
            ) : (
              <>
                <span>Send Reset Link</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      )}

      <div className="text-center text-xs text-text-faint pt-2 border-t border-border">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-accent font-semibold hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Sign In</span>
        </Link>
      </div>
    </div>
  );
}
