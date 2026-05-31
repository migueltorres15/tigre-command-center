#!/usr/bin/env python3
"""
📧 Agente Cold Email USA — Tigre Studio
Lee leads del Sheet "USA Research Tracker" que tengan email y status "Sin contactar",
genera email personalizado por negocio y lo envía desde hola@tigrestudio.mx.

Límite: DAILY_LIMIT emails por ejecución (default 20).
Actualiza el Sheet con status "Email enviado — YYYY-MM-DD".

USO:
  python3 agente_cold_email_usa.py
  python3 agente_cold_email_usa.py --limit 10
  python3 agente_cold_email_usa.py --dry-run   # simula sin enviar
"""

import sys, time, datetime, logging, argparse, smtplib, re
sys.path.insert(0, '/Users/papaspichones/Library/Python/3.9/lib/python/site-packages')

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ── CLI ───────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--limit',   type=int, default=20, help='Máx emails por ejecución')
parser.add_argument('--dry-run', action='store_true',  help='Simula sin enviar')
parser.add_argument('--debug',   action='store_true',  help='Verbose logging')
args = parser.parse_args()

DAILY_LIMIT = args.limit
DRY_RUN     = args.dry_run
TODAY       = datetime.date.today().isoformat()

# ── Logging ───────────────────────────────────────────────────────────────────
log_path = '/Users/papaspichones/Library/Logs/tigre-cold-email-usa.log'
logging.basicConfig(
    handlers=[
        logging.FileHandler(log_path),
        logging.StreamHandler(sys.stdout),
    ],
    level=logging.DEBUG if args.debug else logging.INFO,
    format='%(asctime)s %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.info

mode = "🔵 DRY RUN" if DRY_RUN else "🚀 LIVE"
log(f"📧 Cold Email USA iniciando {mode} — límite: {DAILY_LIMIT} emails — {TODAY}")

# ── SMTP ──────────────────────────────────────────────────────────────────────
SMTP_HOST = 'smtpout.secureserver.net'
SMTP_PORT = 587
SMTP_USER = 'hola@tigrestudio.mx'
SMTP_PASS = 'Oroazul21'
FROM_NAME = 'Miguel | Tigre Studio'
FROM_ADDR = f'{FROM_NAME} <{SMTP_USER}>'

# ── Google Sheets ─────────────────────────────────────────────────────────────
import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
creds = Credentials.from_service_account_file(
    "/Users/papaspichones/tigre-command-center/secrets/google-sheets-key.json",
    scopes=SCOPES,
)
gc  = gspread.authorize(creds)
sh  = gc.open_by_key("1fuHe6FPZdUi0S2HJidEqqPdJ06BSqhO3DTV33Yz4_6c")
ws  = sh.worksheet("USA Research Tracker")

# Columnas (0-indexed):
# A=State B=City C=Niche D=Business E=HasWeb F=Rating G=Reviews
# H=Phone I=Email J=Address K=Priority L=MapsURL M=Status N=Notes O=DateAdded
COL = {
    'state': 0, 'city': 1, 'niche': 2, 'nombre': 3,
    'email': 8, 'priority': 10, 'maps_url': 11,
    'status': 12, 'notas': 13,
}

# ── Templates de email ────────────────────────────────────────────────────────
NICHE_LABELS = {
    'nail salon':        'nail salon',
    'hair salon':        'hair salon',
    'barbershop':        'barbershop',
    'auto repair':       'auto repair shop',
    'massage':           'massage studio',
    'dog groomer':       'dog grooming business',
    'bakery':            'bakery',
    'alterations':       'alterations shop',
    'restaurant':        'restaurant',
}

def niche_label(niche):
    for k, v in NICHE_LABELS.items():
        if k in niche.lower():
            return v
    return niche

def build_subject(nombre):
    return f"Quick question about {nombre}"

def build_body(nombre, city, state, niche):
    nl = niche_label(niche)
    return f"""Hi {nombre},

I was searching for {nl}s in {city} and noticed you don't have a website yet.

Most people search Google before visiting a business in person — without a site, they're going to whoever shows up first, even if you're the better option.

I build simple, professional websites for small businesses like yours:

✅ Shows up on Google searches in {city}
✅ Mobile-friendly (works great on phones)
✅ Online booking / contact form
✅ Your services, photos, hours, and location
✅ Ready in 5 days — starting at $150 USD

No monthly fees. No contracts. You own it.

Would a quick 10-minute call this week make sense? I'm happy to show you examples of sites I've built for other {nl}s in {state}.

Best,
Miguel Torres
Tigre Studio — Websites for Small Businesses
tigrestudio.mx | hola@tigrestudio.mx
"""

# ── Envío de email ────────────────────────────────────────────────────────────
def send_email(to_addr, subject, body):
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From']    = FROM_ADDR
    msg['To']      = to_addr
    msg.attach(MIMEText(body, 'plain'))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)

