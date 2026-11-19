/**
 * Capa de presentación: construye el HTML de tarjetas, modales y avisos.
 * Sin lógica de negocio: recibe datos y callbacks desde app.js.
 */

import { escapar, resaltar, formatearDuracion, iniciales, paleta } from './util.js';
import { etiquetasCoincidencia } from './search.js';
import { urlIncrustada, codigoIncrustado, parsearEnlace } from './facebook.js';

const ICONOS = {
  estrella:
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z"/></svg>',
  enlace:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/></svg>',
  copiar:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
  externo:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"/></svg>',
  editar:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
  borrar:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  play:
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M10 9.4l5 2.6-5 2.6z" fill="currentColor" stroke="none"/></svg>',
  cerrar:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

export const refs = {
  q: document.getElementById('q'),
  formBusqueda: document.getElementById('form-busqueda'),
  limpiarQ: document.getElementById('limpiar-q'),
  chipsGeneros: document.getElementById('chips-generos'),
  filtroAnio: document.getElementById('filtro-anio'),
  filtroDuracion: document.getElementById('filtro-duracion'),
  orden: document.getElementById('orden'),
  soloReel: document.getElementById('solo-reel'),
  soloFavoritos: document.getElementById('solo-favoritos'),
  grid: document.getElementById('grid'),
  contador: document.getElementById('contador'),
  tiempo: document.getElementById('tiempo'),
  limpiarTodo: document.getElementById('limpiar-todo'),
  vacio: document.getElementById('vacio'),
  vacioTitulo: document.getElementById('vacio-titulo'),
  vacioTexto: document.getElementById('vacio-texto'),
  sugerencias: document.getElementById('sugerencias'),
  dlgDetalle: document.getElementById('dlg-detalle'),
  dContenido: document.getElementById('d-contenido'),
  dlgForm: document.getElementById('dlg-form'),
  dlgCatalogo: document.getElementById('dlg-catalogo'),
  form: document.getElementById('form-pelicula'),
  fTituloModal: document.getElementById('f-titulo-modal'),
  fError: document.getElementById('f-error'),
  fReel: document.getElementById('f-reel'),
  fReelEstado: document.getElementById('f-reel-estado'),
  fPreviewEnvoltura: document.getElementById('f-preview-envoltura'),
  fPreview: document.getElementById('f-preview'),
  toasts: document.getElementById('toasts'),
};

/* ---------------- Utilidades de vista ---------------- */

export function abrirDialogo(dialogo) {
  if (typeof dialogo.showModal === 'function') dialogo.showModal();
  else dialogo.setAttribute('open', '');
  document.body.classList.add('modal-abierto');
}

export function cerrarDialogo(dialogo) {
  if (dialogo.open && typeof dialogo.close === 'function') dialogo.close();
  else dialogo.removeAttribute('open');
  if (![...document.querySelectorAll('dialog[open]')].length) {
    document.body.classList.remove('modal-abierto');
  }
}

export function toast(mensaje, tipo = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = mensaje;
  refs.toasts.appendChild(el);
  setTimeout(() => {
    el.classList.add('saliendo');
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

/* ---------------- Filtros ---------------- */

export function pintarChipsGeneros(generos, activos) {
  const activosSet = new Set(activos);
  const todos = `<button type="button" class="chip" data-genero-todos aria-pressed="${
    activosSet.size === 0 ? 'true' : 'false'
  }">Todos</button>`;

  refs.chipsGeneros.innerHTML =
    todos +
    generos
      .map(
        ([genero, cantidad]) => `
        <button type="button" class="chip" data-genero="${escapar(genero)}"
          aria-pressed="${activosSet.has(genero) ? 'true' : 'false'}"
          title="${escapar(genero)} · ${cantidad} película${cantidad === 1 ? '' : 's'}">
          ${escapar(genero)}
        </button>`,
      )
      .join('');
}

export function pintarAnios(anios, valorActual) {
  const opciones = ['<option value="">Todos</option>']
    .concat(anios.map((anio) => `<option value="${escapar(anio)}">${escapar(anio)}</option>`))
    .join('');
  refs.filtroAnio.innerHTML = opciones;
  refs.filtroAnio.value = valorActual || '';
}

/* ---------------- Tarjetas ---------------- */

function tarjetaHTML(item, tokens, indice) {
  const { c1, c2 } = paleta(item.titulo);
  const pista = [item.anio, formatearDuracion(item.duracion)].filter(Boolean).join(' · ');
  const generos = (item.generos || []).slice(0, 2).join(' · ');
  const coincide = etiquetasCoincidencia(item._coincide || []);

  return `
  <article class="tarjeta" data-id="${escapar(item.id)}" tabindex="0" role="button"
    aria-label="${escapar(item.titulo)}${item.anio ? `, ${item.anio}` : ''}"
    style="animation-delay:${Math.min(indice * 22, 260)}ms">
    <div class="poster" style="--c1:${c1};--c2:${c2}">
      ${item.poster ? `<img src="${escapar(item.poster)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}
      <span class="poster-iniciales" aria-hidden="true">${escapar(iniciales(item.titulo))}</span>
      ${
        item.reelUrl
          ? '<span class="badge badge-reel">Reel</span>'
          : '<span class="badge badge-pendiente">Sin reel</span>'
      }
      <button type="button" class="fav-btn" data-accion="favorito"
        aria-pressed="${item.favorito ? 'true' : 'false'}"
        aria-label="${item.favorito ? 'Quitar de favoritas' : 'Marcar como favorita'}: ${escapar(item.titulo)}">
        ${ICONOS.estrella}
      </button>
      ${item.anio ? `<span class="anio-chip">${escapar(item.anio)}</span>` : ''}
      ${
        item.puntuacion != null
          ? `<span class="nota-chip">${ICONOS.estrella}${item.puntuacion.toFixed(1)}</span>`
          : ''
      }
    </div>
    <div class="tarjeta-cuerpo">
      <h3 class="tarjeta-titulo">${resaltar(item.titulo, tokens)}</h3>
      <p class="tarjeta-meta">${escapar(pista || generos || 'Sin datos')}</p>
      ${
        coincide.length
          ? `<div class="tarjeta-coincide">${coincide
              .map((etiqueta) => `<span class="mini-tag">${escapar(etiqueta)}</span>`)
              .join('')}</div>`
          : generos
            ? `<div class="tarjeta-coincide"><span class="mini-tag">${escapar(generos)}</span></div>`
            : ''
      }
    </div>
  </article>`;
}

export function pintarResultados(resultado, { filtros } = {}) {
  const { resultados, total, ms, tokens, difuso, disponibles } = resultado;

  const conFiltros =
    Boolean(filtros.q) ||
    filtros.generos.length > 0 ||
    Boolean(filtros.anio) ||
    Boolean(filtros.duracion) ||
    filtros.soloConReel ||
    filtros.soloFavoritos;

  refs.grid.innerHTML = resultados
    .map((entrada, i) => {
      const item = { ...entrada.item, _coincide: entrada.coincide };
      return tarjetaHTML(item, tokens, i);
    })
    .join('');

  refs.tiempo.hidden = total === 0;
  refs.tiempo.textContent = total ? `${total} en ${ms} ms` : '';
  refs.limpiarTodo.hidden = !conFiltros;

  const plural = total === 1 ? 'película' : 'películas';
  if (total === 0) {
    refs.contador.innerHTML = conFiltros
      ? 'Sin coincidencias'
      : 'El catálogo está vacío';
  } else if (conFiltros) {
    refs.contador.innerHTML = `<strong>${total}</strong> ${plural} de ${disponibles}${
      difuso ? ' · <span title="No hubo coincidencias exactas">resultados aproximados</span>' : ''
    }`;
  } else {
    refs.contador.innerHTML = `<strong>${total}</strong> ${plural} en tu catálogo`;
  }

  refs.vacio.hidden = total > 0;

  if (total === 0) {
    if (!conFiltros) {
      refs.vacioTitulo.textContent = 'Tu catálogo está vacío';
      refs.vacioTexto.textContent =
        'Añade tu primer reel con el botón «Añadir reel» o restaura el catálogo de demostración.';
    } else if (filtros.q) {
      refs.vacioTitulo.textContent = `Nada para «${filtros.q}»`;
      refs.vacioTexto.textContent =
        'Revisa la ortografía, usa menos palabras o quita filtros. La búsqueda ignora tildes y mayúsculas.';
    } else {
      refs.vacioTitulo.textContent = 'Ningún resultado con esos filtros';
      refs.vacioTexto.textContent = 'Prueba a combinar menos filtros o a limpiarlos todos.';
    }

    refs.sugerencias.innerHTML = (filtros.sugerencias || [])
      .slice(0, 6)
      .map(
        ([genero]) =>
          `<button type="button" class="chip" data-sugerencia="${escapar(genero)}">${escapar(genero)}</button>`,
      )
      .join('');
  }
}

/* ---------------- Detalle ---------------- */

function detalleMedia(item) {
  if (item.reelUrl) {
    const src = urlIncrustada(item.reelUrl, { ancho: 400, alto: 711 });
    return `
      <iframe src="${escapar(src)}" title="Reel: ${escapar(item.titulo)}"
        loading="lazy" scrolling="no" frameborder="0" allowfullscreen="true"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>
      <a class="btn btn-mini" style="margin-top:12px" href="${escapar(item.reelUrl)}"
        target="_blank" rel="noopener noreferrer">${ICONOS.externo} Abrir en Facebook</a>`;
  }

  return `
    <div class="media-placeholder">
      <span class="media-icono">${ICONOS.play}</span>
      <p>Esta película todavía no tiene un reel asociado.</p>
      <div class="asociar-reel">
        <label class="sr-only" for="asociar-url">Enlace del reel de Facebook</label>
        <input id="asociar-url" type="url" inputmode="url" spellcheck="false"
          placeholder="https://www.facebook.com/reel/…">
        <button type="button" class="btn btn-primario btn-mini" data-accion="asociar">Asociar reel</button>
      </div>
    </div>`;
}

function ficha(item) {
  const filas = [
    ['Dirección', item.director],
    ['Reparto', (item.reparto || []).join(', ')],
    ['Duración', formatearDuracion(item.duracion)],
  ].filter(([, valor]) => valor);

  if (!filas.length) return '';
  return `<dl class="detalle-ficha">${filas
    .map(([clave, valor]) => `<div><span class="clave">${clave}</span><span class="valor">${escapar(valor)}</span></div>`)
    .join('')}</dl>`;
}

export function pintarDetalle(item) {
  const meta = [
    item.anio ? `<span>${item.anio}</span>` : '',
    item.duracion ? `<span class="punto">${formatearDuracion(item.duracion)}</span>` : '',
    item.visto ? '<span class="punto">Vista</span>' : '',
  ]
    .filter(Boolean)
    .join('');

  refs.dContenido.innerHTML = `
    <div class="detalle-media">${detalleMedia(item)}</div>
    <div class="detalle-info">
      <div class="detalle-eyebrow">
        ${item.reelUrl ? 'Reel de Facebook' : 'Pendiente de reel'}
        ${item.favorito ? '<span aria-hidden="true">★ Favorita</span>' : ''}
      </div>
      <h3 class="detalle-titulo">${escapar(item.titulo)}</h3>
      ${item.tituloOriginal && item.tituloOriginal !== item.titulo ? `<p class="detalle-original">${escapar(item.tituloOriginal)}</p>` : ''}
      <div class="detalle-meta">
        ${meta}
        ${item.puntuacion != null ? `<span class="detalle-nota">★ ${item.puntuacion.toFixed(1)}</span>` : ''}
      </div>
      ${item.sinopsis ? `<p class="detalle-sinopsis">${escapar(item.sinopsis)}</p>` : ''}
      ${
        item.generos.length
          ? `<div class="detalle-generos">${item.generos
              .map((genero) => `<span class="etiqueta">${escapar(genero)}</span>`)
              .join('')}</div>`
          : ''
      }
      ${ficha(item)}
      ${
        item.tags.length
          ? `<div class="detalle-ficha"><div><span class="clave">Etiquetas</span><span class="valor">${item.tags
              .map((t) => `#${escapar(t)}`)
              .join(' · ')}</span></div></div>`
          : ''
      }
      <div class="detalle-acciones">
        <button type="button" class="btn btn-mini btn-primario" data-accion="editar">${ICONOS.editar} Editar</button>
        <button type="button" class="btn btn-mini" data-accion="favorito">${ICONOS.estrella} ${
          item.favorito ? 'Quitar favorita' : 'Favorita'
        }</button>
        ${
          item.reelUrl
            ? `<button type="button" class="btn btn-mini" data-accion="copiar-embed">${ICONOS.copiar} Copiar embed</button>
               <button type="button" class="btn btn-mini" data-accion="copiar-enlace">${ICONOS.enlace} Copiar enlace</button>`
            : ''
        }
        <button type="button" class="btn btn-mini btn-peligro" data-accion="eliminar">${ICONOS.borrar} Eliminar</button>
      </div>
      <p class="detalle-nota-privacidad">El reproductor es el plugin oficial de Facebook y puede usar sus cookies. Este catálogo no envía nada a servidores propios.</p>
    </div>`;
}

export function copiarAlPortapapeles(texto) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(texto);
  }
  const area = document.createElement('textarea');
  area.value = texto;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  return ok ? Promise.resolve() : Promise.reject(new Error('No se pudo copiar'));
}

export function codigoEmbed(item) {
  return codigoIncrustado(item.reelUrl, { ancho: 400, alto: 711 });
}

/* ---------------- Formulario ---------------- */

export function llenarFormulario(item = null) {
  const set = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.value = valor ?? '';
  };

  refs.fTituloModal.textContent = item ? 'Editar película' : 'Añadir película';
  refs.fError.hidden = true;
  refs.form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));

  set('f-id', item?.id || '');
  set('f-titulo', item?.titulo || '');
  set('f-titulo-original', item?.tituloOriginal || '');
  set('f-anio', item?.anio ?? '');
  set('f-duracion', item?.duracion ?? '');
  set('f-puntuacion', item?.puntuacion ?? '');
  set('f-generos', (item?.generos || []).join(', '));
  set('f-tags', (item?.tags || []).join(', '));
  set('f-director', item?.director || '');
  set('f-reparto', (item?.reparto || []).join(', '));
  set('f-poster', item?.poster || '');
  set('f-sinopsis', item?.sinopsis || '');
  set('f-reel', item?.reelUrl || '');

  document.getElementById('f-favorito').checked = Boolean(item?.favorito);
  document.getElementById('f-visto').checked = Boolean(item?.visto);

  refs.fPreviewEnvoltura.hidden = true;
  refs.fPreview.innerHTML = '';
  actualizarEstadoReel(item?.reelUrl || '');
}

