#!/usr/bin/env python3
"""
🔍 Email Enrichment — Tigre Studio
Lee leads del Sheet SIN email, busca su sitio web, lo visita y extrae el email de contacto.
Actualiza el Sheet con emails encontrados para que el Cold Email agent los procese.

Estrategia (en orden):
  1. Buscar el sitio web del negocio en Google → visitar home + /contact → extraer email
  2. Buscar directamente "{nombre} {city} email contact" en Google
  3. Buscar en Yelp y navegar al perfil del negocio

USO:
  python3 agente_email_enrichment.py
  python3 agente_email_enrichment.py --limit 30
  python3 agente_email_enrichment.py --debug
"""

import sys, re, time, logging, argparse, urllib.parse
sys.path.insert(0, '/Users/papaspichones/Library/Python/3.9/lib/python/site-packages')

parser = argparse.ArgumentParser()
parser.add_argument('--limit', type=int, default=50, help='Leads a procesar')
parser.add_argument('--debug', action='store_true')
args = parser.parse_args()

log_path = '/Users/papaspichones/Library/Logs/tigre-email-enrichment.log'
logging.basicConfig(
    handlers=[logging.FileHandler(log_path), logging.StreamHandler(sys.stdout)],
    level=logging.DEBUG if args.debug else logging.INFO,
    format='%(asctime)s %(message)s', datefmt='%H:%M:%S',
)
log = logging.info
log(f"🔍 Email Enrichment iniciando — hasta {args.limit} leads")

# ── Google Sheets ─────────────────────────────────────────────────────────────
import warnings
warnings.filterwarnings('ignore')
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
gc = gspread.authorize(creds)
sh = gc.open_by_key("1fuHe6FPZdUi0S2HJidEqqPdJ06BSqhO3DTV33Yz4_6c")
ws = sh.worksheet("USA Research Tracker")

# A=State B=City C=Niche D=Business E=HasWeb F=Rating G=Reviews
# H=Phone I=Email J=Address K=Priority L=MapsURL M=Status N=Notes
COL = {
    'state': 0, 'city': 1, 'niche': 2, 'nombre': 3,
    'has_web': 4,
    'email': 8, 'priority': 10, 'maps_url': 11,
    'status': 12, 'notas': 13,
}

# ── Helpers de email ──────────────────────────────────────────────────────────
EMAIL_RE  = re.compile(r'[a-zA-Z0-9_.+\-]+@[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}')
EMAIL_SKIP = (
    'google', 'gstatic', 'googleapis', 'sentry', 'example', 'schema',
    'wixpress', 'squarespace', 'godaddy', 'cloudflare', 'yelp',
    'facebook', 'instagram', 'twitter', 'tiktok', 'linkedin',
    'intercom', 'apple', 'amazonaws', 'mailchimp', 'hubspot',
    'wix.com', 'weebly', 'shopify', 'wordpress', 'outlook',
    'noreply', 'no-reply', 'donotreply',
    'duckduckgo', 'bing.com', 'yahoo.com', 'w3.org', 'mozilla.org',
)
SKIP_DOMAINS = (
    'google.com', 'yelp.com', 'tripadvisor.com', 'facebook.com',
    'instagram.com', 'twitter.com', 'yellowpages.com', 'superpages.com',
    'citysearch.com', 'thumbtack.com', 'houzz.com', 'nextdoor.com',
    'mapquest.com', 'bingmaps', 'apple.com',
)

def extract_emails(text):
    found = []
    for m in EMAIL_RE.findall(text):
        domain = m.split('@')[-1].lower()
        if not any(s in domain for s in EMAIL_SKIP):
            found.append(m.lower())
    return list(dict.fromkeys(found))

def is_biz_url(url):
    """Devuelve True si la URL parece un sitio web de negocio (no directorio)."""
    if not url or not url.startswith('http'):
        return False
    return not any(d in url.lower() for d in SKIP_DOMAINS)

# ── Playwright helpers ────────────────────────────────────────────────────────
from playwright.sync_api import sync_playwright

def safe_goto(page, url, timeout=20000):
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=timeout)
        time.sleep(1.5)
        return True
    except Exception as e:
        log(f"       ⚠ goto {url[:60]}: {e}")
        return False

