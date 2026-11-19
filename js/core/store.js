/**
 * Persistencia del catálogo en localStorage.
 * Mantiene una copia en memoria y emite un evento en cada cambio.
 */

import { demoConIds } from '../data/seed.js';
import { generarId } from './util.js';
import { parsearEnlace } from './facebook.js';

const CLAVE_CATALOGO = 'cine-reels:catalogo:v1';
const CLAVE_CONFIG = 'cine-reels:config:v1';
export const EVENTO_CAMBIO = 'catalogo:cambio';

let catalogo = null;
let config = null;
let almacenDisponible = true;

function almacen() {
  try {
    const prueba = '__cine-reels__';
    window.localStorage.setItem(prueba, '1');
    window.localStorage.removeItem(prueba);
    return window.localStorage;
  } catch {
    almacenDisponible = false;
    return null;
  }
}

const LS = almacen();

function emitir() {
  window.dispatchEvent(new CustomEvent(EVENTO_CAMBIO, { detail: { catalogo: listar() } }));
}

/** Convierte cualquier objeto en una entrada válida del catálogo. */
export function normalizarItem(bruto = {}) {
  const enlace = parsearEnlace(bruto.reelUrl || '');
  const numero = (valor, minimo, maximo) => {
    if (valor === '' || valor === null || valor === undefined) return null;
    const n = Number(valor);
    if (!Number.isFinite(n)) return null;
    return Math.min(maximo, Math.max(minimo, n));
  };

  // Acepta arrays o cadenas separadas por comas (JSON importado a mano).
  const lista = (valor, maximo) => {
    const crudos = Array.isArray(valor) ? valor : String(valor ?? '').split(',');
    return crudos
      .map((elemento) => String(elemento).trim())
      .filter(Boolean)
      .slice(0, maximo);
  };

  return {
    id: typeof bruto.id === 'string' && bruto.id.trim() ? bruto.id.trim() : generarId(),
    titulo: String(bruto.titulo ?? '').trim().slice(0, 120),
    tituloOriginal: String(bruto.tituloOriginal ?? '').trim().slice(0, 120),
    anio: numero(bruto.anio, 1888, 2100),
    duracion: numero(bruto.duracion, 1, 600),
    generos: lista(bruto.generos, 8),
    tags: lista(bruto.tags, 12),
    director: String(bruto.director ?? '').trim().slice(0, 120),
    reparto: lista(bruto.reparto, 12),
    puntuacion: numero(bruto.puntuacion, 0, 10),
    sinopsis: String(bruto.sinopsis ?? '').trim().slice(0, 600),
    poster: String(bruto.poster ?? '').trim(),
    reelUrl: enlace.ok ? enlace.canonica : '',
    reelId: enlace.ok ? enlace.id || '' : '',
    visto: Boolean(bruto.visto),
    favorito: Boolean(bruto.favorito),
    demo: Boolean(bruto.demo),
    creado: bruto.creado || new Date().toISOString(),
    actualizado: new Date().toISOString(),
  };
}

function cargar() {
  if (catalogo) return catalogo;

  if (!LS) {
    catalogo = demoConIds(generarId);
    return catalogo;
  }

  try {
    const crudo = LS.getItem(CLAVE_CATALOGO);
    if (!crudo) {
      catalogo = demoConIds(generarId);
      LS.setItem(CLAVE_CATALOGO, JSON.stringify(catalogo));
      return catalogo;
    }
    const datos = JSON.parse(crudo);
    if (!Array.isArray(datos)) throw new Error('Formato inesperado');
    catalogo = datos.map((item) => normalizarItem(item));
  } catch {
    // Datos corruptos: no los borramos sin avisar, arrancamos con demo en memoria.
    catalogo = demoConIds(generarId);
  }
  return catalogo;
}

function persistir() {
  if (!LS) return;
  try {
    LS.setItem(CLAVE_CATALOGO, JSON.stringify(catalogo));
  } catch (error) {
    console.warn('No se pudo guardar el catálogo:', error);
  }
}

/* ---------------- Catálogo ---------------- */

export function listar() {
  return [...cargar()];
}

export function obtener(id) {
  return cargar().find((item) => item.id === id) || null;
}

export function buscarPorReel(reelUrl, exceptoId = null) {
  const enlace = parsearEnlace(reelUrl);
  if (!enlace.ok) return null;
  return (
    cargar().find(
      (item) => item.reelId && enlace.id && item.reelId === enlace.id && item.id !== exceptoId,
    ) || null
  );
}

