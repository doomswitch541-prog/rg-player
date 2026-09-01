# RG Player

Private, phone-first, artwork-reactive music player by RG.

The repository is deliberately band-neutral. Its bundled **Signal Study** is a
short generated calibration fixture, not an artist release. Replace
`data/library.json` with a real personal catalog and keep per-track rights and
source provenance attached to every entry.

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

- status (`direct-permission`, `licensed`, `public-domain`, or `unknown`)
- rights holder
- human-readable credit
- official source label and URL
- license name and URL when licensed

Do not publish entries whose status is `unknown`. The full schema and rationale
live in `media-tools/audio-reactivity/contracts/library-manifest.schema.json`
and `MEDIA-LIBRARY-CONTRACT.md`.

## Design boundary

The player shell stays graphite, mineral, and quiet. Release artwork supplies
the expressive palette. The signature object is the artwork-centered field:
hex scale follows low/mid body and impact; the spectrum ring carries faster
detail; sparse chronology dots carry discrete band-mapped accents.
