"""Asigna un giro a cada empresa según su nombre y su sitio web.

  python scripts/clasificar.py --simular     muestra el resultado sin guardar
  python scripts/clasificar.py               guarda en Supabase (usa .env.local)

Es una clasificación por palabras clave: gana el primer giro que coincide, así que
el orden importa. Lo que no coincide queda como 'sin_clasificar', nunca se adivina.
Las empresas editadas a mano en el panel no se tocan.
"""
import collections
import json
import pathlib
import random
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

import importar

NOMBRES = {
    "armadoras": "Armadoras de vehículos",
    "autopartes": "Autopartes y sistemas automotrices",
    "plasticos": "Plásticos y hule",
    "metalmecanica": "Metalmecánica y herramentales",
    "electrica": "Eléctrica y electrónica",
    "automatizacion": "Automatización y maquinaria",
    "quimicos": "Químicos y recubrimientos",
    "empaque": "Empaque y embalaje",
    "logistica": "Logística y transporte",
    "construccion": "Construcción e instalaciones",
    "servicios_industriales": "Servicios a la industria",
    "servicios_profesionales": "Consultoría y servicios profesionales",
    "comercializadoras": "Comercializadoras y distribuidores",
    "manufactura": "Manufactura en general",
    "sin_clasificar": "Sin clasificar",
}

# Marcas: se revisan antes que las palabras genéricas.
MARCAS = [
    ("armadoras", r"\b(fca|stellantis|mazda motor|toyota motor|nissan|honda de mexico|general motors|gm de mexico|ford motor|volkswagen de mexico|audi mexico|bmw|kia mexico|kia motors|hyundai motor|mercedes[- ]benz|daimler|navistar|freightliner|paccar|kenworth|peterbilt)\b"),
    ("autopartes", r"\b(yazaki|lear|delphi|aptiv|borgwarner|magna|cosma|adient|sumitomo electric|sews|wiring|arneses?|arnecom|continental|contitech|motherson|samvardhana|zf|friedrichshafen|trw|tenneco|federal[- ]mogul|forvia|faurecia|hella|mahle|behr|grammer|joyson|valeo|bosch|denso|aisin|toyoda|dana|cie automotive|condumex|martinrea|matcor|matcormatsu|halla|hanon|pkc|tachi|hayashi|telempu|iac|revere|bocar|aees|autoliv|nexteer|dura|gestamp|benteler|kirchhoff|tower|shiloh|flex[- ]n[- ]gate|plastic omnium|omnium|hutchinson|cooper standard|tmd|metalsa|nemak|rassini|kostal|leoni|nidec|hitachi astemo|schaeffler|brose|webasto|mubea|kongsberg|stoneridge|gentherm|visteon|harman|nexans autoelectric|draxlmaier|dräxlmaier)\b"),
]

