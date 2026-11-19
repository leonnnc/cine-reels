/**
 * Pruebas de humo del núcleo (sin navegador, sin dependencias).
 *   node test/ejecutar.mjs
 */

import assert from 'node:assert/strict';

let pasadas = 0;
let fallidas = 0;

function prueba(nombre, fn) {
  try {
    fn();
    pasadas += 1;
    console.log(`  ok   ${nombre}`);
  } catch (error) {
    fallidas += 1;
    console.error(`  FAIL ${nombre}`);
    console.error(`       ${error.message}`);
  }
}

async function pruebaAsync(nombre, fn) {
  try {
    await fn();
    pasadas += 1;
    console.log(`  ok   ${nombre}`);
  } catch (error) {
    fallidas += 1;
    console.error(`  FAIL ${nombre}`);
    console.error(`       ${error.message}`);
  }
}

/* ---------------- Stubs de navegador ---------------- */

const memoria = new Map();
const eventos = [];

globalThis.window = {
  localStorage: {
    getItem: (clave) => (memoria.has(clave) ? memoria.get(clave) : null),
    setItem: (clave, valor) => memoria.set(clave, String(valor)),
    removeItem: (clave) => memoria.delete(clave),
  },
  dispatchEvent: (evento) => {
    eventos.push(evento);
    return true;
  },
};

const { normalizar, resaltar, formatearDuracion, aLista, iniciales, tokenizar } = await import(
  '../js/core/util.js'
);
const { parsearEnlace, urlIncrustada, codigoIncrustado } = await import('../js/core/facebook.js');
const { construirIndice, buscar } = await import('../js/core/search.js');
const store = await import('../js/core/store.js');

/* ---------------- Texto ---------------- */

console.log('\nutil.js');

prueba('normaliza acentos y mayúsculas', () => {
  assert.equal(normalizar('  Parásitos  '), 'parasitos');
  assert.equal(normalizar('Amélie'), 'amelie');
});

prueba('tokeniza consultas', () => {
  assert.deepEqual(tokenizar('  Blade  Runner 2049 '), ['blade', 'runner', '2049']);
});

prueba('resalta coincidencias sin importar acentos', () => {
  const html = resaltar('Parásitos', ['parasitos']);
  assert.equal(html, '<mark>Parásitos</mark>');
});

prueba('resalta varias apariciones', () => {
  const html = resaltar('Dune y Dune dos', ['dune']);
  assert.equal((html.match(/<mark>/g) || []).length, 2);
});

prueba('escapa HTML al resaltar', () => {
  const html = resaltar('<script>x</script>', ['script']);
  assert.ok(!html.includes('<script>'));
});

prueba('formatea duraciones', () => {
  assert.equal(formatearDuracion(169), '2 h 49 min');
  assert.equal(formatearDuracion(90), '1 h 30 min');
  assert.equal(formatearDuracion(45), '45 min');
  assert.equal(formatearDuracion(0), '');
});

prueba('separa listas por comas', () => {
  assert.deepEqual(aLista('Drama, Crimen ,, '), ['Drama', 'Crimen']);
});

prueba('calcula iniciales', () => {
  assert.equal(iniciales('El Padrino'), 'EP');
  assert.equal(iniciales('Dune'), 'DU');
});

/* ---------------- Facebook ---------------- */

console.log('\nfacebook.js');

prueba('reconoce un reel con locale', () => {
  const r = parsearEnlace('https://www.facebook.com/reel/1403164165219302?locale=es_LA');
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'reel');
  assert.equal(r.id, '1403164165219302');
  assert.equal(r.canonica, 'https://www.facebook.com/reel/1403164165219302');
});

prueba('reconoce /watch/?v=', () => {
  const r = parsearEnlace('https://web.facebook.com/watch/?v=123456789&ref=sharing');
  assert.equal(r.ok, true);
  assert.equal(r.id, '123456789');
});

