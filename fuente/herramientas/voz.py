"""Prueba de órdenes de voz: simula el reconocimiento de voz del navegador y comprueba que cada frase abra o toque lo esperado.
Uso: python3 fuente/herramientas/voz.py carpeta_con_las_apps/   (necesita Playwright y Chrome)"""
import asyncio,subprocess,time,sys,json
from playwright.async_api import async_playwright
RAIZ=sys.argv[1]
SRV=subprocess.Popen(['python3','-m','http.server','8771'],cwd=RAIZ,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
B='http://localhost:8771/'
FAKE="""window.esCelular=()=>matchMedia("(max-width:899px)").matches;window.webkitSpeechRecognition=window.SpeechRecognition=class{start(){window.__rec=this}stop(){}abort(){}};
window.__decir=t=>window.__rec.onresult({resultIndex:0,results:[Object.assign([{transcript:t}],{isFinal:true})]});"""
CASOS=[ # (app, ruta inicial, frase, qué comprobar)
 ('op','', 'selecciona cuarto grado', "location.hash=='#grado-4'"),
 ('op','', 'abre el quinto grado', "location.hash=='#grado-5'"),
 ('op','', 've al grado 2', "location.hash=='#grado-2'"),
 ('op','', '1.º grado', "location.hash=='#grado-1'"),
 ('op','', '6to grado', "location.hash=='#grado-6'"),
 ('op','', 'abre familias', "location.hash=='#cuaderno'"),
 ('op','', 'abre clases', "location.hash=='#clases'"),
 ('op','', 've a clases', "location.hash=='#clases'"),
 ('op','', 'método', "location.hash=='#metodo'"),
 ('op','', 'elige', "location.hash=='#elegir'"),
 ('op','', 'abre retos', "location.hash=='#retos'"),
 ('op','', 'toca evaluador', "location.hash=='#evaluador'"),
 ('op','#clases', 'selecciona 4.º A', "JSON.parse(localStorage.getItem('oya:ctx')||'null')?.gp=='A'&&JSON.parse(localStorage.getItem('oya:ctx')).gr==4"),
 ('op','#clases', 'toca cuarto a', "JSON.parse(localStorage.getItem('oya:ctx')||'null')?.gr==4"),
 ('op','#clases', 'toca sorteo', "document.querySelector('#modal.show')!=null"),
 ('op','#clases', 'abre el banco de lecturas', "location.hash=='#lecturas'"),
 ('op','#grado-4', 'abre mapa conceptual', "location.hash=='#org-03'"),
 ('op','', 'abre línea del tiempo', "location.hash=='#org-14'"),
 ('op','#org-05', 'construye', "document.querySelector('.moms button.on')?.dataset.mo=='2'"),
 ('op','#org-05', 'toca ver en grande', "document.querySelector('#modal.show')!=null"),
 ('op','#org-05', 'abre pregunta para comprobar', "[...document.querySelectorAll('#pane .plg')].some(d=>d.open&&d.dataset.k=='Pregunta para comprobar')"),
 ('op','#org-05', 'inicio', "location.hash==''||location.hash=='#'"),
 ('nk','', 'abre organizadores', "location.hash=='#organizadores'"),
 ('nk','', 'mi plan', "location.hash=='#clases'"),
 ('nk','', 'abre mi cuaderno', "location.hash=='#cuaderno'"),
 ('nk','', 'mi avance', "location.hash=='#evaluador'"),
 ('nk','#organizadores', 'toca comparar y registrar', "location.hash=='#familia-comparar'"),
 ('nk','', 'cuarto grado', "location.hash=='#grado-4'"),
 ('nk','', 'abre clases', "!location.hash.startsWith('#org-')"),
 ('op','#org-05', 'cierra qué es', "esCelular()||[...document.querySelectorAll('#pane .plg')].some(d=>!d.open&&d.dataset.k=='¿Qué es?')"),
 ('op','#org-05', 'ver más', "[...document.querySelectorAll('details.ver-mas')].some(d=>d.open)"),
 ('op','#org-05', 'abre la lectura', "document.querySelector('#modal.show, #lecd')!=null"),
 ('op','#clases', 'toca registrar horario', "document.querySelector('#modal.show')!=null"),
 ('op','#clases', 'código QR para familias', "document.querySelector('#modal.show, #zona-imp')!=null"),
 ('op','', 'segundo grado', "location.hash=='#grado-2'"),
 ('op','', 'abre la clasificación', "location.hash=='#org-05'"),
 ('nk','', 'tengo una tarea y no sé qué organizador usar', "location.hash=='#elegir'"),
 ('op','#org-05','guardar',"document.body.innerText.includes('Guardado')"),
 ('op','#org-05','salir al menú',"location.hash==''||location.hash=='#'"),
 ('op','#org-05','regresa al menú principal',"location.hash==''||location.hash=='#'"),
 ('op','','abre primer grado',"location.hash=='#grado-1'"),
 ('op','','oye abre el primer grado por favor',"location.hash=='#grado-1'"),
 ('op','','abre explorar y describir',"location.hash=='#familia-explorar'"),
 ('op','','abre el juego',"location.hash=='#juego'"),
 ('op','','abre organizadores',"location.hash=='#organizadores'"),
 ('nk','#org-05','salir al menú',"location.hash==''||location.hash=='#'"),
]
URL={'op':'Organizatones_para_Preguntones/index.html','nk':'NoteKiebres/index.html'}
async def main():
  async with async_playwright() as p:
    br=await p.chromium.launch(executable_path=__import__('os').environ.get('CHROME','/usr/bin/google-chrome'));ok=0;errs=[]
    for vp in [(1366,800),(390,844)]:
      for app,ruta,frase,chk in CASOS:
        c=await br.new_context(viewport={'width':vp[0],'height':vp[1]},is_mobile=vp[0]<500);await c.add_init_script(FAKE);pg=await c.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(B+URL[app]+ruta);await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelector('#micf').click()");await pg.wait_for_timeout(100)
        await pg.evaluate(f"__decir({json.dumps(frase)})");await pg.wait_for_timeout(450)
        r=await pg.evaluate(chk)
        ok+=bool(r)
        if not r: print('FALLA',vp[0],app,ruta or '#',f'«{frase}»','->',await pg.evaluate("location.hash"),(await pg.inner_text('#toast'))[:80])
        await c.close()
    print(f'{ok} de {2*len(CASOS)} órdenes funcionaron. Errores JS: {errs[:3]}')
    await br.close()
try: asyncio.run(main())
finally: SRV.terminate()
