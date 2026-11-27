"""Prueba visual de regresión.
  python3 visual.py capturar <carpeta> <raiz_web>
  python3 visual.py comparar <carpeta_a> <carpeta_b>
Captura cada app (3) x pantalla (escritorio, celular) x estado, con hora fija y sin animaciones."""
import asyncio, subprocess, sys, time, os, json
from pathlib import Path

APPS = {'nk': 'NoteKiebres/index.html', 'op': 'Organizatones_para_Preguntones/index.html', 'pc': 'Organizatones_para_Preguntones/por-colores.html'}
VIEWS = {'d': (1366, 800), 'm': (390, 844)}
RUTAS = ['', '#organizadores', '#familia-comparar', '#clases', '#lecturas', '#cuaderno', '#evaluador', '#metodo', '#elegir', '#retos', '#juego', '#grado-4', '#org-05', '#org-20']
FIJO = '2026-11-27T10:05:00-06:00'
SEMILLA = r"""
localStorage.setItem('oya:horario',JSON.stringify([{d:5,h:'10:00',gr:4,gp:'A',t:60}]));
localStorage.setItem('oya:horario-v','2026-11-27');
"""


async def capturar(dest, raiz):
    from playwright.async_api import async_playwright
    port = 8790
    srv = subprocess.Popen(['python3', '-m', 'http.server', str(port)], cwd=raiz, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    errs = []
    os.makedirs(dest, exist_ok=True)
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'))
            for ak, url in APPS.items():
                for vk, (w, h) in VIEWS.items():
                    ctx = await br.new_context(viewport={'width': w, 'height': h}, is_mobile=(vk == 'm'), has_touch=(vk == 'm'))
                    await ctx.add_init_script("(()=>{let x=12345;Math.random=()=>{x=(x*1103515245+12345)%2147483648;return x/2147483648}})()")
                    pg = await ctx.new_page()
                    await pg.clock.set_fixed_time(FIJO)
                    pg.on('pageerror', lambda e, a=ak: errs.append((a, str(e))))
                    base = f'http://localhost:{port}/{url}'
                    await pg.goto(base)
                    await pg.evaluate(SEMILLA)

                    async def shot(nombre, full=True):
                        await pg.wait_for_timeout(450)
                        await pg.screenshot(path=f'{dest}/{ak}_{vk}_{nombre}.png', full_page=full, animations='disabled', caret='hide')

                    for r in RUTAS:
                        await pg.goto(base + r)
                        await shot((r or '#inicio')[1:].replace('-', '_'))
                    # estados interactivos
                    await pg.goto(base + '#org-05'); await pg.wait_for_timeout(300)
                    for i, lab in enumerate(['comprende', 'construye', 'elige'], start=1):
                        b = pg.locator('.moms button').nth(i)
                        if await b.count():
                            await b.evaluate('e=>e.click()'); await shot('org05_' + lab, full=False)
                    await pg.goto(base + '#clases'); await pg.wait_for_timeout(300)
                    if ak != 'nk':
                        await pg.evaluate("document.querySelector('[data-z=ctx][data-v=\"4|A\"]').click()"); await shot('clases_grupo')
                    await pg.evaluate("document.querySelector('[data-z=go30]').click()"); await shot('sesion', full=False)
                    for _ in range(3):
                        await pg.evaluate("document.querySelector('[data-z=snext]').click()"); await pg.wait_for_timeout(200)
                    await shot('sesion_paso4', full=False)
                    if ak != 'nk':
                        await pg.evaluate("document.querySelector('#sesbar [data-z=proy]').click()"); await shot('proyector', full=False)
                        await pg.keyboard.press('ArrowRight'); await shot('proyector_flecha', full=False)
                        await pg.evaluate("document.querySelector('#sesbar [data-z=proy]').click()")
                    await pg.goto(base + '#cuaderno-4A'); await shot('cuaderno_4A')
                    await pg.goto(base + '#evaluador'); await shot('evaluador_con_datos')
                    if ak != 'nk':
                        await pg.goto(base + '#clases'); await pg.evaluate("document.querySelector('[data-z=hor]').click()"); await shot('horario', full=False)
                    await pg.goto(base + '#org-01'); await pg.locator('[data-z="lec"], [data-lec]').first.click() if await pg.locator('[data-z="lec"], [data-lec]').count() else None
                    await shot('org01_lectura', full=False)
                    # modo oscuro (NoteKiebres) y vista de impresión
                    if ak == 'nk':
                        await pg.goto(base); await pg.evaluate("(document.querySelector('[data-tema=oscuro]')||document.querySelectorAll('.temab')[1]).click()")
                        for r in ['', '#org-05', '#clases', '#evaluador']:
                            await pg.goto(base + r); await shot('oscuro_' + ((r or '#inicio')[1:].replace('-', '_')))
                        await pg.evaluate("(document.querySelector('[data-tema=claro]')||document.querySelectorAll('.temab')[0]).click()")
                    await pg.emulate_media(media='print')
                    for r in ['#org-05', '#cuaderno-4A', '#evaluador', '#metodo']:
                        await pg.goto(base + r); await pg.wait_for_timeout(600); await pg.evaluate("dispatchEvent(new Event('resize'))"); await pg.wait_for_timeout(900); await shot('print_' + r[1:].replace('-', '_'))
                    await pg.emulate_media(media='screen')
                    await ctx.close()
            await br.close()
    finally:
        srv.terminate()
    json.dump(errs, open(f'{dest}/_errores.json', 'w'), ensure_ascii=False, indent=1)
    print('capturas:', len([f for f in os.listdir(dest) if f.endswith('.png')]), 'errores:', errs[:5])


def comparar(a, b):
    from PIL import Image, ImageChops
    INESTABLES = ('_d_print_org_05.png',)  # varía entre corridas idénticas (tiempo del reajuste al imprimir)
    fa = sorted(f for f in os.listdir(a) if f.endswith('.png') and not f.endswith(INESTABLES))
    fb = set(f for f in os.listdir(b) if f.endswith('.png') and not f.endswith(INESTABLES))
    malos = []
    for f in fa:
        if f not in fb:
            malos.append((f, 'falta')); continue
        ia, ib = Image.open(f'{a}/{f}').convert('RGB'), Image.open(f'{b}/{f}').convert('RGB')
        if ia.size != ib.size:
            malos.append((f, f'tamaño {ia.size} -> {ib.size}')); continue
        bb = ImageChops.difference(ia, ib).getbbox()
        if bb:
            d = ImageChops.difference(ia, ib).convert('L').point(lambda x: 255 if x > 0 else 0)
            malos.append((f, f'{sum(1 for px in d.get_flattened_data() if px)} px en {bb}'))
    for f in sorted(fb - set(fa)):
        malos.append((f, 'nueva'))
    print(f'{len(fa)} capturas comparadas; diferentes: {len(malos)}')
    for m in malos:
        print('  ', *m)


if __name__ == '__main__':
    if sys.argv[1] == 'capturar':
        asyncio.run(capturar(sys.argv[2], sys.argv[3]))
    else:
        comparar(sys.argv[2], sys.argv[3])
