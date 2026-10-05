import sys
import subprocess;subprocess.run(['python3','gen_planilla.py'],check=True)
body=open('_planilla-body.html').read(); css=open('_planilla-style.css').read()
def page(title,extra_css,bodyattrs,inner):
    return ('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><link rel="stylesheet" href="base.css"><style>'+css+extra_css+'</style></head>'
      '<body '+bodyattrs+'>'+inner+'<script src="lucide.min.js"></script><script src="shell.js"></script></body></html>')
open('campana-planilla.html','w').write(page('Navidad 2026 · Planilla · C4M','','data-nav="navidad"','<div class="app"><div class="main">'+body+'</div></div>'))
import os
if os.path.exists('_ia-panel.html'):
    ia=open('_ia-panel.html').read(); iacss=open('_ia-style.css').read()
    b2=body
    import re
    for h in ['@techconjavi','@sarabakes']:
        i=b2.index(h); j=b2.index('<span class="pill info">Propuesto</span>',i)
        b2=b2[:j]+'<span class="ghost-diff"><s>Propuesto</s><i data-lucide="arrow-right" class="i s14" style="color:var(--ai)"></i><span class="pill success">Aprobado</span></span>'+b2[j+len('<span class="pill info">Propuesto</span>'):]
    open('panel-ia.html','w').write(page('Asistente ⌘J · C4M',iacss,'data-nav="navidad" class="ia-open"','<div class="app"><div class="main">'+b2+'</div>'+ia+'</div>'))
