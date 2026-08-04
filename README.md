# Globe View

An interactive 3D Earth you can drag to rotate and scroll to zoom, built with
[Svelte](https://svelte.dev/) and [Three.js](https://threejs.org/). Continents
are rendered as a real-geography dot grid (sampled from an actual land/ocean
mask, not a texture image), and glowing red points mark hundreds of major
world cities.

## Features

- **Drag to rotate, scroll to zoom** — powered by Three.js `OrbitControls`, with damping and zoom-aware camera panning so clustered cities spread out as you zoom in.
- **Real-geography dot map** — every land dot is placed by sampling an equirectangular land/ocean mask, so continents match true Earth coastlines (not procedural noise).
- **Glowing city points** — 500+ cities, rendered as additive-blended red glow sprites, toggleable on/off, with hover tooltips.
- **Single source of truth for coordinates** — both the land dots and city points convert lat/lon to 3D position with the same [`latLonToVector3`](src/lib/geo.js) function, so they always stay in sync.
- **Atmosphere & starfield** — a soft additive-blended atmosphere shell and a randomly distributed starfield for depth.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL in your browser.

### Build

```bash
npm run build   # outputs to dist/
npm run preview # preview the production build locally
```

## Project structure

```
index.html              Entry HTML, mounts the Svelte app
src/
  main.js                Svelte app bootstrap
  App.svelte              Page layout, title overlay, city-toggle button
  Globe.svelte             Three.js scene: camera, controls, lighting, atmosphere, city sprites
  lib/
    geo.js                  latLonToVector3() — shared lat/lon -> 3D conversion
    earthDots.js             Builds the continent dot point-cloud from the land mask
    cities.js                 City name/lat/lon/size data
  assets/textures/
    land-mask.jpg              Equirectangular land/ocean mask used to place land dots
```

## Tech stack

- [Svelte 4](https://svelte.dev/) + [Vite](https://vitejs.dev/)
- [Three.js](https://threejs.org/) (`WebGLRenderer`, `OrbitControls`, `Points`, `Sprite`)

<img width="1175" height="797" alt="image" src="https://github.com/user-attachments/assets/8afec4b7-9781-44ac-8ae1-b6400e7f8c5c" />

