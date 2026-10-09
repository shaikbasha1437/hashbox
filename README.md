# HashBox

**In-browser hasher for text and files.** Compute MD5, SHA-1, SHA-256, SHA-384, SHA-512 and CRC32, copy results, and check a download against an expected checksum.

**Live:** https://shaikbasha1437.github.io/hashbox/

## Privacy

Everything runs **only in your browser**. Text and files never leave this tab — no uploads, no accounts, no analytics, no CDN scripts.

## Features

- **Text tab** — live hashes as you type (UTF-8), byte count, copy all
- **Files tab** — drag-and-drop or pick one or many files; each is hashed in a Web Worker in 4 MiB chunks with a progress bar, cancel/retry, and per-file timing
- **Algorithms** — SHA-1 / SHA-256 / SHA-384 / SHA-512 via Web Crypto; MD5 and CRC32 via small vendored JS (`vendor/`); toggle any subset
- **Hex output** with an uppercase toggle and a copy button per hash
- **Compare** — paste an expected hash (also accepts `SHA256: …` or `hash  filename` lines) to see match / mismatch, with the matching row highlighted
- **Copy all (checksum list)** — `hash  filename` lines grouped by algorithm
- Works offline after first visit (PWA); relative paths (GitHub Pages–friendly)

## Notes

- Web Crypto has no streaming API, so SHA digests need the whole file in memory: SHA is computed for files up to 2 GiB. MD5 and CRC32 stream chunk-by-chunk at any size.
- MD5 and SHA-1 are fine for integrity checksums but are not collision-resistant; prefer SHA-256 or stronger for security purposes.

## Test vectors

| Input | Algorithm | Hash |
|---|---|---|
| `abc` | SHA-256 | `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` |
| `abc` | MD5 | `900150983cd24fb0d6963f7d28e17f72` |
| `abc` | SHA-1 | `a9993e364706816aba3e25717850c26c9cd0d89d` |
| `123456789` | CRC32 | `cbf43926` |

## License

MIT
