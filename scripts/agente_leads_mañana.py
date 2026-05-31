#!/usr/bin/env python3
"""
🤖 Agente Matutino — Sitios Express
Corre L-V automáticamente al iniciar el Mac.
1. Lee Research Tracker de Google Sheets → sabe qué negocios ya están
2. Busca 25 nuevos leads en Google Maps (spas/masajes Los Cabos)
3. Los agrega directo al Google Sheet con reseñas
"""

import sys, json, re, time, datetime, logging
sys.path.insert(0, '/Users/papaspichones/Library/Python/3.9/lib/python/site-packages')

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    filename='/Users/papaspichones/Library/Logs/tigre-agente-leads.log',
    level=logging.INFO,
    format='%(asctime)s %(message)s'
)
log = logging.info

# ── Solo L-V ──────────────────────────────────────────────────────────────────
hoy = datetime.datetime.now().weekday()  # 0=Lunes, 6=Domingo
if hoy >= 5:
    log("Hoy es fin de semana — agente no corre.")
    print("🛑 Fin de semana — agente en reposo.")
    sys.exit(0)

# ── Filtro de exclusión — negocios que NO son leads viables ───────────────────
EXCLUDED_KEYWORDS = [
    # Resorts y hoteles corporativos
    "resort", "hotel", "hilton", "marriott", "hyatt", "waldorf", "westin",
    "sheraton", "grand velas", "one&only", "one & only", "fiesta americana",
    "solmar", "intercontinental", "riu", "pueblo bonito", "sandos", "princess",
    "hacienda", "all inclusive", "viceroy", "montage", "live aqua", "brisas",
    "meliá", "melia", "paradisus", "hard rock", "vidanta", "grand coral",
    "palmilla", "esperanza", "las ventanas", "pedregal", "marquis", "barceló",
    "barcelo", "krystal", "posada", "inn", "suites",
    # Gubernamental / salud pública
    "imss", "issste", "centro de salud", "secretar", "gobierno", "municipal",
    "salud pública", "clínica pública", "seguro social", "ssp", "dif ",
    "cruz roja", "hospital general", "hospital regional",
    # Asilos / casas hogar
    "casa hogar", "asilo", "hogar de ancianos", "ancian", "voluntariado",
    "institución", "albergue", "refugio", "comedor comunit",
]

def is_excluded(nombre):
    n = nombre.lower()
    for kw in EXCLUDED_KEYWORDS:
        if kw in n:
            return True
    return False

log(f"🤖 Agente matutino iniciando — {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}")

# ── Google Sheets ─────────────────────────────────────────────────────────────
import gspread
from google.oauth2.service_account import Credentials
from gspread_formatting import *

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
creds = Credentials.from_service_account_file(
    "/Users/papaspichones/tigre-command-center/secrets/google-sheets-key.json",
    scopes=SCOPES
)
gc    = gspread.authorize(creds)
sh    = gc.open_by_key("1fuHe6FPZdUi0S2HJidEqqPdJ06BSqhO3DTV33Yz4_6c")
ws    = sh.worksheet("Research Tracker")

# Leer negocios existentes
log("📋 Leyendo Research Tracker...")
existing_rows = ws.get_all_values()
EXISTING = set()
for row in existing_rows[2:]:  # saltar título y headers
    if len(row) > 2 and row[2].strip():
        EXISTING.add(row[2].strip().lower())

log(f"   {len(EXISTING)} negocios ya en el sheet")

# ── Playwright scraper ────────────────────────────────────────────────────────
from playwright.sync_api import sync_playwright

# Términos de búsqueda — geografía expandida BCS
SEARCH_TERMS = [
    # Cabo San Lucas
    "spa masaje Cabo San Lucas",
    "masaje relajante Cabo San Lucas",
    "terapias Cabo San Lucas",
    "centro bienestar Cabo San Lucas",
    "reflexología Cabo San Lucas",
    "masaje terapéutico Cabo San Lucas",
    # San José del Cabo
    "spa masaje San José del Cabo",
    "day spa San José del Cabo",
    "masaje deportivo San José del Cabo",
    "spa facial San José del Cabo",
    # La Paz
    "spa La Paz BCS",
    "masaje La Paz BCS",
    "centro bienestar La Paz BCS",
    "fisioterapia La Paz BCS",
    "masaje relajante La Paz",
    "spa belleza La Paz BCS",
    # Todos Santos
    "spa Todos Santos BCS",
    "masaje Todos Santos BCS",
    "wellness Todos Santos",
    "terapias Todos Santos BCS",
    # El Pescadero / Cerritos
    "spa Pescadero BCS",
    "masaje Pescadero BCS",
    "wellness El Pescadero BCS",
]

