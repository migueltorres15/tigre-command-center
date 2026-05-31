#!/usr/bin/env python3
"""
🇺🇸 Agente Research USA — Tigre Studio
Encuentra negocios en Estados Unidos SIN website usando Google Maps.
Recorre múltiples ciudades hasta alcanzar el límite de leads.
Deposita leads en Google Sheets (tab: USA Research Tracker).

USO:
  python3 agente_research_usa.py                          # defaults: nail salon, 50 leads
  python3 agente_research_usa.py --niche "hair salon" --limit 50
  python3 agente_research_usa.py --niche "auto repair" --limit 30

NICHOS BUENOS: nail salon, hair salon, barbershop, auto repair,
               massage therapist, dog groomer, alterations, bakery
"""

import sys, re, time, datetime, logging, argparse, json
sys.path.insert(0, '/Users/papaspichones/Library/Python/3.9/lib/python/site-packages')

# ── CLI ───────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description='Agente Research USA — Google Maps Lead Scraper')
parser.add_argument('--niche',  default='nail salon', help='Tipo de negocio (en inglés)')
parser.add_argument('--limit',  type=int, default=50, help='Máximo de leads a recolectar')
parser.add_argument('--debug',  action='store_true',  help='Verbose logging')
args = parser.parse_args()

NICHE = args.niche
LIMIT = args.limit
TODAY = datetime.date.today().isoformat()

# ── Ciudades objetivo — en orden de prioridad ─────────────────────────────────
# Ciudades mid-size con alta densidad de negocios de servicio y baja adopción digital
CITIES = [
    ("Corpus Christi", "TX"),
    ("McAllen",        "TX"),
    ("Laredo",         "TX"),
    ("Brownsville",    "TX"),
    ("El Paso",        "TX"),
    ("Lubbock",        "TX"),
    ("Amarillo",       "TX"),
    ("Fresno",         "CA"),
    ("Bakersfield",    "CA"),
    ("Stockton",       "CA"),
    ("Modesto",        "CA"),
    ("Visalia",        "CA"),
    ("Albuquerque",    "NM"),
    ("Tucson",         "AZ"),
    ("Mesa",           "AZ"),
]

# ── Logging ───────────────────────────────────────────────────────────────────
log_path = f'/Users/papaspichones/Library/Logs/tigre-usa-leads-{TODAY}.log'
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

log(f"🇺🇸 Agente USA iniciando — niche: {NICHE} — meta: {LIMIT} leads — {len(CITIES)} ciudades disponibles")

# ── Exclusiones ───────────────────────────────────────────────────────────────
EXCLUDED = [
    "marriott","hilton","hyatt","sheraton","westin","ritz","four seasons",
    "intercontinental","ihg","wyndham","best western","holiday inn","hampton inn",
    "courtyard","residence inn","doubletree","embassy suites","kimpton",
    "loews","omni","waldorf","w hotel","st. regis","le méridien",
    "massage envy","hand & stone","elements massage","zeel","soothe",
    "great clips","sport clips","supercuts","fantastic sam","regis salon",
    "ulta","ulta beauty","european wax","the joint chiro","joint chiropractic",
    "aspen dental","great expressions","smile doctors",
    "county","city of ","department of","va hospital","veterans affairs",
    "community health","federally qualified","non-profit","nonprofit",
    "united way","salvation army","ymca","ywca","goodwill",
    "planet fitness","la fitness","anytime fitness","24 hour fitness",
    "equinox","orangetheory","crunch fitness","gold's gym","lifetime fitness",
    "nursing home","assisted living","senior living","memory care",
    "hospice","skilled nursing","rehabilitation center",
]

def is_excluded(name):
    n = name.lower()
    return any(kw in n for kw in EXCLUDED)

# ── Google Sheets ─────────────────────────────────────────────────────────────
import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
creds = Credentials.from_service_account_file(
    "/Users/papaspichones/tigre-command-center/secrets/google-sheets-key.json",
    scopes=SCOPES
)
gc = gspread.authorize(creds)
sh = gc.open_by_key("1fuHe6FPZdUi0S2HJidEqqPdJ06BSqhO3DTV33Yz4_6c")

TAB_NAME = "USA Research Tracker"
try:
    ws = sh.worksheet(TAB_NAME)
except gspread.WorksheetNotFound:
    ws = sh.add_worksheet(title=TAB_NAME, rows=2000, cols=15)
    ws.update(values=[[
        "State","City","Niche","Business","Has Website","Rating","Reviews",
        "Phone","Email","Address","Priority","Maps URL","Status","Notes","Date Added"
    ]], range_name="A1")
    ws.freeze(rows=1)

