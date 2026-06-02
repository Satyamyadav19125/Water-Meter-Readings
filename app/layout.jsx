import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Water Meter Dashboard',
  description: 'Twice-weekly water meter reading tracker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="bg-slate-900 text-white">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4">
            <h1 className="text-lg font-semibold">💧 Water Meter Dashboard</h1>
            <nav className="flex flex-wrap gap-3 text-sm">
              <Link className="hover:underline" href="/">Pending this week</Link>
              <Link className="hover:underline" href="/dashboard">All submissions</Link>
              <Link className="hover:underline" href="/kobo-view">Kobo view</Link>
              <Link className="hover:underline" href="/assignments">Assignments</Link>
              <Link className="hover:underline" href="/debug">Debug</Link>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto p-4">{children}</main>
      </body>
    </html>
  );
}
