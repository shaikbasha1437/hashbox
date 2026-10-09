/* HashBox core: shared by the page and the worker. */
(function (root) {
  'use strict';
  var ALGOS = [
    { id: 'md5', label: 'MD5', hexLen: 32 },
    { id: 'sha1', label: 'SHA-1', subtle: 'SHA-1', hexLen: 40 },
    { id: 'sha256', label: 'SHA-256', subtle: 'SHA-256', hexLen: 64 },
    { id: 'sha384', label: 'SHA-384', subtle: 'SHA-384', hexLen: 96 },
    { id: 'sha512', label: 'SHA-512', subtle: 'SHA-512', hexLen: 128 },
    { id: 'crc32', label: 'CRC32', hexLen: 8 }
  ];
  var BY_ID = {};
  ALGOS.forEach(function (a) { BY_ID[a.id] = a; });
  var CHUNK = 4 * 1024 * 1024;
  // Web Crypto has no streaming digest, so SHA needs the whole file in one buffer.
  var SHA_MAX = 2 * 1024 * 1024 * 1024 - 1;

  function toHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return s;
  }

  function subtle() {
    var c = root.crypto;
    return c && c.subtle ? c.subtle : null;
  }

  async function hashBytes(bytes, algos) {
    var out = {};
    var jobs = algos.map(async function (id) {
      var a = BY_ID[id];
      if (!a) return;
      if (a.subtle) {
        var s = subtle();
        if (!s) { out[id] = { error: 'Web Crypto unavailable (needs HTTPS)' }; return; }
        out[id] = { hex: toHex(new Uint8Array(await s.digest(a.subtle, bytes))) };
      } else if (id === 'md5') {
        out[id] = { hex: toHex(new root.MD5().update(bytes).digest()) };
      } else if (id === 'crc32') {
        out[id] = { hex: toHex(new root.CRC32().update(bytes).digest()) };
      }
    });
    await Promise.all(jobs);
    return out;
  }

  /* Read a Blob in chunks; MD5/CRC32 update incrementally, SHA digests run on the assembled buffer. */
  async function hashBlob(blob, algos, onProgress, isCancelled) {
    var size = blob.size;
    var md5 = algos.indexOf('md5') >= 0 ? new root.MD5() : null;
    var crc = algos.indexOf('crc32') >= 0 ? new root.CRC32() : null;
    var shaIds = algos.filter(function (id) { return BY_ID[id] && BY_ID[id].subtle; });
    var out = {};
    var full = null;
    if (shaIds.length) {
      if (!subtle()) {
        shaIds.forEach(function (id) { out[id] = { error: 'Web Crypto unavailable (needs HTTPS)' }; });
        shaIds = [];
      } else if (size > SHA_MAX) {
        shaIds.forEach(function (id) { out[id] = { error: 'Skipped: file over 2 GiB (Web Crypto needs it in memory)' }; });
        shaIds = [];
      } else {
        try { full = new Uint8Array(size); } catch (e) {
          shaIds.forEach(function (id) { out[id] = { error: 'Skipped: not enough memory for this file' }; });
          shaIds = [];
        }
      }
    }
    var lastTick = 0;
    for (var off = 0; off < size; off += CHUNK) {
      if (isCancelled && isCancelled()) throw new Error('cancelled');
      var chunk = new Uint8Array(await blob.slice(off, Math.min(off + CHUNK, size)).arrayBuffer());
      if (md5) md5.update(chunk);
      if (crc) crc.update(chunk);
      if (full) full.set(chunk, off);
      var done = off + chunk.length;
      var now = Date.now();
      if (onProgress && (now - lastTick > 80 || done === size)) { lastTick = now; onProgress(done, size, 'read'); }
    }
    if (isCancelled && isCancelled()) throw new Error('cancelled');
    if (md5) out.md5 = { hex: toHex(md5.digest()) };
    if (crc) out.crc32 = { hex: toHex(crc.digest()) };
    if (shaIds.length) {
      if (onProgress) onProgress(size, size, 'digest');
      var buf = full || new Uint8Array(0);
      await Promise.all(shaIds.map(async function (id) {
        out[id] = { hex: toHex(new Uint8Array(await subtle().digest(BY_ID[id].subtle, buf))) };
      }));
    }
    return out;
  }

  var api = { ALGOS: ALGOS, BY_ID: BY_ID, CHUNK: CHUNK, SHA_MAX: SHA_MAX, toHex: toHex, hashBytes: hashBytes, hashBlob: hashBlob };
  root.HashCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
