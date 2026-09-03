# RG Player

Phone-first, artwork-reactive resonance reference player by RG.

The current reference library pairs **Somewhere** by julez with **Hope To See
You Again** by Antent, then adds each official slowed variant as a controlled
comparison. All four full tracks use official release/source metadata and
artwork-led palettes while sharing the same native Web Audio visualizer.

## Run locally

Serve the repository root over HTTP; ES modules and media analysis do not run
reliably from a direct `file://` URL.

```powershell
npx serve .
```

Open the printed local address. Add `?calibrate=1` to expose:

```js
window.__RG_PLAYER_CALIBRATION__.snapshot()
window.__RG_PLAYER_CALIBRATION__.download()
window.__RG_PLAYER_CALIBRATION__.clear()
```

The downloaded session can be processed by
`media-tools/audio-reactivity/object-index-report.mjs`.

## Media providers

Every artwork and audio object names a provider and public path. `relative`
providers resolve from this site. `absolute` providers resolve from an HTTPS
base, allowing the library to move to object storage without changing player
code. Provider records contain no credentials.

```json
"mediaProviders": {
  "bundled": { "type": "relative", "baseUrl": "." },
  "libraryCdn": { "type": "absolute", "baseUrl": "https://media.example.org/" }
}
```

## Rights records

Every track must include a merged rights record with:

- status (`direct-permission`, `licensed`, `all-rights-reserved`, `public-domain`, or `unknown`)
- rights holder
- human-readable credit
- official source label and URL
- license name and URL when licensed

The full schema and rationale live in
`media-tools/audio-reactivity/contracts/library-manifest.schema.json` and
`MEDIA-LIBRARY-CONTRACT.md`.

## Design boundary

The player shell stays graphite, mineral, and quiet. Release artwork supplies
the expressive palette. The same uninterrupted player now supports two local
visual engines:

- **Hex Field** keeps the artwork-centered geometry: hex scale follows low/mid
  body and impact; the spectrum ring carries faster detail; sparse chronology
  dots carry discrete band-mapped accents.
- **Liquid Chrome** turns the artwork itself into reflective material. WebGL is
  progressively enhanced over an authored Canvas fallback, with bass shaping
  mass, mids shaping surface flow, treble shaping highlights, and transients
  shaping brief focus trails.

Visual selection changes the canvas, never the route or audio element. Add
`?renderer=canvas` to force the Liquid Chrome fallback during QA.