export function llenarDatalistGeneros(generos) {
  const lista = document.getElementById('lista-generos');
  if (!lista) return;
  lista.innerHTML = generos.map(([genero]) => `<option value="${escapar(genero)}">`).join('');
}

export function leerFormulario() {
  const valor = (id) => document.getElementById(id)?.value ?? '';
  return {
    id: valor('f-id') || undefined,
    titulo: valor('f-titulo'),
    tituloOriginal: valor('f-titulo-original'),
    anio: valor('f-anio'),
    duracion: valor('f-duracion'),
    puntuacion: valor('f-puntuacion'),
    generos: valor('f-generos'),
    tags: valor('f-tags'),
    director: valor('f-director'),
    reparto: valor('f-reparto'),
    poster: valor('f-poster'),
    sinopsis: valor('f-sinopsis'),
    reelUrl: valor('f-reel'),
    favorito: document.getElementById('f-favorito').checked,
    visto: document.getElementById('f-visto').checked,
  };
}

export function mostrarErrorFormulario(mensaje) {
  refs.fError.textContent = mensaje;
  refs.fError.hidden = false;
}

export function marcarInvalido(id) {
  const el = document.getElementById(id);
  if (el) {
    el.setAttribute('aria-invalid', 'true');
    el.focus();
  }
}

