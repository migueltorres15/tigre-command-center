export const dynamic = 'force-dynamic';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export async function POST(request) {
  try {
    const { bcs_id } = await request.json();
    if (!bcs_id) return Response.json({ error: 'bcs_id requerido' }, { status: 400 });

    const slug = bcs_id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const demoDir = path.join(process.env.HOME, 'tigre-demos');
    const builderScript = path.join(demoDir, 'demo-builder.py');

    // Verificar si ya existe el demo
    const metaFiles = fs.readdirSync(demoDir)
      .map(d => path.join(demoDir, d, 'meta.json'))
      .filter(f => {
        try {
          const meta = JSON.parse(fs.readFileSync(f));
          return meta.id === bcs_id;
        } catch { return false; }
      });

    const num = parseInt(bcs_id.replace('BCS-', ''), 10) || 0;
    const port = 8000 + num;

    // Lanzar builder en background
    const logFile = `/tmp/demo-${bcs_id.toLowerCase()}.log`;
    exec(
      `python3 ${builderScript} --id ${bcs_id} --serve --port ${port} > ${logFile} 2>&1`,
      { detached: true }
    );

    return Response.json({
      ok: true,
      bcs_id,
      port,
      url: `http://localhost:${port}`,
      log: logFile,
      message: `Demo iniciando en localhost:${port} — listo en ~3 minutos`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const demoDir = path.join(process.env.HOME, 'tigre-demos');
    const demos = [];

    for (const dir of fs.readdirSync(demoDir)) {
      const metaPath = path.join(demoDir, dir, 'meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath));
          demos.push(meta);
        } catch {}
      }
    }
    return Response.json(demos);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
