/**
 * CineReels · controlador principal.
 * Conecta controles, catálogo, buscador y modales.
 */

import {
  refs,
  abrirDialogo,
  cerrarDialogo,
  toast,
  pintarChipsGeneros,
  pintarAnios,
  pintarResultados,
  pintarDetalle,
  llenarFormulario,
  llenarDatalistGeneros,
  leerFormulario,
  mostrarErrorFormulario,
  marcarInvalido,
  actualizarEstadoReel,
  previsualizarReel,
  copiarAlPortapapeles,
  codigoEmbed,
  pintarEstadisticas,
  rellenarEndpoint,
  mostrarEstadoEndpoint,
} from './core/ui.js';

import {
  listar,
  obtener,
  guardar,
  eliminar,
  alternarFavorito,
  buscarPorReel,
  exportar,
  importar,
  vaciar,
  restaurarDemo,
  estadisticas,
  obtenerConfig,
  guardarConfig,
  almacenActivo,
  EVENTO_CAMBIO,
} from './core/store.js';

import { construirIndice, buscar } from './core/search.js';
import { parsearEnlace, consultarOembed, rutaProxy } from './core/facebook.js';
import { aLista, debounce, descargarJSON, leerJSON, normalizar } from './core/util.js';

/* ---------------- Estado ---------------- */

const estado = {
  q: '',
  generos: [],
  anio: '',
  duracion: '',
  soloConReel: false,
  soloFavoritos: false,
  orden: 'relevancia',
};

let indice = [];
let stats = { generos: [], anios: [] };
let idDetalle = null;

/* ---------------- Arranque ---------------- */

function iniciar() {
  leerParametrosURL();
  reconstruirIndice();
  pintarFiltros();
  sincronizarControles();
  renderizar();
  conectarEventos();
  comprobarAlmacen();
}

function reconstruirIndice() {
  indice = construirIndice(listar());
  stats = estadisticas();
}

function pintarFiltros() {
  // Conserva solo los géneros que aún existen.
  const disponibles = new Set(stats.generos.map(([genero]) => genero));
  estado.generos = estado.generos.filter((genero) => disponibles.has(genero));

  pintarChipsGeneros(stats.generos, estado.generos);
  pintarAnios(stats.anios, estado.anio);
  llenarDatalistGeneros(stats.generos);
}

function sincronizarControles() {
  refs.q.value = estado.q;
  refs.filtroDuracion.value = estado.duracion;
  refs.orden.value = estado.orden;
  refs.soloReel.checked = estado.soloConReel;
  refs.soloFavoritos.checked = estado.soloFavoritos;
  refs.limpiarQ.hidden = !estado.q;
}

function comprobarAlmacen() {
  if (!almacenActivo()) {
    toast('Sin localStorage: los cambios se perderán al recargar.', 'err');
  }
}

/* ---------------- Render ---------------- */

function renderizar() {
  const resultado = buscar(indice, { ...estado });
  pintarResultados(resultado, {
    filtros: { ...estado, sugerencias: stats.generos },
  });
  actualizarURL();
}

function leerControles() {
  estado.q = refs.q.value.trim();
  estado.anio = refs.filtroAnio.value;
  estado.duracion = refs.filtroDuracion.value;
  estado.orden = refs.orden.value;
  estado.soloConReel = refs.soloReel.checked;
  estado.soloFavoritos = refs.soloFavoritos.checked;
}

const renderizarDiferido = debounce(() => {
  leerControles();
  renderizar();
}, 170);

function limpiarFiltros({ conservarConsulta = false } = {}) {
  estado.generos = [];
  estado.anio = '';
  estado.duracion = '';
  estado.soloConReel = false;
  estado.soloFavoritos = false;
  if (!conservarConsulta) estado.q = '';
  refs.filtroAnio.value = '';
  refs.filtroDuracion.value = '';
  refs.soloReel.checked = false;
  refs.soloFavoritos.checked = false;
  if (!conservarConsulta) refs.q.value = '';
  pintarChipsGeneros(stats.generos, []);
  refs.limpiarQ.hidden = !estado.q;
  renderizar();
}

/* ---------------- URL ---------------- */

