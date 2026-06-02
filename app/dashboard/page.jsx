// All submissions table with expandable rows + red flags
import { fetchSubmissions } from '@/lib/kobo';
import { detectRedFlags } from '@/lib/redflags';
import { getField } from '@/lib/fieldMap';
import SubmissionTable from '@/components/SubmissionTable';

export const revalidate = 60;

export default async function DashboardPage() {
  let submissions = [];
  let error = null;
  try {
    submissions = await fetchSubmissions();
  } catch (e) {
    error = e.message;
  }

  if (error) {
    return <ErrorBox message={error} />;
  }

  const flags = detectRedFlags(submissions);
  const flaggedCount = Object.keys(flags).length;

  // Sort newest first for display
  const sorted = [...submissions].sort(
    (a, b) =>
      new Date(b._submission_time).getTime() -
      new Date(a._submission_time).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">All submissions ({submissions.length})</h2>
        {flaggedCount > 0 && (
          <span className="bg-red-100 text-red-800 border border-red-300 px-3 py-1 rounded text-sm">
            🚩 {flaggedCount} red-flagged
          </span>
        )}
      </div>
      <SubmissionTable submissions={sorted} flags={flags} />
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
      <p className="font-semibold mb-1">Could not load data from Kobo</p>
      <p className="text-sm">{message}</p>
    </div>
  );
}
