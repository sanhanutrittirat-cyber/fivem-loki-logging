import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FiveM Log Watcher",
  description: "Realtime FiveM transaction watcher",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-mono">
        <Providers>
          <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
            <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-6 px-4 text-sm">
              <span className="font-bold tracking-wide text-emerald-400">● LOGWATCH</span>
              <nav className="flex items-center gap-4 text-zinc-400">
                <Link href="/" className="hover:text-zinc-100">Overview</Link>
                <Link href="/watcher" className="hover:text-zinc-100">Watcher</Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-[1600px] p-4">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