function actualizarURL() {
  const params = new URLSearchParams();
  if (estado.q) params.set('q', estado.q);
  if (estado.generos.length) params.set('genero', estado.generos.join(','));
  if (estado.anio) params.set('anio', estado.anio);
  if (estado.duracion) params.set('duracion', estado.duracion);
  if (estado.soloConReel) params.set('reel', '1');
  if (estado.soloFavoritos) params.set('favoritas', '1');
  if (estado.orden !== 'relevancia') params.set('orden', estado.orden);

  const cadena = params.toString();
  const nueva = `${location.pathname}${cadena ? `?${cadena}` : ''}${location.hash}`;
  history.replaceState(null, '', nueva);
}

function leerParametrosURL() {
  const params = new URLSearchParams(location.search);
  estado.q = params.get('q') || '';
  estado.generos = (params.get('genero') || '').split(',').map((g) => g.trim()).filter(Boolean);
  estado.anio = params.get('anio') || '';
  estado.duracion = params.get('duracion') || '';
  estado.soloConReel = params.get('reel') === '1';
  estado.soloFavoritos = params.get('favoritas') === '1';
  const orden = params.get('orden');
  if (['relevancia', 'recientes', 'titulo', 'puntuacion', 'duracion'].includes(orden)) {
    estado.orden = orden;
  }
}

/* ---------------- Eventos ---------------- */

function conectarEventos() {
  // Buscador
  refs.q.addEventListener('input', () => {
    estado.q = refs.q.value.trim();
    refs.limpiarQ.hidden = !refs.q.value;
    renderizarDiferido();
  });

  refs.formBusqueda.addEventListener('submit', (evento) => {
    evento.preventDefault();
    renderizarDiferido.cancelar();
    leerControles();
    renderizar();
    if (window.matchMedia('(max-width: 900px)').matches) refs.q.blur();
  });

  refs.limpiarQ.addEventListener('click', () => {
    refs.q.value = '';
    estado.q = '';
    refs.limpiarQ.hidden = true;
    refs.q.focus();
    renderizar();
  });

  // Filtros
  refs.chipsGeneros.addEventListener('click', (evento) => {
    const boton = evento.target.closest('button');
    if (!boton) return;

    if (boton.hasAttribute('data-genero-todos')) {
      estado.generos = [];
    } else {
      const genero = boton.dataset.genero;
      estado.generos = estado.generos.includes(genero)
        ? estado.generos.filter((g) => g !== genero)
        : [...estado.generos, genero];
    }
    pintarChipsGeneros(stats.generos, estado.generos);
    renderizar();
  });

  refs.filtroAnio.addEventListener('change', () => {
    leerControles();
    renderizar();
  });
  refs.filtroDuracion.addEventListener('change', () => {
    leerControles();
    renderizar();
  });
  refs.orden.addEventListener('change', () => {
    leerControles();
    renderizar();
  });
  refs.soloReel.addEventListener('change', () => {
    leerControles();
    renderizar();
  });
  refs.soloFavoritos.addEventListener('change', () => {
    leerControles();
    renderizar();
  });

  refs.limpiarTodo.addEventListener('click', () => limpiarFiltros());
  document.getElementById('vacio-limpiar').addEventListener('click', () => limpiarFiltros());
  document.getElementById('vacio-nueva').addEventListener('click', () => abrirFormulario());

  refs.sugerencias.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-sugerencia]');
    if (!boton) return;
    estado.generos = [boton.dataset.sugerencia];
    pintarChipsGeneros(stats.generos, estado.generos);
    renderizar();
  });

  // Tarjetas
  refs.grid.addEventListener('click', (evento) => {
    const tarjeta = evento.target.closest('.tarjeta');
    if (!tarjeta) return;

    if (evento.target.closest('[data-accion="favorito"]')) {
      const actualizado = alternarFavorito(tarjeta.dataset.id);
      if (actualizado) {
        const boton = tarjeta.querySelector('[data-accion="favorito"]');
        boton.setAttribute('aria-pressed', String(actualizado.favorito));
        boton.setAttribute(
          'aria-label',
          `${actualizado.favorito ? 'Quitar de favoritas' : 'Marcar como favorita'}: ${actualizado.titulo}`,
        );
        toast(actualizado.favorito ? 'Añadida a favoritas' : 'Quitada de favoritas', 'ok');
      }
      return;
    }

    abrirDetalle(tarjeta.dataset.id);
  });

  refs.grid.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    const tarjeta = evento.target.closest('.tarjeta');
    if (!tarjeta || evento.target.closest('button')) return;
    evento.preventDefault();
    abrirDetalle(tarjeta.dataset.id);
  });

  // Diálogos: cierre
  document.querySelectorAll('dialog').forEach((dialogo) => {
    dialogo.addEventListener('click', (evento) => {
      if (evento.target === dialogo) cerrarDialogo(dialogo);
    });
    dialogo.addEventListener('close', () => {
      if (!document.querySelector('dialog[open]')) {
        document.body.classList.remove('modal-abierto');
      }
    });
  });

  document.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-cerrar]');
    if (!boton) return;
    const dialogo = boton.closest('dialog');
    if (dialogo) cerrarDialogo(dialogo);
  });

  // Detalle
  refs.dContenido.addEventListener('click', manejarAccionDetalle);

  document.getElementById('abrir-nueva').addEventListener('click', () => abrirFormulario());
  document.getElementById('abrir-catalogo').addEventListener('click', abrirCatalogo);

  // Formulario
  refs.form.addEventListener('submit', guardarFormulario);
  refs.fReel.addEventListener('blur', () => actualizarEstadoReel(refs.fReel.value));
  refs.fReel.addEventListener('input', () => {
    if (!refs.fPreviewEnvoltura.hidden) {
      refs.fPreviewEnvoltura.hidden = true;
      refs.fPreview.innerHTML = '';
    }
  });
  document.getElementById('f-analizar').addEventListener('click', analizarReel);

  // Catálogo
  document.getElementById('c-exportar').addEventListener('click', exportarCatalogo);
  document.getElementById('c-importar').addEventListener('change', importarCatalogo);
  document.getElementById('c-vaciar').addEventListener('click', vaciarCatalogo);
  document.getElementById('c-demo').addEventListener('click', () => {
    if (!confirm('¿Reemplazar el catálogo actual por el de demostración?')) return;
    restaurarDemo();
    toast('Catálogo de demostración restaurado', 'ok');
  });
  document.getElementById('c-guardar-endpoint').addEventListener('click', () => {
    const valor = document.getElementById('c-endpoint').value.trim();
    guardarConfig({ proxyOembed: valor || '/api/oembed' });
    mostrarEstadoEndpoint('Ruta guardada.', 'ok');
    toast('Ruta del proxy guardada', 'ok');
  });
  document.getElementById('c-probar-endpoint').addEventListener('click', probarEndpoint);

  // Cambios en el catálogo
  window.addEventListener(EVENTO_CAMBIO, () => {
    reconstruirIndice();
    pintarChipsGeneros(stats.generos, estado.generos);
    pintarAnios(stats.anios, estado.anio);
    llenarDatalistGeneros(stats.generos);
    renderizar();

    if (idDetalle) {
      const item = obtener(idDetalle);
      if (item) pintarDetalle(item);
      else {
        idDetalle = null;
        cerrarDialogo(refs.dlgDetalle);
      }
    }
  });

  // Atajos
  document.addEventListener('keydown', (evento) => {
    const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(evento.target.tagName);
    const hayDialogo = Boolean(document.querySelector('dialog[open]'));

    if (!enCampo && !hayDialogo && (evento.key === '/' || ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k'))) {
      evento.preventDefault();
      refs.q.focus();
      refs.q.select();
      return;
    }

    if (evento.key === 'Escape' && evento.target === refs.q && refs.q.value) {
      refs.q.value = '';
      estado.q = '';
      refs.limpiarQ.hidden = true;
      renderizar();
    }
  });
}

