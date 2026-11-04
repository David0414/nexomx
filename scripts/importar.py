"""Carga contactos.xlsx en Supabase.

  python scripts/importar.py --simular     revisa el archivo sin subir nada
  python scripts/importar.py               sube los datos (usa .env.local)

Las filas se agrupan por ficha de origen: cada ficha es una empresa y cada persona
de esa ficha es un contacto. Repetir la carga no duplica: actualiza lo existente.
Las empresas que editaste a mano y las que borraste no se tocan.
"""
import collections
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

import openpyxl

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ARCHIVO = RAIZ / "contactos.xlsx"

# El orden importa: gana la primera área que coincide.
AREAS = [
    ("compras", r"compra|purchas|buyer|procure|abastec|sourcing|adquisici[oó]n|commodity|supplier|proveedor"),
    ("calidad", r"calidad|quality|\bsqe\b|\bqa\b|\bqc\b"),
    ("finanzas", r"financ|finanz|contab|contador|accounting|accountant|tesor|\bcfo\b|controller|auditor|cuentas por|administrativ"),
    ("rh", r"recursos humanos|human resources|\brh\b|\bhr\b|rr\.? ?hh|talento|talent|people|personal|n[oó]mina|reclut|training|capacitaci"),
    ("logistica", r"log[ií]stic|almac|warehouse|supply|suministro|materiales|materials?\b|tr[aá]fico|traffic|embarques|shipping|comercio exterior|customs|aduan|planner"),
    ("ventas", r"venta|sales|comercial|commercial|business dev|desarrollo de negocio|account|marketing|cliente|customer"),
    ("direccion", r"general manager|gerente general|director|direcci[oó]n|\bceo\b|\bcoo\b|president|owner|due[ñn]o|plant manager|gerente de planta|country manager|site manager"),
    ("ingenieria", r"ingenier|engineer|manufactur|producci|production|mantenimiento|maintenance|operaci|operations|proyecto|project|program manager|\bti\b|\bit\b|sistemas|\behs\b|seguridad"),
]
AREAS = [(area, re.compile(patron, re.I)) for area, patron in AREAS]


def area_de(puesto):
    for area, patron in AREAS:
        if puesto and patron.search(puesto):
            return area
    return "otro"


def web_propia(valor):
    # Algunas fichas traen como sitio el enlace del directorio de origen.
    web = limpio(valor)
    return None if web and "clusterindustrialb2b.com" in web.lower() else web


def limpio(valor):
    if valor is None:
        return None
    texto = str(valor).strip()
    return texto or None


def leer():
    libro = openpyxl.load_workbook(ARCHIVO, read_only=True, data_only=True)
    filas = libro["Contactos"].iter_rows(values_only=True)
    encabezado = list(next(filas))
    return [dict(zip(encabezado, fila)) for fila in filas]


def transformar(filas):
    empresas, contactos = {}, {}
    for fila in filas:
        enlace = limpio(fila["Enlace de origen"])
        if enlace not in empresas:
            empresas[enlace] = {
                "enlace_origen": enlace,
                "nombre": limpio(fila["Empresa"]),
                "web": web_propia(fila["Página web"]),
                "estado": limpio(fila["Estado"]) or "Sin estado",
                "ubicacion": limpio(fila["Ubicación"]),
                "telefono": limpio(fila["Teléfono general"]) or limpio(fila["Teléfono"]),
            }
        nombre = limpio(fila["Nombre"])
        correo = limpio(fila["Correo del contacto"])
        correo = correo.lower() if correo else None
        directo = limpio(fila["Teléfono del contacto"])
        if nombre or correo or directo:
            puesto = limpio(fila["Puesto"])
            contactos[(enlace, nombre, correo)] = {
                "enlace": enlace,
                "nombre": nombre,
                "puesto": puesto,
                "area": area_de(puesto),
                "correo": correo,
                "telefono_directo": directo,
            }
    return list(empresas.values()), list(contactos.values())


