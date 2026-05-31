#!/usr/bin/env python3
"""
Lee el Research Tracker de Google Sheets y devuelve en JSON
los leads con status "Demo Agendado" para sincronizar al command center.
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
ws = sh.worksheet('Research Tracker')
rows = ws.get_all_values()

# Columnas (0-indexed): A=ciudad B=termino C=nombre D=tiene_web E=rating
# F=resenas G=telefono H=direccion I=instagram J=whatsapp K=email
# L=gaps M=prioridad N=maps_url O=status (índice 14)
DEMO_STATUSES = ['demo agendado', 'demo agendada', 'demo_agendado']

leads = []
for row in rows[2:]:  # saltar título + header
    if len(row) <= 14:
        continue
    status = row[14].strip().lower()
    if status not in DEMO_STATUSES:
        continue
    nombre = row[2].strip()
    if not nombre:
        continue
    leads.append({
        'nombre':    nombre,
        'ciudad':    row[0].strip(),
        'termino':   row[1].strip(),
        'telefono':  row[6].strip(),
        'direccion': row[7].strip(),
        'instagram': row[8].strip(),
        'whatsapp':  row[9].strip(),
        'email':     row[10].strip(),
        'maps_url':  row[13].strip(),
        'status':    row[14].strip(),
    })

print(json.dumps(leads, ensure_ascii=False))
