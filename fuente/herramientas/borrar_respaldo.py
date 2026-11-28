"""Prueba de «Borrar datos» y «Respaldo automático» (puente de Google simulado, reloj controlado).
Uso: python3 fuente/herramientas/borrar_respaldo.py carpeta_con_las_apps/   (necesita Playwright y Chrome; ruta de Chrome en la variable CHROME)"""
import asyncio,subprocess,time,sys,json
from playwright.async_api import async_playwright
RAIZ=sys.argv[1]
SRV=subprocess.Popen(['python3','-m','http.server','8774'],cwd=RAIZ,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
B='http://localhost:8774/';OP=B+'Organizatones_para_Preguntones/index.html';NK=B+'NoteKiebres/index.html'
URL='https://script.google.com/macros/s/PRUEBA/exec'
SEM="""(()=>{const P=JSON.stringify({P:[{id:'a',k:'tema',x:10,y:10,text:'x'}],C:[],meta:{f1:'2026-11-20',f2:'2026-11-20'}});
 localStorage.setItem('ogp:v1:g4A:5',P);localStorage.setItem('ogp:v1:g4A:7',P);localStorage.setItem('ogp:v1:g5A:5',P);
 const e=(g,gr)=>({id:'2026-11-20|'+g+'|5',d:'2026-11-20',ctx:g,gr,gp:'A',n:5,t:'2026-11-20T10:00:00.000Z',tema:'',lec:null,mom:2,momv:[0,1],sello:false,etv:[],propio:true,lv:[1,1,1,1],notas:'',form:'A',f1:'2026-11-20T10:00:00.000Z',f2:'2026-11-20T10:00:00.000Z'});
 localStorage.setItem('oya:bit',JSON.stringify({'2026-11-20|g4A|5':e('g4A',4),'2026-11-20|g5A|5':e('g5A',5)}));
 localStorage.setItem('oya:lecs',JSON.stringify([{id:'L1',titulo:'Con foto',texto:'',orgs:[1],img:'data:image/jpeg;base64,AAAA'},{id:'L2',titulo:'Texto',texto:'hola',orgs:[2]}]));
 localStorage.setItem('oya:letra','1');localStorage.setItem('oya:horario','[]');localStorage.setItem('oya:gh',JSON.stringify({owner:'x',repo:'y',token:'SECRETO'}));})()"""
res=[]
def ok(nombre,cond,extra=''):
  res.append(bool(cond));print(('✓ ' if cond else '✗ FALLA ')+nombre+(' · '+str(extra) if extra and not cond else ''))
async def toca(pg,sel):
  await pg.evaluate("s=>{const e=document.querySelector(s);e.scrollIntoView({block:'center'});if(e.disabled)throw new Error('desactivado: '+s);e.click()}",sel)
async def marca(pg,sel,val=True):
  await pg.evaluate("([s,v])=>{const e=document.querySelector(s);if(e.checked!==v)e.closest('label').click()}",[sel,val])
async def nueva(br,fecha,vp=(1366,800)):
  c=await br.new_context(viewport={'width':vp[0],'height':vp[1]},accept_downloads=True,permissions=['clipboard-read','clipboard-write'])
  pg=await c.new_page();await pg.clock.set_fixed_time(fecha);pg.errs=[];pg.on('pageerror',lambda e:pg.errs.append(str(e)));return c,pg
async def main():
  async with async_playwright() as p:
    br=await p.chromium.launch(executable_path=__import__('os').environ.get('CHROME','/usr/bin/google-chrome'))
    # ---------- BORRAR: solo trabajos del 4.º A
    c,pg=await nueva(br,'2026-11-27T10:00:00-06:00');await pg.goto(OP);await pg.evaluate(SEM);await pg.goto(OP+'#evaluador');await pg.wait_for_timeout(500)
    await pg.click('section [data-z="borrar"]');await pg.wait_for_timeout(300)
    ok('Continuar desactivado sin elegir nada',await pg.is_disabled('#brsig'))
    txt=await pg.inner_text('#modal');ok('lista categorías con cantidades','3 trabajos' in txt and '2 registros' in txt and '1 con foto' in txt,txt[:300])
    await marca(pg,'.brc[value="tab"]');await marca(pg,'#brgall',False);await marca(pg,'.brg[value="g4A"]');await toca(pg,'#brsig');await pg.wait_for_timeout(300)
    t2=await pg.inner_text('#modal');ok('resumen dice qué y de qué grupo','4.º A' in t2 and '2 trabajos' in t2,t2[:300])
    ok('Borrar desactivado hasta escribir BORRAR',await pg.is_disabled('#brgo'))
    await pg.fill('#brtxt','borrar');ok('se activa al escribir «borrar»',not await pg.is_disabled('#brgo'))
    async with pg.expect_download() as d: await toca(pg,'#brgo')
    dl=await d.value;ok('descarga un respaldo antes de borrar',dl.suggested_filename.startswith('respaldo-organizatones'),dl.suggested_filename)
    await pg.wait_for_timeout(1500)
    K=await pg.evaluate("Object.keys(localStorage)")
    ok('borró solo los trabajos del 4.º A','ogp:v1:g4A:5' not in K and 'ogp:v1:g4A:7' not in K and 'ogp:v1:g5A:5' in K)
    ok('no tocó registro, lecturas ni llave','oya:bit' in K and 'oya:lecs' in K and 'oya:gh' in K)
    ok('avisa al recargar','borró' in (await pg.inner_text('#toast')))
    respaldo=json.loads(open(await dl.path()).read());ok('el respaldo trae lo borrado y no la llave','ogp:v1:g4A:5' in respaldo['datos'] and 'oya:gh' not in respaldo['datos'])
    await c.close()
    # ---------- BORRAR: solo fotos de lecturas, por voz
    c,pg=await nueva(br,'2026-11-27T10:00:00-06:00');await pg.add_init_script("window.webkitSpeechRecognition=window.SpeechRecognition=class{start(){window.__rec=this}stop(){}abort(){}};window.__decir=t=>window.__rec.onresult({resultIndex:0,results:[Object.assign([{transcript:t}],{isFinal:true})]});")
    await pg.goto(OP);await pg.evaluate(SEM);await pg.goto(OP);await pg.wait_for_timeout(400)
    await pg.evaluate("document.querySelector('#micf').click()");await pg.evaluate("__decir('borra mis datos')");await pg.wait_for_timeout(500)
    ok('«borra mis datos» abre la ventana',await pg.locator('#brsig').count()==1)
    await marca(pg,'.brc[value="lec"]');ok('aparece «solo quitar las fotos»',await pg.evaluate("!document.querySelector('#brsolofotos').closest('label').hidden"))
    await marca(pg,'#brsolofotos');await toca(pg,'#brsig');await pg.fill('#brtxt','BORRAR')
    async with pg.expect_download(): await toca(pg,'#brgo')
    await pg.wait_for_timeout(1500);L=await pg.evaluate("JSON.parse(localStorage.getItem('oya:lecs'))")
    ok('quitó la foto y conservó las 2 lecturas',len(L)==2 and not any('img' in l for l in L))
    await c.close()
    # ---------- NoteKiebres: sin grupos, preferencias
    c,pg=await nueva(br,'2026-11-27T10:00:00-06:00');await pg.goto(NK);await pg.evaluate("localStorage.setItem('oya:letra','2');localStorage.setItem('ogp:v1:5','{}')");await pg.goto(NK+'#evaluador');await pg.wait_for_timeout(400)
    await pg.click('footer [data-z="borrar"]');ok('NoteKiebres: sin selector de grupos',await pg.locator('#brgall').count()==0)
    await marca(pg,'.brc[value="pref"]');await toca(pg,'#brsig');await pg.fill('#brtxt','BORRAR')
    async with pg.expect_download(): await toca(pg,'#brgo')
    await pg.wait_for_timeout(1500);K=await pg.evaluate("Object.keys(localStorage)");ok('NoteKiebres: borró preferencias y conservó el trabajo','oya:letra' not in K and 'ogp:v1:5' in K)
    await c.close()
    # ---------- RESPALDO AUTOMÁTICO
    posts=[]
    async def ruta(route):
      req=route.request
      if req.method=='POST':
        b=json.loads(req.post_data);posts.append(b);modo=ruta.modo
        if modo=='abort':return await route.abort()
        cuerpo={'ok':True,'archivo':b['nombre']} if modo=='ok' else {'ok':False,'error':'clave incorrecta'}
        return await route.fulfill(status=200,headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json'},body=json.dumps(cuerpo))
      await route.fulfill(status=200,body='{}')
    ruta.modo='ok'
    async def conf(pg,on=True):
      await pg.goto(OP+'#evaluador');await pg.wait_for_timeout(300);await pg.click('section [data-z="autobk"]');await pg.wait_for_timeout(200)
      if on: await marca(pg,'#abon')
      await pg.fill('#abeq','Biblioteca');await pg.fill('#abco','profe@ejemplo.com');await pg.fill('#abur',URL);await toca(pg,'#abok');await pg.wait_for_timeout(300)
    # viernes 27/11 a las 14:30: debe enviar una vez
    c,pg=await nueva(br,'2026-11-27T14:30:00-06:00');await pg.route('https://script.google.com/**',ruta);await pg.goto(OP);await pg.evaluate(SEM);await conf(pg)
    await pg.wait_for_timeout(3500);n1=len(posts)
    ok('día hábil después de la hora: envía',n1==1,n1)
    if posts:
      b=posts[-1];clave=await pg.evaluate("JSON.parse(localStorage.getItem('oya:auto')).clave")
      ok('lleva la clave, el equipo y el respaldo',b['clave']==clave and b['equipo']=='Biblioteca' and 'ogp:v1:g4A:5' in b['respaldo']['datos'])
      ok('el respaldo no lleva la llave de GitHub ni la clave','oya:gh' not in b['respaldo']['datos'] and 'oya:auto' not in b['respaldo']['datos'])
      ok('cubre el viernes 27',b['cubre']=='2026-11-27' and b['motivo']=='diario',b.get('cubre'))
    await pg.goto(OP+'#evaluador');await pg.wait_for_timeout(3500);ok('no repite el mismo día',len(posts)==n1)
    est=await pg.inner_text('.respaldo-estado');ok('muestra el estado','activado' in est and '✓' in est,est)
    await pg.click('section [data-z="autobk"]');await toca(pg,'#abcp');await pg.wait_for_timeout(300)
    code=await pg.evaluate("navigator.clipboard.readText()");ok('copia el código con clave y correo',clave in code and "CORREO = 'profe@ejemplo.com'" in code and '@@' not in code)
    posts.clear();await toca(pg,'#abpr');await pg.wait_for_timeout(800);ok('«Probar envío» manda uno de prueba',len(posts)==1 and posts[0]['motivo']=='prueba')
    await c.close()
    # antes de la hora: no envía; sábado: no envía; vacaciones: no envía
    for fecha,nombre in [('2026-11-27T10:00:00-06:00','antes de la hora'),('2026-11-28T15:00:00-06:00','sábado'),('2026-12-22T15:00:00-06:00','vacaciones de invierno'),('2027-07-12T15:00:00-06:00','después del fin de ciclo')]:
      posts.clear();c,pg=await nueva(br,fecha);await pg.route('https://script.google.com/**',ruta);await pg.goto(OP);await conf(pg);await pg.wait_for_timeout(3500)
      ok(f'{nombre}: no envía',len(posts)==0,len(posts));await c.close()
    # lunes 30/11 a las 8:00 con el viernes sin respaldo: envía el atrasado
    posts.clear();c,pg=await nueva(br,'2026-11-30T08:00:00-06:00');await pg.route('https://script.google.com/**',ruta);await pg.goto(OP)
    await pg.evaluate("localStorage.setItem('oya:auto',JSON.stringify({on:true,url:'"+URL+"',clave:'k1',ult:'2026-11-26',hora:'14:00'}))");await pg.goto(OP);await pg.wait_for_timeout(3500)
    ok('lunes temprano: manda el viernes que faltó',len(posts)==1 and posts[0]['cubre']=='2026-11-27' and posts[0]['motivo']=='atrasado',[x.get('cubre') for x in posts])
    await c.close()
    # errores: Google rechaza y sin conexión
    for modo,esper in [('error','Google respondió'),('abort','no respondió')]:
      ruta.modo=modo;posts.clear();c,pg=await nueva(br,'2026-11-27T15:00:00-06:00');await pg.route('https://script.google.com/**',ruta);await pg.goto(OP);await conf(pg);await pg.wait_for_timeout(3500)
      A=await pg.evaluate("JSON.parse(localStorage.getItem('oya:auto'))");ok(f'error «{modo}»: lo registra y no marca el día como respaldado',esper in A['ultRes'] and A.get('ult','')!='2026-11-27',A['ultRes'])
      await c.close()
    ruta.modo='ok'
    print(f'\n{sum(res)} de {len(res)} comprobaciones correctas.')
    await br.close()
try: asyncio.run(main())
finally: SRV.terminate()