/* ---------------- Detalle ---------------- */

function abrirDetalle(id) {
  const item = obtener(id);
  if (!item) {
    toast('Esa película ya no existe', 'err');
    return;
  }
  idDetalle = id;
  pintarDetalle(item);
  abrirDialogo(refs.dlgDetalle);
}

async function manejarAccionDetalle(evento) {
  const boton = evento.target.closest('[data-accion]');
  if (!boton) return;
  const item = idDetalle ? obtener(idDetalle) : null;
  if (!item) return;

  switch (boton.dataset.accion) {
    case 'editar':
      cerrarDialogo(refs.dlgDetalle);
      abrirFormulario(item);
      break;

    case 'favorito': {
      const actualizado = alternarFavorito(item.id);
      if (actualizado) {
        pintarDetalle(actualizado);
        toast(actualizado.favorito ? 'Añadida a favoritas' : 'Quitada de favoritas', 'ok');
      }
      break;
    }

    case 'eliminar':
      if (!confirm(`¿Eliminar «${item.titulo}» del catálogo?`)) return;
      idDetalle = null;
      cerrarDialogo(refs.dlgDetalle);
      eliminar(item.id);
      toast('Película eliminada', 'ok');
      break;

    case 'copiar-enlace':
      try {
        await copiarAlPortapapeles(item.reelUrl);
        toast('Enlace copiado', 'ok');
      } catch {
        toast('No se pudo copiar el enlace', 'err');
      }
      break;

    case 'copiar-embed':
      try {
        await copiarAlPortapapeles(codigoEmbed(item));
        toast('Código de inserción copiado', 'ok');
      } catch {
        toast('No se pudo copiar el código', 'err');
      }
      break;

    case 'asociar': {
      const entrada = document.getElementById('asociar-url');
      const enlace = parsearEnlace(entrada?.value || '');
      if (!enlace.ok) {
        toast(enlace.motivo, 'err');
        entrada?.focus();
        return;
      }
      const duplicado = buscarPorReel(enlace.canonica, item.id);
      if (duplicado) {
        toast(`Ese reel ya está asociado a «${duplicado.titulo}»`, 'err');
        return;
      }
      guardar({ ...item, reelUrl: enlace.canonica });
      toast('Reel asociado', 'ok');
      break;
    }

    default:
      break;
  }
}