# ── Leer leads elegibles ──────────────────────────────────────────────────────
log("📋 Leyendo leads del Sheet...")
all_rows = ws.get_all_values()
data     = all_rows[1:]  # skip header

eligible = []
for i, row in enumerate(data):
    if len(row) <= max(COL.values()):
        continue

    email  = row[COL['email']].strip()
    status = row[COL['status']].strip()

    # Necesita email válido
    if not email:
        continue
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$', email):
        continue

    # Solo los sin contactar (o con error previo para reintento)
    if status and status not in ('Sin contactar', '') and not status.startswith('Error'):
        continue

    eligible.append({
        'row_index': i + 2,      # 1-based + header
        'nombre':   row[COL['nombre']].strip(),
        'city':     row[COL['city']].strip(),
        'state':    row[COL['state']].strip(),
        'niche':    row[COL['niche']].strip(),
        'email':    email,
        'priority': row[COL['priority']].strip(),
    })

# Ordenar P1 → P2 → P3
priority_order = {'P1': 0, 'P2': 1, 'P3': 2}
eligible.sort(key=lambda x: priority_order.get(x['priority'], 3))

log(f"   {len(eligible)} leads elegibles (con email, sin contactar)")
log(f"   Enviando máximo {DAILY_LIMIT} emails")

if not eligible:
    log("⚠ No hay leads con email disponibles. Corre primero el agente de research.")
    sys.exit(0)

# ── Loop de envío ─────────────────────────────────────────────────────────────
sent   = 0
errors = 0
batch  = eligible[:DAILY_LIMIT]

for lead in batch:
    nombre   = lead['nombre']
    city     = lead['city']
    state    = lead['state']
    niche    = lead['niche']
    email    = lead['email']
    row_idx  = lead['row_index']
    priority = lead['priority']

    subject = build_subject(nombre)
    body    = build_body(nombre, city, state, niche)

    log(f"\n  [{priority}] {nombre} — {city}, {state}")
    log(f"       📧 {email}")

    if DRY_RUN:
        log(f"       🔵 DRY RUN — omitiendo envío")
        log(f"       Subject: {subject}")
        sent += 1
        continue

    try:
        send_email(email, subject, body)
        ws.update_cell(row_idx, COL['status'] + 1, f"Email enviado — {TODAY}")
        ws.update_cell(row_idx, COL['notas']  + 1, f"Enviado {TODAY}")
        log(f"       ✅ Enviado")
        sent += 1
        time.sleep(4)   # pausa entre emails para no quemar el dominio

    except Exception as e:
        msg_err = str(e)[:80]
        log(f"       ❌ Error: {msg_err}")
        ws.update_cell(row_idx, COL['status'] + 1, f"Error — {msg_err[:50]}")
        errors += 1
        time.sleep(6)

# ── Resumen final ─────────────────────────────────────────────────────────────
pendientes = len(eligible) - len(batch)
log(f"\n{'='*60}")
log(f"📊 RESULTADO: {sent} enviados | {errors} errores | {pendientes} pendientes")
if DRY_RUN:
    log("🔵 DRY RUN — ningún email fue enviado realmente")
log(f"{'='*60}\n")

print(f"\n✅ Cold Email USA — {TODAY}")
print(f"   Enviados:   {sent}")
print(f"   Errores:    {errors}")
print(f"   Pendientes: {pendientes} para próxima ejecución")
