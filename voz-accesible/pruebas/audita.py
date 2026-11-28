"""Auditoría del motor: 13 fallas que tenía la versión 2.0. Uso, desde esta carpeta: python3 audita.py ../voz-accesible.js  (Playwright + Chrome; ruta de Chrome en la variable CHROME)"""
import asyncio,sys,os,shutil,subprocess,time,json
from playwright.async_api import async_playwright
MOTOR=sys.argv[1]
os.makedirs('srv',exist_ok=True);shutil.copy(MOTOR,'srv/motor.js')
open('srv/banco.html','w').write(open('banco.html').read().replace('MOTOR','motor.js'))
SRV=subprocess.Popen(['python3','-m','http.server','8790'],cwd='srv',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
FAKE="""window.__recs=[];window.webkitSpeechRecognition=window.SpeechRecognition=class{constructor(){window.__rec=this}start(){this._on=1}stop(){this._on=0;setTimeout(()=>this.onend&&this.onend(),0)}abort(){this.stop()}};
window.__di=(t,fin=true)=>{const r=window.__rec;const res=[{0:{transcript:t},isFinal:fin,length:1}];r.onresult({resultIndex:0,results:res})};"""
R=[]
def rep(n,ok,det=''):R.append((n,ok,det));print(('✓' if ok else '✗'),n,det)
async def main():
  async with async_playwright() as p:
    br=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'))
    async def nueva():
      pg=await br.new_page();await pg.add_init_script(FAKE);await pg.goto('http://localhost:8790/banco.html');await pg.wait_for_timeout(200)
      await pg.evaluate('VozAccesible.encender()');return pg
    async def di(pg,t,fin=True,esp=500):
      await pg.evaluate('([t,f])=>__di(t,f)',[t,fin]);await pg.wait_for_timeout(esp)
    est=lambda pg:pg.eval_on_selector('#estado','e=>e.textContent')
    # 1 marca dos veces
    pg=await nueva();await di(pg,'marca acepto');await di(pg,'marca acepto')
    rep('«marca acepto» dicho dos veces deja la casilla marcada',await pg.is_checked('#acepto'))
    await di(pg,'desmarca acepto');rep('«desmarca acepto» la desmarca',not await pg.is_checked('#acepto'))
    # 2 cancelar en ventana con Exportar
    await pg.click('#abre1');await pg.wait_for_timeout(200);await di(pg,'cancelar')
    rep('«cancelar» en una ventana no toca «Exportar»',await est(pg)!='EXPORTÓ',await est(pg))
    pg=await nueva()
    # 3 aceptar con Cerrar sesión
    await pg.click('#abre2');await pg.wait_for_timeout(200);await di(pg,'aceptar')
    rep('«aceptar» en una ventana no toca «Cerrar sesión»',await est(pg)!='CERRÓ SESIÓN',await est(pg))
    pg=await nueva()
    # 4 select por nombre de opción
    await di(pg,'abre méxico');foc=await pg.evaluate('document.activeElement.id')
    rep('«abre México» no confunde la lista «País» con sus opciones',foc!='pais',foc)
    await di(pg,'elige españa en país');rep('«elige España en país» elige',await pg.input_value('#pais')=='es')
    pg=await nueva()
    # 5 botón dentro de tarjeta: duplicado
    await di(pg,'toca ver ficha');b=await pg.evaluate('document.querySelectorAll("#va-badges .va-badge").length')
    rep('«toca ver ficha» no pide elegir entre la tarjeta y su botón',b==0 and await est(pg)=='ficha',f'etiquetas={b} estado={await est(pg)}')
    await pg.evaluate('document.getElementById("va-badges")&&document.getElementById("va-badges").remove()')
    pg=await nueva()
    # 6 dictado: puntuación dentro de la frase y punto final
    await di(pg,'escribe en comentarios');await di(pg,'hola coma cómo estás');await di(pg,'punto final',esp=300)
    v=await pg.input_value('#com');rep('Dictado convierte «coma» dentro de la frase y «punto final» pone punto',v in('Hola, cómo estás.','hola, cómo estás.'),repr(v))
    # 7 dictado con resultado parcial y silencio: debe cerrarse solo
    await pg.fill('#com','');await di(pg,'escribe en comentarios');await di(pg,'primera idea');await di(pg,'segunda',fin=False,esp=2600)
    modo=await pg.evaluate('document.querySelector("#va-barra").textContent');rep('El dictado se cierra solo tras una pausa aunque haya quedado un parcial','Dictando' not in modo,modo[:40])
    await pg.evaluate("document.querySelector('[data-va=listo]')&&document.querySelector('[data-va=listo]').click()")
    # 8 ve al inicio sin salir del sitio
    pg=await nueva()
    # 9 navegar a javascript:
    await pg.evaluate("VozAccesible.ejecutar({accion:'navegar',url:'javascript:window.__x=1'})");await pg.wait_for_timeout(300)
    x=await pg.evaluate('window.__x');rep('Una acción «navegar» no ejecuta direcciones javascript:',x!=1,str(x))
    pg=await nueva()
    # 10 eco: mientras la página habla, no obedece lo que oye
    await pg.evaluate("Object.defineProperty(speechSynthesis,'speaking',{get:()=>true,configurable:true})")
    await pg.evaluate("void(gua.onclick=()=>estado.textContent='GUARDÓ')");await di(pg,'toca guardar');rep('No obedece lo que oye mientras la propia página está hablando',await est(pg)!='GUARDÓ',await est(pg))
    await pg.evaluate("delete speechSynthesis.speaking")
    pg=await nueva()
    # 11 confirmación vieja
    await pg.evaluate("document.querySelector('main').insertAdjacentHTML('beforeend','<button id=elim onclick=\"estado.textContent=\\'ELIMINÓ\\'\">Eliminar</button>')")
    await di(pg,'toca eliminar');await pg.evaluate('elim.remove()');await di(pg,'sí confirmar')
    rep('Un «sí» no actúa sobre un botón que ya desapareció',await est(pg)!='ELIMINÓ',await est(pg))
    pg=await nueva()
    # 12 Android repite la frase
    await pg.fill('#nombre','');await di(pg,'escribe en nombre');await di(pg,'Ana');await di(pg,'Ana',esp=1900)
    v=await pg.input_value('#nombre');rep('No duplica la frase que Android entrega dos veces',v.strip()=='Ana',repr(v))
    await br.close()
asyncio.run(main());SRV.terminate()
print(f"\n{sum(1 for r in R if r[1])} de {len(R)} correctas")
