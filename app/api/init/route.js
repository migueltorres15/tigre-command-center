export const dynamic = 'force-dynamic';
import { seed } from '@/lib/db';

export async function GET() {
  try {
    seed();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
