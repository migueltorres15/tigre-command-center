#!/usr/bin/env python3
"""
Lee los leads del USA Research Tracker y devuelve JSON para el call list.
USO interno por la API de Next.js.

Args opcionales (JSON en stdin o argv):
  action: "read" | "update"
  row_index: fila 1-based en el Sheet (para update)
  status: nuevo status (para update)
"""
import sys, json, warnings
warnings.filterwarnings('ignore')
sys.path.insert(0, '/Users/papaspichones/Library/Python/3.9/lib/python/site-packages')

import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
]
creds = Credentials.from_service_account_file(
    '/Users/papaspichones/tigre-command-center/secrets/google-sheets-key.json',
    scopes=SCOPES,
)
gc = gspread.authorize(creds)
sh = gc.open_by_key('1fuHe6FPZdUi0S2HJidEqqPdJ06BSqhO3DTV33Yz4_6c')
ws = sh.worksheet('USA Research Tracker')

# A=State B=City C=Niche D=Business E=HasWeb F=Rating G=Reviews
# H=Phone I=Email J=Address K=Priority L=MapsURL M=Status N=Notes
COL = {
    'state': 0, 'city': 1, 'niche': 2, 'nombre': 3,
    'has_web': 4, 'rating': 5, 'reviews': 6,
    'phone': 7, 'email': 8, 'address': 9,
    'priority': 10, 'maps_url': 11, 'status': 12, 'notas': 13,
}
STATUS_COL = COL['status'] + 1   # 1-based for gspread

# ── Parsear acción ────────────────────────────────────────────────────────────
action     = 'read'
row_index  = None
new_status = None

if len(sys.argv) > 1:
    try:
        data = json.loads(sys.argv[1])
        action     = data.get('action', 'read')
        row_index  = data.get('row_index')
        new_status = data.get('status')
    except:
        pass

# ── UPDATE ────────────────────────────────────────────────────────────────────
if action == 'update' and row_index and new_status:
    ws.update_cell(row_index, STATUS_COL, new_status)
    print(json.dumps({'ok': True, 'row': row_index, 'status': new_status}))
    sys.exit(0)

# ── READ ──────────────────────────────────────────────────────────────────────
rows = ws.get_all_values()
leads = []

for i, row in enumerate(rows[1:], start=2):  # skip header, 1-based index
    nombre = row[COL['nombre']].strip() if len(row) > COL['nombre'] else ''
    if not nombre:
        continue

    def g(col_key):
        idx = COL[col_key]
        return row[idx].strip() if len(row) > idx else ''

    leads.append({
        'row_index': i,
        'nombre':    nombre,
        'niche':     g('niche'),
        'city':      g('city'),
        'state':     g('state'),
        'phone':     g('phone'),
        'email':     g('email'),
        'priority':  g('priority'),
        'maps_url':  g('maps_url'),
        'status':    g('status') or 'Sin contactar',
        'notas':     g('notas'),
        'rating':    g('rating'),
        'has_web':   g('has_web'),
    })

print(json.dumps(leads, ensure_ascii=False))