export function actualizarEstadoReel(url) {
  const el = refs.fReelEstado;
  const enlace = parsearEnlace(url);

  if (!String(url ?? '').trim()) {
    el.className = 'ayuda';
    el.innerHTML =
      'Acepta enlaces <code>/reel/…</code>, <code>/watch/?v=…</code>, <code>/videos/…</code> y <code>fb.watch</code>.';
    return enlace;
  }

  if (!enlace.ok) {
    el.className = 'ayuda err';
    el.textContent = enlace.motivo;
    return enlace;
  }

  el.className = 'ayuda ok';
  const detalle = enlace.id ? `ID ${enlace.id}` : 'enlace corto (se resuelve al incrustar)';
  el.innerHTML = `Enlace válido · ${escapar(enlace.tipo)} · ${escapar(detalle)}`;
  return enlace;
}

export function previsualizarReel(url) {
  const enlace = parsearEnlace(url);
  if (!enlace.ok) {
    refs.fPreviewEnvoltura.hidden = true;
    refs.fPreview.innerHTML = '';
    return;
  }
  const src = urlIncrustada(enlace.canonica, { ancho: 280, alto: 498 });
  refs.fPreview.innerHTML = `<iframe src="${escapar(src)}" title="Vista previa del reel"
    loading="lazy" scrolling="no" frameborder="0" allowfullscreen="true"
    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`;
  refs.fPreviewEnvoltura.hidden = false;
}

/* ---------------- Catálogo ---------------- */

export function pintarEstadisticas(stats) {
  const caja = document.getElementById('c-stats');
  const datos = [
    ['Películas', stats.total],
    ['Con reel', stats.conReel],
    ['Favoritas', stats.favoritas],
    ['Vistas', stats.vistas],
  ];
  caja.innerHTML = datos
    .map(
      ([etiqueta, valor]) =>
        `<div class="stat"><div class="stat-valor">${valor}</div><div class="stat-etiqueta">${etiqueta}</div></div>`,
    )
    .join('');
}

export function mostrarEstadoEndpoint(mensaje, tipo = '') {
  const el = document.getElementById('c-estado-endpoint');
  el.className = `ayuda ${tipo === 'ok' ? 'ok' : tipo === 'err' ? 'err' : ''}`;
  el.textContent = mensaje;
}

export function rellenarEndpoint(valor) {
  const el = document.getElementById('c-endpoint');
  if (el) el.value = valor || '';
}