GIROS = [
    ("logistica", r"\b(logistic\w*|logistica|transport\w*|cargo|carga|freight|fletes?|aduanal\w*|aduanas?|customs|forwarding|express|paqueteria|mudanzas?|almacenaje|warehous\w*|comercio exterior|shipping|autotransportes?)\b"),
    ("servicios_profesionales", r"\b(consult\w*|asesor\w*|abogados?|legal|lex|law|contadores?|contable|fiscal|auditor\w*|seguros?|fianzas?|insurance|capacitacion|training|instituto|universidad|universitario|escuela|colegio|reclutamiento|recursos humanos|outsourcing|staffing|talento|despacho|notaria|marketing|publicidad|financier\w*|banco|bank|sofom|prestamo\w*|credito\w*|software|sistemas de informacion|informatica|profesionales|asociados)\b"),
    ("construccion", r"\b(construc\w*|edificaciones?|inmobiliari\w*|arquitectura|obras?|estructuras?|naves? industriales?|instalaciones|parque industrial|concreto|cemento)\b"),
    ("servicios_industriales", r"\b(mantenimiento|maintenance|limpieza|clean\w*|uniformes?|comedores?|alimentos|catering|vigilancia|ambiental\w*|environmental|residuos|reciclaj\w*|recycling|calibracion|metrologia|laboratorios?|inspeccion\w*|sorting|seleccion|equipo de proteccion|seguridad industrial|safety|hotel\w*|tours?|viajes|calzado|ropa industrial|servicios industriales|industrial services)\b"),
    ("empaque", r"\b(empaques?|embalaj\w*|packaging|cajas?|cartones?|carton|corrugad\w*|etiquetas?|labels?|tarimas?|pallets?|envases?)\b"),
    ("quimicos", r"\b(quimic\w*|chemical\w*|pinturas?|paint\w*|recubrimientos?|coatings?|lubricantes?|lubricants?|solventes?|adhesiv\w*|galva\w*|cromad\w*|tratamientos? termicos?|heat treat\w*|acabados|finishing)\b"),
    ("plasticos", r"\b(plastic\w*|plastics|poli\w*|polymers?|nylon|inyeccion|inyectad\w*|injection|molding|moulding|rubber|hule|caucho|foam|espumas?|sealing|sellos?|extrusion\w*|termoformad\w*|composites?|nylon)\b"),
    ("metalmecanica", r"\b(maquinad\w*|machining|mecanizad\w*|metal\w*|steel|acero\w*|aluminio|aluminum|aluminium|iron|fundicion|foundry|casting|forja\w*|forging|estampad\w*|stamping|troquel\w*|die|dies|tool|tools|tooling|herramient\w*|moldes?|mold|molds|mould|tornill\w*|fastener\w*|sujetadores|resortes?|spring|springs|soldadura|welding|tubos?|tube|tubing|precision|precisión|pailer\w*|lamin\w*|gears?|engranes?|fabricaciones? metalicas?|lamina)\b"),
    ("electrica", r"\b(electric\w*|electronic\w*|electro|electrica|electrico|electricos|electronica|cable|cables|conductores?|conectores?|connectors?|connection|lighting|iluminacion|semiconductor\w*|sensors?|sensores?|energia|energy|power|baterias?|batteries)\b"),
    ("automatizacion", r"\b(automation|automatizacion|automatizaciones|automatizad\w*|robot\w*|maquinaria|machinery|machine|machines|equipos?|bombas?|pumps?|hidraulic\w*|hydraulic\w*|neumatic\w*|pneumatic\w*|compresores?|control|controls|ingenieria|engineering|integrador\w*|ensamble|assembly)\b"),
    ("autopartes", r"\b(automotive|automotriz|automotrices|autopartes?|autoparts?|auto|autosistemas|seating|asientos?|powertrain|interiors?|trim|axle|motors?|motor|frenos?|brakes?|wheels?|rines?|llantas?|neumaticos|tires?|mobility)\b"),
    ("comercializadoras", r"\b(comercializador\w*|distribuidor\w*|distribution|suministros?|proveedor\w*|supply|trading|importador\w*|ferreter\w*|refacciones|accesorios|tsusho|comercial)\b"),
    ("manufactura", r"\b(manufactur\w*|mfg|kogyo|seiki|seisakusho|industries|industrias|textil\w*|components?|componentes?|parts|partes|products|productos)\b"),
    ("servicios_industriales", r"\b(servicios?|services?|soluciones|solutions?)\b"),
]

# Palabras que también se reconocen dentro del dominio, donde van pegadas.
DOMINIOS = [
    ("logistica", "logist|transport|freight|aduan"),
    ("empaque", "empaque|packaging|embalaj"),
    ("plasticos", "plastic|rubber"),
    ("metalmecanica", "metal|steel|acero|maquinad|troquel"),
    ("electrica", "electric|electronic"),
    ("autopartes", "automotive|autopart"),
    ("servicios_profesionales", "consult|abogad|seguros"),
]

# Marcas identificadas una por una, sin pistas en el nombre: {nombre: giro}.
ARCHIVO_REVISADOS = pathlib.Path(__file__).with_name("giros_revisados.json")
REVISADOS = json.loads(ARCHIVO_REVISADOS.read_text(encoding="utf-8")) if ARCHIVO_REVISADOS.exists() else {}

MARCAS = [(g, re.compile(p)) for g, p in MARCAS]
GIROS = [(g, re.compile(p)) for g, p in GIROS]
DOMINIOS = [(g, re.compile(p)) for g, p in DOMINIOS]


def normal(texto):
    sin = unicodedata.normalize("NFD", texto or "")
    return "".join(c for c in sin if unicodedata.category(c) != "Mn").lower()


