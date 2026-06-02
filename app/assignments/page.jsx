// Assignments page - read-only view of the assignments.json file
import assignmentsData from '@/data/assignments.json';

export default function AssignmentsPage() {
  const list = assignmentsData.assignments || [];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
        <p className="font-semibold mb-1">How to update assignments</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Open your GitHub repo in the browser.</li>
          <li>Navigate to <code>data/assignments.json</code>.</li>
          <li>Click the pencil ✏️ icon to edit, change the JSON, and commit.</li>
          <li>Vercel will auto-redeploy in ~1 minute. Refresh this page.</li>
        </ol>
      </div>

      <h2 className="text-lg font-semibold">{list.length} people assigned</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.map((a, i) => (
          <div key={i} className="bg-white rounded shadow p-4">
            <div className="font-semibold">{a.person}</div>
            {a.phone && <div className="text-sm text-slate-600">📞 {a.phone}</div>}
            {a.email && <div className="text-sm text-slate-600">✉️ {a.email}</div>}
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Meters ({a.meters?.length || 0})</div>
              <ul className="text-sm space-y-1">
                {(a.meters || []).map((m, j) => (
                  <li key={j} className="flex justify-between border-b border-slate-100 py-1">
                    <span>{m.village}</span>
                    <span className="font-mono text-xs">{m.serial}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
