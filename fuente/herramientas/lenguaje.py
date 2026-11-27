"""Prueba de lenguaje natural del micrófono: cada caso dice frases y revisa el estado guardado o la pantalla.
Uso: python3 fuente/herramientas/lenguaje.py carpeta_con_las_apps/   (necesita Playwright y Chrome)"""
import asyncio,subprocess,time,sys,json
from playwright.async_api import async_playwright
RAIZ=sys.argv[1]
SRV=subprocess.Popen(['python3','-m','http.server','8772'],cwd=RAIZ,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
B='http://localhost:8772/'
FAKE="""window.webkitSpeechRecognition=window.SpeechRecognition=class{start(){window.__rec=this}stop(){}abort(){}};
window.__decir=t=>window.__rec.onresult({resultIndex:0,results:[Object.assign([{transcript:t}],{isFinal:true})]});
window.__P=n=>{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('ogp:v1:')&&k.endsWith(':'+n)||k==='ogp:v1:'+n)return JSON.parse(localStorage.getItem(k))}return null};"""
NK='NoteKiebres/index.html';OP='Organizatones_para_Preguntones/index.html'
# (app, ruta, [frases en orden], comprobación JS sobre el estado final)
CASOS=[
 (NK,'#org-05',['escribe en el conjunto general los animales'],"__P(5).P.some(p=>p.text==='los animales')"),
 (NK,'#org-05',['escribe Los Peces en el conjunto general'],"__P(5).P.some(p=>p.text==='Los Peces')"),
 (NK,'#org-05',['cambia el criterio por qué comen'],"__P(5).P.some(p=>p.text==='qué comen')"),
 (NK,'#org-05',['oye, ¿puedes pintar el criterio de azul por favor?'],"__P(5).P.some(p=>/lados\\?/.test(p.text)&&p.c==='B')"),
 (NK,'#org-05',['selecciona el criterio','píntalo de rojo'],"__P(5).P.some(p=>/lados\\?/.test(p.text)&&p.c==='R')"),
 (NK,'#org-05',['el criterio en verde'],"__P(5).P.some(p=>/lados\\?/.test(p.text)&&p.c==='G')"),
 (NK,'#org-05',['mueve el conjunto general a la derecha'],"__P(5).P.find(p=>p.text==='FIGURAS').x>700"),
 (NK,'#org-05',['sube un poco el conjunto general'],"__P(5).P.find(p=>p.text==='FIGURAS').y<85"),
 (NK,'#org-05',['duplica el criterio'],"__P(5).P.filter(p=>/lados\\?/.test(p.text)).length===2"),
 (NK,'#org-05',['duplica el criterio','otra vez'],"__P(5).P.filter(p=>/lados\\?/.test(p.text)).length===3"),
 (NK,'#org-05',['une el conjunto general con la categoría 2'],"(()=>{const d=__P(5),a=d.P.find(p=>p.text==='FIGURAS');return d.C.filter(c=>c.a===a.id).length>=2})()"),
 (NK,'#org-05',['pon una flecha del conjunto general a la categoría 2','quita la flecha entre el conjunto general y la categoría 2'],"(()=>{const d=__P(5),a=d.P.find(p=>p.text==='FIGURAS');return d.C.filter(c=>c.a===a.id||c.b===a.id).length===1})()"),
 (NK,'#org-05',['resalta el criterio'],"__P(5).P.some(p=>/lados\\?/.test(p.text)&&p.hl)"),
 (NK,'#org-05',['agrégale otra categoría'],"__P(5).P.length===10"),
 (NK,'#org-05',['duplica el criterio','me equivoqué'],"__P(5).P.filter(p=>/lados\\?/.test(p.text)).length===1"),
 (NK,'#org-05',['selecciona el criterio','ponle letra escolar'],"__P(5).P.some(p=>/lados\\?/.test(p.text)&&p.fo===2)"),
 (NK,'#org-05',['letra más grande'],"document.body.classList.contains('z1')"),
 (NK,'#org-05',['la respuesta es la primera'],"(document.querySelector('#qf-r')||{}).textContent.length>0"),
 (NK,'#org-11',['agrega una fila'],"__P(11).P.find(p=>p.t).t.rows===4"),
 (NK,'#org-11',['agrega una columna'],"__P(11).P.find(p=>p.t).t.cols===4"),
 (NK,'#org-11',['escribe en la fila 2 columna 1 manzana roja'],"__P(11).P.find(p=>p.t).t.cells[2][0]==='manzana roja'"),
 (NK,'#org-10',['pon tres círculos'],"__P(10).P.some(p=>p.n===3)"),
 (NK,'',['oye, ¿me puedes abrir el método por favor?'],"location.hash==='#metodo'"),
 (NK,'#metodo',['llévame al inicio'],"location.hash===''||location.hash==='#'"),
 (NK,'#metodo',['baja'],"scrollY>100"),
 (OP,'',['abre cuarto grado y luego clases'],"location.hash==='#clases'"),
 (OP,'#clases',['selecciona cuarto A','empieza la sesión'],"!!document.querySelector('#sesbar')"),
 (OP,'#clases',['selecciona cuarto A','empieza la sesión','siguiente paso'],"/2\\/6/.test(document.querySelector('#sesbar').textContent)"),
 (OP,'#clases',['selecciona cuarto A','empieza la sesión','termina la sesión','sí'],"/Sesión terminada/.test(document.querySelector('#modal').textContent)"),
 (OP,'#clases',['haz un sorteo'],"/^\\d+$/.test(document.querySelector('#sorn').textContent.trim())"),
 (OP,'#clases',['toca registrar horario','cerrar'],"!document.querySelector('#modal.show')"),
 (OP,'',['¿puedes mostrarme las familias?'],"location.hash==='#cuaderno'"),
 (OP,'',['regresa al inicio'],"location.hash===''||location.hash==='#'"),
]
async def main():
  async with async_playwright() as p:
    br=await p.chromium.launch(executable_path=__import__('os').environ.get('CHROME','/usr/bin/google-chrome'));ok=0;errs=[];tot=0
    for vp in [(1366,800),(390,844)]:
      for app,ruta,frases,chk in CASOS:
        tot+=1
        c=await br.new_context(viewport={'width':vp[0],'height':vp[1]},is_mobile=vp[0]<500);await c.add_init_script(FAKE);pg=await c.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(B+app+ruta);await pg.wait_for_timeout(600)
        await pg.evaluate("document.querySelector('#micf').click()")
        for f in frases:
          await pg.evaluate(f"__decir({json.dumps(f)})");await pg.wait_for_timeout(1300)
        try:r=await pg.evaluate(chk)
        except Exception as e:r=False
        ok+=bool(r)
        if not r: print('FALLA',vp[0],app[:2],ruta or '#',frases,'->',(await pg.inner_text('#toast'))[:90])
        await c.close()
    print(f'{ok} de {tot} casos funcionaron. Errores JS: {errs[:3]}')
    await br.close()
try: asyncio.run(main())
finally: SRV.terminate()
