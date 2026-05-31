export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';
import { execSync } from 'child_process';

export async function GET() {
  try {
    // Leer leads con "Demo Agendado" del Research Tracker
    const output = execSync(
      '/usr/bin/python3 /Users/papaspichones/tigre-command-center/scripts/sync_crm_mx.py',
      { encoding: 'utf8', timeout: 30000 }
    );

    const leads = JSON.parse(output.trim());
    const db = getDb();
    const creados = [];
    const yaExisten = [];

    // Cargar TODOS los sitios (incluidos perdido) para evitar recrear eliminados
    const todosLosSitios = await db.prepare('SELECT id, cliente, whatsapp, etapa FROM sitios').all();

    // Normalizar teléfono — solo dígitos
    const normTel = t => (t || '').replace(/\D/g, '');

    // Normalizar texto — sin acentos, sin caracteres especiales, minúsculas
    const normStr = s => (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quitar acentos (á→a, ñ→n, etc.)
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();

    // Palabras clave significativas
    const STOP = new Set(['de','la','el','los','las','y','a','en','por','del','by','the','and','su','mi']);
    const keywords = nombre => normStr(nombre)
      .split(' ')
      .filter(w => w.length > 2 && !STOP.has(w));

    for (const lead of leads) {
      const telLead = normTel(lead.whatsapp || lead.telefono);
      const kwsLead = keywords(lead.nombre);
      const normLead = normStr(lead.nombre);

      const existe = todosLosSitios.find(s => {
        const normSitio = normStr(s.cliente);

        // 1. Nombre normalizado exacto
        if (normSitio === normLead) return true;

        // 2. Teléfono coincide (si ambos tienen teléfono)
        const telSitio = normTel(s.whatsapp);
        if (telLead.length >= 7 && telSitio.length >= 7 && telSitio === telLead) return true;

        // 3. El nombre del pipeline está contenido en el del sheet o viceversa
        if (normLead.includes(normSitio) || normSitio.includes(normLead)) return true;

        // 4. Suficientes keywords en común (mín 2)
        const kwsSitio = keywords(s.cliente);
        const coinciden = kwsLead.filter(k => kwsSitio.includes(k)).length;
        if (coinciden >= 2) return true;

        return false;
      });

      if (existe) {
        yaExisten.push(lead.nombre);
        continue;
      }

      // Construir notas con info del CRM
      const notas = [
        lead.ciudad    ? `📍 ${lead.ciudad}`    : '',
        lead.termino   ? `🏷 ${lead.termino}`   : '',
        lead.email     ? `📧 ${lead.email}`     : '',
        lead.instagram ? `📸 ${lead.instagram}` : '',
        lead.maps_url  ? `🗺 ${lead.maps_url}`  : '',
      ].filter(Boolean).join('\n');

      const whatsapp = lead.whatsapp || lead.telefono || '';

      const ins = await db.prepare(
        `INSERT INTO sitios (cliente, contacto, whatsapp, fecha_demo, paquete, link_demo, link_sitio, etapa, monto, moneda, notas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        lead.nombre, '', whatsapp, '',
        'por_elegir', '', '',
        'demo_agendado',
        null, 'MXN', notas
      );

      const nuevo = await db.prepare('SELECT * FROM sitios WHERE id = ?').get(ins.lastInsertRowid);
      creados.push(nuevo);
    }

    return Response.json({
      ok: true,
      totalEnSheet: leads.length,
      creados: creados.length,
      yaExisten: yaExisten.length,
      nuevos: creados,
      ts: new Date().toISOString(),
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