# Ciudad por término de búsqueda
def ciudad_from_term(term):
    t = term.lower()
    if "cabo san lucas" in t: return "Cabo San Lucas"
    if "san josé del cabo" in t or "san jose del cabo" in t: return "San José del Cabo"
    if "la paz" in t: return "La Paz"
    if "todos santos" in t: return "Todos Santos"
    if "pescadero" in t: return "El Pescadero"
    if "cerritos" in t: return "Cerritos"
    return "Los Cabos"

results = []

def normalize(s):
    return s.lower().strip()

def already_exists(name):
    n = normalize(name)
    if n in EXISTING:
        return True
    for r in results:
        if normalize(r['nombre']) == n:
            return True
    return False

def detect_gaps(has_web, phone, email, instagram):
    gaps = []
    if not has_web:   gaps.append("Sin web")
    if not phone:     gaps.append("Sin teléfono en Maps")
    if not email:     gaps.append("Sin email")
    if not instagram: gaps.append("Sin Instagram")
    return ", ".join(gaps) if gaps else "Completo"

def priority(rating_str, resenas_str):
    try:
        r = float(str(rating_str).replace(",", "."))
        n = int(str(resenas_str).replace(",","").replace(".",""))
        if r >= 4.5 and n >= 50: return 1
        elif r >= 4.0:            return 2
        else:                     return 3
    except:
        return 2

def scrape_reviews(page):
    reviews = []
    try:
        rev_btn = page.locator('button[aria-label*="reseña"], button[aria-label*="opinión"]').first
        rev_btn.click(timeout=4000)
        time.sleep(2)
    except: pass
    try:
        page.wait_for_selector('[data-review-id], .jftiEf', timeout=5000)
        time.sleep(1)
        try:
            for btn in page.locator('button.w8nwRe').all()[:3]:
                btn.click(); time.sleep(0.3)
        except: pass
        review_els = page.locator('[data-review-id]').all()
        if not review_els:
            review_els = page.locator('.jftiEf').all()
        for el in review_els[:3]:
            try:
                autor = ""
                try: autor = el.locator('.d4r55').first.inner_text(timeout=2000).strip()
                except: pass
                estrellas = ""
                try:
                    aria = el.locator('[aria-label*="estrella"], [aria-label*="star"]').first.get_attribute("aria-label", timeout=2000) or ""
                    m = re.search(r'(\d)', aria)
                    if m: estrellas = m.group(1) + "★"
                except: pass
                texto = ""
                try: texto = el.locator('.wiI7pd, .MyEned span').first.inner_text(timeout=2000).strip()[:300]
                except: pass
                if autor or texto:
                    reviews.append({"autor": autor, "estrellas": estrellas, "texto": texto})
            except: continue
    except: pass
    return reviews[:3]