/** Crea o actualiza. Devuelve la entrada guardada. */
export function guardar(datos) {
  const lista = cargar();
  const item = normalizarItem(datos);
  if (!item.titulo) throw new Error('El título es obligatorio.');

  const indice = lista.findIndex((existente) => existente.id === item.id);
  if (indice >= 0) {
    lista[indice] = { ...lista[indice], ...item, creado: lista[indice].creado };
  } else {
    lista.unshift(item);
  }
  persistir();
  emitir();
  return item;
}

export function eliminar(id) {
  const lista = cargar();
  const indice = lista.findIndex((item) => item.id === id);
  if (indice < 0) return false;
  lista.splice(indice, 1);
  persistir();
  emitir();
  return true;
}

export function alternarFavorito(id) {
  const item = obtener(id);
  if (!item) return null;
  item.favorito = !item.favorito;
  item.actualizado = new Date().toISOString();
  persistir();
  emitir();
  return item;
}

export function vaciar() {
  catalogo = [];
  persistir();
  emitir();
}

export function restaurarDemo() {
  catalogo = demoConIds(generarId);
  persistir();
  emitir();
}

export function exportar() {
  return {
    formato: 'cine-reels',
    version: 1,
    exportado: new Date().toISOString(),
    total: listar().length,
    peliculas: listar(),
  };
}

/**
 * Importa películas.
 * @param {any[]} entradas
 * @param {{ fusionar?: boolean }} opciones  fusionar=true conserva lo existente
 */
export function importar(entradas, { fusionar = true } = {}) {
  if (!Array.isArray(entradas)) throw new Error('Se esperaba una lista de películas.');

  const validas = entradas
    .filter((entrada) => entrada && typeof entrada === 'object')
    .map((entrada) => normalizarItem(entrada))
    .filter((entrada) => entrada.titulo);

  if (!validas.length) throw new Error('No se encontró ninguna película con título.');

  if (fusionar) {
    const lista = cargar();
    const porReel = new Map(lista.filter((i) => i.reelId).map((i) => [i.reelId, i]));
    const porTitulo = new Map(
      lista.map((i) => [`${i.titulo.toLowerCase()}|${i.anio ?? ''}`, i]),
    );

    for (const nueva of validas) {
      const existente =
        (nueva.reelId && porReel.get(nueva.reelId)) ||
        porTitulo.get(`${nueva.titulo.toLowerCase()}|${nueva.anio ?? ''}`);

      if (existente) {
        Object.assign(existente, { ...nueva, id: existente.id, creado: existente.creado });
        existente.actualizado = new Date().toISOString();
      } else {
        lista.push(nueva);
      }
    }
    catalogo = lista;
  } else {
    catalogo = validas;
  }

  persistir();
  emitir();
  return validas.length;
}

export function estadisticas() {
  const lista = listar();
  const generos = new Map();
  for (const item of lista) {
    for (const genero of item.generos) generos.set(genero, (generos.get(genero) || 0) + 1);
  }
  return {
    total: lista.length,
    conReel: lista.filter((item) => Boolean(item.reelUrl)).length,
    favoritas: lista.filter((item) => item.favorito).length,
    vistas: lista.filter((item) => item.visto).length,
    generos: [...generos.entries()].sort((a, b) => b[1] - a[1]),
    anios: [...new Set(lista.map((item) => item.anio).filter(Boolean))].sort((a, b) => b - a),
  };
}

export function almacenActivo() {
  return almacenDisponible && Boolean(LS);
}

/* ---------------- Configuración ---------------- */

const CONFIG_POR_DEFECTO = { proxyOembed: '/api/oembed' };

export function obtenerConfig() {
  if (config) return config;
  if (!LS) {
    config = { ...CONFIG_POR_DEFECTO };
    return config;
  }
  try {
    config = { ...CONFIG_POR_DEFECTO, ...(JSON.parse(LS.getItem(CLAVE_CONFIG) || '{}') || {}) };
  } catch {
    config = { ...CONFIG_POR_DEFECTO };
  }
  return config;
}

export function guardarConfig(parcial) {
  config = { ...obtenerConfig(), ...parcial };
  if (LS) {
    try {
      LS.setItem(CLAVE_CONFIG, JSON.stringify(config));
    } catch {
      /* sin espacio */
    }
  }
  return config;
}
