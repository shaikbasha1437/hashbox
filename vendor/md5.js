/*! Incremental MD5 — small self-contained implementation (RFC 1321). MIT. */
(function (root) {
  'use strict';
  var K = new Int32Array(64);
  for (var i = 0; i < 64; i++) K[i] = (Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
  var S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  var M = new Int32Array(16);

  function MD5() {
    this.h = new Int32Array([0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476]);
    this.buf = new Uint8Array(64);
    this.bufLen = 0;
    this.len = 0; // total bytes
  }

  MD5.prototype._block = function (x, o) {
    for (var j = 0; j < 16; j++, o += 4) {
      M[j] = x[o] | (x[o + 1] << 8) | (x[o + 2] << 16) | (x[o + 3] << 24);
    }
    var h = this.h, a = h[0], b = h[1], c = h[2], d = h[3], f, g, t;
    for (var i = 0; i < 64; i++) {
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) & 15; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) & 15; }
      else { f = c ^ (b | ~d); g = (7 * i) & 15; }
      f = (f + a + K[i] + M[g]) | 0;
      a = d; d = c; c = b;
      t = S[i];
      b = (b + ((f << t) | (f >>> (32 - t)))) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
  };

  MD5.prototype.update = function (bytes) {
    var n = bytes.length, i = 0;
    this.len += n;
    if (this.bufLen) {
      while (i < n && this.bufLen < 64) this.buf[this.bufLen++] = bytes[i++];
      if (this.bufLen === 64) { this._block(this.buf, 0); this.bufLen = 0; }
    }
    for (; i + 64 <= n; i += 64) this._block(bytes, i);
    while (i < n) this.buf[this.bufLen++] = bytes[i++];
    return this;
  };

  MD5.prototype.digest = function () {
    var bits = this.len * 8;
    var padLen = ((this.bufLen < 56) ? 56 : 120) - this.bufLen;
    var pad = new Uint8Array(padLen + 8);
    pad[0] = 0x80;
    var lo = bits >>> 0, hi = Math.floor(bits / 4294967296) >>> 0;
    for (var k = 0; k < 4; k++) {
      pad[padLen + k] = (lo >>> (8 * k)) & 0xff;
      pad[padLen + 4 + k] = (hi >>> (8 * k)) & 0xff;
    }
    var savedLen = this.len;
    this.update(pad);
    this.len = savedLen;
    var out = new Uint8Array(16);
    for (var w = 0; w < 4; w++) for (var q = 0; q < 4; q++) out[w * 4 + q] = (this.h[w] >>> (8 * q)) & 0xff;
    return out;
  };

  root.MD5 = MD5;
  if (typeof module !== 'undefined' && module.exports) module.exports = MD5;
})(typeof self !== 'undefined' ? self : globalThis);
