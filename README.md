# British Speaking Studio

Production-ready static web application for practising British English pronunciation, listening, and shadowing. The project preserves the browser-native `SpeechSynthesis` approach from the original ZIP and only uses voices whose language is exactly `en-GB`.

## Run locally

Requirements: Node.js 18 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by the server. Microphone recording requires HTTPS or `localhost`.

## Validation

```bash
npm run build
```

The validation checks the lesson count/schema, metadata, en-GB language lock, absence of an en-US fallback, audio cancellation, and Local Storage persistence.

## Edit lesson data

All editable lesson content is in [`data/lessons.json`](data/lessons.json). Each record contains:

- `id`: stable internal identifier — do not change after launch unless necessary.
- `number` and `page`: original lesson order and source PDF page.
- `word`, `meaning`, `wordIpa`, `sentence`, `ipa`, `thai`: learner-facing content.
- `flags`: review reasons. Use an empty array only after the record has been checked against the original PDF.

After editing, run `npm run build` and inspect the affected lesson in the browser. Do not invent missing translations or IPA. The generated audit is in [`data/audit.json`](data/audit.json).

## Audio behaviour

- Uses the device's installed Web Speech API voices.
- Selects only `en-GB`; it never silently falls back to American English.
- Cancels current speech and pending timers before a new playback or lesson change.
- Supports 0.5×, 0.75×, and 1× speeds.
- Shadowing supports 1, 3, 5, or 10 rounds with a configurable speaking pause and countdown.
- A device without an en-GB voice receives a visible installation message and audio controls are disabled.

## Privacy

Progress, bookmarks, difficult words, and the current lesson are stored in browser Local Storage. Microphone recordings use an in-memory object URL and are not uploaded to a server.

## Deploy to Vercel

1. Create a new Vercel project named `british-speaking-studio` from this repository.
2. Framework preset: **Other**.
3. Build command: leave empty (or use `npm run build` as a check).
4. Output directory: `.`
5. Deploy a Preview first and test audio/microphone over HTTPS.

No API keys or runtime secrets are required.

## Custom domain later

In Vercel, open the new `british-speaking-studio` project, go to **Settings → Domains**, add the domain, then create the DNS record Vercel shows. Verify both apex and `www` behaviour before promoting the Preview to Production. This does not require modifying any other Vercel project.