def scrape_page_emails(page):
    """Extrae emails del HTML actual de la página."""
    try:
        html = page.content()
        return extract_emails(html)
    except:
        return []

def find_email_on_website(page, website_url):
    """Visita el sitio web del negocio y busca email en home + /contact."""
    if not safe_goto(page, website_url):
        return None

    emails = scrape_page_emails(page)
    if emails:
        log(f"       📧 Email en homepage: {emails[0]}")
        return emails[0]

    # Intentar páginas de contacto comunes
    base = '/'.join(website_url.rstrip('/').split('/')[:3])
    for path in ['/contact', '/contact-us', '/about-us', '/about', '/info', '/reach-us']:
        try:
            contact_url = base + path
            page.goto(contact_url, wait_until="domcontentloaded", timeout=15000)
            time.sleep(1.2)
            emails = scrape_page_emails(page)
            if emails:
                log(f"       📧 Email en {path}: {emails[0]}")
                return emails[0]
        except:
            continue

    return None

def find_website_via_ddg(page, nombre, city, state):
    """Busca el sitio web del negocio en DuckDuckGo (sin captcha) y devuelve la URL."""
    q = urllib.parse.quote(f'"{nombre}" {city} {state}')
    try:
        page.goto(f"https://html.duckduckgo.com/html/?q={q}", wait_until="domcontentloaded", timeout=25000)
        time.sleep(2)

        html = page.content()

        # DuckDuckGo links directos como: href="https://..."
        emails = extract_emails(html)
        if emails:
            log(f"       📧 Email en snippet DDG: {emails[0]}")
            return None, emails[0]

        # DuckDuckGo /html devuelve hrefs directos a los sitios
        urls = re.findall(r'class="result__url"[^>]*>([^<]+)<', html)
        for raw in urls:
            url = 'https://' + raw.strip()
            if is_biz_url(url):
                return url, None

        # Fallback: buscar hrefs
        all_hrefs = re.findall(r'href="(https?://[^"]+)"', html)
        for url in all_hrefs:
            if is_biz_url(url):
                return url, None

    except Exception as e:
        log(f"       ⚠ DDG search: {e}")
    return None, None

def find_email_direct_ddg(page, nombre, city, state):
    """Busca email directamente en DuckDuckGo y navega a sitios encontrados."""
    q = urllib.parse.quote(f'"{nombre}" {city} email contact')
    try:
        page.goto(f"https://html.duckduckgo.com/html/?q={q}", wait_until="domcontentloaded", timeout=25000)
        time.sleep(2)
        html = page.content()

        emails = extract_emails(html)
        if emails:
            log(f"       📧 Email via DDG direct: {emails[0]}")
            return emails[0]

        # Navegar a sitios encontrados
        urls = re.findall(r'class="result__url"[^>]*>([^<]+)<', html)
        for raw in urls[:3]:
            url = 'https://' + raw.strip()
            if is_biz_url(url):
                email = find_email_on_website(page, url)
                if email:
                    return email

    except Exception as e:
        log(f"       ⚠ DDG direct: {e}")
    return None

def find_email_yelp(page, nombre, city, state):
    """Busca el negocio en Yelp y navega al perfil para extraer email/website."""
    try:
        q = f"{nombre} {city} {state}".replace(' ', '+')
        page.goto(
            f"https://www.yelp.com/search?find_desc={q}&find_loc={city.replace(' ','+')},+{state}",
            wait_until="domcontentloaded", timeout=20000
        )
        time.sleep(2)

        # Ir al primer resultado de Yelp
        links = page.locator('a[href*="/biz/"]').all()
        if links:
            biz_url = links[0].get_attribute('href')
            if biz_url:
                if not biz_url.startswith('http'):
                    biz_url = 'https://www.yelp.com' + biz_url
                page.goto(biz_url, wait_until="domcontentloaded", timeout=20000)
                time.sleep(2)
                html = page.content()

                # Buscar email directo
                emails = extract_emails(html)
                if emails:
                    log(f"       📧 Email en Yelp: {emails[0]}")
                    return emails[0]

                # Buscar link al website del negocio
                website_links = re.findall(r'href="(https?://(?!(?:www\.yelp|biz\.yelp))[^"]+)"', html)
                for wl in website_links[:3]:
                    if is_biz_url(wl):
                        log(f"       🌐 Website via Yelp: {wl[:60]}")
                        email = find_email_on_website(page, wl)
                        if email:
                            return email
    except Exception as e:
        log(f"       ⚠ Yelp error: {e}")
    return None

