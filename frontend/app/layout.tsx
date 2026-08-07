import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { DemoModeProvider } from "@/lib/demoMode";

export const metadata: Metadata = {
  title: "EcoTrace — Enterprise Sustainability Observability Platform",
  description: "Real-time IoT telemetry, carbon footprint tracking & grid intensity metrics.",
};

const themeScript = `
  (function() {
    try {
      var saved = localStorage.getItem('ecotrace_theme');
      var theme = 'dark';
      if (saved === 'light' || saved === 'dark') {
        theme = saved;
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        theme = 'light';
      }
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-bg text-text antialiased transition-colors duration-200">
        <DemoModeProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </DemoModeProvider>
      </body>
    </html>
  );
}
