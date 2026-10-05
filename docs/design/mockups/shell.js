// Inyecta AppShell (sidebar + bottom nav móvil) y luego iconos lucide
(function(){
  const active = document.body.dataset.nav || '';
  const it = (k,icon,label,count,hot)=>`<a class="sb-item ${active===k?'active':''}" href="#"><i data-lucide="${icon}" class="i"></i><span class="txt">${label}</span>${count?`<span class="count ${hot?'hot':''}">${count}</span>`:''}</a>`;
  const sb = `
  <aside class="sb" aria-label="Navegación principal"><div class="sb-in">
    <div class="sb-ws"><div class="logo">C4M</div><div class="txt" style="min-width:0"><div class="t-l13">Creators for Media</div><div class="t-l12 subtle" style="font-weight:400">Agencia · Madrid</div></div><i data-lucide="chevrons-up-down" class="i s14 subtle txt" style="margin-left:auto"></i></div>
    <div class="sb-search"><i data-lucide="search" class="i"></i><span class="txt t-c13" style="flex:1">Buscar o saltar a…</span><span class="kbd">⌘K</span></div>
    ${it('acciones','inbox','Centro de acciones','5',true)}
    ${it('asistente','sparkles','Asistente','')}
    <div class="sb-group"><div class="sb-label">Operación</div>
    ${it('campanas','megaphone','Campañas','6')}
    ${it('creadores','users','Creators','')}
    ${it('contenidos','clapperboard','Contenidos','')}
    </div>
    <div class="sb-group"><div class="sb-label">Dinero</div>
    ${it('contratos','file-signature','Contratos','4')}
    ${it('finanzas','wallet','Finanzas','')}
    ${it('clientes','building-2','Clientes','')}
    </div>
    <div class="sb-group"><a class="sb-item" href="#" style="height:26px"><i data-lucide="chevron-right" class="i s14"></i><span class="txt" style="font-size:12.5px">Admin</span></a></div>
    <div class="sb-group"><div class="sb-label">Campañas fijadas</div>
    <a class="sb-item ${active==='navidad'?'active':''}" href="#"><span style="width:16px;display:grid;place-items:center"><span style="width:8px;height:8px;border-radius:3px;background:var(--brand-ui)"></span></span><span class="txt">Navidad 2026</span></a>
    <a class="sb-item" href="#"><span style="width:16px;display:grid;place-items:center"><span style="width:8px;height:8px;border-radius:3px;background:var(--info-dot)"></span></span><span class="txt">Black Friday · Many Chat</span></a>
    </div>
    <div class="sb-foot"><div class="avatar">ÁR</div><div class="txt" style="min-width:0;flex:1"><div class="t-l13">Álvaro Romero</div><div class="t-l12 subtle" style="font-weight:400">Admin</div></div><i data-lucide="settings" class="i subtle txt"></i></div></div>
  </aside>`;
  const bn = `<nav class="bottom-nav" aria-label="Navegación">
    <a href="#" class="${active==='acciones'?'on':''}"><i data-lucide="inbox" class="i s20"></i>Acciones</a>
    <a href="#" class="${['campanas','navidad'].includes(active)?'on':''}"><i data-lucide="megaphone" class="i s20"></i>Campañas</a>
    <a href="#" class="${active==='contenidos'?'on':''}"><i data-lucide="clapperboard" class="i s20"></i>Contenidos</a>
    <a href="#" class="${active==='asistente'?'on':''}"><i data-lucide="sparkles" class="i s20"></i>Asistente</a>
    <a href="#"><i data-lucide="menu" class="i s20"></i>Más</a></nav>`;
  const app = document.querySelector('.app');
  if (app && !document.body.dataset.nosb) app.insertAdjacentHTML('afterbegin', sb);
  if (!document.body.dataset.nobn) document.body.insertAdjacentHTML('beforeend', bn);
  const BR={instagram:'<svg viewBox="0 0 24 24" class="i s14" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>',
   youtube:'<svg viewBox="0 0 24 24" class="i s14" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/></svg>',
   tiktok:'<svg viewBox="0 0 24 24" class="i s14" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.6 2.4 4.4 5 4.6"/></svg>'};
  document.querySelectorAll('i[data-brand]').forEach(e=>e.outerHTML=BR[e.dataset.brand]);
  lucide.createIcons({attrs:{'stroke-width':1.75}});
})();
