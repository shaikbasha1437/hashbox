(function () {
  'use strict';
  var H = window.HashCore;
  var $ = function (id) { return document.getElementById(id); };
  var LS_ALGOS = 'hashbox.algos', LS_UPPER = 'hashbox.upper';

  var state = {
    algos: loadAlgos(),
    upper: localStorage.getItem(LS_UPPER) === '1',
    text: null,      // { result }
    files: [],       // { id, file, status, done, result, error, el }
    nextId: 1
  };

  function loadAlgos() {
    try {
      var v = JSON.parse(localStorage.getItem(LS_ALGOS) || 'null');
      if (Array.isArray(v) && v.length) return v.filter(function (id) { return H.BY_ID[id]; });
    } catch (e) {}
    return H.ALGOS.map(function (a) { return a.id; });
  }
  function orderedAlgos() { return H.ALGOS.map(function (a) { return a.id; }).filter(function (id) { return state.algos.indexOf(id) >= 0; }); }
  function fmt(hex) { return state.upper ? hex.toUpperCase() : hex; }
  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    var u = ['KiB', 'MiB', 'GiB', 'TiB'], i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return n.toFixed(n < 10 ? 2 : 1) + ' ' + u[i];
  }

  /* ---------- toast / copy ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 1300);
  }
  function copy(text) {
    if (!text) return;
    var done = function () { toast('Copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }

  /* ---------- algorithm chips ---------- */
  function renderChips() {
    var box = $('algoChips');
    box.textContent = '';
    H.ALGOS.forEach(function (a) {
      var lab = document.createElement('label');
      lab.className = 'chip';
      var inp = document.createElement('input');
      inp.type = 'checkbox'; inp.value = a.id; inp.checked = state.algos.indexOf(a.id) >= 0;
      inp.addEventListener('change', function () {
        var sel = Array.prototype.filter.call(box.querySelectorAll('input'), function (i) { return i.checked; }).map(function (i) { return i.value; });
        if (!sel.length) { inp.checked = true; toast('Keep at least one'); return; }
        state.algos = sel;
        localStorage.setItem(LS_ALGOS, JSON.stringify(sel));
        hashText();
        rehashFiles();
      });
      var sp = document.createElement('span'); sp.textContent = a.label;
      lab.appendChild(inp); lab.appendChild(sp);
      box.appendChild(lab);
    });
  }

  /* ---------- hash rows ---------- */
  function renderRows(container, result, algos, pending) {
    container.textContent = '';
    algos.forEach(function (id) {
      var a = H.BY_ID[id];
      var r = result && result[id];
      var row = document.createElement('div');
      row.className = 'hrow';
      row.dataset.algo = id;
      var k = document.createElement('div'); k.className = 'hkey'; k.textContent = a.label;
      var v = document.createElement('div'); v.className = 'hval';
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ghost sm'; btn.textContent = 'Copy';
      if (r && r.hex) {
        v.textContent = fmt(r.hex);
        row.dataset.hex = r.hex;
        btn.addEventListener('click', function () { copy(fmt(r.hex)); });
      } else if (r && r.error) {
        v.textContent = r.error; v.classList.add('err'); btn.disabled = true;
      } else {
        v.textContent = pending || '—'; v.classList.add('pending'); btn.disabled = true;
      }
      row.appendChild(k); row.appendChild(v); row.appendChild(btn);
      container.appendChild(row);
    });
    updateCompare();
  }

  /* ---------- text tab ---------- */
  var textSeq = 0, textTimer;
  function hashText() {
    clearTimeout(textTimer);
    textTimer = setTimeout(async function () {
      var seq = ++textSeq;
      var bytes = new TextEncoder().encode($('textInput').value);
      $('textMeta').textContent = bytes.length.toLocaleString() + (bytes.length === 1 ? ' byte' : ' bytes') + ' (UTF-8)';
      var algos = orderedAlgos();
      try {
        var res = await H.hashBytes(bytes, algos);
        if (seq !== textSeq) return;
        state.text = { result: res, algos: algos };
        renderRows($('textHashes'), res, algos);
      } catch (e) {
        if (seq !== textSeq) return;
        var errRes = {}; algos.forEach(function (id) { errRes[id] = { error: String(e.message || e) }; });
        renderRows($('textHashes'), errRes, algos);
      }
    }, 90);
  }
  $('textInput').addEventListener('input', hashText);
  $('sampleBtn').addEventListener('click', function () { $('textInput').value = 'abc'; hashText(); });
  $('clearTextBtn').addEventListener('click', function () { $('textInput').value = ''; hashText(); $('textInput').focus(); });
  $('copyAllTextBtn').addEventListener('click', function () {
    if (!state.text) return;
    copy(state.text.algos.filter(function (id) { return state.text.result[id] && state.text.result[id].hex; })
      .map(function (id) { return H.BY_ID[id].label + ': ' + fmt(state.text.result[id].hex); }).join('\n'));
  });

  /* ---------- tabs ---------- */
  function showTab(name) {
    var text = name === 'text';
    $('tabText').classList.toggle('active', text); $('tabText').setAttribute('aria-selected', String(text));
    $('tabFiles').classList.toggle('active', !text); $('tabFiles').setAttribute('aria-selected', String(!text));
    $('panelText').hidden = !text; $('panelFiles').hidden = text;
  }
  $('tabText').addEventListener('click', function () { showTab('text'); });
  $('tabFiles').addEventListener('click', function () { showTab('files'); });
  document.querySelector('.tabs').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      var toFiles = $('panelFiles').hidden;
      showTab(toFiles ? 'files' : 'text');
      (toFiles ? $('tabFiles') : $('tabText')).focus();
    }
  });

  /* ---------- file hashing engine (worker with main-thread fallback) ---------- */
  var worker = null, workerFailed = false;
  var pending = {}; // runId -> { onProgress, resolve, reject }
  var runCounter = 0;
  function getWorker() {
    if (worker || workerFailed) return worker;
    try {
      worker = new Worker('hash-worker.js');
      worker.onmessage = function (e) {
        var m = e.data, p = pending[m.id];
        if (!p) return;
        if (m.type === 'progress') p.onProgress(m.done, m.total, m.phase);
        else if (m.type === 'done') { delete pending[m.id]; p.resolve(m.result); }
        else if (m.type === 'error') { delete pending[m.id]; p.reject(new Error(m.message)); }
      };
      worker.onerror = function (ev) {
        ev.preventDefault && ev.preventDefault();
        workerFailed = true; worker = null;
        Object.keys(pending).forEach(function (id) { var p = pending[id]; delete pending[id]; p.retry(); });
      };
    } catch (e) { workerFailed = true; worker = null; }
    return worker;
  }
  function runHash(job, algos, onProgress) {
    return new Promise(function (resolve, reject) {
      var fallback = function () {
        H.hashBlob(job.file, algos, onProgress, function () { return job.cancelled; }).then(resolve, reject);
      };
      var w = getWorker();
      if (!w) return fallback();
      job.runId = ++runCounter;
      pending[job.runId] = { onProgress: onProgress, resolve: resolve, reject: reject, retry: fallback };
      w.postMessage({ type: 'hash', id: job.runId, file: job.file, algos: algos });
    });
  }
  function cancelJob(job) {
    job.cancelled = true;
    if (worker && job.runId && pending[job.runId]) worker.postMessage({ type: 'cancel', id: job.runId });
  }

  var queueRunning = false;
  async function pump() {
    if (queueRunning) return;
    queueRunning = true;
    try {
      var job;
      while ((job = state.files.find(function (f) { return f.status === 'queued'; }))) {
        await processJob(job);
      }
    } finally { queueRunning = false; }
  }

  async function processJob(job) {
    job.status = 'hashing'; job.cancelled = false; job.result = null; job.error = null;
    var algos = orderedAlgos();
    job.algos = algos;
    var t0 = performance.now();
    renderFile(job);
    try {
      var res = await runHash(job, algos, function (done, total, phase) {
        var pct = total ? (done / total) * 100 : 100;
        job.el.bar.style.width = pct.toFixed(1) + '%';
        job.el.status.textContent = phase === 'digest' ? 'Finishing SHA digests…' : 'Reading ' + fmtSize(done) + ' of ' + fmtSize(total) + ' (' + Math.floor(pct) + '%)';
      });
      if (job.removed) return;
      if (job.requeue) { job.requeue = false; job.status = 'queued'; renderFile(job); return; }
      job.status = 'done'; job.result = res;
      job.secs = (performance.now() - t0) / 1000;
    } catch (e) {
      if (job.removed) return;
      if (job.requeue) { job.requeue = false; job.status = 'queued'; renderFile(job); return; }
      job.status = job.cancelled ? 'cancelled' : 'error';
      job.error = job.cancelled ? 'Cancelled' : String(e.message || e);
    }
    renderFile(job);
  }

  function addFiles(list) {
    var arr = Array.prototype.slice.call(list || []);
    if (!arr.length) return;
    showTab('files');
    arr.forEach(function (file) {
      var job = { id: state.nextId++, file: file, status: 'queued' };
      state.files.push(job);
      buildFileEl(job);
      renderFile(job);
    });
    $('fileToolbar').hidden = false;
    pump();
  }

  function buildFileEl(job) {
    var wrap = document.createElement('div'); wrap.className = 'file';
    var head = document.createElement('div'); head.className = 'file-head';
    var name = document.createElement('div'); name.className = 'file-name'; name.textContent = job.file.name || '(unnamed)';
    var size = document.createElement('div'); size.className = 'file-size'; size.textContent = fmtSize(job.file.size);
    var act = document.createElement('button'); act.type = 'button'; act.className = 'ghost sm';
    var copyAll = document.createElement('button'); copyAll.type = 'button'; copyAll.className = 'ghost sm'; copyAll.textContent = 'Copy all';
    head.appendChild(name); head.appendChild(size); head.appendChild(copyAll); head.appendChild(act);
    var prog = document.createElement('div'); prog.className = 'progress';
    var bar = document.createElement('i'); prog.appendChild(bar);
    var status = document.createElement('div'); status.className = 'file-status';
    var hashes = document.createElement('div'); hashes.className = 'hashes';
    wrap.appendChild(head); wrap.appendChild(prog); wrap.appendChild(status); wrap.appendChild(hashes);
    $('fileList').appendChild(wrap);
    job.el = { wrap: wrap, act: act, copyAll: copyAll, prog: prog, bar: bar, status: status, hashes: hashes };
    act.addEventListener('click', function () {
      if (job.status === 'hashing') cancelJob(job);
      else if (job.status === 'cancelled' || job.status === 'error') { job.status = 'queued'; renderFile(job); pump(); }
      else removeJob(job);
    });
    copyAll.addEventListener('click', function () {
      if (!job.result) return;
      copy(job.algos.filter(function (id) { return job.result[id] && job.result[id].hex; })
        .map(function (id) { return H.BY_ID[id].label + ': ' + fmt(job.result[id].hex); }).join('\n'));
    });
  }

  function removeJob(job) {
    job.removed = true;
    if (job.status === 'hashing') cancelJob(job);
    job.el.wrap.remove();
    state.files = state.files.filter(function (f) { return f !== job; });
    if (!state.files.length) $('fileToolbar').hidden = true;
    updateCompare();
  }

  function renderFile(job) {
    var el = job.el, s = job.status;
    el.prog.hidden = s === 'done';
    el.copyAll.hidden = s !== 'done';
    el.act.textContent = s === 'hashing' ? 'Cancel' : (s === 'cancelled' || s === 'error') ? 'Retry' : 'Remove';
    if (s === 'queued') { el.bar.style.width = '0'; el.status.textContent = 'Queued'; renderRows(el.hashes, null, orderedAlgos(), 'waiting…'); }
    else if (s === 'hashing') { el.status.textContent = 'Starting…'; renderRows(el.hashes, null, job.algos, 'hashing…'); }
    else if (s === 'done') {
      el.status.textContent = 'Done in ' + (job.secs < 1 ? Math.round(job.secs * 1000) + ' ms' : job.secs.toFixed(1) + ' s');
      renderRows(el.hashes, job.result, job.algos);
    } else { el.status.textContent = job.error; renderRows(el.hashes, null, job.algos || orderedAlgos(), '—'); }
  }

  function rehashFiles() {
    state.files.forEach(function (job) {
      if (job.status === 'hashing') { job.requeue = true; cancelJob(job); }
      else { job.status = 'queued'; renderFile(job); }
    });
    pump();
  }

  var drop = $('drop'), fileInput = $('fileInput');
  drop.addEventListener('click', function () { fileInput.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  $('addFilesBtn').addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () { addFiles(fileInput.files); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) {
        e.preventDefault(); drop.classList.add('over');
      }
    });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (ev === 'dragleave' && e.relatedTarget) return;
      drop.classList.remove('over');
    });
  });
  document.addEventListener('drop', function (e) {
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  });
  $('clearFilesBtn').addEventListener('click', function () { state.files.slice().forEach(removeJob); });
  $('copyAllFilesBtn').addEventListener('click', function () {
    var done = state.files.filter(function (f) { return f.status === 'done'; });
    if (!done.length) return toast('Nothing hashed yet');
    var lines = [];
    orderedAlgos().forEach(function (id) {
      var rows = done.filter(function (f) { return f.result[id] && f.result[id].hex; });
      if (!rows.length) return;
      lines.push('# ' + H.BY_ID[id].label);
      rows.forEach(function (f) { lines.push(fmt(f.result[id].hex) + '  ' + f.file.name); });
      lines.push('');
    });
    copy(lines.join('\n').trim());
  });

  /* ---------- compare ---------- */
  function updateCompare() {
    var raw = $('expected').value;
    var exp = raw.replace(/^\s*(md5|sha-?1|sha-?256|sha-?384|sha-?512|crc-?32)\s*[:=]\s*/i, '').replace(/[\s:-]/g, '').toLowerCase();
    // accept "hash  filename" lines
    var m = raw.trim().match(/^([0-9a-fA-F]{8,128})\s+\*?\S/);
    if (m) exp = m[1].toLowerCase();
    var st = $('compareStatus');
    document.querySelectorAll('.hrow.match').forEach(function (r) { r.classList.remove('match'); });
    if (!exp) { st.hidden = true; return; }
    st.hidden = false;
    if (!/^[0-9a-f]+$/.test(exp)) { st.className = 'status warn'; st.textContent = 'That doesn’t look like a hex hash.'; return; }
    var guess = H.ALGOS.filter(function (a) { return a.hexLen === exp.length; }).map(function (a) { return a.label; });
    var rows = document.querySelectorAll('.hrow[data-hex]');
    var hits = [];
    rows.forEach(function (r) {
      if (r.dataset.hex === exp) {
        r.classList.add('match');
        var where = r.closest('.file');
        hits.push(H.BY_ID[r.dataset.algo].label + (where ? ' · ' + where.querySelector('.file-name').textContent : ' · text'));
      }
    });
    if (hits.length) { st.className = 'status ok'; st.textContent = '✓ Match — ' + hits.join(', '); }
    else if (!rows.length) { st.className = 'status warn'; st.textContent = 'Nothing hashed yet' + (guess.length ? ' — looks like ' + guess.join('/') : '') + '.'; }
    else {
      st.className = 'status err';
      st.textContent = '✗ Mismatch — no computed hash equals this value' +
        (guess.length ? ' (length suggests ' + guess.join('/') + (orderedAlgos().some(function (id) { return guess.indexOf(H.BY_ID[id].label) >= 0; }) ? '' : ', which is turned off') + ')' : ' (unusual length: ' + exp.length + ' hex chars)') + '.';
    }
  }
  $('expected').addEventListener('input', updateCompare);

  /* ---------- uppercase ---------- */
  $('upperToggle').checked = state.upper;
  $('upperToggle').addEventListener('change', function () {
    state.upper = $('upperToggle').checked;
    localStorage.setItem(LS_UPPER, state.upper ? '1' : '0');
    if (state.text) renderRows($('textHashes'), state.text.result, state.text.algos);
    state.files.forEach(renderFile);
  });

  renderChips();
  hashText();
})();