def scrape_listing(page, url):
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        time.sleep(2.5)

        nombre = ""
        try: nombre = page.locator('h1').first.inner_text(timeout=5000).strip()
        except: pass
        if not nombre: return None

        rating = ""
        try: rating = page.locator('.fontDisplayLarge').first.inner_text(timeout=3000).strip()
        except:
            try: rating = page.locator('span.ceNzKf').first.inner_text(timeout=2000).strip()
            except: pass

        resenas = ""
        try:
            txt = page.locator('button[aria-label*="reseña"], button[aria-label*="opinión"]').first.inner_text(timeout=3000)
            m = re.search(r'[\d,\.]+', txt)
            if m: resenas = m.group().replace(",","")
        except: pass

        telefono = ""
        try: telefono = page.locator('[data-item-id^="phone"] .fontBodyMedium').first.inner_text(timeout=3000).strip()
        except:
            try:
                content = page.content()
                m = re.search(r'(\+52[\s\-]?\d[\d\s\-]{8,}|\b\d{3}[\s\-]\d{3}[\s\-]\d{4}\b|\b\d{10}\b)', content)
                if m: telefono = m.group().strip()
            except: pass

        if not telefono:
            return None  # Sin teléfono = no sirve para cold calling

        # ── Filtro principal: solo negocios SIN website ───────────────────────
        # (si ya tienen web, no son leads para Sitios Express)

        direccion = ""
        try: direccion = page.locator('[data-item-id="address"] .fontBodyMedium').first.inner_text(timeout=3000).strip()
        except: pass

        # ── Website ───────────────────────────────────────────────────────────
        tiene_web = "No"
        web_url_found = ""
        try:
            # Selector 1: botón oficial de sitio web
            el = page.locator('a[data-item-id="authority"]').first
            web_url_found = el.get_attribute("href", timeout=3000) or ""
        except: pass
        if not web_url_found:
            try:
                # Selector 2: cualquier link externo en el panel que no sea Google
                for a in page.locator('a[href^="http"]').all():
                    href = a.get_attribute("href") or ""
                    if href and "google" not in href and "facebook" not in href and "maps" not in href:
                        web_url_found = href
                        break
            except: pass
        if web_url_found and "google" not in web_url_found:
            tiene_web = "Sí"

        # Descartar si ya tienen website — no son leads para Sitios Express
        if tiene_web == "Sí":
            log(f"  ⏭ Tiene web — descartado: {nombre}")
            return None

        # ── Instagram ─────────────────────────────────────────────────────────
        instagram = ""
        try:
            # Buscar links de Instagram en el panel de Maps
            page_content = page.content()
            ig_match = re.search(r'instagram\.com/([A-Za-z0-9._]{2,30})/?(?:"|\?|\'|\\)', page_content)
            if ig_match:
                handle = ig_match.group(1).rstrip('/')
                if handle not in ('p', 'reel', 'stories', 'explore', 'accounts'):
                    instagram = f"@{handle}"
        except: pass

        # Si no encontramos IG en Maps, buscar en el sitio web del negocio
        if not instagram and web_url_found and "google" not in web_url_found:
            try:
                page.goto(web_url_found, wait_until="domcontentloaded", timeout=15000)
                time.sleep(1)
                web_content = page.content()
                ig_match = re.search(r'instagram\.com/([A-Za-z0-9._]{2,30})/?(?:"|\?|\'|\\|/)', web_content)
                if ig_match:
                    handle = ig_match.group(1).rstrip('/')
                    if handle not in ('p', 'reel', 'stories', 'explore', 'accounts', 'sharer'):
                        instagram = f"@{handle}"
                # Volver al listing de Maps para las reviews
                page.goto(url, wait_until="domcontentloaded", timeout=20000)
                time.sleep(1.5)
            except: pass

        reviews = scrape_reviews(page)

        return {
            "ciudad": "San José del Cabo / Los Cabos",
            "termino": "spa masajes",
            "nombre": nombre,
            "tiene_web": tiene_web,
            "rating": rating,
            "resenas": resenas,
            "telefono": telefono,
            "direccion": direccion,
            "instagram": instagram,
            "whatsapp": "",
            "email": "",
            "gaps": detect_gaps(tiene_web=="Sí", telefono, "", instagram),
            "prioridad": priority(rating, resenas),
            "maps_url": url,
            "status": "Sin contactar",
            "review_1_autor":  reviews[0]["autor"]    if len(reviews)>0 else "",
            "review_1_stars":  reviews[0]["estrellas"] if len(reviews)>0 else "",
            "review_1_texto":  reviews[0]["texto"]    if len(reviews)>0 else "",
            "review_2_autor":  reviews[1]["autor"]    if len(reviews)>1 else "",
            "review_2_stars":  reviews[1]["estrellas"] if len(reviews)>1 else "",
            "review_2_texto":  reviews[1]["texto"]    if len(reviews)>1 else "",
            "review_3_autor":  reviews[2]["autor"]    if len(reviews)>2 else "",
            "review_3_stars":  reviews[2]["estrellas"] if len(reviews)>2 else "",
            "review_3_texto":  reviews[2]["texto"]    if len(reviews)>2 else "",
        }
    except Exception as e:
        log(f"  ERROR listing: {e}")
        return None

