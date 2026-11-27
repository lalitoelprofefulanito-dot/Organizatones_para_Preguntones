"""Limpieza conservadora del <style> principal del motor.
Quita solo lo que se puede demostrar que no tiene efecto:
 1. Selectores que nombran una clase o un id que no aparece en ningún lugar fuera del CSS
    (no cuenta lo que está dentro de :not(...)). Si una regla se queda sin selectores, se va.
 2. Declaraciones anuladas: una propiedad de un selector exacto que se vuelve a declarar más abajo
    para ese mismo selector, en el mismo contexto o en uno que aplica siempre que el primero, con
    importancia igual o mayor. Dentro de una misma regla se conservan los respaldos (valores distintos).
 3. Reglas vacías y comentarios de número de versión.
Uso: python3 css_limpia.py motor.html
"""
import re, sys
import tinycss2

F = sys.argv[1]
s = open(F, encoding='utf-8').read()
a = s.find('<style>') + 7
b = s.find('</style>', a)
css = s[a:b]
fuera = s[:a] + s[b:]
DINAMICAS = {'z1', 'z2'}  # se arman con 'z'+LETRA
tokens = set(re.findall(r'[A-Za-z_][\w-]*', fuera))

VERSION = re.compile(r'\bv\d+\b')


def norm(t):
    return re.sub(r'\s+', ' ', t).strip()


def sin_not(sel):
    """Quita el contenido de :not(), :is() y :where(): ahí una clase ausente no hace muerto al selector."""
    out, i = '', 0
    while i < len(sel):
        m = re.compile(r':(not|is|where)\(').search(sel, i)
        if not m:
            return out + sel[i:]
        j = m.start()
        out += sel[i:j]
        k, d = m.end(), 1
        while d:
            d += {'(': 1, ')': -1}.get(sel[k], 0); k += 1
        i = k
    return out


def vivo(sel):
    base = sin_not(sel)
    for c in re.findall(r'\.([A-Za-z_][\w-]*)', base):
        if c not in tokens and c not in DINAMICAS:
            return False
    for c in re.findall(r'#([A-Za-z_][\w-]*)', base):
        if c not in tokens:
            return False
    return True


def split_sel(prelude):
    t, partes, d, cur = norm(tinycss2.serialize(prelude)), [], 0, ''
    for ch in t:
        if ch in '([': d += 1
        if ch in ')]': d -= 1
        if ch == ',' and d == 0:
            partes.append(cur.strip()); cur = ''
        else:
            cur += ch
    partes.append(cur.strip())
    return partes


# ---- 1. leer todo a una lista plana de items, con su contexto
items = []  # dict(tipo, ctx, sels, decls, texto)


def leer(rules, ctx):
    for r in rules:
        if r.type == 'whitespace':
            continue
        if r.type == 'comment':
            items.append(dict(tipo='comment', ctx=ctx, texto=r.value)); continue
        if r.type == 'at-rule' and r.lower_at_keyword in ('media', 'supports') and r.content is not None:
            pre = norm(tinycss2.serialize(r.prelude))
            items.append(dict(tipo='open', ctx=ctx, texto=f'@{r.lower_at_keyword} {pre}'))
            leer(tinycss2.parse_rule_list(r.content, skip_comments=False, skip_whitespace=True), ctx + (f'@{r.lower_at_keyword} {pre}',))
            items.append(dict(tipo='close', ctx=ctx)); continue
        if r.type == 'at-rule':
            items.append(dict(tipo='raw', ctx=ctx, texto=tinycss2.serialize([r]).strip())); continue
        if r.type == 'qualified-rule':
            decls = []
            for d in tinycss2.parse_blocks_contents(r.content, skip_comments=True, skip_whitespace=True):
                if d.type == 'declaration':
                    decls.append(dict(prop=d.name if d.name.startswith('--') else d.lower_name, val=norm(tinycss2.serialize(d.value)), imp=d.important, vivo=True))
                elif d.type == 'error':
                    sys.exit('ERROR de CSS: ' + str(d.message))
            items.append(dict(tipo='rule', ctx=ctx, sels=split_sel(r.prelude), decls=decls)); continue
        sys.exit('tipo no previsto: ' + r.type)


leer(tinycss2.parse_stylesheet(css, skip_comments=False, skip_whitespace=True), ())
reglas = [x for x in items if x['tipo'] == 'rule']
n_decl0 = sum(len(x['decls']) for x in reglas)
n_sel0 = sum(len(x['sels']) for x in reglas)

