import { fetchSubmissions } from '@/lib/kobo';
import { filterSubmissionsForUser } from '@/lib/filter';
import Link from 'next/link';

export const revalidate = 60;

const HIDDEN_KEYS = new Set([
  '_id', '_uuid', '_xform_id_string', '_attachments', '_status',
  '_geolocation', '_submission_time', '_tags', '_notes', '_validation_status',
  '_submitted_by', '__version__', 'formhub/uuid', 'meta/instanceID', 'meta/rootUuid',
  '_version_', '_version__001',
]);

export default async function KoboViewPage({ searchParams }) {
  let submissions = await fetchSubmissions();
  submissions = await filterSubmissionsForUser(submissions);

  const sorted = [...submissions].sort(
    (a, b) => new Date(b._submission_time).getTime() - new Date(a._submission_time).getTime()
  );

  const selectedId = searchParams?.id ? Number(searchParams.id) : null;
  const submission = selectedId ? sorted.find((s) => s._id === selectedId) : null;

  if (sorted.length === 0) {
    return <div className="bg-white rounded-lg shadow p-6 text-center text-slate-500">No submissions yet.</div>;
  }

  return (
    <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-4">
      <aside className={`bg-white rounded-lg shadow overflow-hidden lg:max-h-[calc(100vh-100px)] lg:sticky lg:top-20 ${submission ? 'hidden lg:block' : ''}`}>
        <div className="px-3 py-2 border-b bg-slate-50 flex items-center justify-between sticky top-0">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Submissions</div>
            <div className="text-sm font-medium">{sorted.length} total</div>
          </div>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          <ul className="divide-y divide-slate-100">
            {sorted.map((s) => (
              <li key={s._id}>
                <Link
                  href={`/kobo-view?id=${s._id}`}
                  scroll={false}
                  className={`block px-3 py-3 hover:bg-slate-50 active:bg-slate-100 ${s._id === submission?._id ? 'bg-brand-50 border-l-4 border-brand-500' : ''}`}
                >
                  <div className="text-sm font-medium">#{s._id}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {new Date(s._submission_time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className={`space-y-4 ${!submission ? 'hidden lg:block' : ''} mt-0 lg:mt-0`}>
        {submission ? (
          <>
            <Link
              href="/kobo-view"
              scroll={false}
              className="lg:hidden inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back to list
            </Link>

            <div className="bg-white rounded-lg shadow">
              <div className="p-4 sm:p-6 border-b border-slate-100">
                <div className="text-xs uppercase tracking-wide text-slate-500">Submission</div>
                <h2 className="text-xl font-semibold">#{submission._id}</h2>
                <div className="text-sm text-slate-500 mt-1">
                  {new Date(submission._submission_time).toLocaleString()}
                </div>
              </div>

              <div className="p-4 sm:p-6">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {Object.entries(submission)
                    .filter(([k]) => !HIDDEN_KEYS.has(k) && !k.startsWith('_'))
                    .map(([k, v]) => (
                      <div key={k} className="border-l-2 border-slate-100 pl-3">
                        <dt className="text-xs uppercase tracking-wide text-slate-500">{prettyKey(k)}</dt>
                        <dd className="text-sm text-slate-900 mt-0.5 break-words">{renderValue(v, submission)}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            </div>

            {submission._attachments?.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-3">
                  Attachments ({submission._attachments.length})
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {submission._attachments.map((a) => (
                    <a key={a.id} href={`/api/photo?url=${encodeURIComponent(a.download_url)}`} target="_blank" rel="noreferrer" className="block group">
                      <img
                        src={`/api/photo?url=${encodeURIComponent(a.download_small_url || a.download_url)}`}
                        alt={a.filename}
                        className="w-full h-40 object-cover rounded-lg border border-slate-200 group-hover:border-brand-500 transition"
                      />
                      <div className="text-xs text-slate-500 truncate mt-1.5">{a.filename?.split('/').pop()}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="hidden lg:flex bg-white rounded-lg shadow p-12 items-center justify-center text-slate-400">
            Select a submission from the list
          </div>
        )}
      </section>
    </div>
  );
}

function prettyKey(k) {
  return k.replace(/_/g, ' ').replace(/\//g, ' / ');
}

function renderValue(v, submission) {
  if (v === null || v === undefined || v === '') return <em className="text-slate-400">empty</em>;
  if (typeof v === 'object') return <pre className="text-xs bg-slate-50 p-2 rounded">{JSON.stringify(v, null, 2)}</pre>;
  const str = String(v);
  if (/\.(jpg|jpeg|png|webp|heic)$/i.test(str)) {
    const att = submission._attachments?.find((a) => (a.filename || '').endsWith(str.replace(/\s+/g, '_')));
    if (att) {
      return (
        <a href={`/api/photo?url=${encodeURIComponent(att.download_url)}`} target="_blank" rel="noreferrer">
          <img
            src={`/api/photo?url=${encodeURIComponent(att.download_small_url || att.download_url)}`}
            alt={str}
            className="h-28 rounded border mt-1"
          />
        </a>
      );
    }
  }
  return str;
}