log("📋 Leyendo leads ya existentes...")
existing_rows = ws.get_all_values()
EXISTING = set()
for row in existing_rows[1:]:
    if len(row) > 3 and row[3].strip():
        EXISTING.add(row[3].strip().lower())
log(f"   {len(EXISTING)} negocios ya en el sheet")

# ── Scrapling + utilidades ────────────────────────────────────────────────────
from scrapling import Adaptor

def parse_html(html):
    return Adaptor(html, auto_match=False)

def normalize(s):
    return s.lower().strip()

def already_exists(name, local_results):
    n = normalize(name)
    if n in EXISTING: return True
    return any(normalize(r['nombre']) == n for r in local_results)

def score_priority(rating_str, reviews_str):
    try:
        r = float(str(rating_str).replace(",","."))
        n_str = re.sub(r'[^\d]', '', str(reviews_str))
        n = int(n_str) if n_str else None
        if n is not None:
            if r >= 4.5 and 20 <= n <= 300: return "P1"
            elif r >= 4.0 and n >= 10:       return "P2"
            else:                            return "P3"
        else:
            if r >= 4.5: return "P2"
            elif r >= 4.0: return "P3"
            else: return "P3"
    except:
        return "P3"

def extract_email(html):
    pattern = r'[a-zA-Z0-9_.+\-]+@[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}'
    skip = ('google','gstatic','googleapis','sentry','example','schema')
    for m in re.findall(pattern, html):
        if not any(s in m.split('@')[-1].lower() for s in skip):
            return m
    return ""

# ── Búsqueda de una ciudad ────────────────────────────────────────────────────
def build_search_terms(niche, city, state):
    return [
        f"{niche} {city} {state}",
        f"best {niche} {city}",
        f"local {niche} near {city} {state}",
        f"{niche} near me {city} {state}",
    ]

def scrape_search(page, term):
    log(f"  🔍 {term}")
    q = term.replace(' ', '+')
    page.goto(f"https://www.google.com/maps/search/{q}", wait_until="domcontentloaded", timeout=30000)
    time.sleep(3)
    try:
        feed = page.locator('div[role="feed"]').first
        for _ in range(12):
            feed.evaluate("el => el.scrollBy(0, 800)")
            time.sleep(0.7)
    except:
        pass
    links = page.locator('a[href*="/maps/place/"]').all()
    urls, seen = [], set()
    for link in links:
        try:
            href = link.get_attribute("href") or ""
            if "/maps/place/" in href and href not in seen:
                seen.add(href); urls.append(href)
        except:
            pass
    log(f"     → {len(urls)} listings")
    return urls

def scrape_listing(page, url, city, state):
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        time.sleep(2.5)

        nombre = ""
        try: nombre = page.locator('h1').first.inner_text(timeout=5000).strip()
        except: pass
        if not nombre: return None

        # Verificar website — si tiene, descartar
        tiene_web = False
        try:
            el = page.locator('a[data-item-id="authority"]').first
            href = el.get_attribute("href", timeout=3000) or ""
            if href and "google" not in href: tiene_web = True
        except: pass
        if not tiene_web:
            try:
                for a in page.locator('a[href^="http"]').all():
                    href = a.get_attribute("href") or ""
                    if href and not any(x in href for x in ("google","maps","gstatic","facebook","instagram","yelp","linkedin","twitter","apple")):
                        tiene_web = True; break
            except: pass
        if tiene_web:
            log(f"    ⏭  Web — {nombre}")
            return None

        html = page.content()
        adaptor = parse_html(html)

        # Rating
        rating = ""
        try:
            el = adaptor.css('.fontDisplayLarge').first
            if el: rating = el.text.strip()
        except: pass

        # Reviews
        reviews = ""
        try:
            btn_text = page.locator('button[aria-label*="review"]').first.inner_text(timeout=3000)
            m = re.search(r'[\d,]+', btn_text)
            if m: reviews = m.group().replace(",","")
        except: pass

        # Teléfono
        telefono = ""
        try:
            telefono = page.locator('[data-item-id^="phone"] .fontBodyMedium').first.inner_text(timeout=3000).strip()
        except: pass
        if not telefono:
            m = re.search(r'\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}', html)
            if m: telefono = m.group().strip()

        # Dirección
        address = ""
        try:
            address = page.locator('[data-item-id="address"] .fontBodyMedium').first.inner_text(timeout=3000).strip()
        except: pass

        # Email
        email = extract_email(html)

        # Filtro fantasma: si no hay nada útil, descartar
        if not telefono and not rating and not reviews:
            log(f"    ⏭  Sin datos — {nombre}")
            return None

        priority = score_priority(rating, reviews)

        return {
            "state": state, "city": city, "niche": NICHE,
            "nombre": nombre, "tiene_web": "No",
            "rating": rating, "reviews": reviews,
            "telefono": telefono, "email": email, "address": address,
            "priority": priority, "maps_url": url,
            "status": "Sin contactar", "notas": "", "fecha": TODAY,
        }
    except Exception as e:
        log(f"    ⚠ Error: {e}")
        return None