def leer_entorno():
    entorno = {}
    archivo = RAIZ / ".env.local"
    if not archivo.exists():
        sys.exit("Falta .env.local (copia .env.example y llena los valores).")
    for linea in archivo.read_text(encoding="utf-8").splitlines():
        if "=" in linea and not linea.lstrip().startswith("#"):
            nombre, valor = linea.split("=", 1)
            entorno[nombre.strip()] = valor.strip()
    return entorno


def leer_enlaces(url, clave, ruta):
    enlaces, desde = set(), 0
    while True:
        solicitud = urllib.request.Request(
            f"{url}/rest/v1/{ruta}&limit=1000&offset={desde}",
            headers={"apikey": clave, **({"Authorization": f"Bearer {clave}"} if clave.startswith("eyJ") else {})},
        )
        with urllib.request.urlopen(solicitud, timeout=60) as respuesta:
            filas = json.load(respuesta)
        enlaces.update(f["enlace_origen"] for f in filas)
        if len(filas) < 1000:
            return enlaces
        desde += 1000


def enviar(url, clave, ruta, cuerpo, conflicto, retornar=False):
    preferencias = ["resolution=merge-duplicates", "return=representation" if retornar else "return=minimal"]
    encabezados = {
        "apikey": clave,
        "Content-Type": "application/json",
        "Prefer": ",".join(preferencias),
        # Las claves nuevas (sb_secret_) van solo en apikey; las antiguas son JWT.
        **({"Authorization": f"Bearer {clave}"} if clave.startswith("eyJ") else {}),
    }
    solicitud = urllib.request.Request(
        f"{url}/rest/v1/{ruta}?on_conflict={conflicto}",
        data=json.dumps(cuerpo, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers=encabezados,
    )
    try:
        with urllib.request.urlopen(solicitud, timeout=120) as respuesta:
            return json.load(respuesta) if retornar else None
    except urllib.error.HTTPError as error:
        sys.exit(f"Error {error.code} en {ruta}: {error.read().decode('utf-8', 'replace')[:500]}")


def main():
    empresas, contactos = transformar(leer())
    print(f"Empresas: {len(empresas):,}")
    print(f"Contactos: {len(contactos):,}")
    for area, total in collections.Counter(c["area"] for c in contactos).most_common():
        print(f"  {area}: {total:,}")

    if "--simular" in sys.argv:
        return

    entorno = leer_entorno()
    url = entorno["VITE_SUPABASE_URL"].rstrip("/")
    clave = entorno["SUPABASE_SERVICE_ROLE_KEY"]

    # Lo editado o borrado a mano manda sobre el Excel.
    respetar = leer_enlaces(url, clave, "empresas?select=enlace_origen&protegida=is.true")
    respetar |= leer_enlaces(url, clave, "empresas_borradas?select=enlace_origen")
    empresas = [e for e in empresas if e["enlace_origen"] not in respetar]
    contactos = [c for c in contactos if c["enlace"] not in respetar]
    print(f"Respetando {len(respetar):,} empresas editadas o borradas a mano")

    ids = {}
    for inicio in range(0, len(empresas), 500):
        lote = empresas[inicio:inicio + 500]
        for fila in enviar(url, clave, "empresas", lote, "enlace_origen", retornar=True):
            ids[fila["enlace_origen"]] = fila["id"]
        print(f"Empresas subidas: {len(ids):,}", end="\r")
    print()

    registros = [
        {**{k: v for k, v in c.items() if k != "enlace"}, "empresa_id": ids[c["enlace"]]}
        for c in contactos
    ]
    for inicio in range(0, len(registros), 500):
        enviar(url, clave, "contactos", registros[inicio:inicio + 500], "empresa_id,nombre,correo")
        print(f"Contactos subidos: {min(inicio + 500, len(registros)):,}", end="\r")
    print("\nListo.")


if __name__ == "__main__":
    main()
