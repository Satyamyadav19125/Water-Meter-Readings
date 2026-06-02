// Debug page - shows raw submission JSON so you can map field names
import { fetchSubmissions } from '@/lib/kobo';

export const revalidate = 30;

export default async function DebugPage() {
  let submissions = [];
  let error = null;
  try {
    submissions = await fetchSubmissions({ limit: 5 });
  } catch (e) {
    error = e.message;
  }

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
        <p className="font-semibold">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
        <p className="font-semibold mb-1">Use this page once to find your field names</p>
        <p>Look at the keys in the JSON below (e.g. <code>village_name</code>, <code>wm_serial</code>, etc.)
          and put them into <code>lib/fieldMap.js</code> in your GitHub repo.</p>
      </div>

      {submissions.length === 0 ? (
        <p>No submissions yet. Submit one Kobo form and refresh this page.</p>
      ) : (
        submissions.map((s) => (
          <details key={s._id} className="bg-white rounded shadow">
            <summary className="cursor-pointer p-3 font-mono text-sm">
              Submission #{s._id} — {new Date(s._submission_time).toLocaleString()}
            </summary>
            <pre className="p-3 text-xs overflow-x-auto bg-slate-50">{JSON.stringify(s, null, 2)}</pre>
          </details>
        ))
      )}
    </div>
  );
}