# ── MAIN — recorre ciudades hasta llegar al límite ────────────────────────────
results = []

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        locale="en-US",
        timezone_id="America/Chicago",
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1280, "height": 800},
    )
    page = ctx.new_page()

    for city, state in CITIES:
        if len(results) >= LIMIT:
            break

        needed = LIMIT - len(results)
        log(f"\n📍 Ciudad: {city}, {state} — faltan {needed} leads")

        # Recolectar URLs de esta ciudad
        city_urls, seen_urls = [], set()
        for term in build_search_terms(NICHE, city, state):
            for u in scrape_search(page, term):
                if u not in seen_urls:
                    seen_urls.add(u); city_urls.append(u)

        log(f"   {len(city_urls)} listings únicos en {city}")

        # Procesar listings
        city_found = 0
        for url in city_urls:
            if len(results) >= LIMIT:
                break
            data = scrape_listing(page, url, city, state)
            if not data:
                time.sleep(1); continue
            if already_exists(data['nombre'], results):
                log(f"    ↩  Duplicado — {data['nombre']}")
                continue
            if is_excluded(data['nombre']):
                log(f"    🚫 Chain/corp — {data['nombre']}")
                continue
            results.append(data)
            city_found += 1
            log(f"    ✅ [{data['priority']}] {data['nombre']} | ⭐{data['rating']} | 📞{data['telefono'] or 'sin tel'}")
            time.sleep(1.5)

        log(f"   → {city_found} leads nuevos en {city}")

    browser.close()

# ── Resumen ───────────────────────────────────────────────────────────────────
p1 = [r for r in results if r['priority']=='P1']
p2 = [r for r in results if r['priority']=='P2']
p3 = [r for r in results if r['priority']=='P3']

log(f"\n{'='*60}")
log(f"📊 RESULTADO FINAL: {len(results)} leads")
log(f"   P1: {len(p1)}  |  P2: {len(p2)}  |  P3: {len(p3)}")
ciudades_usadas = sorted(set(r['city'] for r in results))
log(f"   Ciudades: {', '.join(ciudades_usadas)}")
log(f"{'='*60}\n")

# ── JSON backup ───────────────────────────────────────────────────────────────
niche_slug = NICHE.replace(' ','-')
backup_path = f"/Users/papaspichones/Library/Logs/usa-leads-{niche_slug}-{TODAY}.json"
with open(backup_path, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
log(f"💾 Backup: {backup_path}")

# ── Google Sheets ─────────────────────────────────────────────────────────────
if results:
    log("📝 Subiendo al Google Sheet...")
    rows = []
    for d in results:
        rows.append([
            d["state"], d["city"], d["niche"], d["nombre"],
            d["tiene_web"], d["rating"], d["reviews"],
            d["telefono"], d["email"], d["address"],
            d["priority"], d["maps_url"], d["status"],
            d["notas"], d["fecha"],
        ])

    needed = len(existing_rows) + len(rows) + 100
    if needed > ws.row_count:
        ws.add_rows(max(needed - ws.row_count, 500))

    next_row = len(existing_rows) + 1
    ws.update(values=rows, range_name=f"A{next_row}")
    log(f"✅ {len(results)} leads subidos (desde fila {next_row})")

    print(f"\n✅ {len(results)} leads de {NICHE}")
    print(f"   Ciudades: {', '.join(ciudades_usadas)}")
    print(f"   P1:{len(p1)}  P2:{len(p2)}  P3:{len(p3)}")
    print(f"📊 Sheet: https://docs.google.com/spreadsheets/d/1fuHe6FPZdUi0S2HJidEqqPdJ06BSqhO3DTV33Yz4_6c")
else:
    log("⚠ No se encontraron leads nuevos")
    print("⚠ No se encontraron leads. Intenta otro nicho.")