def scrape_search(page, term):
    log(f"🔍 Buscando: {term}")
    url = f"https://www.google.com/maps/search/{term.replace(' ', '+')}"
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    time.sleep(3)
    try:
        panel = page.locator('div[role="feed"]').first
        for _ in range(10):
            panel.evaluate("el => el.scrollBy(0, 700)")
            time.sleep(1)
    except: pass
    links = page.locator('a[href*="/maps/place/"]').all()
    urls, seen = [], set()
    for link in links:
        try:
            href = link.get_attribute("href") or ""
            if "/maps/place/" in href and href not in seen:
                seen.add(href); urls.append(href)
        except: pass
    log(f"   {len(urls)} URLs encontradas")
    return urls

# ── MAIN ──────────────────────────────────────────────────────────────────────
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        locale="es-MX",
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
    )
    page = ctx.new_page()

    all_urls, seen_urls, url_term_map = [], set(), {}
    for term in SEARCH_TERMS:
        for u in scrape_search(page, term):
            if u not in seen_urls:
                seen_urls.add(u)
                all_urls.append(u)
                url_term_map[u] = term

    log(f"📋 Total URLs únicas: {len(all_urls)}")

    for i, url in enumerate(all_urls):
        if len(results) >= 35: break
        data = scrape_listing(page, url)
        if data:
            term = url_term_map.get(url, "")
            data["ciudad"] = ciudad_from_term(term)
            data["termino"] = term
            if already_exists(data['nombre']):
                log(f"  ↩ Ya existe: {data['nombre']}")
                continue
            if is_excluded(data['nombre']):
                log(f"  🚫 Excluido (resort/gov/asilo): {data['nombre']}")
                continue
            results.append(data)
            log(f"  ✅ {data['nombre']} | ⭐{data['rating']} | 📞{data['telefono']}")
        time.sleep(1.5)

    browser.close()

log(f"\n📊 Nuevos leads encontrados: {len(results)}")

# ── Guardar backup JSON (por si falla el Sheet) ───────────────────────────────
import json as _json
backup_path = f"/Users/papaspichones/Library/Logs/leads-backup-{datetime.datetime.now().strftime('%Y-%m-%d')}.json"
with open(backup_path, "w", encoding="utf-8") as _f:
    _json.dump(results, _f, ensure_ascii=False, indent=2)
log(f"💾 Backup guardado: {backup_path}")

# ── Agregar al Google Sheet ───────────────────────────────────────────────────
if results:
    log("📝 Agregando al Research Tracker...")
    rows_to_add = []
    for d in results:
        rows_to_add.append([
            d["ciudad"], d["termino"], d["nombre"], d["tiene_web"],
            d["rating"], d["resenas"], d["telefono"], d["direccion"],
            d["instagram"], d["whatsapp"], d["email"], d["gaps"],
            str(d["prioridad"]), d["maps_url"], d["status"],
            d["review_1_autor"], d["review_1_stars"], d["review_1_texto"],
            d["review_2_autor"], d["review_2_stars"], d["review_2_texto"],
            d["review_3_autor"], d["review_3_stars"], d["review_3_texto"],
        ])

    # Expandir sheet si está cerca del límite
    current_rows = ws.row_count
    needed = len(existing_rows) + len(rows_to_add) + 50
    if needed > current_rows:
        ws.add_rows(max(needed - current_rows, 200))
        log(f"📐 Sheet expandido a {ws.row_count} filas")

    next_row = len(existing_rows) + 1
    ws.update(values=rows_to_add, range_name=f"A{next_row}")
    log(f"✅ {len(results)} leads agregados al Sheet desde fila {next_row}")
    print(f"✅ {len(results)} nuevos leads agregados al Research Tracker")
else:
    log("⚠ No se encontraron leads nuevos hoy")
    print("⚠ No se encontraron leads nuevos hoy")
