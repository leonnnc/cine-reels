/**
 * Utilidades compartidas: texto, normalización, resaltado y formato.
 */

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para inyectarlo en HTML. */
export function escapar(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}

/** Minúsculas, sin acentos y con separadores colapsados. */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenizar(consulta) {
  return normalizar(consulta).split(' ').filter(Boolean);
}

/**
 * Normaliza conservando un mapa hacia los índices del texto original,
 * para poder resaltar coincidencias sin acentos.
 * @returns {{ texto: string, mapa: number[] }}
 */
function normalizarConMapa(original) {
  let texto = '';
  const mapa = [];
  for (let i = 0; i < original.length; i += 1) {
    const plano = original[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const caracter of plano) {
      if (/[a-z0-9]/.test(caracter)) {
        texto += caracter;
        mapa.push(i);
      } else if (texto && !texto.endsWith(' ')) {
        texto += ' ';
        mapa.push(i);
      }
    }
  }
  return { texto, mapa };
}

/** Devuelve HTML seguro con <mark> en las coincidencias de `tokens`. */
export function resaltar(texto, tokens = []) {
  const original = String(texto ?? '');
  if (!tokens.length) return escapar(original);

  const { texto: plano, mapa } = normalizarConMapa(original);
  const rangos = [];

  for (const token of tokens) {
    if (!token) continue;
    let desde = plano.indexOf(token);
    while (desde !== -1) {
      const hasta = desde + token.length;
      rangos.push([mapa[desde], mapa[hasta - 1] + 1]);
      desde = plano.indexOf(token, hasta);
    }
  }
  if (!rangos.length) return escapar(original);

  // Une rangos solapados y los ordena.
  rangos.sort((a, b) => a[0] - b[0]);
  const unidos = [rangos[0]];
  for (let i = 1; i < rangos.length; i += 1) {
    const ultimo = unidos[unidos.length - 1];
    if (rangos[i][0] <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], rangos[i][1]);
    else unidos.push(rangos[i]);
  }

  let salida = '';
  let cursor = 0;
  for (const [desde, hasta] of unidos) {
    salida += escapar(original.slice(cursor, desde));
    salida += `<mark>${escapar(original.slice(desde, hasta))}</mark>`;
    cursor = hasta;
  }
  salida += escapar(original.slice(cursor));
  return salida;
}

/** "135" → "2 h 15 min" */
export function formatearDuracion(minutos) {
  const total = Number(minutos);
  if (!Number.isFinite(total) || total <= 0) return '';
  const horas = Math.floor(total / 60);
  const resto = Math.round(total % 60);
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

/** Lista separada por comas a partir de un input libre. */
export function aLista(texto) {
  return String(texto ?? '')
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean);
}

export function debounce(fn, espera = 180) {
  let temporizador;
  const envuelta = (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), espera);
  };
  envuelta.cancelar = () => clearTimeout(temporizador);
  return envuelta;
}

/** Iniciales para el póster cuando no hay imagen. */
export function iniciales(titulo) {
  const palabras = String(titulo ?? '').trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) return '?';
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

const PALETAS = [
  ['#2c1a5e', '#7c5cff'],
  ['#5e1a33', '#ff4d8d'],
  ['#123b4a', '#2fd1c5'],
  ['#4a2a12', '#f0a23b'],
  ['#1a2a6e', '#5c8bff'],
  ['#123f26', '#4dd97a'],
  ['#3d1530', '#b44dff'],
  ['#3a3a12', '#d7c93a'],
];

/** Paleta estable derivada del texto. */
export function paleta(titulo) {
  const texto = String(titulo ?? '');
  let hash = 0;
  for (let i = 0; i < texto.length; i += 1) {
    hash = (hash * 31 + texto.charCodeAt(i)) % 100000;
  }
  const [c1, c2] = PALETAS[hash % PALETAS.length];
  return { c1, c2 };
}

export function generarId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function descargarJSON(nombreArchivo, datos) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function leerJSON(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        resolve(JSON.parse(String(lector.result)));
      } catch {
        reject(new Error('El archivo no contiene JSON válido.'));
      }
    };
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.readAsText(archivo);
  });
}
