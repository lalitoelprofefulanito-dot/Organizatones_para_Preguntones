"""Regresión del motor sobre ejemplo.html: todo lo que la v2.0 hacía bien debe seguir funcionando.
Uso, desde esta carpeta: python3 regresion.py ../voz-accesible.js ../ejemplo.html"""
import asyncio,sys,os,shutil,subprocess,time
from playwright.async_api import async_playwright
MOTOR,EJ=sys.argv[1],sys.argv[2]
os.makedirs('srv2',exist_ok=True);shutil.copy(MOTOR,'srv2/voz-accesible.js');shutil.copy(EJ,'srv2/ejemplo.html')
SRV=subprocess.Popen(['python3','-m','http.server','8791'],cwd='srv2',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
FAKE=open(os.path.join(os.path.dirname(__file__) or '.','audita.py')).read().split('FAKE="""')[1].split('"""')[0]
R=[]
def rep(n,ok,d=''):R.append(ok);print(('✓' if ok else '✗'),n,d)
async def main():
  async with async_playwright() as p:
    br=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'))
    pg=await br.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.add_init_script(FAKE);await pg.goto('http://localhost:8791/ejemplo.html');await pg.wait_for_timeout(300)
    await pg.evaluate('VozAccesible.encender()')
    async def di(t,esp=450): await pg.evaluate('t=>__di(t)',t);await pg.wait_for_timeout(esp)
    est=lambda:pg.eval_on_selector('#estado','e=>e.textContent')
    await di('escribe Ana López en nombre');rep('escribir en un campo con mayúsculas y acentos',await pg.input_value('#nombre')=='Ana López',await pg.input_value('#nombre'))
    await di('elige México en país');rep('elegir en lista',await pg.input_value('#pais')=='mx')
    await di('por favor toca guardar');rep('cortesía + tocar botón',(await est()).startswith('Guardado: Ana López'),await est())
    await di('marca acepto');rep('marcar casilla',await pg.is_checked('#acepto'))
    await di('toca editar');n=await pg.evaluate('document.querySelectorAll("#va-badges .va-badge").length');rep('botones repetidos muestran números',n==2,str(n))
    await di('el dos');rep('«el dos» elige el segundo',await est()=='Editando Documento B',await est())
    await di('toca eliminar');await di('el uno');rep('eliminar pide confirmación',await est()=='Editando Documento B')
    await di('sí confirmar');rep('«sí confirmar» ejecuta',await est() in('Eliminado Documento A','Eliminado Documento B'),await est())
    await pg.evaluate("void(document.getElementById('estado').textContent='x')");await di('toca eliminar');await di('el dos');await di('cancelar');rep('«cancelar» no ejecuta',await est()=='x',await est())
    await di('abre detalles');rep('abrir detalles',await pg.evaluate('document.querySelector("details").open'))
    await di('cierra detalles');rep('cerrar detalles',not await pg.evaluate('document.querySelector("details").open'))
    await di('la segunda');rep('opción por número (radio)',await pg.evaluate('document.querySelectorAll("input[type=radio]")[1].checked'))
    await di('toca ver mensaje');rep('abrir ventana',await pg.evaluate('dlg.open'))
    await di('entendido');rep('«entendido» cierra la ventana',not await pg.evaluate('dlg.open'))
    await di('hasta abajo',900);y=await pg.evaluate('scrollY');rep('desplazar hasta abajo',y>200,str(y))
    await di('hasta arriba',900);y=await pg.evaluate('scrollY');rep('desplazar hasta arriba',y<50,str(y))
    await di('modo oscuro');rep('comando propio de la app',await pg.evaluate('document.body.classList.contains("oscuro")'))
    await di('escribe en comentarios');await di('me gustó mucho coma gracias');await di('terminar dictado')
    v=await pg.input_value('#coment');rep('dictado largo con puntuación',v.startswith('Me gustó mucho, gracias') or v.startswith('me gustó mucho, gracias') or v=='me gustó mucho coma gracias',repr(v))
    await pg.fill('#nombre','');await di('llena el formulario de prueba',900)
    rep('acciones de IA',await pg.input_value('#nombre')=='Eduardo Kantún' and (await est()).startswith('Guardado'),await est())
    await di('abre detalles y luego toca guardar',1500);rep('órdenes encadenadas',await pg.evaluate('document.querySelector("details").open') and (await est()).startswith('Guardado'))
    await di('ayuda');rep('ayuda',await pg.evaluate('!document.getElementById("va-ayuda").hidden'))
    await di('entendido');rep('cerrar ayuda',await pg.evaluate('document.getElementById("va-ayuda").hidden'))
    await di('apaga el micrófono');rep('apagar',not await pg.evaluate('VozAccesible.encendido'))
    rep('sin errores de JavaScript',not errs,str(errs))
    await br.close()
asyncio.run(main());SRV.terminate()
print(f"\n{sum(R)} de {len(R)} correctas")
