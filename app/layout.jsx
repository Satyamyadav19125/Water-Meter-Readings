import './globals.css';
import MobileNav from '@/components/MobileNav';
import Footer from '@/components/Footer';
import GuestGuard from '@/components/GuestGuard';
import PageTransition from '@/components/PageTransition';
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
  // Mobile keyboards resize the page instead of covering the chat composer.
  interactiveWidget: 'resizes-content',
};

// Runs BEFORE paint so the saved theme (light / dark / liquid-glass) applies
// without a white/black flash.
const themeInit = `try{var t=localStorage.getItem('wmd-theme');if(t==='dark'){document.documentElement.classList.add('dark')}else if(t==='glass'){document.documentElement.classList.add('glass')}}catch(e){}`;

export default async function RootLayout({ children }) {
  let user = null;
  let formUploadUrl = '';
  // The custom guest/app name (Settings → Guest viewer) and whether the admin
  // forced the generic public landing. MobileNav decides when to SHOW the guest
  // brand (guest login, the /view link, or generic-public) vs the original
  // "PVC Pipe Readings" — so the root landing keeps the real branding.
  let guestBrandName = '';
  let publicGeneric = false;
  try {
    user = await getCurrentUser();
    const settings = await getSettings();
    formUploadUrl = settings?.project?.formUploadUrl || '';
    guestBrandName = (settings?.guest?.appName || '').trim();
    publicGeneric = settings?.landingControls?.publicGeneric === true;
  } catch {}

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link rel="apple-touch-icon" href="/apple-icon" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen flex flex-col">
        <div className="glass-bg" aria-hidden="true" />
        <MobileNav user={user} formUploadUrl={formUploadUrl} guestBrandName={guestBrandName} publicGeneric={publicGeneric} />
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 pb-20">
          <PageTransition>{children}</PageTransition>
        </main>
        {user?.role === 'guest' && <GuestGuard />}
        <Footer />
      </body>
    </html>
  );
}
