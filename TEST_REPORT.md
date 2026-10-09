# Test and implementation report

## Implemented

- Responsive Dashboard with total, completed, progress, favourites, and Continue Learning.
- Searchable/filterable All Lessons library.
- Practice screen with word, sentence, IPA, Thai translation toggles, word/sentence audio, repeat, speed, previous/next, completed, difficult, and favourite states.
- Shadowing Studio with 0.5×/0.75×/1× speed, 1/3/5/10 rounds, speaking pause, countdown, stop, and restart.
- Microphone Record, Stop, and Playback using `MediaRecorder`; recordings stay in browser memory.
- Local Storage persistence and return-to-last-lesson.
- Strict en-GB voice selection and visible no-UK-voice state. No automatic American English fallback.
- SEO title/description, favicon, responsive layout, Vercel headers, and repository editing instructions.

## Automated validation

Run `npm run build`. The validation checks dataset shape/count, SEO files, audio cancellation, en-GB lock, no en-US fallback, and Local Storage use.

Automated browser acceptance completed on 9 October 2026:

- Google Chrome 154.0.8037.98: passed.
- Microsoft Edge 154.0.4258.62: passed.
- Mobile emulation at 390 x 844 and narrow-layout check at 300 px: passed without horizontal overflow.
- No uncaught JavaScript or browser console errors were recorded.
- Local Storage completion state survived a full page reload.
- Localhost was reported as a secure context with `MediaRecorder` and microphone APIs available.

Headless browser sessions do not expose installed operating-system speech voices, so automated tests validate the strict en-GB selection, control flow, cancellation, and no-fallback behaviour but cannot attest to the audible quality of a specific installed voice. A visible browser check confirmed that the explicit “no en-GB voice” message appears when a voice is unavailable. Final audible and microphone permission checks should also be repeated on the deployed HTTPS Preview with the target device.

## Browser acceptance checklist

- Chrome desktop: page load, lessons, navigation, Local Storage, en-GB voice discovery, playback controls, Shadowing stop/restart, responsive layout.
- Edge desktop: same checks.
- Mobile viewport: navigation drawer, Practice layout, Shadowing controls, touch-sized controls.
- Microphone permission and capture require a real browser session over HTTPS or localhost and user permission.

## Data limitations

The supplied ZIP contained no separate PDF; it contained a single HTML file with an embedded dataset said to be extracted from a 160-page PDF. No uncertain text was invented. See `DATA_REVIEW.md` and `data/audit.json`.
