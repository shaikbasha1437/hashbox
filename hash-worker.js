/* Hashes files off the main thread so the page stays responsive. */
importScripts('vendor/md5.js', 'vendor/crc32.js', 'hashcore.js');
var cancelled = new Set();
self.onmessage = async function (e) {
  var m = e.data || {};
  if (m.type === 'cancel') { cancelled.add(m.id); return; }
  if (m.type !== 'hash') return;
  var id = m.id;
  try {
    var res = await self.HashCore.hashBlob(m.file, m.algos, function (done, total, phase) {
      self.postMessage({ type: 'progress', id: id, done: done, total: total, phase: phase });
    }, function () { return cancelled.has(id); });
    self.postMessage({ type: 'done', id: id, result: res });
  } catch (err) {
    self.postMessage({ type: 'error', id: id, message: cancelled.has(id) ? 'cancelled' : String(err && err.message || err) });
  } finally {
    cancelled.delete(id);
  }
};
