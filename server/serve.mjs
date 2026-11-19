#!/usr/bin/env node
/**
 * Servidor de desarrollo + puente oEmbed (sin dependencias).
 *
 *   node server/serve.mjs
 *
 * - Sirve el frontend estático.
 * - Expone GET /api/oembed?url=…  firmando la petición con el token de app,
 *   de modo que el App Secret NUNCA llega al navegador.
 * - Expone GET /api/estado para comprobar la configuración.
 *
 * Variables de entorno (o archivo .env en la raíz):
 *   PORT=8080
 *   FB_APP_ID=...
 *   FB_APP_SECRET=...
 *   FB_GRAPH_VERSION=v23.0
 *   ALLOW_ORIGIN=            (vacío = mismo origen)
 */

import { createServer } from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));

/* ---------- .env mínimo ---------- */
function cargarEnv() {
  const ruta = join(RAIZ, '.env');
  if (!existsSync(ruta)) return;
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const igual = limpia.indexOf('=');
    if (igual < 1) continue;
    const clave = limpia.slice(0, igual).trim();
    let valor = limpia.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}
cargarEnv();

const PUERTO = Number(process.env.PORT) || 8080;
const VERSION = process.env.FB_GRAPH_VERSION || 'v23.0';
const APP_ID = process.env.FB_APP_ID || '';
const APP_SECRET = process.env.FB_APP_SECRET || '';
const ORIGEN = process.env.ALLOW_ORIGIN || '';
const TIENE_CREDENCIALES = Boolean(APP_ID && APP_SECRET);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const cacheOembed = new Map();
const TTL = 10 * 60 * 1000;

function cabecerasCors(extra = {}) {
  return {
    ...(ORIGEN ? { 'Access-Control-Allow-Origin': ORIGEN } : {}),
    ...extra,
  };
}

function responderJSON(res, estado, cuerpo) {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Cache-Control': 'no-store',
    ...cabecerasCors(),
  });
  res.end(texto);
}

function hostPermitido(url) {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'facebook.com' ||
      hostname.endsWith('.facebook.com') ||
      hostname === 'fb.watch' ||
      hostname === 'fb.me'
    );
  } catch {
    return false;
  }
}

/* ---------- oEmbed ---------- */
async function oembed(res, destino) {
  if (!destino) return responderJSON(res, 400, { error: 'Falta el parámetro «url».' });
  if (!hostPermitido(destino)) {
    return responderJSON(res, 400, { error: 'Solo se aceptan URLs de facebook.com o fb.watch.' });
  }
  if (!TIENE_CREDENCIALES) {
    return responderJSON(res, 501, {
      error: 'Faltan FB_APP_ID y FB_APP_SECRET en .env; el oEmbed de Meta exige token de app.',
    });
  }

  const clave = destino;
  const enCache = cacheOembed.get(clave);
  if (enCache && Date.now() - enCache.hora < TTL) {
    return responderJSON(res, 200, enCache.datos);
  }

  const params = new URLSearchParams({
    url: destino,
    access_token: `${APP_ID}|${APP_SECRET}`,
  });

  try {
    const meta = await fetch(`https://graph.facebook.com/${VERSION}/oembed_video?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const texto = await meta.text();

    let datos;
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = { error: 'Respuesta no JSON de Meta.' };
    }

    if (!meta.ok) {
      const mensaje = datos?.error?.message || datos?.error || `Meta respondió ${meta.status}.`;
      return responderJSON(res, meta.status === 400 ? 400 : 502, { error: String(mensaje) });
    }

    cacheOembed.set(clave, { hora: Date.now(), datos });
    return responderJSON(res, 200, datos);
  } catch (error) {
    return responderJSON(res, 504, { error: `No se pudo consultar Meta: ${error.message}` });
  }
}

/* ---------- Estáticos ---------- */
async function estatico(res, rutaUrl) {
  let relativa = decodeURIComponent(rutaUrl.split('?')[0]);
  if (relativa === '/') relativa = '/index.html';

  const destino = resolve(join(RAIZ, normalize(relativa)));
  if (destino !== RAIZ && !destino.startsWith(RAIZ + sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Prohibido');
    return;
  }

  try {
    const info = await stat(destino);
    if (info.isDirectory()) {
      return estatico(res, `${relativa.replace(/\/$/, '')}/index.html`);
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(destino).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
    });
    createReadStream(destino).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404</h1><p>No encontrado.</p>');
  }
}

/* ---------- Router ---------- */
const servidor = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cabecerasCors({ 'Access-Control-Allow-Methods': 'GET, OPTIONS' }));
    return res.end();
  }

  if (url.pathname === '/api/estado') {
    return responderJSON(res, 200, {
      ok: true,
      credenciales: TIENE_CREDENCIALES,
      version: VERSION,
      cache: cacheOembed.size,
    });
  }

  if (url.pathname === '/api/oembed') {
    return oembed(res, url.searchParams.get('url'));
  }

  return estatico(res, url.pathname);
});

servidor.listen(PUERTO, () => {
  const origen = `http://localhost:${PUERTO}`;
  console.log(`CineReels → ${origen}`);
  console.log(
    TIENE_CREDENCIALES
      ? `oEmbed: activo (Graph ${VERSION})`
      : 'oEmbed: inactivo · define FB_APP_ID y FB_APP_SECRET en .env',
  );
});

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    servidor.close(() => process.exit(0));
  });
}