prueba('reconoce /usuario/videos/id', () => {
  const r = parsearEnlace('https://www.facebook.com/cinefilos/videos/987654321012');
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'video');
  assert.equal(r.id, '987654321012');
});

prueba('acepta enlaces cortos fb.watch', () => {
  const r = parsearEnlace('fb.watch/abc123/');
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'corto');
});

prueba('rechaza dominios ajenos', () => {
  const r = parsearEnlace('https://example.com/reel/123456789');
  assert.equal(r.ok, false);
  assert.match(r.motivo, /facebook/i);
});

prueba('rechaza historias', () => {
  const r = parsearEnlace('https://www.facebook.com/stories/1234567890');
  assert.equal(r.ok, false);
});

prueba('rechaza texto que no es URL', () => {
  assert.equal(parsearEnlace('hola').ok, false);
});

prueba('genera URL de plugin vertical', () => {
  const src = urlIncrustada('https://www.facebook.com/reel/1403164165219302', { ancho: 400, alto: 711 });
  assert.ok(src.startsWith('https://www.facebook.com/plugins/video.php?'));
  const params = new URL(src).searchParams;
  assert.equal(params.get('href'), 'https://www.facebook.com/reel/1403164165219302');
  assert.equal(params.get('height'), '711');
});

prueba('genera código de inserción', () => {
  const html = codigoIncrustado('https://www.facebook.com/reel/1403164165219302');
  assert.ok(html.includes('<iframe'));
  assert.ok(html.includes('allowfullscreen'));
});

/* ---------------- Búsqueda ---------------- */

console.log('\nsearch.js');

const DEMO = [
  {
    id: '1',
    titulo: 'Parásitos',
    tituloOriginal: 'Gisaengchung',
    anio: 2019,
    duracion: 132,
    generos: ['Drama', 'Suspenso'],
    tags: ['corea', 'sátira social'],
    director: 'Bong Joon-ho',
    reparto: ['Song Kang-ho'],
    sinopsis: 'Una familia humilde se infiltra en una casa adinerada.',
    favorito: true,
    reelUrl: 'https://www.facebook.com/reel/1',
  },
  {
    id: '2',
    titulo: 'Dune',
    tituloOriginal: 'Dune: Part One',
    anio: 2021,
    duracion: 155,
    generos: ['Ciencia ficción'],
    tags: ['desierto'],
    director: 'Denis Villeneuve',
    reparto: ['Timothée Chalamet'],
    sinopsis: 'El heredero viaja a un planeta desértico.',
    favorito: false,
    reelUrl: '',
  },
  {
    id: '3',
    titulo: 'El viaje de Chihiro',
    tituloOriginal: 'Sen to Chihiro',
    anio: 2001,
    duracion: 125,
    generos: ['Animación', 'Fantasía'],
    tags: ['ghibli'],
    director: 'Hayao Miyazaki',
    reparto: [],
    sinopsis: 'Una niña entra en el mundo de los espíritus.',
    favorito: false,
    reelUrl: '',
  },
];

const indice = construirIndice(DEMO);

prueba('encuentra sin acentos', () => {
  const r = buscar(indice, { q: 'parasitos' });
  assert.equal(r.total, 1);
  assert.equal(r.resultados[0].item.id, '1');
});

prueba('encuentra en sinopsis con menos peso', () => {
  const r = buscar(indice, { q: 'espiritus' });
  assert.equal(r.total, 1);
  assert.equal(r.resultados[0].item.id, '3');
});

prueba('varios términos funcionan como AND', () => {
  const r = buscar(indice, { q: 'dune villeneuve' });
  assert.equal(r.total, 1);
  assert.equal(r.resultados[0].item.id, '2');
});

prueba('sin coincidencia exacta reintenta en modo difuso', () => {
  const r = buscar(indice, { q: 'dune dinosaurio' });
  assert.equal(r.difuso, true);
  assert.ok(r.total >= 1);
});