# ── Leer leads sin email ──────────────────────────────────────────────────────
log("📋 Leyendo leads sin email del Sheet...")
all_rows = ws.get_all_values()
data = all_rows[1:]  # skip header

to_enrich = []
for i, row in enumerate(data):
    if len(row) <= max(COL['email'], COL['status'], COL['nombre']):
        continue
    email  = row[COL['email']].strip() if len(row) > COL['email'] else ''
    status = row[COL['status']].strip() if len(row) > COL['status'] else ''
    nombre = row[COL['nombre']].strip()
    if email:
        continue  # ya tiene email
    if not nombre:
        continue
    if status and 'Sin contactar' not in status:
        continue
    to_enrich.append({
        'row_index': i + 2,
        'nombre':    nombre,
        'city':      row[COL['city']].strip() if len(row) > COL['city'] else '',
        'state':     row[COL['state']].strip() if len(row) > COL['state'] else '',
        'niche':     row[COL['niche']].strip() if len(row) > COL['niche'] else '',
        'has_web':   row[COL['has_web']].strip().lower() if len(row) > COL['has_web'] else '',
        'maps_url':  row[COL['maps_url']].strip() if len(row) > COL['maps_url'] else '',
        'priority':  row[COL['priority']].strip() if len(row) > COL['priority'] else '',
    })

# Priorizar: P1 > P2 > P3, y dentro de cada prioridad: los que tienen has_web=True primero
priority_order = {'P1': 0, 'P2': 1, 'P3': 2, '': 3}
to_enrich.sort(key=lambda x: (priority_order.get(x['priority'], 3), 0 if x['has_web'] in ('true','yes','1') else 1))
to_enrich = to_enrich[:args.limit]

log(f"   {len(to_enrich)} leads sin email para enriquecer")

# ── Buscar emails con Playwright ──────────────────────────────────────────────
found_count = 0
not_found   = 0

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        locale="en-US",
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1280, "height": 800},
    )
    page = ctx.new_page()

    for lead in to_enrich:
        nombre   = lead['nombre']
        city     = lead['city']
        state    = lead['state']
        has_web  = lead['has_web']

        log(f"\n  [{lead['priority']}] {nombre} — {city}, {state}  (has_web={has_web})")

        email = None

        # Estrategia 1: DuckDuckGo → buscar sitio web → visitar → extraer email
        website_url, quick_email = find_website_via_ddg(page, nombre, city, state)
        if quick_email:
            email = quick_email
        elif website_url:
            log(f"       🌐 Visitando: {website_url[:70]}")
            email = find_email_on_website(page, website_url)

        # Estrategia 2: Búsqueda directa de email en DuckDuckGo
        if not email:
            email = find_email_direct_ddg(page, nombre, city, state)

        # Estrategia 3: Yelp como último recurso
        if not email:
            email = find_email_yelp(page, nombre, city, state)

        if email:
            ws.update_cell(lead['row_index'], COL['email'] + 1, email)
            log(f"       ✅ Sheet actualizado: {email}")
            found_count += 1
        else:
            log(f"       ❌ Sin email encontrado")
            not_found += 1

        time.sleep(3)

    browser.close()

# ── Resumen ───────────────────────────────────────────────────────────────────
log(f"\n{'='*60}")
log(f"📊 Enrichment: {found_count} emails encontrados | {not_found} sin email")
log(f"   Ahora corre agente_cold_email_usa.py para enviar")
log(f"{'='*60}\n")

print(f"\n✅ Email Enrichment completado")
print(f"   Emails encontrados: {found_count} / {len(to_enrich)}")
print(f"   Listos para cold email: {found_count}")
