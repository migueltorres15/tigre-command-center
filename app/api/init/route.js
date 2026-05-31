export const dynamic = 'force-dynamic';
import { initSchema } from '@/lib/db';

export async function GET() {
  try {
    await initSchema();
    return Response.json({ ok: true, message: 'Schema initialized' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
