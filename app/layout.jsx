import './globals.css';
import MobileNav from '@/components/MobileNav';
import { isAdmin } from '@/lib/auth';

export const metadata = {
  title: 'Water Meter Dashboard',
  description: 'Twice-weekly water meter reading tracker for the Digital Village project',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WaterMeter',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0c4a6e',
};

export default async function RootLayout({ children }) {
  const admin = await isAdmin();
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen">
        <MobileNav isAdmin={admin} />
        <main className="max-w-7xl mx-auto p-3 sm:p-4 pb-20">{children}</main>
      </body>
    </html>
  );
}