/* ---------------- Formulario ---------------- */

function abrirFormulario(item = null) {
  llenarFormulario(item);
  abrirDialogo(refs.dlgForm);
  setTimeout(() => document.getElementById('f-titulo').focus(), 60);
}

function analizarReel() {
  const url = refs.fReel.value.trim();
  const enlace = actualizarEstadoReel(url);

  if (!enlace.ok) {
    toast(enlace.motivo, 'err');
    refs.fReel.focus();
    return;
  }

  previsualizarReel(url);
  toast('Enlace válido; vista previa cargada', 'ok');

  const duplicado = buscarPorReel(enlace.canonica, document.getElementById('f-id').value);
  if (duplicado) {
    toast(`Ojo: ese reel ya está en «${duplicado.titulo}»`, 'err');
    return;
  }

  autocompletarConOembed(enlace);
}

async function autocompletarConOembed(enlace) {
  const config = obtenerConfig();
  const proxy = rutaProxy(config.proxyOembed);
  const base = proxy.replace(/\/oembed$/, '');
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 9000);

  try {
    // Primero comprobamos si el proxy existe y tiene credenciales: así no
    // lanzamos una petición que sabemos que va a fallar.
    const estado = await fetch(`${base}/estado`, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: 'application/json' },
    }).then((r) => (r.ok ? r.json() : null));

    if (!estado) return;
    if (!estado.credenciales) {
      toast('Autocompletado inactivo: faltan FB_APP_ID y FB_APP_SECRET en .env', 'info');
      return;
    }

    const datos = await consultarOembed(enlace.canonica, {
      proxy: config.proxyOembed,
      signal: controlador.signal,
    });
    if (!datos) return;

    const titulo = document.getElementById('f-titulo');
    if (datos.titulo && !titulo.value.trim()) titulo.value = datos.titulo;

    const poster = document.getElementById('f-poster');
    if (datos.miniatura && !poster.value.trim()) poster.value = datos.miniatura;

    if (datos.autor) {
      const tags = document.getElementById('f-tags');
      const actuales = aLista(tags.value);
      if (!actuales.some((tag) => normalizar(tag) === normalizar(datos.autor))) {
        tags.value = [...actuales, datos.autor].join(', ');
      }
    }
    toast('Datos completados con oEmbed', 'ok');
  } catch (error) {
    // Un proxy ausente o un fallo de red no deben molestar: el alta es manual.
    if (error.name !== 'TimeoutError' && error.name !== 'AbortError') {
      console.info('oEmbed no disponible:', error.message);
    }
  } finally {
    clearTimeout(temporizador);
  }
}

