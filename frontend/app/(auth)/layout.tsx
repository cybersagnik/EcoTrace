export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-bg text-text antialiased selection:bg-accent selection:text-bg">
      {children}
    </div>
  );
}

