"""Prueba de la capa Voz Accesible 2.1 del micrófono (eco, Android, dictado con puntuación, listas, botones repetidos, casillas, Alt+M).
Uso: python3 fuente/herramientas/voz_accesible.py carpeta_con_las_apps/   (necesita Playwright y Chrome; ruta de Chrome en la variable CHROME)"""
import asyncio,subprocess,time,sys,os
from playwright.async_api import async_playwright
RAIZ=sys.argv[1]
SRV=subprocess.Popen(['python3','-m','http.server','8772'],cwd=RAIZ,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
B='http://localhost:8772/'
FAKE="""window.webkitSpeechRecognition=window.SpeechRecognition=class{start(){window.__rec=this}stop(){}abort(){}};
window.__decir=(t,fin=true)=>window.__rec.onresult({resultIndex:0,results:[Object.assign([{transcript:t}],{isFinal:fin})]});
window.__P=n=>{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('ogp:v1:')&&k.endsWith(':'+n)||k==='ogp:v1:'+n)return JSON.parse(localStorage.getItem(k))}return null};
window.__mic=()=>document.querySelector('#micf').classList.contains('mic-on');window.__dicta=()=>!document.querySelector('#vzbar').hidden&&/Dictando/.test(document.querySelector('#vzbar').textContent);"""
URL={'op':'Organizatones_para_Preguntones/index.html','nk':'NoteKiebres/index.html'}
R=[]
def rep(n,ok,d=''):R.append(ok);print(('✓' if ok else '✗'),n,('' if ok else d))
async def main():
  async with async_playwright() as p:
    br=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'));errs=[]
    async def abre(app,ruta,vp=(1366,800)):
      c=await br.new_context(viewport={'width':vp[0],'height':vp[1]});await c.add_init_script(FAKE);pg=await c.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
      await pg.goto(B+URL[app]+ruta);await pg.wait_for_timeout(500);await pg.evaluate("document.querySelector('#micf').click()");await pg.wait_for_timeout(100);return c,pg
    async def di(pg,t,fin=True,esp=450): await pg.evaluate('([t,f])=>__decir(t,f)',[t,fin]);await pg.wait_for_timeout(esp)
    for app in ['op','nk']:
      n={'op':'Organizatones','nk':'NoteKiebres'}[app]
      # eco
      c,pg=await abre(app,'')
      await pg.evaluate("Object.defineProperty(speechSynthesis,'speaking',{get:()=>true,configurable:true})");await di(pg,'abre retos')
      rep(f'{n}: no obedece lo que oye mientras la app lee en voz alta',await pg.evaluate("location.hash")!='#retos')
      await pg.evaluate("delete speechSynthesis.speaking");await pg.wait_for_timeout(1300);await di(pg,'abre retos')
      rep(f'{n}: al terminar de leer vuelve a obedecer',await pg.evaluate("location.hash")=='#retos')
      # Alt+M
      await pg.keyboard.press('Alt+m');rep(f'{n}: Alt+M apaga el micrófono',not await pg.evaluate('__mic()'));await pg.keyboard.press('Alt+m');rep(f'{n}: Alt+M lo vuelve a prender',await pg.evaluate('__mic()'))
      await c.close()
      # dictado
      c,pg=await abre(app,'#org-05')
      await di(pg,'escribe en el conjunto general');await di(pg,'los animales coma las plantas');await di(pg,'los animales coma las plantas');await di(pg,'punto final',esp=600)
      v=await pg.evaluate("(__P(5)||{P:[]}).P.map(p=>p.text).find(t=>/animales/i.test(t||''))");rep(f'{n}: dictado con «coma» y «punto final», sin repetir lo que Android duplicó',v=='Los animales, las plantas.',repr(v))
      await di(pg,'escribe en el conjunto general');rep(f'{n}: «escribe en el conjunto general» abre el dictado (antes escribía «general»)',await pg.evaluate("__dicta()"));await di(pg,'cancela')
      await di(pg,'escribe en el conjunto general');await di(pg,'hola');await di(pg,'mundo',fin=False,esp=5600)
      rep(f'{n}: el dictado se cierra solo aunque quede un parcial',not await pg.evaluate("__dicta()"))
      await di(pg,'elige redondeada en tipo de letra');rep(f'{n}: «elige redondeada en tipo de letra» cambia la lista',await pg.evaluate("document.querySelector('#fontsel').value")=='1')
      await c.close()
      # botones repetidos y casillas
      c,pg=await abre(app,'#organizadores')
      await pg.evaluate("""void(document.querySelector('#app').insertAdjacentHTML('afterbegin','<button class=tb id=r1 onclick="window.__t=1">Prueba repetida</button><button class=tb id=r2 onclick="window.__t=2">Prueba repetida</button><label class=marca-op><input type=checkbox id=cx> Acepto las reglas</label>'))""")
      await di(pg,'toca prueba repetida');k=await pg.evaluate("document.querySelectorAll('#vznums span').length")
      rep(f'{n}: botones con el mismo nombre se numeran',k==2,str(k))
      await di(pg,'el dos');rep(f'{n}: «el dos» toca el segundo',await pg.evaluate('window.__t')==2)
      await di(pg,'marca acepto las reglas',esp=1400);await di(pg,'marca acepto las reglas',esp=1400)
      rep(f'{n}: «marca» dicho dos veces deja la casilla marcada',await pg.evaluate("cx.checked"))
      await di(pg,'desmarca acepto las reglas');rep(f'{n}: «desmarca» la desmarca',not await pg.evaluate("cx.checked"))
      await di(pg,'ayuda');t=await pg.inner_text('#modal')
      rep(f'{n}: la ayuda explica puntuación, botones repetidos y privacidad',all(x in t for x in['coma','el dos','Alt+M'])and(('no dictes datos personales' in t) if app=='nk' else ('nombres de alumnos' in t)))
      rep(f'{n}: la ayuda se adapta a la app',('4.º A en grupo' in t)==(app=='op'))
      await c.close()
    rep('Sin errores de JavaScript',not errs,str(errs[:3]))
    await br.close()
try: asyncio.run(main())
finally: SRV.terminate()
print(f"\n{sum(R)} de {len(R)} comprobaciones correctas.")
