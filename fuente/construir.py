"""Construye las tres aplicaciones desde un solo motor.

  fuente/motor.html  ->  index.html          (Organizatones para Preguntones, por grado)
                     ->  por-colores.html    (Organizatones, por colores)
                     ->  ../NoteKiebres/index.html  (NoteKiebres, para estudiar por tu cuenta)

Uso (desde la carpeta del repositorio):
    python3 fuente/construir.py
    python3 fuente/construir.py --notekiebres /ruta/a/NoteKiebres

Todo cambio se hace en fuente/motor.html y después se corre este script.
Nunca edite a mano los archivos generados: el siguiente armado los reemplaza.
"""
import json
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
REPO = AQUI.parent
MOTOR = (AQUI / 'motor.html').read_text(encoding='utf-8')
ESCUDO = (AQUI / 'escudo.txt').read_text(encoding='utf-8').strip()

args = sys.argv[1:]
NK = Path(args[args.index('--notekiebres') + 1]) if '--notekiebres' in args else REPO.parent / 'NoteKiebres'

# Textos de NoteKiebres: la persona estudia sola, no hay grupo.
TEXTOS_NOTEKIEBRES = [
    ('todas las ideas que el grupo conoce o se le ocurren', 'todas las ideas que conoces o se te ocurren'),
    ('recuperar lo que el grupo sabe', 'recuperar lo que ya sabes'),
    ('y el grupo necesita investigarlas', 'y necesitas investigarlas'),
    ('todo lo que el grupo ya sabe', 'todo lo que ya sabes'),
    ('Comparte tu resumen con un compañero', 'Explica tu resumen en voz alta, como si se lo contaras a alguien'),
]

CABEZA_NOTEKIEBRES = (
    '<meta name="description" content="¡Organiza tus ideas sin quebrarte la cabeza! 26 organizadores gráficos para estudiar por tu cuenta.">\n'
    '<link rel="manifest" href="manifest.webmanifest">\n'
    '<link rel="apple-touch-icon" href="icon-192.png">\n'
    '<meta name="theme-color" content="#1565C0">\n'
)

APPS = [
    dict(nombre='Organizatones (por grado)', salida=REPO / 'index.html', titulo='Organizatones para Preguntones',
         config=[('OYA_MODO', 'grado'), ('OYA_DENSIDAD', 'normal'), ('OYA_PUBLICO', 'escolar'), ('OYA_MOMIMG', 1), ('OYA_ESCUDO', ESCUDO)]),
    dict(nombre='Organizatones (por colores)', salida=REPO / 'por-colores.html', titulo='Organizatones para Preguntones',
         config=[('OYA_MODO', 'familia'), ('OYA_DENSIDAD', 'compacta'), ('OYA_PUBLICO', 'escolar')]),
    dict(nombre='NoteKiebres', salida=NK / 'index.html', titulo='NoteKiebres',
         config=[('OYA_MODO', 'familia'), ('OYA_DENSIDAD', 'normal'), ('OYA_PUBLICO', 'general')],
         textos=TEXTOS_NOTEKIEBRES, cabeza=CABEZA_NOTEKIEBRES),
]


def falla(msg):
    sys.exit('ERROR: ' + msg)


for marca in ('/*@@CONFIG@@*/', '<title>@@TITULO@@</title>'):
    if MOTOR.count(marca) != 1:
        falla(f'el motor debe tener exactamente una marca {marca}')

for app in APPS:
    if not app['salida'].parent.exists():
        print(f'(se omite {app["nombre"]}: no existe {app["salida"].parent})')
        continue
    conf = '\n'.join(f'window.{k}={json.dumps(v, ensure_ascii=False) if isinstance(v, str) else v};' for k, v in app['config'])
    html = MOTOR.replace('/*@@CONFIG@@*/', conf).replace('<title>@@TITULO@@</title>', f'<title>{app["titulo"]}</title>')
    for viejo, nuevo in app.get('textos', []):
        n = html.count(viejo)
        if n != 1:
            falla(f'«{viejo}» aparece {n} veces en el motor (se esperaba 1). Revise el texto en motor.html y en TEXTOS_NOTEKIEBRES.')
        html = html.replace(viejo, nuevo)
    if app.get('cabeza'):
        html = html.replace('<meta name="author"', app['cabeza'] + '<meta name="author"', 1)
    app['salida'].write_text(html, encoding='utf-8')
    print(f'{app["nombre"]}: {app["salida"]} ({len(html.encode("utf-8")) // 1024} KB)')
