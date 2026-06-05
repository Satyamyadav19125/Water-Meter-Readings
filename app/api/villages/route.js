import { NextResponse } from 'next/server';
import { fetchSubmissions } from '@/lib/kobo';
import { getField } from '@/lib/fieldMap';

export const revalidate = 120;

export async function GET() {
  try {
    const subs = await fetchSubmissions();
    const villages = new Set();
    const meters = new Set();
    const metersByVillage = {};
    for (const s of subs) {
      const village = getField(s, 'village');
      const serial = getField(s, 'serial');
      if (village) villages.add(village);
      if (serial) meters.add(serial);
      if (village && serial) {
        if (!metersByVillage[village]) metersByVillage[village] = new Set();
        metersByVillage[village].add(serial);
      }
    }
    return NextResponse.json({
      villages: Array.from(villages).sort(),
      meters: Array.from(meters).sort(),
      metersByVillage: Object.fromEntries(
        Object.entries(metersByVillage).map(([k, v]) => [k, Array.from(v).sort()])
      ),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
