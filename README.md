# f1-box-box

> F1 pit-lane style loading — car rolls in, crew fires, car launches out. Self-contained CSS + canvas, `start()` / `complete()` / `reset()` / `destroy()`. Zero dependencies.

[![npm version](https://img.shields.io/npm/v/f1-box-box)](https://www.npmjs.com/package/f1-box-box)
[![npm downloads](https://img.shields.io/npm/dm/f1-box-box)](https://www.npmjs.com/package/f1-box-box)
[![bundle size](https://img.shields.io/bundlephobia/minzip/f1-box-box)](https://bundlephobia.com/package/f1-box-box)
[![license](https://img.shields.io/github/license/everything-frontend/f1-box-box)](https://github.com/everything-frontend/f1-box-box/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/types-included-blue)](https://www.npmjs.com/package/f1-box-box)

**[Live Demo →](https://www.everythingfrontend.com/f1-box-box)**

---

## Install

```bash
npm install f1-box-box
```

---

## Quick start

```ts
import f1BoxBox from 'f1-box-box';

const el = document.getElementById('loader')!;
const pit = f1BoxBox(el, {
  scale: 1.2,
  color: '#e22828',
  baseColor: '#1a1a1a',
  text: [
    'Box, box — coming in…',
    'Jacking up…',
    'Changing tyres…',
    'Adjusting front wing…',
    'Tyres on — go, go, go!',
  ],
  textInterval: 1500,
});

pit.start();
// later: pit.complete(), pit.reset(), or pit.destroy();
```

---

## API

### `f1BoxBox(container, options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scale` | `number` | `1` | Visual scale multiplier (e.g. `0.75`, `1.5`) |
| `color` | `string` | `#e22828` | Car / team accent |
| `baseColor` | `string` | `#1a1a1a` | Car chassis and mechanics' gear base color |
| `text` | `string \| string[]` | `Pit lane…` | Subtitle under the track. Pass an array to cycle messages: first and last are shown once (at start / end); middle entries repeat in sequence during work. |
| `textInterval` | `number` | `2000` | Interval in ms for cycling middle text entries (only applies when `text` is an array). |

**Status line behavior:** With a **string**, only the idle / `reset()` line uses your value; `start()` / `complete()` keep the built-in pit radio phrases. With an **array**, index `0` is idle and the first line when `start()` runs, indices `1 … length-2` rotate in order every `textInterval` ms while the crew is working, and index `length-1` is shown when `complete()` runs (and after the car leaves).

Returns `{ start, complete, reset, destroy }`.

- **`start()`** — starts the sequence (car enters pit, crew works).
- **`complete()`** — transitions to release (green light, crew steps back, car exits).
- **`reset()`** — returns to idle.
- **`destroy()`** — removes the mounted nodes from the container (global injected stylesheet stays, shared across instances).

---

**Bundle size:** ~2.2 kB minified + gzip (see [bundlephobia](https://bundlephobia.com/package/f1-box-box)).

## License

MIT © [Everything Frontend](https://github.com/everything-frontend)
