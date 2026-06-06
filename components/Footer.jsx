import { getSettings } from '@/lib/db';

export default async function Footer() {
  let settings;
  try { settings = await getSettings(); } catch { settings = null; }
  const c = settings?.contact;

  if (!c || !c.showInFooter) {
    return (
      <footer className="mt-12 py-6 text-center text-xs text-slate-400">
        <p>Digital Village Project · Tel Aviv University × Thapar Institute</p>
      </footer>
    );
  }

  const showE = c.showEmails;
  const showP = c.showPhone;

  return (
    <footer className="mt-12 py-6 border-t border-slate-200/60 bg-white/50">
      <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
        <p className="text-xs text-slate-500">
          <span className="text-field-700">💧</span> Digital Village Project · Tel Aviv University × Thapar Institute
        </p>
        {(showE || showP) && (
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-x-3 gap-y-1 flex-wrap">
            <span>Contact:</span>
            {showE && c.adminEmail && <a href={`mailto:${c.adminEmail}`} className="hover:text-brand-600 hover:underline">{c.adminEmail}</a>}
            {showE && c.leadEmail && <a href={`mailto:${c.leadEmail}`} className="hover:text-brand-600 hover:underline">{c.leadEmail}</a>}
            {showP && c.adminPhone && <a href={`tel:${c.adminPhone}`} className="hover:text-brand-600 hover:underline">{c.adminPhone}</a>}
          </p>
        )}
      </div>
    </footer>
  );
}
