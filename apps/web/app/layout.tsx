import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { GlobalNavDock } from "@/components/layout/GlobalNavDock";
import { ActiveView } from "@/components/layout/ActiveView";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iUM - Insight, Understanding, Mastery",
  description: "An agentic learning ecosystem powered by Opik",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex h-screen w-screen overflow-hidden">
            <GlobalNavDock />
            <ActiveView>{children}</ActiveView>
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

