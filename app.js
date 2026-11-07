/* TAPE 13 — skeleton v0.
 * A 1992 tape answering machine in the browser. No backend, no dependencies.
 * Everything below is deliberately small: this is the scaffold Kiro extends.
 */
(function () {
  'use strict';

  var DB_NAME = 'tape13';
  var STORE = 'messages';
  var MAX_SECONDS = 60;

  var el = {
    machine: document.querySelector('.machine'),
    led: document.getElementById('led'),
    ledLabel: document.getElementById('ledLabel'),
    counter: document.getElementById('counter'),
    msgCount: document.getElementById('msgCount'),
    log: document.getElementById('log'),
    fxToggle: document.getElementById('fxToggle'),
    demoBtn: document.getElementById('demoBtn'),
    dropHint: document.getElementById('dropHint'),
    fileInput: document.getElementById('fileInput')
  };

  /* ------------------------------------------------------------------ *
   * IndexedDB — one store, blobs only. No sync, no server, no accounts.
   * ------------------------------------------------------------------ */

  var dbPromise = null;

  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(STORE, mode);
        var store = t.objectStore(STORE);
        var out = fn(store);
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error); };
      });
    });
  }

  function addMessage(record) {
    return tx('readwrite', function (store) { return store.add(record); });
  }

  function readAll() {
    return tx('readonly', function (store) { return store.getAll(); });
  }

  /* ------------------------------------------------------------------ *
   * Audio — a small tape-degradation chain.
   *   source -> saturate -> band-limit -> (wow/flutter on playbackRate) -> out
   *   hiss is mixed in parallel, because tape noise is not a filter.
   * ------------------------------------------------------------------ */

  var ac = null;
  var playing = null;

  function audio() {
    if (!ac) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      ac = new Ctor();
    }
    return ac;
  }

  function saturationCurve(amount) {
    var n = 1024;
    var curve = new Float32Array(n);
    var k = amount || 1.6;
    for (var i = 0; i < n; i++) {
      var x = (i * 2) / (n - 1) - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    return curve;
  }

  function hissBuffer(context, seconds) {
    var len = Math.floor(context.sampleRate * (seconds || 2));
    var buf = context.createBuffer(1, len, context.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    return buf;
  }

  function stopEverything() {
    if (!playing) return;
    try { playing.stop(); } catch (e) { /* already stopped */ }
    playing = null;
    setRunning('idle');
  }

  var LED_TEXT = {
    idle: 'STANDBY',
    rec: 'RECORDING',
    play: 'PLAYING',
    rew: 'REWIND',
    ff: 'FAST FWD'
  };

  function setRunning(state) {
    el.machine.dataset.running = state;
    el.led.dataset.state = state;
    el.ledLabel.textContent = LED_TEXT[state] || 'STANDBY';
  }

  function setCounter(n) {
    el.counter.textContent = String(Math.max(0, n)).padStart(3, '0');
  }

  /**
   * Play an AudioBuffer with or without the 1992 treatment.
   * Resolves when playback ends or is interrupted.
   */
  function playBuffer(buffer, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var context = audio();
      var src = context.createBufferSource();
      src.buffer = buffer;

      var useFx = el.fxToggle.checked;
      var tail = [];

      if (useFx) {
        var shaper = context.createWaveShaper();
        shaper.curve = saturationCurve(1.6);
        shaper.oversample = '2x';

        var band = context.createBiquadFilter();
        band.type = 'lowpass';
        band.frequency.value = 3200;
        band.Q.value = 0.7;

        var rumbleCut = context.createBiquadFilter();
        rumbleCut.type = 'highpass';
        rumbleCut.frequency.value = 180;

        src.connect(shaper);
        shaper.connect(band);
        band.connect(rumbleCut);
        rumbleCut.connect(context.destination);

        // wow (0.7 Hz, slow pitch drift) + flutter (6.3 Hz, fast shimmer)
        var wow = context.createOscillator();
        wow.frequency.value = 0.7;
        var wowDepth = context.createGain();
        wowDepth.gain.value = 0.006;
        wow.connect(wowDepth);
        wowDepth.connect(src.playbackRate);
        wow.start();
        tail.push(wow);

        var flutter = context.createOscillator();
        flutter.frequency.value = 6.3;
        var flutterDepth = context.createGain();
        flutterDepth.gain.value = 0.0018;
        flutter.connect(flutterDepth);
        flutterDepth.connect(src.playbackRate);
        flutter.start();
        tail.push(flutter);

        var hiss = context.createBufferSource();
        hiss.buffer = hissBuffer(context, 2);
        hiss.loop = true;
        var hissGain = context.createGain();
        hissGain.gain.value = 0.014;
        hiss.connect(hissGain);
        hissGain.connect(context.destination);
        hiss.start();
        tail.push(hiss);
      } else {
        src.connect(context.destination);
      }

      var done = false;
      function finish() {
        if (done) return;
        done = true;
        tail.forEach(function (node) {
          try { node.stop(); } catch (e) { /* ignore */ }
        });
        try { src.stop(); } catch (e) { /* ignore */ }
        if (playing && playing.id === opts.id) {
          playing = null;
          setRunning('idle');
        }
        resolve();
      }

      src.onended = finish;

      playing = {
        id: opts.id,
        stop: finish
      };

      setRunning(opts.state || 'play');
      if (opts.onStart) opts.onStart();
      src.start();
    });
  }

  /* ------------------------------------------------------------------ *
   * WAV helpers — used by the demo tape today, by export tomorrow.
   * ------------------------------------------------------------------ */

  function encodeWav(channels, sampleRate) {
    var frames = channels[0].length;
    var bytes = frames * channels.length * 2;
    var buf = new ArrayBuffer(44 + bytes);
    var view = new DataView(buf);

    function str(offset, s) {
      for (var i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    }

    str(0, 'RIFF');
    view.setUint32(4, 36 + bytes, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels.length, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels.length * 2, true);
    view.setUint16(32, channels.length * 2, true);
    view.setUint16(34, 16, true);
    str(36, 'data');
    view.setUint32(40, bytes, true);

    var offset = 44;
    for (var i = 0; i < frames; i++) {
      for (var c = 0; c < channels.length; c++) {
        var s = Math.max(-1, Math.min(1, channels[c][i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }
    return buf;
  }

  /**
   * Deterministic demo tones so judges can hear the chain without a mic.
   * Synthesised here on purpose: no third-party audio, no licensing risk.
   */
  function demoTake(which, sampleRate) {
    var seconds = which === 0 ? 2.6 : which === 1 ? 3.2 : 2.2;
    var n = Math.floor(sampleRate * seconds);
    var out = new Float32Array(n);

    for (var i = 0; i < n; i++) {
      var t = i / sampleRate;
      var env = Math.min(1, t / 0.06) * Math.max(0, 1 - Math.max(0, t - (seconds - 0.4)) / 0.4);

      if (which === 0) {
        // a slow three-note phrase, like someone speaking a name
        var steps = [220, 174, 262];
        var step = Math.min(2, Math.floor((t / (seconds - 0.4)) * 3));
        out[i] = Math.sin(2 * Math.PI * steps[step] * t) * 0.22 * env;
      } else if (which === 1) {
        // breath / wind
        out[i] = (Math.random() * 2 - 1) * 0.12 * env * (0.4 + 0.6 * Math.sin(t * 1.7));
      } else {
        // a telephone-ish pulse train
        var gate = (t * 7) % 1 < 0.45 ? 1 : 0;
        out[i] = (Math.sin(2 * Math.PI * 440 * t) * 0.16 + Math.sin(2 * Math.PI * 660 * t) * 0.06) * env * gate;
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Recording
   * ------------------------------------------------------------------ */

  var recorder = null;
  var recTimer = null;
  var recStartedAt = 0;

  function startRecording() {
    stopEverything();
    if (recorder) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      flash('NO MIC — use the demo tape instead');
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [];
      var mime = window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      try {
        recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch (e) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        flash('RECORDER UNAVAILABLE');
        return;
      }

      recorder.ondataavailable = function (ev) {
        if (ev.data && ev.data.size) chunks.push(ev.data);
      };

      recorder.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        var elapsed = Math.min(MAX_SECONDS, (Date.now() - recStartedAt) / 1000);
        var blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        recorder = null;
        if (!blob.size) return;
        addMessage({
          createdAt: Date.now(),
          seconds: Math.round(elapsed * 10) / 10,
          blob: blob,
          label: 'recorded'
        }).then(function () {
          refresh();
          setRunning('idle');
        });
      };

      recStartedAt = Date.now();
      recorder.start();
      setRunning('rec');
      clearTimeout(recTimer);
      recTimer = setTimeout(function () { stopRecording(); }, MAX_SECONDS * 1000);
      flash('TAP STOP TO END');
    }).catch(function () {
      flash('MIC DENIED — demo tape still works');
    });
  }

  function stopRecording() {
    clearTimeout(recTimer);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  /* ------------------------------------------------------------------ *
   * Tape log / playback order
   * ------------------------------------------------------------------ */

  var tape = [];
  var demoItems = [];
  var demoBuffers = {};
  var activeId = null;
  var playingIndex = null;

  function refresh() {
    return readAll().then(function (rows) {
      rows.sort(function (a, b) { return a.id - b.id; });
      var stored = rows.map(function (r) {
        return { id: 'msg-' + r.id, kind: 'msg', createdAt: r.createdAt, seconds: r.seconds, blob: r.blob, label: r.label };
      });
      tape = demoItems.concat(stored);
      render();
    });
  }

  function render() {
    el.msgCount.textContent = String(tape.length);
    el.log.innerHTML = '';

    if (!tape.length) {
      var empty = document.createElement('li');
      empty.className = 'log__empty';
      empty.textContent = 'NO MESSAGES — press REC, or load the demo tape';
      el.log.appendChild(empty);
      setCounter(0);
      return;
    }

    tape.forEach(function (item, i) {
      var row = document.createElement('li');
      row.className = 'log__row';
      row.dataset.active = String(activeId === item.id);

      var idx = document.createElement('span');
      idx.className = 'log__idx';
      idx.textContent = String(i + 1).padStart(2, '0');

      var label = document.createElement('span');
      label.textContent = item.label === 'demo' ? 'demo take' : item.label;

      var dur = document.createElement('span');
      dur.className = 'log__dur';
      dur.textContent = formatSeconds(item.seconds);

      row.appendChild(idx);
      row.appendChild(label);
      row.appendChild(dur);
      row.addEventListener('click', function () { playIndex(i); });
      el.log.appendChild(row);
    });

    if (activeId) {
      var at = tape.findIndex(function (t) { return t.id === activeId; });
      setCounter(at < 0 ? 0 : at + 1);
    } else {
      setCounter(0);
    }
  }

  function formatSeconds(s) {
    var total = Math.max(0, Math.round(s || 0));
    var m = Math.floor(total / 60);
    var r = total % 60;
    return m + ':' + String(r).padStart(2, '0');
  }

  function toAudioBuffer(item) {
    var context = audio();
    if (demoBuffers[item.id]) return Promise.resolve(demoBuffers[item.id]);

    if (item.kind === 'demo') {
      var samples = demoTake(item.which, context.sampleRate);
      var wav = encodeWav([samples], context.sampleRate);
      return context.decodeAudioData(wav).then(function (buf) {
        demoBuffers[item.id] = buf;
        return buf;
      });
    }

    return item.blob.arrayBuffer().then(function (buf) {
      return context.decodeAudioData(buf);
    });
  }

  function playIndex(i) {
    if (i < 0 || i >= tape.length) return;
    var item = tape[i];
    stopEverything();
    activeId = item.id;
    playingIndex = i;
    render();

    toAudioBuffer(item).then(function (buffer) {
      return playBuffer(buffer, { id: item.id });
    }).then(function () {
      // a real machine keeps rolling: move to the next message on the tape
      var next = i + 1;
      if (next < tape.length && activeId === item.id) {
        playIndex(next);
      } else {
        playingIndex = null;
        render();
      }
    }).catch(function () {
      flash('COULD NOT READ THAT TAPE');
      setRunning('idle');
    });
  }

  /* ------------------------------------------------------------------ *
   * Import an existing file (judges without a mic, and old tapes)
   * ------------------------------------------------------------------ */

  function importFile(file) {
    if (!file) return;
    var seconds = 0;
    var url = URL.createObjectURL(file);

    var probe = new Audio();
    probe.preload = 'metadata';
    probe.src = url;
    probe.onloadedmetadata = function () {
      seconds = isFinite(probe.duration) ? probe.duration : 0;
      URL.revokeObjectURL(url);
      addMessage({
        createdAt: Date.now(),
        seconds: Math.round(seconds * 10) / 10,
        blob: file,
        label: 'imported'
      }).then(function () { return refresh(); }).then(function () {
        flash('TAPE LOADED');
      });
    };
    probe.onerror = function () {
      URL.revokeObjectURL(url);
      flash('UNSUPPORTED FILE');
    };
  }

  /* ------------------------------------------------------------------ *
   * Demo tape — three synthesised takes, no microphone required.
   * ------------------------------------------------------------------ */

  function loadDemo() {
    demoItems = [0, 1, 2].map(function (which) {
      return {
        id: 'demo-' + which,
        kind: 'demo',
        which: which,
        createdAt: Date.now(),
        seconds: which === 0 ? 2.6 : which === 1 ? 3.2 : 2.2,
        label: 'demo'
      };
    });
    tape = demoItems.concat(tape);
    activeId = null;
    render();
    playIndex(0);
  }

  /* ------------------------------------------------------------------ *
   * Wiring
   * ------------------------------------------------------------------ */

  var flashTimer = null;
  function flash(text) {
    el.ledLabel.textContent = text;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () {
      el.ledLabel.textContent = LED_TEXT[el.led.dataset.state] || 'STANDBY';
    }, 2200);
  }

  document.querySelectorAll('.key').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.dataset.key;
      if (key === 'rec') {
        if (recorder) stopRecording(); else startRecording();
        return;
      }
      if (key === 'stop') {
        stopRecording();
        stopEverything();
        activeId = null;
        render();
        return;
      }
      if (!tape.length) { flash('TAPE EMPTY'); return; }
      var from = playingIndex === null ? 0 : playingIndex;
      if (key === 'play') playIndex(from);
      if (key === 'rew') { stopEverything(); playIndex(Math.max(0, from - 1)); }
      if (key === 'ff') { stopEverything(); playIndex(Math.min(tape.length - 1, from + 1)); }
    });
  });

  el.fxToggle.addEventListener('change', function () {
    var i = playingIndex;
    if (i === null) return;
    // A/B in place: the whole point of the project is hearing the difference.
    stopEverything();
    playIndex(i);
  });

  el.demoBtn.addEventListener('click', loadDemo);
  el.dropHint.addEventListener('click', function () { el.fileInput.click(); });
  el.fileInput.addEventListener('change', function (ev) {
    importFile(ev.target.files && ev.target.files[0]);
    ev.target.value = '';
  });

  ['dragenter', 'dragover'].forEach(function (type) {
    el.machine.addEventListener(type, function (ev) {
      ev.preventDefault();
      el.machine.dataset.dragover = 'true';
    });
  });

  ['dragleave', 'drop'].forEach(function (type) {
    el.machine.addEventListener(type, function (ev) {
      ev.preventDefault();
      el.machine.dataset.dragover = 'false';
    });
  });

  el.machine.addEventListener('drop', function (ev) {
    var file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    importFile(file);
  });

  window.addEventListener('keydown', function (ev) {
    // Buttons already answer Enter/Space natively; never hijack them here or a focused
    // REW/STOP press would also fire PLAY.
    if (ev.target && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(ev.target.tagName)) return;
    if (ev.code === 'Space') { ev.preventDefault(); document.querySelector('[data-key="play"]').click(); }
  });

  setRunning('idle');
  setCounter(0);
  refresh().catch(function () {
    el.log.innerHTML = '<li class="log__empty">STORAGE UNAVAILABLE — demo tape still works</li>';
  });
})();
