R=[# handle,name,ini,igc,plat,median,n,fmt,cost,sale,margin,st,tone,ctr,cst,ctone
('@martamoda','Marta Molina','MM','','instagram','48,2 K',4,'Reel','4.200,00 €','US$ 6.400,00','24 %','Activo','success','CTR-2026-001','Firmado','success'),
('@lauratravels','Laura Torres','LT','b','instagram','21,5 K',2,'Reel','2.400,00 €','US$ 3.600,00','22 %','Activo','success','CTR-2026-004','Visto, sin firmar','warning'),
('@pabloframes','Pablo Fernández','PF','c','tiktok','96 K',2,'TikTok','3.800,00 €','US$ 5.800,00','24 %','Activo','success','CTR-2026-005','Enviado','info'),
('@nachoeats','Nacho Estévez','NE','d','tiktok','33 K',2,'TikTok','2.150,00 €','US$ 3.200,00','22 %','Activo','success','CTR-2026-006','Borrador','neutral'),
('@lucia.fit','Lucía Ferrer','LF','e','instagram','12,8 K',3,'Story','900,00 €','US$ 1.350,00','22 %','Aprobado','success','',None,None),
('@techconjavi','Javier Ruiz','JR','b','youtube','61 K',1,'Vídeo','6.500,00 €','US$ 9.600,00','21 %','Propuesto','info','',None,None),
('@sarabakes','Sara Blanco','SB','','instagram','30,1 K',1,'Reel','1.800,00 €','US$ 2.700,00','22 %','Propuesto','info','',None,None),
('@daniurbano','Dani Urbano','DU','c','tiktok','18 K',2,'TikTok','1.500,00 €','US$ 2.200,00','21 %','Rechazado','danger','',None,None),
]
tr=[];ml=[]
for i,(h,n,ini,ig,pl,med,q,fmt,cost,sale,mg,st,tone,ctr,cst,ctone) in enumerate(R):
    cls=' class="is-hover"' if h=='@lauratravels' else (' class="sel"' if h=='@pabloframes' else '')
    plural={'Reel':'Reels','TikTok':'TikToks','Story':'Stories','Vídeo':'Vídeos'}[fmt] if q>1 else fmt
    if ctr: c=f'<a class="mono lnk" href="#">{ctr}</a> <span class="cst {ctone}">{cst}</span>'
    elif st=='Aprobado': c='<button class="btn btn-ghost btn-sm" style="margin-left:-10px"><i data-lucide="file-plus-2" class="i"></i>Generar contrato</button>'
    else: c='<span class="subtle">—</span>'
    act='<button class="btn btn-secondary btn-sm"><i data-lucide="send" class="i"></i>Reenviar</button>' if h=='@lauratravels' else '<i data-lucide="ellipsis" class="i subtle"></i>'
    salecell=f'<span class="cell-edit">{sale}</span>' if h=='@pabloframes' else sale
    tr.append(f'<tr{cls}><td><span class="cb{" on" if h=="@pabloframes" else ""}"></span></td><td><div class="who"><span class="ig {ig}">{ini}</span><div><div class="h">{n}</div><div class="s plat"><i data-brand="{pl}"></i>{h}</div></div></div></td><td class="r num">{med}</td><td>{q} × {plural if q>1 else fmt}</td><td class="r num">{cost}</td><td class="r num">{salecell}</td><td class="r num muted">{mg}</td><td><span class="pill {tone}">{st}</span></td><td>{c}</td><td class="r">{act}</td></tr>')
    if i<6: ml.append(f'<div class="mrow"><span class="ig {ig}">{ini}</span><div class="mm"><div class="h">{h}</div><div class="s">{q} × {plural} · {cost}</div></div><div class="mr"><span class="pill {tone}">{st}</span><span class="t-l12 subtle">{ctr or "Sin contrato"}</span></div></div>')
body=open('_planilla-body.tpl.html').read().replace('{{ROWS}}','\n'.join(tr)).replace('{{MROWS}}','\n'.join(ml))
open('_planilla-body.html','w').write(body)
