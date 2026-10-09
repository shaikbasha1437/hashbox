/*! Incremental CRC-32 (IEEE 802.3, poly 0xEDB88320). MIT. */
(function (root) {
  'use strict';
  var T = new Int32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    T[n] = c;
  }
  function CRC32() { this.crc = -1; }
  CRC32.prototype.update = function (bytes) {
    var crc = this.crc;
    for (var i = 0, n = bytes.length; i < n; i++) crc = T[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    this.crc = crc;
    return this;
  };
  CRC32.prototype.digest = function () {
    var v = (this.crc ^ -1) >>> 0;
    return new Uint8Array([(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]);
  };
  root.CRC32 = CRC32;
  if (typeof module !== 'undefined' && module.exports) module.exports = CRC32;
})(typeof self !== 'undefined' ? self : globalThis);
