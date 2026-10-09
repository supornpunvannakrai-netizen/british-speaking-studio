# Lesson data review report

Source inspected: the embedded JSON dataset in the supplied `index.html`. The ZIP did not include the original PDF.

## Summary

- Records: 467
- Highest displayed lesson number: 469
- Records marked Needs Review after objective checks: 52
- Duplicate lesson numbers: 277, 278, 279
- Missing lesson numbers: 208, 254, 296, 400, 421
- Duplicate vocabulary terms are listed in `data/audit.json`; repetitions may be intentional and were not removed.

## Review policy

The original flags were preserved. `missing-data` was added where one or more core fields are blank, and `duplicate-number` was added where a lesson number repeats. Thai translations, English sentences, words, and IPA were not guessed or silently repaired.

The full machine-readable review list, including record IDs, PDF page references, and reasons, is in [`data/audit.json`](data/audit.json).