def dominio(web):
    if not web:
        return ""
    return urllib.parse.urlparse(web if "://" in web else f"https://{web}").netloc.lower().removeprefix("www.")


def giro_de(nombre, web):
    if nombre in REVISADOS:
        return REVISADOS[nombre]
    texto = normal(nombre)
    for grupo in (MARCAS, GIROS):
        for giro, patron in grupo:
            if patron.search(texto):
                return giro
    host = dominio(web)
    for giro, patron in DOMINIOS:
        if patron.search(host):
            return giro
    return "sin_clasificar"


def clasificar_todas(empresas):
    """Devuelve {enlace: giro}. Las sucursales heredan el giro de otra ficha con el mismo sitio."""
    giros = {e["enlace_origen"]: giro_de(e["nombre"], e["web"]) for e in empresas}
    por_dominio = collections.defaultdict(collections.Counter)
    for e in empresas:
        host = dominio(e["web"])
        if host and giros[e["enlace_origen"]] != "sin_clasificar":
            por_dominio[host][giros[e["enlace_origen"]]] += 1
    for e in empresas:
        cuenta = por_dominio.get(dominio(e["web"]))
        if cuenta and giros[e["enlace_origen"]] == "sin_clasificar":
            giros[e["enlace_origen"]] = cuenta.most_common(1)[0][0]
    return giros


def guardar(empresas):
    entorno = importar.leer_entorno()
    url = entorno["VITE_SUPABASE_URL"].rstrip("/")
    clave = entorno["SUPABASE_SERVICE_ROLE_KEY"]
    cabeceras = {"apikey": clave, "Content-Type": "application/json", "Prefer": "return=minimal"}
    if clave.startswith("eyJ"):
        cabeceras["Authorization"] = f"Bearer {clave}"

    filas, desde = [], 0
    while True:
        solicitud = urllib.request.Request(
            f"{url}/rest/v1/empresas?select=id,enlace_origen,protegida,giro&order=id&limit=1000&offset={desde}",
            headers=cabeceras,
        )
        with urllib.request.urlopen(solicitud, timeout=60) as respuesta:
            lote = json.load(respuesta)
        filas += lote
        desde += 1000
        if len(lote) < 1000:
            break

    giro_por_enlace = clasificar_todas(empresas)
    grupos = collections.defaultdict(list)
    for fila in filas:
        giro = giro_por_enlace.get(fila["enlace_origen"])
        if giro and not fila["protegida"] and fila["giro"] != giro:
            grupos[giro].append(fila["id"])

    total = 0
    for giro, ids in grupos.items():
        for inicio in range(0, len(ids), 300):
            parte = ids[inicio:inicio + 300]
            solicitud = urllib.request.Request(
                f"{url}/rest/v1/empresas?id=in.({','.join(map(str, parte))})",
                data=json.dumps({"giro": giro}).encode(), method="PATCH", headers=cabeceras,
            )
            try:
                urllib.request.urlopen(solicitud, timeout=60).read()
            except urllib.error.HTTPError as error:
                sys.exit(f"Error {error.code}: {error.read().decode('utf-8', 'replace')[:300]}")
            total += len(parte)
            print(f"Guardadas: {total:,}", end="\r")
    print(f"\nListo: {total:,} empresas actualizadas.")


def main():
    empresas, _ = importar.transformar(importar.leer())
    cuenta = collections.Counter(clasificar_todas(empresas).values())
    for giro, total in cuenta.most_common():
        print(f"{NOMBRES[giro]}: {total:,} ({total / len(empresas):.1%})")

    if "--simular" not in sys.argv:
        guardar(empresas)
        return

    random.seed(11)
    print("\nMUESTRA")
    for e in random.sample(empresas, 90):
        print(f"{giro_de(e['nombre'], e['web'])[:12]:12} {e['nombre'][:58]}")
    print("\nFALTANTES")
    palabras = collections.Counter()
    for e in empresas:
        if giro_de(e["nombre"], e["web"]) == "sin_clasificar":
            palabras.update(set(re.findall(r"[a-z]{4,}", normal(e["nombre"]))))
    print(" ".join(f"{p}:{n}" for p, n in palabras.most_common(120)))


if __name__ == "__main__":
    main()
