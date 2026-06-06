import './globals.css';
import MobileNav from '@/components/MobileNav';
import Footer from '@/components/Footer';
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/db';

export const metadata = {
  title: 'Water Meter Dashboard · Digital Village Project',
  description: 'Tel Aviv University × Thapar Institute — water-saving research in Punjab agriculture',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'WaterMeter' },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, themeColor: '#0c4a6e',
};

export default async function RootLayout({ children }) {
  let user = null;
  let formUploadUrl = '';
  try {
    user = await getCurrentUser();
    const settings = await getSettings();
    formUploadUrl = settings?.project?.formUploadUrl || '';
  } catch {}

  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen flex flex-col">
        <MobileNav user={user} formUploadUrl={formUploadUrl} />
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 pb-20">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
