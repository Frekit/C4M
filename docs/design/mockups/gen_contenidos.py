# título, ctr, ini, igc, handle, plat, estado, tono, fecha, enlace, pago, sel, focus
R=[
('Reel 1 · Unboxing','CTR-2026-001','MM','','@martamoda','instagram','Fecha pasada','danger','2 oct','—','—',False,False),
('Reel 1','CTR-2026-004','LT','b','@lauratravels','instagram','Fecha pasada','danger','2 oct','—','—',False,False),
('TikTok 1 · Set de Navidad','CTR-2026-005','PF','c','@pabloframes','tiktok','Fecha pasada','danger','2 oct','—','—',False,True),
('Reel 2 · Antes y después','CTR-2026-001','MM','','@martamoda','instagram','Programado','info','12 oct','—','—',True,False),
('TikTok 2','CTR-2026-005','PF','c','@pabloframes','tiktok','Programado','info','18 oct','—','—',True,False),
('Reel · Lookbook','CTR-2026-001','MM','','@martamoda','instagram','Rechazado por plataforma','danger','1 oct','instagram.com/reel/C9x…','—',False,False),
('Story · Código regalo','CTR-2026-001','MM','','@martamoda','instagram','Subido al cliente','success','1 oct','instagram.com/p/C9k…','vence 31 oct',False,False),
('TikTok · Receta exprés','CTR-2026-006','NE','d','@nachoeats','tiktok','Publicado','success','28 sep','tiktok.com/@nachoeats/…','vence 28 oct',False,False),
('Reel · Black Friday teaser','CTR-2026-002','SB','','@sarabakes','instagram','Pagado','neutral','2 sep','instagram.com/reel/C7q…','pagado 2 oct',False,False),
]
tr=[]
for (t,ctr,ini,ig,h,pl,st,tone,date,link,pay,sel,foc) in R:
    cls=' class="sel"' if sel else (' class="focus"' if foc else '')
    lk=f'<span class="lnk2"><i data-lucide="link" class="i s14"></i>{link}</span>' if link!='—' else '<span class="subtle">—</span>'
    tr.append(f'<tr{cls}><td><span class="cb{" on" if sel else ""}"></span></td><td><div class="who"><span class="pf"><i data-brand="{pl}"></i></span><div><div class="h">{t}</div><div class="s mono" style="font-size:11.5px">{ctr}</div></div></div></td><td><div class="who"><span class="ig {ig}" style="width:22px;height:22px;font-size:9px">{ini}</span><span class="t-c13">{h}</span></div></td><td><span class="pill {tone}">{st}</span></td><td class="num{" danger-t" if tone=="danger" and st=="Fecha pasada" else ""}">{date}</td><td>{lk}</td><td class="num t-c13 {"muted" if pay!="—" else "subtle"}">{pay}</td></tr>')
t=open('contenidos.tpl.html').read().replace('{{ROWS}}','\n'.join(tr))
open('contenidos-detalle.html','w').write(t)
open('contenidos.html','w').write(t.replace('<body data-nav="contenidos">','<body data-nav="contenidos" class="no-sheet">'))
