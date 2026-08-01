"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Cloud,
  TrendingUp,
  Leaf,
  Check,
  LogIn,
} from "lucide-react";
import { setSessionToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@ecotrace.io");
  const [password, setPassword] = useState("••••••••••••");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setError(null);
    setLoading(true);

    setTimeout(() => {
      setSessionToken("eco_session_authenticated_admin");
      setLoading(false);
      router.push("/dashboard");
    }, 600);
  };

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-[#060D15] text-slate-100 overflow-hidden font-sans">
      {/* LEFT SIDE: Hero Showcase Panel (50% width on Desktop) */}
      <div className="relative flex w-full lg:w-1/2 flex-col justify-between p-8 lg:p-14 bg-gradient-to-b from-[#091624] via-[#050C14] to-[#04090F] border-b lg:border-b-0 lg:border-r border-emerald-900/20 overflow-hidden min-h-[600px] lg:min-h-screen">
        {/* Background Ambient Glow & Mesh Orbs */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[450px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 h-72 w-72 rounded-full bg-teal-500/10 blur-[90px] pointer-events-none" />

        {/* Top Header: EcoTrace Brand Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-500/30 bg-slate-950 shadow-md">
            <Image
              src="/images/ecotrace_logo.jpg"
              alt="EcoTrace 3D Emblem Logo"
              width={44}
              height={44}
              priority
              className="h-full w-full object-cover object-center"
            />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white font-display">
            Eco<span className="text-[#10B981]">Trace</span>
          </span>
        </div>

        {/* Main Hero Headline & Subtitle */}
        <div className="relative z-10 my-auto py-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
            Track Today. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#059669]">
              Transform Tomorrow.
            </span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-md font-normal leading-relaxed">
            Real-time carbon emission tracker for a sustainable future.
          </p>

          {/* Central Illuminated 3D Globe & Floating Glass Metrics Container */}
          <div className="relative mt-8 mb-6 flex items-center justify-center">
            {/* Ambient Backlight Halo behind Globe */}
            <div className="absolute inset-0 m-auto h-[320px] w-[320px] rounded-full bg-[#10B981]/15 blur-2xl pointer-events-none animate-pulse" />

            {/* 3D Globe Image */}
            <div className="relative h-[300px] sm:h-[360px] w-full max-w-[420px] flex items-center justify-center">
              <Image
                src="/images/ecotrace_login_globe.png"
                alt="EcoTrace Holographic 3D Globe"
                fill
                priority
                className="object-contain drop-shadow-[0_0_35px_rgba(16,185,129,0.3)] transition-transform duration-700 hover:scale-105"
              />

              {/* Floating Glassmorphism Metric Badge 1: CO2 Saved */}
              <div className="absolute -top-2 left-2 sm:left-4 z-20 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[#0B1826]/80 p-3 px-4 backdrop-blur-md shadow-2xl shadow-emerald-950/50 animate-bounce-slow">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-[#10B981]">
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-400">CO₂ Saved</div>
                  <div className="text-sm font-bold text-white tracking-wide">12,345 t</div>
                </div>
              </div>

              {/* Floating Glassmorphism Metric Badge 2: Emissions Trend */}
              <div className="absolute top-4 right-2 sm:right-4 z-20 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[#0B1826]/80 p-3 px-4 backdrop-blur-md shadow-2xl shadow-emerald-950/50">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-[#10B981]">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-400">Emissions</div>
                  <div className="text-sm font-bold text-[#10B981] flex items-center gap-1">
                    -18.6% <span className="text-[10px] text-slate-400 font-normal">vs last month</span>
                  </div>
                </div>
              </div>

              {/* Floating Glassmorphism Metric Badge 3: Active Projects */}
              <div className="absolute -bottom-2 right-6 sm:right-10 z-20 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[#0B1826]/80 p-3 px-4 backdrop-blur-md shadow-2xl shadow-emerald-950/50">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-[#10B981]">
                  <Leaf className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-400">Total Projects</div>
                  <div className="text-sm font-bold text-white tracking-wide">
                    256 <span className="text-xs text-[#10B981] font-medium">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Trusted Organizations & Carousel Indicators */}
        <div className="relative z-10 mt-auto pt-6 border-t border-slate-800/50">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Trusted by 500+ Organizations Worldwide
          </p>

          <div className="flex flex-wrap items-center justify-between gap-4 text-slate-400 px-2 opacity-80">
            {/* GreenTech */}
            <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm tracking-tight text-slate-300">
              <Leaf className="h-4 w-4 text-[#10B981]" />
              <span>GreenTech</span>
            </div>

            {/* TerraWave */}
            <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm tracking-tight text-slate-300">
              <svg className="h-4 w-4 text-[#10B981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3a9 9 0 0 0 0 18" />
              </svg>
              <span>TerraWave</span>
            </div>

            {/* NaturaCorp */}
            <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm tracking-tight text-slate-300">
              <svg className="h-4 w-4 text-[#10B981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>NaturaCorp</span>
            </div>

            {/* EcoSphere */}
            <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm tracking-tight text-slate-300">
              <svg className="h-4 w-4 text-[#10B981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <span>EcoSphere</span>
            </div>
          </div>

          {/* Carousel Pagination Dots */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <span className="h-2 w-7 rounded-full bg-[#10B981] shadow-glow" />
            <span className="h-2 w-2 rounded-full bg-slate-700" />
            <span className="h-2 w-2 rounded-full bg-slate-700" />
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Sleek Dark Sign-In Form Panel */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center items-center p-6 sm:p-12 lg:p-16 bg-[#081019] relative min-h-screen">
        <div className="w-full max-w-md space-y-8 my-auto">
          {/* Top Hexagonal Badge with Shield Icon */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative flex h-16 w-16 items-center justify-center">
              {/* Hexagon SVG Frame */}
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-emerald-950 stroke-emerald-500/40" fill="currentColor">
                <polygon points="50,3 93,25 93,75 50,97 7,75 7,25" strokeWidth="3" />
              </svg>
              {/* Glowing Shield Icon */}
              <div className="relative z-10 text-[#10B981]">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 14.5l-3.5-3.5 1.41-1.41L11 12.67l5.09-5.09L17.5 9 11 15.5z" />
                </svg>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">Welcome Back</h2>
              <p className="mt-2 text-sm text-slate-400">
                Sign in to continue monitoring your organization&apos;s carbon footprint.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-center font-mono text-xs font-semibold text-rose-400 animate-shake">
              {error}
            </div>
          )}

          {/* Form Controls */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-xl border border-slate-800 bg-[#0F1924] pl-12 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-all focus:border-[#10B981] focus:bg-[#121E2C] focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-800 bg-[#0F1924] pl-12 pr-12 py-3 text-sm text-white placeholder-slate-500 transition-all focus:border-[#10B981] focus:bg-[#121E2C] focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                    rememberMe
                      ? "border-[#10B981] bg-[#10B981] text-slate-950"
                      : "border-slate-700 bg-[#0F1924] group-hover:border-slate-500"
                  }`}
                >
                  {rememberMe && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
                <span className="text-slate-300 text-sm font-medium select-none">Remember me</span>
              </label>

              <Link
                href="/forgot-password"
                className="text-sm font-medium text-[#10B981] hover:text-[#34D399] hover:underline transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Sign In Primary Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#10B981] via-[#059669] to-[#10B981] py-3.5 px-6 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-950/50 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-6">
            <div className="w-full border-t border-slate-800" />
            <span className="absolute bg-[#081019] px-4 text-xs font-semibold uppercase text-slate-500 tracking-widest">
              OR
            </span>
          </div>

          {/* Social Logins Row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Google Button */}
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#0D1722] py-2.5 px-3 text-xs font-semibold text-slate-200 hover:border-slate-700 hover:bg-[#121E2C] transition-all cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
                />
              </svg>
              <span>Google</span>
            </button>

            {/* Microsoft Button */}
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#0D1722] py-2.5 px-3 text-xs font-semibold text-slate-200 hover:border-slate-700 hover:bg-[#121E2C] transition-all cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              <span>Microsoft</span>
            </button>

            {/* GitHub Button */}
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#0D1722] py-2.5 px-3 text-xs font-semibold text-slate-200 hover:border-slate-700 hover:bg-[#121E2C] transition-all cursor-pointer"
            >
              <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>GitHub</span>
            </button>
          </div>

          {/* Footer Signup Prompt */}
          <p className="text-center text-sm text-slate-400 pt-4">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-[#10B981] hover:text-[#34D399] hover:underline inline-flex items-center gap-1 transition-colors"
            >
              <span>Create Account</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
