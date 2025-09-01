
(function(){
  const $ = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];
  const txt = (node, sel) => {
    const n = sel ? node.querySelector(sel) : node;
    return n ? (n.textContent || "").trim() : "";
  };

  function parseItem(node){
    const pick = (names) => {
      for (const n of names){
        const v = txt(node, n);
        if (v) return v;
      }
      return "";
    };

    const fotos = []
      .concat($$('fotos foto', node).map(f => txt(f)))
      .concat($$('imagenes imagen', node).map(f => txt(f)))
      .concat($$('fotos url', node).map(f => txt(f)))
      .filter(Boolean);

    return {
      id:       pick(['id','ID','cod','codigo','code']),
      titulo:   pick(['titulo','title','nombre','name']),
      precio:   pick(['precio','price','importe']),
      moneda:   pick(['moneda','currency']),
      ciudad:   pick(['localidad','ciudad','poblacion','town']),
      provincia:pick(['provincia','region','state']),
      hab:      pick(['habitaciones','dormitorios','rooms','bedrooms']),
      banos:    pick(['banos','baños','bathrooms']),
      metros:   pick(['superficie','metros','m2','area']),
      lat:      pick(['lat','latitud']),
      lng:      pick(['lng','lon','longitud']),
      desc:     pick(['descripcion','description','resumen']),
      fotos
    };
  }

  function autoItems(doc){
    const candidates = [
      'viviendas vivienda',
      'vivienda',
      'items item',
      'properties property',
      'list item',
      'root item'
    ];
    for (const sel of candidates){
      const nodes = $$(sel, doc);
      if (nodes.length) return nodes;
    }
    const all = $$('*', doc).filter(n => n.children.length === 0);
    const parents = new Set(all.map(n => n.parentElement).filter(Boolean));
    const plausible = [...parents].filter(p => p.querySelector('precio, price, titulo, title'));
    return plausible.length ? plausible : [];
  }

  function money(p, m){
    if (!p) return '';
    const num = p.replace(/[^\d.,]/g,'').replace(',', '.');
    const val = Number(num);
    const sym = (m||'').toUpperCase()==='EUR' ? '€' : (m||'');
    return isNaN(val) ? p : `${val.toLocaleString()} ${sym}`.trim();
  }

  const FKEY = 'fincalida:favs';
  const getFavs = () => new Set(JSON.parse(localStorage.getItem(FKEY)||'[]'));
  const setFavs = s => localStorage.setItem(FKEY, JSON.stringify([...s]));

  function cardHTML(it){
    const price = money(it.precio, it.moneda);
    const img = it.fotos?.[0] || 'https://via.placeholder.com/800x500?text=Sin+foto';
    const favs = getFavs();
    const liked = favs.has(it.id);
    return `
      <article class="prop-card" data-id="${it.id}">
        <div class="prop-img"><img src="${img}" alt="${(it.titulo||'Propiedad')}" loading="lazy"></div>
        <div class="prop-body">
          <h3>${it.titulo || 'Propiedad'}</h3>
          <p class="prop-loc">${[it.ciudad, it.provincia].filter(Boolean).join(', ')}</p>
          <p class="prop-meta">
            ${it.hab ? `${it.hab} hab` : ''} ${it.banos ? `· ${it.banos} baños` : ''} ${it.metros ? `· ${it.metros} m²` : ''}
          </p>
          <p class="prop-price">${price || ''}</p>
          <div class="prop-actions">
            <button class="btn-like" aria-pressed="${liked}">${liked ? '♥ Quitar' : '♡ Me gusta'}</button>
            <a class="btn" target="_blank"
               href="https://wa.me/?text=${encodeURIComponent((it.titulo||'Propiedad') + '\n' + location.href + '#id=' + it.id)}">WhatsApp</a>
            <a class="btn btn-outline" href="mailto:__MAIL__?subject=${encodeURIComponent('Consulta propiedad ' + it.id)}&body=${encodeURIComponent('Hola, me interesa la propiedad ' + it.id + '.')}">Contactar</a>
            <a class="btn btn-primary" href="${window.__FINCALIDA_CFG.baseDetailUrl || './index.html'}#id=${encodeURIComponent(it.id)}">Ver propiedad</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderList(items, mount, contactEmail){
    mount.innerHTML = `
      <style>
        .prop-card{display:grid;grid-template-columns: 1fr 1.2fr;gap:16px;margin:14px 0;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff}
        @media (max-width: 800px){.prop-card{grid-template-columns:1fr}}
        .prop-img img{width:100%;height:100%;object-fit:cover;border-radius:10px;aspect-ratio:16/9}
        .prop-body h3{margin:0 0 6px 0}
        .prop-meta,.prop-loc{color:#555;margin:.25rem 0}
        .prop-price{font-weight:700;margin:.5rem 0 1rem 0}
        .prop-actions{display:flex;flex-wrap:wrap;gap:8px}
        .btn, .btn-like{border:1px solid #ddd;padding:.45rem .7rem;border-radius:8px;text-decoration:none;background:#fff}
        .btn-primary{background:#111;color:#fff;border-color:#111}
        .btn-outline{background:#fff}
        .btn-like[aria-pressed="true"]{background:#ffe3ea;border-color:#ff9bb2}
      </style>
      <div class="prop-grid"></div>
    `;
    const grid = $('.prop-grid', mount);
    grid.innerHTML = items.map(cardHTML).join('').replaceAll('__MAIL__', contactEmail);

    grid.addEventListener('click', (e)=>{
      const btn = e.target.closest('.btn-like');
      if (!btn) return;
      const card = e.target.closest('.prop-card');
      const id = card?.dataset?.id;
      if (!id) return;
      const favs = getFavs();
      favs.has(id) ? favs.delete(id) : favs.add(id);
      setFavs(favs);
      btn.setAttribute('aria-pressed', favs.has(id) ? 'true' : 'false');
      btn.textContent = favs.has(id) ? '♥ Quitar' : '♡ Me gusta';
    });
  }

  async function fetchXML(url){
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xmlText = await res.text();
    return new DOMParser().parseFromString(xmlText, 'text/xml');
  }

  async function initFincalida(cfg){
    window.__FINCALIDA_CFG = cfg;
    const mount = document.getElementById('prop-list');
    if (!mount){ console.warn('[Fincalida] Falta <div id="prop-list">'); return; }

    try{
      const doc = await fetchXML(cfg.XML_URL);
      const nodes = autoItems(doc);
      if (!nodes.length) throw new Error('No se encontraron propiedades en el XML');
      const items = nodes.map(parseItem).filter(x => x.id);
      renderList(items, mount, cfg.contactEmail || 'info@sitio.com');
    }catch(err){
      mount.innerHTML = `
        <div style="padding:16px;border:1px solid #fbbf24;background:#fffbeb;border-radius:10px">
          <strong>No se pudo cargar el XML.</strong><br>
          ${err.message}.<br>
          <small>Si es un error CORS, usa un proxy (Cloudflare Worker).</small>
        </div>`;
      console.error('[Fincalida] Error XML:', err);
    }
  }

  window.initFincalida = initFincalida;
})();
