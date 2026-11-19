/**
 * Motor de búsqueda del catálogo.
 *
 * - Insensible a mayúsculas y acentos.
 * - Varios términos = AND (todos deben aparecer), con reintento OR si no hay
 *   resultados, avisando mediante `difuso`.
 * - Puntúa por campo (título pesa mucho más que la sinopsis) y premia frases
 *   exactas y coincidencias al inicio del título.
 */

import { normalizar, tokenizar } from './util.js';

const PESOS = {
  titulo: 12,
  tituloOriginal: 8,
  generos: 6,
  tags: 6,
  personas: 4,
  anio: 5,
  sinopsis: 2,
};

const ETIQUETAS = {
  titulo: 'título',
  tituloOriginal: 'título original',
  generos: 'género',
  tags: 'etiqueta',
  personas: 'reparto',
  anio: 'año',
  sinopsis: 'sinopsis',
};

/** Precalcula los campos normalizados una sola vez por catálogo. */
export function construirIndice(items) {
  return items.map((item) => ({
    item,
    campos: {
      titulo: normalizar(item.titulo),
      tituloOriginal: normalizar(item.tituloOriginal),
      generos: normalizar((item.generos || []).join(' ')),
      tags: normalizar((item.tags || []).join(' ')),
      personas: normalizar([item.director, ...(item.reparto || [])].join(' ')),
      anio: item.anio ? String(item.anio) : '',
      sinopsis: normalizar(item.sinopsis),
    },
  }));
}

function puntuarCampos(campos, token) {
  let puntaje = 0;
  const coincide = new Set();

  for (const [campo, peso] of Object.entries(PESOS)) {
    const valor = campos[campo];
    if (!valor) continue;
    const posicion = valor.indexOf(token);
    if (posicion === -1) continue;

    coincide.add(campo);
    // Palabra completa o prefijo de palabra puntúa algo más que coincidencia interna.
    const esInicioPalabra = posicion === 0 || valor[posicion - 1] === ' ';
    puntaje += peso * (esInicioPalabra ? 1.35 : 1);
  }

  return puntaje > 0 ? { puntaje, coincide } : null;
}

/**
 * @param {{ item: object, campos: object }} entrada
 * @param {string[]} tokens
 * @param {string} frase  consulta completa normalizada
 * @param {'and'|'or'} modo
 */
function puntuar(entrada, tokens, frase, modo = 'and') {
  let total = 0;
  const coincide = new Set();
  let aciertos = 0;

  for (const token of tokens) {
    const parcial = puntuarCampos(entrada.campos, token);
    if (parcial) {
      aciertos += 1;
      total += parcial.puntaje;
      for (const campo of parcial.coincide) coincide.add(campo);
    } else if (modo === 'and') {
      return null;
    }
  }

  if (aciertos === 0) return null;

  if (modo === 'or') {
    // Penaliza los resultados que solo cumplen parte de la consulta.
    total *= aciertos / tokens.length;
    if (aciertos < tokens.length) total *= 0.55;
  }

  const titulo = entrada.campos.titulo;
  if (titulo === frase) total += 80;
  else if (frase && titulo.includes(frase)) total += 30;

  const original = entrada.campos.tituloOriginal;
  if (frase && original && original.includes(frase)) total += 14;

  if (tokens[0] && titulo.startsWith(tokens[0])) total += 10;

  return { puntaje: total, coincide: [...coincide] };
}

export function coincideConFiltros(item, filtros = {}) {
  if (filtros.soloConReel && !item.reelUrl) return false;
  if (filtros.soloFavoritos && !item.favorito) return false;

  if (filtros.generos?.length) {
    const propios = new Set(item.generos || []);
    if (!filtros.generos.some((genero) => propios.has(genero))) return false;
  }

  if (filtros.anio) {
    if (String(item.anio ?? '') !== String(filtros.anio)) return false;
  }

  if (filtros.duracion) {
    const minutos = Number(item.duracion);
    if (!Number.isFinite(minutos) || minutos <= 0) return false;
    if (filtros.duracion === 'corto' && minutos >= 90) return false;
    if (filtros.duracion === 'media' && (minutos < 90 || minutos > 130)) return false;
    if (filtros.duracion === 'larga' && minutos <= 130) return false;
  }

  return true;
}

function ordenar(resultados, orden) {
  const porTitulo = (a, b) =>
    a.item.titulo.localeCompare(b.item.titulo, 'es', { sensitivity: 'base' });

  switch (orden) {
    case 'recientes':
      resultados.sort((a, b) => (b.item.anio || 0) - (a.item.anio || 0) || porTitulo(a, b));
      break;
    case 'titulo':
      resultados.sort(porTitulo);
      break;
    case 'puntuacion':
      resultados.sort(
        (a, b) => (b.item.puntuacion ?? -1) - (a.item.puntuacion ?? -1) || porTitulo(a, b),
      );
      break;
    case 'duracion':
      resultados.sort(
        (a, b) => (a.item.duracion || Infinity) - (b.item.duracion || Infinity) || porTitulo(a, b),
      );
      break;
    case 'relevancia':
    default:
      resultados.sort((a, b) => b.puntaje - a.puntaje || porTitulo(a, b));
      break;
  }
}

/**
 * @param {ReturnType<typeof construirIndice>} indice
 * @param {{ q?: string, generos?: string[], anio?: string, duracion?: string, soloConReel?: boolean, soloFavoritos?: boolean, orden?: string }} filtros
 */
export function buscar(indice, filtros = {}) {
  const inicio = performance.now();
  const consulta = String(filtros.q ?? '').trim();
  const tokens = tokenizar(consulta);
  const frase = normalizar(consulta);

  const base = indice.filter((entrada) => coincideConFiltros(entrada.item, filtros));

  let resultados;
  let difuso = false;

  if (!tokens.length) {
    resultados = base.map((entrada) => ({ item: entrada.item, puntaje: 0, coincide: [] }));
  } else {
    resultados = [];
    for (const entrada of base) {
      const parcial = puntuar(entrada, tokens, frase, 'and');
      if (parcial) resultados.push({ item: entrada.item, ...parcial });
    }

    if (!resultados.length && tokens.length > 1) {
      difuso = true;
      for (const entrada of base) {
        const parcial = puntuar(entrada, tokens, frase, 'or');
        if (parcial) resultados.push({ item: entrada.item, ...parcial });
      }
    }
  }

  ordenar(resultados, filtros.orden || 'relevancia');

  return {
    resultados,
    total: resultados.length,
    disponibles: base.length,
    tokens,
    difuso,
    ms: Math.round((performance.now() - inicio) * 10) / 10,
  };
}

/** Etiquetas legibles de los campos donde hubo coincidencia. */
export function etiquetasCoincidencia(campos = []) {
  return campos
    .filter((campo) => campo !== 'sinopsis' && campo !== 'anio')
    .slice(0, 3)
    .map((campo) => ETIQUETAS[campo] || campo);
}
