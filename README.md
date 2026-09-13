# RamNeverComes

**Live: [https://ramnevercomes.com/](https://ramnevercomes.com/)**

A fictional DDR5 memory store that is secretly an idle/clicker game. Nothing will be shipped, no payment is ever taken. Shop freely.

![RamNeverComes](assets/og-image-2.jpg)

## What it is

RamNeverComes looks like a premium hardware shop: 59 DDR5 kits with glossy product pages, five deadpan customer reviews each, a cart, order tracking and a loyalty programme. Underneath it is an incremental game: every kit you "buy" produces RAM Points, which buy more kits, which produce more points. The RAM itself never arrives.

Everything runs in the browser. There is no backend, no accounts and no tracking; all progress lives in `localStorage`.

## Features

- **Kit ladder** - 59 tiers of increasingly absurd DDR5 kits, revealed one by one as your production grows
- **Levels and XP** - orders and interactions grant XP; levels shorten delivery times, unlock features and eventually turn "Add to cart" into instant buy
- **Mystery cases** - three risk tiers with fixed expected value and separate cooldowns
- **Spin** - a prize wheel on a 60 second cooldown
- **RAMX market** - a deterministic fractal-noise price chart you can trade against (with a fee, so scalping does not pay)
- **Discover** - swipe cards for small rewards, with a regenerating charge pool
- **Scratch cards** - coupons and XP, auto-scratched once you reach instant buy
- **GB milestones** - permanent production multipliers for total memory "owned"
- **Product reviews** - 295 hand-written reviews, localised into 11 languages
- **11 languages** - en, pl, fr, es, pt, pt-br, de, it, zh, ja, ko
- **PWA** - installable, works offline via a service worker
- **Dark mode, mobile layout, Konami code**

## Tech

Vanilla JavaScript, HTML and CSS. No framework, no runtime dependencies.

- `index.html` - the app shell (History API routing, `<base href="/">` is required)
- `js/app.js` - the whole game and store logic
- `js/data.js` - product catalogue, ladder pricing, review metadata
- `js/seo-render.js` - shared prerender used by the build for static product pages
- `lang/*.json` - translations (English is the fallback)
- `build.mjs` - bundles with esbuild into `dist/`, generates a static page per product, `sitemap.xml` and `_redirects`
- `sw.js` - service worker cache (bump `CACHE` when static files change)

## Development

```bash
npm install
node build.mjs
npx wrangler pages dev dist   # serves dist/ with SPA fallback for deep links
```

Verify that every product has its full set of reviews in every language:

```bash
node scripts/verify-reviews.mjs
```

Useful console helpers while testing (see `CLAUDE.md` for the full list):

```js
debug(true)              // HUD with production stats and event log
cheat('unlockall')       // reveal the whole ladder
revealCinematic(RP_LADDER[7], 2)
ramRain()
```

## Deploy

`./deploy.sh` builds and publishes to Cloudflare Pages (project `ramnevercomes`) and pings IndexNow. Requires `CLOUDFLARE_API_TOKEN` in the environment or in `.env`.

## License

Code is released under the [MIT License](LICENSE). Product artwork in `assets/` was generated for this project and is included for the purpose of running the site.