function validarFormulario(datos) {
  if (!datos.titulo.trim()) return { campo: 'f-titulo', mensaje: 'El título es obligatorio.' };

  if (datos.anio !== '' && (Number(datos.anio) < 1888 || Number(datos.anio) > 2100)) {
    return { campo: 'f-anio', mensaje: 'El año debe estar entre 1888 y 2100.' };
  }

  if (datos.duracion !== '' && (Number(datos.duracion) < 1 || Number(datos.duracion) > 600)) {
    return { campo: 'f-duracion', mensaje: 'La duración debe estar entre 1 y 600 minutos.' };
  }

  if (datos.puntuacion !== '' && (Number(datos.puntuacion) < 0 || Number(datos.puntuacion) > 10)) {
    return { campo: 'f-puntuacion', mensaje: 'La puntuación va de 0 a 10.' };
  }

  if (datos.reelUrl.trim()) {
    const enlace = parsearEnlace(datos.reelUrl);
    if (!enlace.ok) return { campo: 'f-reel', mensaje: enlace.motivo };
    const duplicado = buscarPorReel(enlace.canonica, datos.id);
    if (duplicado) {
      return { campo: 'f-reel', mensaje: `Ese reel ya está asociado a «${duplicado.titulo}».` };
    }
  }

  return null;
}

function guardarFormulario(evento) {
  evento.preventDefault();

  const datos = leerFormulario();
  const error = validarFormulario(datos);
  if (error) {
    mostrarErrorFormulario(error.mensaje);
    marcarInvalido(error.campo);
    return;
  }

  try {
    const guardado = guardar({
      id: datos.id,
      titulo: datos.titulo,
      tituloOriginal: datos.tituloOriginal,
      anio: datos.anio,
      duracion: datos.duracion,
      puntuacion: datos.puntuacion,
      generos: aLista(datos.generos),
      tags: aLista(datos.tags),
      director: datos.director,
      reparto: aLista(datos.reparto),
      poster: datos.poster,
      sinopsis: datos.sinopsis,
      reelUrl: datos.reelUrl,
      favorito: datos.favorito,
      visto: datos.visto,
    });

    cerrarDialogo(refs.dlgForm);
    toast(datos.id ? 'Cambios guardados' : `«${guardado.titulo}» añadida`, 'ok');
  } catch (fallo) {
    mostrarErrorFormulario(fallo.message || 'No se pudo guardar.');
  }
}

/* ---------------- Catálogo ---------------- */

function abrirCatalogo() {
  pintarEstadisticas(estadisticas());
  rellenarEndpoint(obtenerConfig().proxyOembed);
  mostrarEstadoEndpoint('Sin probar.');
  abrirDialogo(refs.dlgCatalogo);
}

function exportarCatalogo() {
  const fecha = new Date().toISOString().slice(0, 10);
  descargarJSON(`cine-reels-${fecha}.json`, exportar());
  toast('Catálogo exportado', 'ok');
}

async function importarCatalogo(evento) {
  const archivo = evento.target.files?.[0];
  evento.target.value = '';
  if (!archivo) return;

  try {
    const datos = await leerJSON(archivo);
    const entradas = Array.isArray(datos) ? datos : datos?.peliculas;
    if (!Array.isArray(entradas)) throw new Error('El JSON no contiene una lista «peliculas».');

    const fusionar = confirm(
      `Se encontraron ${entradas.length} entradas.\n\nAceptar = fusionar con el catálogo actual.\nCancelar = reemplazarlo.`,
    );
    const total = importar(entradas, { fusionar });
    toast(`${total} entradas importadas`, 'ok');
  } catch (error) {
    toast(error.message || 'No se pudo importar', 'err');
  }
}

function vaciarCatalogo() {
  if (!confirm('¿Vaciar todo el catálogo? Esta acción no se puede deshacer (exporta antes si dudas).')) return;
  vaciar();
  cerrarDialogo(refs.dlgCatalogo);
  toast('Catálogo vaciado', 'ok');
}

async function probarEndpoint() {
  const config = obtenerConfig();
  const proxy = rutaProxy(document.getElementById('c-endpoint').value);
  const base = proxy.replace(/\/oembed$/, '');
  mostrarEstadoEndpoint('Comprobando…');

  try {
    const respuesta = await fetch(`${base}/estado`, { headers: { Accept: 'application/json' } });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const datos = await respuesta.json();
    if (datos.credenciales) {
      mostrarEstadoEndpoint('Proxy conectado y con credenciales de Meta.', 'ok');
    } else {
      mostrarEstadoEndpoint(
        'Proxy activo, pero sin credenciales: define FB_APP_ID y FB_APP_SECRET en .env.',
        'err',
      );
    }
  } catch (error) {
    mostrarEstadoEndpoint(
      `No se pudo contactar (${error.message}). Arranca «node server/serve.mjs» o revisa la ruta.`,
      'err',
    );
    if (config.proxyOembed !== proxy) guardarConfig({ proxyOembed: proxy });
  }
}

/* ---------------- Go ---------------- */

iniciar();
