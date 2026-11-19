/**
 * Facebook: análisis de enlaces de reels/vídeos, URL de incrustación y
 * cliente opcional de oEmbed a través de un proxy propio.
 *
 * Nota importante: Facebook no ofrece una API pública para *buscar* reels de
 * terceros. Aquí solo se resuelven enlaces concretos que el usuario aporta.
 */

const HOSTS_FACEBOOK = new Set([
  'facebook.com',
  'www.facebook.com',
  'web.facebook.com',
  'm.facebook.com',
  'mbasic.facebook.com',
  'business.facebook.com',
]);

const HOSTS_CORTOS = new Set(['fb.watch', 'www.fb.watch', 'fb.me', 'www.fb.me']);

/** @typedef {{ ok: boolean, tipo: 'reel'|'video'|'watch'|'corto'|'compartido'|null, id: string|null, url: string, canonica: string, motivo: string }} EnlaceReel */

/** Analiza un enlace pegado por el usuario. */
export function parsearEnlace(entrada) {
  /** @type {EnlaceReel} */
  const salida = { ok: false, tipo: null, id: null, url: '', canonica: '', motivo: '' };
  const crudo = String(entrada ?? '').trim();

  if (!crudo) {
    salida.motivo = 'Pega el enlace de un reel.';
    return salida;
  }

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(crudo) ? crudo : `https://${crudo}`);
  } catch {
    salida.motivo = 'El enlace no tiene un formato válido.';
    return salida;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    salida.motivo = 'Solo se admiten enlaces http(s).';
    return salida;
  }

  const host = url.hostname.toLowerCase();

  if (HOSTS_CORTOS.has(host)) {
    if (!url.pathname || url.pathname === '/') {
      salida.motivo = 'El enlace corto está incompleto.';
      return salida;
    }
    salida.ok = true;
    salida.tipo = 'corto';
    salida.url = `https://${host.replace(/^www\./, '')}${url.pathname}`;
    salida.canonica = salida.url;
    return salida;
  }

  if (!HOSTS_FACEBOOK.has(host)) {
    salida.motivo = 'Solo se admiten enlaces de facebook.com o fb.watch.';
    return salida;
  }

  const ruta = url.pathname;
  let id = null;
  let tipo = null;

  const coincideReel = ruta.match(/^\/(?:reel|reels)\/(\d{6,})/i);
  const coincideVideoPath = ruta.match(/^\/[^/]+\/videos\/(?:[^/]+\/)?(\d{6,})/i);
  const v = url.searchParams.get('v');

  if (coincideReel) {
    id = coincideReel[1];
    tipo = 'reel';
  } else if (/^\/watch\/?$/i.test(ruta) && v && /^\d{6,}$/.test(v)) {
    id = v;
    tipo = 'watch';
  } else if (/^\/video\.php$/i.test(ruta) && v && /^\d{6,}$/.test(v)) {
    id = v;
    tipo = 'video';
  } else if (coincideVideoPath) {
    id = coincideVideoPath[1];
    tipo = 'video';
  } else if (/^\/share\//i.test(ruta)) {
    tipo = 'compartido';
  } else if (/^\/stories\//i.test(ruta)) {
    salida.motivo = 'Las historias caducan y no se pueden incrustar. Usa el enlace del reel.';
    return salida;
  } else {
    salida.motivo = 'No reconozco un reel en ese enlace. Copia el enlace desde el menú «Compartir» del reel.';
    return salida;
  }

  const base = url.origin.replace('http://', 'https://');

  if (tipo === 'reel' && id) {
    salida.canonica = `https://www.facebook.com/reel/${id}`;
  } else if (tipo === 'watch' && id) {
    salida.canonica = `https://www.facebook.com/watch/?v=${id}`;
  } else if (tipo === 'video' && id) {
    salida.canonica = `${base}${ruta.replace(/\/$/, '')}`;
  } else {
    salida.canonica = `${base}${ruta}`;
  }

  salida.ok = true;
  salida.tipo = tipo;
  salida.id = id;
  salida.url = salida.canonica;
  return salida;
}

/** URL del plugin oficial de vídeo, en formato vertical para reels. */
export function urlIncrustada(enlace, { ancho = 400, alto = 711 } = {}) {
  const url = typeof enlace === 'string' ? enlace : enlace?.canonica || enlace?.url;
  if (!url) return '';
  const params = new URLSearchParams({
    href: url,
    show_text: 'false',
    width: String(ancho),
    height: String(alto),
    autoplay: 'false',
    lazy: 'true',
  });
  return `https://www.facebook.com/plugins/video.php?${params.toString()}`;
}

/** Código HTML listo para pegar. */
export function codigoIncrustado(enlace, { ancho = 400, alto = 711 } = {}) {
  const src = urlIncrustada(enlace, { ancho, alto });
  const original = typeof enlace === 'string' ? enlace : enlace?.canonica || enlace?.url || '';
  return [
    `<iframe src="${src}"`,
    `  width="${ancho}" height="${alto}"`,
    '  style="border:none;overflow:hidden"',
    '  scrolling="no" frameborder="0" allowfullscreen="true"',
    '  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"',
    `  title="Reel de Facebook"></iframe>`,
    `<p><a href="${original}" target="_blank" rel="noopener noreferrer">Ver en Facebook</a></p>`,
  ].join('\n');
}

/** Normaliza la ruta del proxy: "" → "/api/oembed". */
export function rutaProxy(guardada) {
  const ruta = String(guardada ?? '').trim() || '/api/oembed';
  return ruta.replace(/\/+$/, '');
}

/**
 * Consulta el proxy oEmbed propio. El proxy es quien guarda el token de app;
 * el navegador nunca ve el App Secret.
 */
export async function consultarOembed(enlace, { proxy = '/api/oembed', signal } = {}) {
  const url = typeof enlace === 'string' ? enlace : enlace?.canonica || enlace?.url;
  if (!url) throw new Error('Falta el enlace del reel.');

  const destino = `${rutaProxy(proxy)}?url=${encodeURIComponent(url)}`;
  const respuesta = await fetch(destino, { signal, headers: { Accept: 'application/json' } });

  if (!respuesta.ok) {
    let detalle = '';
    try {
      const cuerpo = await respuesta.json();
      detalle = cuerpo?.error || cuerpo?.detalle || '';
    } catch {
      /* respuesta sin JSON */
    }
    if (respuesta.status === 501) {
      throw new Error(detalle || 'El proxy no tiene credenciales de Facebook configuradas.');
    }
    if (respuesta.status === 404) {
      throw new Error('No hay proxy oEmbed en esa ruta. Arranca `node server/serve.mjs`.');
    }
    throw new Error(detalle || `El proxy respondió ${respuesta.status}.`);
  }

  const datos = await respuesta.json();
  return {
    titulo: datos.title || '',
    autor: datos.author_name || '',
    autorUrl: datos.author_url || '',
    miniatura: datos.thumbnail_url || '',
    html: datos.html || '',
    ancho: datos.width || null,
    alto: datos.height || null,
  };
}