# ---- 2. selectores muertos
muertos = set()
for x in reglas:
    vivos = [z for z in x['sels'] if vivo(z)]
    muertos.update(z for z in x['sels'] if not vivo(z))
    x['sels'] = vivos

# ---- 3. declaraciones anuladas
# para cada (selector, propiedad): lista de apariciones (indice_regla, ctx, imp)
for idx, x in enumerate(reglas):
    for d in x['decls']:
        if not d['vivo']:
            continue
        # dentro de la misma regla: si se repite la propiedad, la anterior solo se quita si el valor es igual
        anulada_en_todos = bool(x['sels'])
        for sel in x['sels']:
            gana = False
            for y in reglas[idx + 1:]:
                if sel in y['sels'] and x['ctx'][:len(y['ctx'])] == y['ctx']:
                    for e in y['decls']:
                        if e['prop'] == d['prop'] and (e['imp'] or not d['imp']):
                            gana = True; break
                if gana:
                    break
            if not gana:
                anulada_en_todos = False; break
        if anulada_en_todos:
            d['vivo'] = False
    # repetidas dentro de la misma regla con el mismo valor
    visto = {}
    for i, d in enumerate(x['decls']):
        k = (d['prop'], d['val'], d['imp'])
        if k in visto and d['vivo']:
            x['decls'][visto[k]]['vivo'] = False
        visto[k] = i

# ---- 3b. fusionar fragmentos del mismo selector (mismo contexto) en la última aparición,
#          solo si ninguna regla intermedia declara la misma propiedad (el orden efectivo no cambia)
def props(x):
    return {d['prop'] for d in x['decls'] if d['vivo']}


fusiones = 0
for idx in range(len(reglas) - 1, -1, -1):
    x = reglas[idx]
    if not x['sels'] or not props(x):
        continue
    clave = (x['ctx'], tuple(x['sels']))
    for jdx in range(idx + 1, len(reglas)):
        y = reglas[jdx]
        if (y['ctx'], tuple(y['sels'])) != clave or not y['sels']:
            continue
        entre = set()
        for z in reglas[idx + 1:jdx]:
            if z['sels']:
                entre |= props(z)
        mover = [d for d in x['decls'] if d['vivo'] and d['prop'] not in entre and not d['prop'].startswith('--') or (d['vivo'] and d['prop'].startswith('--') and d['prop'] not in entre)]
        if len(mover) == len([d for d in x['decls'] if d['vivo']]):
            y['decls'] = [dict(d) for d in mover] + y['decls']
            for d in x['decls']:
                d['vivo'] = False
            fusiones += 1
        break
print('reglas fusionadas:', fusiones)

# ---- 4. escribir
out, depth = [], 0
for x in items:
    pad = ' ' * depth
    if x['tipo'] == 'comment':
        if VERSION.search(x['texto']):
            continue
        out.append(f'{pad}/*{x["texto"]}*/')
    elif x['tipo'] == 'open':
        out.append(f'{pad}{x["texto"]}{{'); depth += 1
    elif x['tipo'] == 'close':
        depth -= 1; out.append(' ' * depth + '}')
    elif x['tipo'] == 'raw':
        out.append(pad + x['texto'])
    else:
        ds = [f'{d["prop"]}:{d["val"]}{"!important" if d["imp"] else ""}' for d in x['decls'] if d['vivo']]
        if x['sels'] and ds:
            out.append(f'{pad}{",".join(x["sels"])}{{{";".join(ds)}}}')
texto = '\n'.join(out)
# quitar bloques @media que quedaron vacíos y comentarios huérfanos seguidos
for _ in range(3):
    texto = re.sub(r'\n *@(media|supports)[^{\n]*\{\n *\}', '', texto)
reglas_f = texto.count('{')
n_decl1 = sum(1 for x in reglas if x['sels'] for d in x['decls'] if d['vivo'])
print(f'selectores: {n_sel0} -> {sum(len(x["sels"]) for x in reglas)} (muertos: {len(muertos)})')
print(f'declaraciones: {n_decl0} -> {n_decl1}  | !important: {css.count("!important")} -> {texto.count("!important")}')
print('CSS:', len(css), '->', len(texto) + 2)
print('selectores muertos:', sorted(muertos)[:200])
s = s[:a] + '\n' + texto + '\n' + s[b:]
open(F, 'w', encoding='utf-8').write(s)
