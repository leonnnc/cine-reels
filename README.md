# CineReels

Buscador personal de **películas que descubres en reels de Facebook**.
HTML5, CSS3 y JavaScript moderno, sin frameworks y sin dependencias en el
frontend. El catálogo vive en tu navegador y los reels se reproducen con el
plugin oficial de Facebook.

![stack](https://img.shields.io/badge/HTML5-CSS3-JS-7c5cff) ![sin dependencias](https://img.shields.io/badge/dependencias-0-35d49a)

## Ubicaciones

- Kali:    `/home/kadmin/web/cine-reels`
- GitHub:  https://github.com/leonnnc/cine-reels
- Windows: `D:\Documentos\web\cine-reels`

## Arranque rápido

```bash
cd cine-reels
node server/serve.mjs        # http://localhost:8080
# o bien:  npm start
```

También vale cualquier servidor estático (`python3 -m http.server 8080`), pero
entonces el autocompletado con oEmbed queda desactivado.

> No abras `index.html` con doble clic: los módulos ES necesitan `http://`.

## Qué hace

### Búsqueda (el núcleo)

- Insensible a **mayúsculas y tildes**: `parasitos` encuentra *Parásitos*.
- Varios términos funcionan como **AND** (`dune villeneuve`), y si no hay
  coincidencias exactas reintenta en modo aproximado avisando en el contador.
- **Puntuación por campo**: título (×12) > título original (×8) > géneros y
  etiquetas (×6) > año (×5) > reparto/dirección (×4) > sinopsis (×2).
- Premia la **frase exacta** y las coincidencias al inicio del título.
- Resalta las coincidencias con `<mark>` conservando los acentos originales.
- Filtros combinables: género (multi), año, duración, solo con reel, favoritas.
- Orden: relevancia, año, título, puntuación o duración.
- Estado en la URL (`?q=dune&genero=Ciencia%20ficci%C3%B3n`) → compartible.
- Atajos: `/` o `Ctrl/Cmd + K` enfoca el buscador, `Esc` limpia, `Esc` cierra
  los diálogos.

### Reels de Facebook

- Analiza enlaces `/reel/ID`, `/reels/ID`, `/watch/?v=ID`,
  `/usuario/videos/ID`, `/video.php?v=ID` y enlaces cortos `fb.watch/…`,
  ignorando parámetros como `?locale=es_LA`.
- Genera la URL del **plugin oficial** (`plugins/video.php`) en formato 9:16.
- Vista previa dentro del formulario, copia del enlace y copia del código
  `<iframe>` listo para pegar.
- Detecta **reels duplicados** antes de guardar.

### Catálogo

- Alta, edición, borrado, favoritos y "vista".
- Exportar / importar JSON (fusionando sin duplicar por reel o por título+año).
- Datos de demostración restaurables.
- Persistencia en `localStorage` (clave `cine-reels:catalogo:v1`).

## Estructura

```
cine-reels/
├── index.html                 # marcado y diálogos
├── css/styles.css             # tema oscuro, responsive, sin frameworks
├── js/
│   ├── app.js                 # controlador: eventos, estado, URL
│   ├── core/
│   │   ├── util.js            # normalización, resaltado, formato
│   │   ├── facebook.js        # parseo de enlaces + oEmbed
│   │   ├── search.js          # índice, puntuación, filtros, orden
│   │   ├── store.js           # localStorage + import/export
│   │   └── ui.js              # render de tarjetas y modales
│   └── data/seed.js           # catálogo de demostración
├── server/serve.mjs           # estáticos + proxy oEmbed (Node, 0 deps)
├── test/ejecutar.mjs          # 36 pruebas de humo del núcleo
└── .env.example
```

## El límite real de Facebook (leer antes de pedir "buscar en todo Facebook")

| Vía | ¿Sirve? | Requisitos |
|---|---|---|
| Plugin oficial de vídeo (incrustar y reproducir) | **Sí** | Nada; el reel debe ser público |
| `oembed_video` de la Graph API (título, autor, miniatura) | **Sí** | App de Meta con `FB_APP_ID` y `FB_APP_SECRET` |
| Graph API sobre vídeos de páginas que administras | **Sí** | Token de usuario con permisos y rol en la página |
| Buscar reels de terceros por palabra clave | **No** | Meta no expone ese buscador en ninguna API pública |
| Raspar el HTML de facebook.com | **No** | Viola los términos de uso y se rompe cada semana |

Por eso este proyecto **no promete** un "Google de reels": indexa los reels que
tú aportas, los busca muy bien y los reproduce. Cualquier herramienta que
ofrezca búsqueda global de reels lo está haciendo raspando Facebook (con riesgo
legal y estabilidad nula).

## Autocompletado con oEmbed (opcional)

1. Crea una app en <https://developers.facebook.com/apps/>.
2. Copia `App ID` y `App Secret` en `.env`:

   ```bash
   cp .env.example .env
   # FB_APP_ID=1234567890
   # FB_APP_SECRET=abcdef...
   ```

3. Arranca con `node server/serve.mjs`.
4. En **Catálogo → Puente con Facebook**, pulsa *Probar conexión*: debe decir
   "Proxy conectado y con credenciales de Meta".
5. Al pegar un reel y pulsar **Analizar**, si hay credenciales se rellenan
   título, miniatura y autor automáticamente.

Por qué un proxy: Meta exige `access_token=APP_ID|APP_SECRET` en la URL. Ese
secreto **nunca** debe viajar al navegador. `server/serve.mjs` lo firma en el
servidor, limita el destino a `facebook.com`/`fb.watch` y cachea 10 minutos.

```
GET /api/oembed?url=https://www.facebook.com/reel/1403164165219302
GET /api/estado
```

## Modelo de datos

```json
{
  "formato": "cine-reels",
  "version": 1,
  "peliculas": [
    {
      "id": "uuid",
      "titulo": "Interestelar",
      "tituloOriginal": "Interstellar",
      "anio": 2014,
      "duracion": 169,
      "generos": ["Ciencia ficción", "Drama"],
      "tags": ["agujero negro"],
      "director": "Christopher Nolan",
      "reparto": ["Matthew McConaughey"],
      "puntuacion": 8.7,
      "sinopsis": "…",
      "poster": "",
      "reelUrl": "https://www.facebook.com/reel/1403164165219302",
      "reelId": "1403164165219302",
      "visto": true,
      "favorito": true,
      "creado": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

La importación acepta también un array plano y cadenas separadas por comas en
`generos`, `tags` y `reparto`.

## Pruebas

```bash
npm test        # node test/ejecutar.mjs
```

Cubren normalización y resaltado, parseo de los cinco formatos de enlace,
construcción del plugin, ranking AND/difuso, filtros, orden y CRUD del almacén.

## Despliegue

- **GitHub Pages / hosting estático**: funciona todo excepto el autocompletado
  oEmbed (no hay backend). Pega los datos a mano.
- **Con oEmbed**: publica el frontend y ejecuta `server/serve.mjs` en un host
  con Node ≥ 20 (Render, Fly, VPS). Define las variables de entorno allí, nunca
  en el repositorio.

## Privacidad

Tu catálogo no sale del navegador. El único tercero es Facebook, y solo cuando
abres la vista previa de un reel (el iframe carga su reproductor y sus cookies).

## Licencia

MIT.