prueba('el título pesa más que la sinopsis', () => {
  const r = buscar(indice, { q: 'dune' });
  assert.equal(r.resultados[0].item.id, '2');
  assert.ok(r.resultados[0].puntaje > 0);
});

prueba('filtra por género', () => {
  const r = buscar(indice, { generos: ['Animación'] });
  assert.equal(r.total, 1);
  assert.equal(r.resultados[0].item.id, '3');
});

prueba('filtra por año y duración', () => {
  assert.equal(buscar(indice, { anio: '2019' }).total, 1);
  assert.equal(buscar(indice, { duracion: 'larga' }).total, 2);
});

prueba('filtra solo con reel y favoritas', () => {
  assert.equal(buscar(indice, { soloConReel: true }).total, 1);
  assert.equal(buscar(indice, { soloFavoritos: true }).total, 1);
});

prueba('ordena por año descendente', () => {
  const r = buscar(indice, { orden: 'recientes' });
  assert.deepEqual(
    r.resultados.map((x) => x.item.anio),
    [2021, 2019, 2001],
  );
});

prueba('ordena alfabéticamente', () => {
  const r = buscar(indice, { orden: 'titulo' });
  assert.deepEqual(
    r.resultados.map((x) => x.item.titulo),
    ['Dune', 'El viaje de Chihiro', 'Parásitos'],
  );
});

prueba('consulta vacía devuelve todo', () => {
  assert.equal(buscar(indice, {}).total, 3);
});

/* ---------------- Almacén ---------------- */

console.log('\nstore.js');

await pruebaAsync('arranca con el catálogo demo', () => {
  assert.ok(store.listar().length >= 10);
});

await pruebaAsync('guarda y normaliza una película', () => {
  const guardada = store.guardar({
    titulo: '  Mi película  ',
    anio: '2024',
    duracion: '100',
    generos: 'Drama,  Terror',
    reelUrl: 'https://www.facebook.com/reel/5555555555?locale=es_LA',
    puntuacion: '7.5',
  });
  assert.equal(guardada.titulo, 'Mi película');
  assert.equal(guardada.anio, 2024);
  assert.deepEqual(guardada.generos, ['Drama', 'Terror']);
  assert.equal(guardada.reelUrl, 'https://www.facebook.com/reel/5555555555');
});

await pruebaAsync('detecta reels duplicados', () => {
  const dup = store.buscarPorReel('https://www.facebook.com/reel/5555555555');
  assert.ok(dup);
  assert.equal(dup.titulo, 'Mi película');
});

await pruebaAsync('editar conserva el id', () => {
  const original = store.listar().find((i) => i.titulo === 'Mi película');
  const editada = store.guardar({ ...original, titulo: 'Mi película editada' });
  assert.equal(editada.id, original.id);
  assert.equal(store.listar().filter((i) => i.id === original.id).length, 1);
});

await pruebaAsync('alterna favorito', () => {
  const item = store.listar().find((i) => i.titulo === 'Mi película editada');
  const cambiada = store.alternarFavorito(item.id);
  assert.equal(cambiada.favorito, true);
});

await pruebaAsync('exporta e importa sin duplicar por reel', () => {
  const antes = store.listar().length;
  const paquete = store.exportar();
  store.importar(paquete.peliculas, { fusionar: true });
  assert.equal(store.listar().length, antes);
});

await pruebaAsync('elimina', () => {
  const item = store.listar().find((i) => i.titulo === 'Mi película editada');
  assert.equal(store.eliminar(item.id), true);
  assert.equal(store.obtener(item.id), null);
});

await pruebaAsync('emite eventos de cambio', () => {
  assert.ok(eventos.length > 0);
  assert.equal(eventos.at(-1).type, 'catalogo:cambio');
});

/* ---------------- Resumen ---------------- */

console.log(`\n${pasadas} pruebas correctas, ${fallidas} fallidas.`);
process.exit(fallidas ? 1 : 0);
