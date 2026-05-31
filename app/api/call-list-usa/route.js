export const dynamic = 'force-dynamic';
import { getSheetsClient, SHEETS_ID, USA_SHEET } from '@/lib/sheets';

// Column indices (0-based) in USA Research Tracker
// A=State B=City C=Niche D=Business E=HasWeb F=Rating G=Reviews
// H=Phone I=Email J=Address K=Priority L=MapsURL M=Status N=Notes
const COL = {
  state: 0, city: 1, niche: 2, nombre: 3,
  has_web: 4, rating: 5, reviews: 6,
  phone: 7, email: 8, address: 9,
  priority: 10, maps_url: 11, status: 12, notas: 13,
};
const STATUS_COL = COL.status + 1; // 1-based for Sheets API

function g(row, key) {
  const idx = COL[key];
  return row[idx] ? row[idx].toString().trim() : '';
}

export async function GET() {
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEETS_ID,
      range: `${USA_SHEET}!A2:N`,
    });

    const rows = res.data.values || [];
    const leads = [];

    rows.forEach((row, i) => {
      const nombre = g(row, 'nombre');
      if (!nombre) return;
      leads.push({
        row_index: i + 2, // 1-based + header row
        nombre,
        niche:    g(row, 'niche'),
        city:     g(row, 'city'),
        state:    g(row, 'state'),
        phone:    g(row, 'phone'),
        email:    g(row, 'email'),
        priority: g(row, 'priority'),
        maps_url: g(row, 'maps_url'),
        status:   g(row, 'status') || 'Sin contactar',
        notas:    g(row, 'notas'),
        rating:   g(row, 'rating'),
        has_web:  g(row, 'has_web'),
      });
    });

    return Response.json(leads);
  } catch (error) {
    console.error('call-list-usa GET error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { row_index, status } = await request.json();
    if (!row_index || !status) {
      return Response.json({ error: 'row_index y status requeridos' }, { status: 400 });
    }

    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEETS_ID,
      range: `${USA_SHEET}!M${row_index}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[status]] },
    });

    return Response.json({ ok: true, row: row_index, status });
  } catch (error) {
    console.error('call-list-usa POST error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
