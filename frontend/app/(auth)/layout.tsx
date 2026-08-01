export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#070d14] text-slate-100 antialiased selection:bg-emerald-500 selection:text-black">
      {children}
    </div>
  );
}

