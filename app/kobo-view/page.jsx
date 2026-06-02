// Kobo-style submission view - mirrors the form layout
import { fetchSubmissions } from '@/lib/kobo';

export const revalidate = 60;

const HIDDEN_KEYS = new Set([
  '_id', '_uuid', '_xform_id_string', '_attachments', '_status',
  '_geolocation', '_submission_time', '_tags', '_notes', '_validation_status',
  '_submitted_by', '__version__', 'formhub/uuid', 'meta/instanceID', 'meta/rootUuid',
  '_version_', '_version__001',
]);

export default async function KoboViewPage({ searchParams }) {
  const submissions = await fetchSubmissions();
  const sorted = [...submissions].sort(
    (a, b) => new Date(b._submission_time).getTime() - new Date(a._submission_time).getTime()
  );

  const selectedId = searchParams?.id ? Number(searchParams.id) : sorted[0]?._id;
  const submission = sorted.find((s) => s._id === selectedId) || sorted[0];

  if (!submission) {
    return <p>No submissions yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Sidebar of submissions */}
      <aside className="md:col-span-1 bg-white rounded shadow overflow-y-auto" style={{ maxHeight: '80vh' }}>
        <div className="p-2 text-xs uppercase tracking-wide text-slate-500 sticky top-0 bg-white border-b">
          {sorted.length} submissions
        </div>
        <ul>
          {sorted.map((s) => (
            <li key={s._id}>
              <a
                href={`/kobo-view?id=${s._id}`}
                className={`block px-3 py-2 text-sm border-b hover:bg-slate-50 ${s._id === submission._id ? 'bg-slate-100 font-semibold' : ''}`}
              >
                <div>#{s._id}</div>
                <div className="text-xs text-slate-600">{new Date(s._submission_time).toLocaleString()}</div>
              </a>
            </li>
          ))}
        </ul>
      </aside>

      {/* Detail panel - styled like Kobo's submission view */}
      <section className="md:col-span-3 bg-white rounded shadow p-4">
        <h2 className="text-lg font-semibold mb-1">Submission #{submission._id}</h2>
        <p className="text-xs text-slate-500 mb-4">
          Submitted {new Date(submission._submission_time).toLocaleString()} · UUID {submission._uuid}
        </p>

        <table className="w-full text-sm">
          <tbody>
            {Object.entries(submission)
              .filter(([k]) => !HIDDEN_KEYS.has(k) && !k.startsWith('_'))
              .map(([k, v]) => (
                <tr key={k} className="border-t">
                  <td className="py-2 pr-4 align-top font-medium text-slate-700 w-1/3">{k}</td>
                  <td className="py-2 align-top">{renderValue(v, submission, k)}</td>
                </tr>
              ))}
          </tbody>
        </table>

        {submission._attachments?.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold mb-2">Attachments</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {submission._attachments.map((a) => (
                <a key={a.id} href={`/api/photo?url=${encodeURIComponent(a.download_url)}`} target="_blank" rel="noreferrer">
                  <img
                    src={`/api/photo?url=${encodeURIComponent(a.download_small_url || a.download_url)}`}
                    alt={a.filename}
                    className="w-full h-40 object-cover rounded border"
                  />
                  <div className="text-xs text-slate-500 truncate mt-1">{a.filename?.split('/').pop()}</div>
                </a>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function renderValue(v, submission, key) {
  if (v === null || v === undefined || v === '') return <em className="text-slate-400">empty</em>;
  if (typeof v === 'object') return <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto">{JSON.stringify(v, null, 2)}</pre>;
  const str = String(v);
  // If this looks like an attachment filename, show a thumbnail
  if (/\.(jpg|jpeg|png|webp|heic)$/i.test(str)) {
    const att = submission._attachments?.find((a) => (a.filename || '').endsWith(str.replace(/\s+/g, '_')));
    if (att) {
      return (
        <a href={`/api/photo?url=${encodeURIComponent(att.download_url)}`} target="_blank" rel="noreferrer">
          <img
            src={`/api/photo?url=${encodeURIComponent(att.download_small_url || att.download_url)}`}
            alt={str}
            className="h-32 rounded border"
          />
        </a>
      );
    }
  }
  return str;
}
