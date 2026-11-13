// Sound recordings, cleaned of what the phone or recorder wrote into them, without
// re-encoding: the sound itself is not touched, byte for byte. One copy, used twice: in the
// editor's browser before upload (a recording picked in the editor is replaced by its
// cleaned copy, so nothing identifying reaches the repository), and in the build, which
// cleans again before publishing and reads each recording's length (site/_includes/blocks.js).
//
// MP3   the ID3v2 tag at the start, and the ID3v1 and APE tags at the end, are removed. They
//       are where an app writes titles, names, comments, dates, the phone's software and
//       anything else. The MPEG frames that follow are kept exactly.
// M4A   (also MP4 and 3GP audio, the containers iPhone and Android recorders use) every
//       metadata box (udta, which can hold the location in ©xyz or loci, and meta, uuid and
//       XMP boxes) is turned into an empty "free" box of the same size, and the creation
//       and modification times in the movie, track and media headers are set to zero. No
//       box moves, so the offsets the player uses still point at the same sound.
// WAV   only the format and sound chunks are kept; LIST/INFO, bext (originator, date and
//       time), iXML, axml and every other chunk is dropped.
// Anything else (Ogg, Opus, WebM, WMA, FLAC, AIFF, AMR...) is refused: ask for MP3 or M4A.
(function () {
  var REFUSE_MSG = 'Save or export the recording as MP3 or M4A and upload that instead.';
  var CANNOT = ', which the website cannot clean of the details the phone or recorder put in it (sometimes where it was made), so it has not been uploaded.\n\n';
  var str = function (b, o, n) { var s = ''; for (var i = 0; i < n; i++) s += String.fromCharCode(b[o + i]); return s; };
  var u32 = function (b, o) { return ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]; };
  var le32 = function (b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; };

  // 'mp3' | 'mp4' | 'wav', or the name of a format that is refused, or ''
  function kind(b, name) {
    var ext = (/\.([a-z0-9]+)$/i.exec(name || '') || [])[1] || '';
    if (b.length >= 12 && str(b, 4, 4) === 'ftyp') return 'mp4';
    if (b.length >= 12 && str(b, 0, 4) === 'RIFF' && str(b, 8, 4) === 'WAVE') return 'wav';
    if (str(b, 0, 4) === 'OggS') return 'Ogg or Opus';
    if (b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return 'WebM';
    if (b[0] === 0x30 && b[1] === 0x26 && b[2] === 0xB2 && b[3] === 0x75) return 'WMA';
    if (str(b, 0, 4) === 'fLaC') return 'FLAC';
    if (str(b, 0, 4) === 'FORM') return 'AIFF';
    if (str(b, 0, 5) === '#!AMR') return 'AMR';
    if (str(b, 0, 3) === 'ID3' || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)) return 'mp3';
    return /^(ogg|opus|oga|webm|wma|flac|aif|aiff|amr|caf)$/i.test(ext) ? ext.toUpperCase() : '';
  }
  function isAudioName(name) { return /\.(mp3|m4a|mp4|3gp|aac|wav|ogg|opus|oga|webm|wma|flac|aif|aiff|amr|caf)$/i.test(name || ''); }

  // ---- MP3 ----
  function id3Size(b, o) { return 10 + ((b[o + 6] & 127) << 21 | (b[o + 7] & 127) << 14 | (b[o + 8] & 127) << 7 | (b[o + 9] & 127)) + ((b[o + 5] & 0x10) ? 10 : 0); }
  function cleanMp3(b) {
    var start = 0, end = b.length, removed = [];
    while (end - start > 10 && str(b, start, 3) === 'ID3') {
      var n = id3Size(b, start);
      var frames = [], o = start + 10;
      while (o + 10 < start + n && /^[A-Z0-9]{4}$/.test(str(b, o, 4))) { frames.push(str(b, o, 4)); o += 10 + u32(b, o + 4); }
      removed.push('ID3v2 tag' + (frames.length ? ' (' + frames.join(', ') + ')' : ''));
      start += n;
    }
    if (end - start > 128 && str(b, end - 128, 3) === 'TAG') { end -= 128; removed.push('ID3v1 tag'); }
    if (end - start > 32 && str(b, end - 32, 8) === 'APETAGEX') { end -= 32 + le32(b, end - 20); removed.push('APE tag'); }
    return { bytes: b.slice(start, end), removed: removed };
  }
  var BITRATES = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
  var RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
  function mp3Seconds(b) {
    var o = 0;
    while (o + 4 < b.length && !(b[o] === 0xFF && (b[o + 1] & 0xE6) === 0xE2)) o++;  // layer III frame sync
    if (o + 4 >= b.length) return null;
    var ver = (b[o + 1] >> 3) & 3, mono = ((b[o + 3] >> 6) & 3) === 3;
    var kbps = BITRATES[ver === 3 ? 1 : 2][b[o + 2] >> 4], rate = RATES[ver][(b[o + 2] >> 2) & 3];
    var perFrame = ver === 3 ? 1152 : 576;
    var side = ver === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17);
    var x = o + 4 + side, tag = str(b, x, 4);
    if ((tag === 'Xing' || tag === 'Info') && (b[x + 7] & 1)) return u32(b, x + 8) * perFrame / rate;
    if (str(b, o + 36, 4) === 'VBRI') return u32(b, o + 36 + 14) * perFrame / rate;
    return kbps ? (b.length - o) * 8 / (kbps * 1000) : null;
  }

  // ---- MP4 / M4A / 3GP ----
  var BLANK = { udta: 1, meta: 1, uuid: 1, XMP_: 1 };
  var CONTAINERS = { moov: 1, trak: 1, mdia: 1, minf: 1, stbl: 1, edts: 1, dinf: 1 };
  var TIMES = { mvhd: 1, tkhd: 1, mdhd: 1 };
  function walk(b, from, to, fn) {
    for (var o = from; o + 8 <= to;) {
      var size = u32(b, o), type = str(b, o + 4, 4), head = 8;
      if (size === 1) { size = u32(b, o + 8) * 4294967296 + u32(b, o + 12); head = 16; } else if (size === 0) size = to - o;
      if (size < head || o + size > to) break;
      fn(o, size, type, head);
      o += size;
    }
  }
  function cleanMp4(b) {
    var out = b.slice(), removed = [];
    (function go(from, to, depth) {
      walk(out, from, to, function (o, size, type, head) {
        if (BLANK[type]) {
          for (var i = o + head; i < o + size; i++) out[i] = 0;
          out[o + 4] = 0x66; out[o + 5] = 0x72; out[o + 6] = 0x65; out[o + 7] = 0x65;  // "free"
          removed.push(type + ' box');
        } else if (TIMES[type]) {
          var n = out[o + head] === 1 ? 16 : 8;  // creation and modification times
          for (var j = o + head + 4; j < o + head + 4 + n; j++) out[j] = 0;
          removed.push(type + ' times');
        } else if (CONTAINERS[type] && depth < 8) go(o + head, o + size, depth + 1);
      });
    })(0, out.length, 0);
    return { bytes: out, removed: removed };
  }
  function mp4Seconds(b) {
    var secs = null;
    (function go(from, to) {
      walk(b, from, to, function (o, size, type, head) {
        if (type === 'moov') go(o + head, o + size);
        else if (type === 'mvhd') {
          var v1 = b[o + head] === 1, ts = u32(b, o + head + (v1 ? 20 : 12));
          var dur = v1 ? u32(b, o + head + 24) * 4294967296 + u32(b, o + head + 28) : u32(b, o + head + 16);
          if (ts) secs = dur / ts;
        }
      });
    })(0, b.length);
    return secs;
  }

  // ---- WAV ----
  function cleanWav(b) {
    var keep = [], removed = [], o = 12, byteRate = 0;
    while (o + 8 <= b.length) {
      var id = str(b, o, 4), n = le32(b, o + 4), whole = 8 + n + (n & 1);
      if (id === 'fmt ' || id === 'data' || id === 'fact') keep.push(b.slice(o, Math.min(o + whole, b.length)));
      else removed.push(id.trim() + ' chunk');
      if (id === 'fmt ') byteRate = le32(b, o + 16);
      o += whole;
    }
    var total = keep.reduce(function (s, c) { return s + c.length; }, 4);
    var out = new Uint8Array(8 + total);
    out.set([0x52, 0x49, 0x46, 0x46, total & 255, (total >> 8) & 255, (total >> 16) & 255, (total >>> 24) & 255, 0x57, 0x41, 0x56, 0x45]);
    var at = 12;
    keep.forEach(function (c) { out.set(c, at); at += c.length; });
    return { bytes: out, removed: removed, byteRate: byteRate };
  }
  function wavSeconds(b) {
    var o = 12, rate = 0;
    while (o + 8 <= b.length) {
      var id = str(b, o, 4), n = le32(b, o + 4);
      if (id === 'fmt ') rate = le32(b, o + 16);
      if (id === 'data' && rate) return n / rate;
      o += 8 + n + (n & 1);
    }
    return null;
  }

  // Clean a recording: { ok, kind, bytes, removed, seconds } or { ok: false, why }
  function clean(bytes, name) {
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var k = kind(b, name);
    var r;
    if (k === 'mp3') { r = cleanMp3(b); r.seconds = mp3Seconds(r.bytes); }
    else if (k === 'mp4') { r = cleanMp4(b); r.seconds = mp4Seconds(r.bytes); }
    else if (k === 'wav') { r = cleanWav(b); r.seconds = wavSeconds(r.bytes); }
    else return { ok: false, why: 'This recording is ' + (k ? 'in the ' + k + ' format' : 'not in a format the website knows') + CANNOT + REFUSE_MSG };
    if (!r.seconds) return { ok: false, why: 'This recording could not be read, so it has not been uploaded.\n\n' + REFUSE_MSG };
    r.ok = true; r.kind = k;
    return r;
  }
  // 7 minutes 34 seconds -> "7:34"
  function length(seconds) { var s = Math.round(seconds); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  var api = { clean: clean, kind: kind, length: length, isAudioName: isAudioName, REFUSE_MSG: REFUSE_MSG };
  if (typeof window === 'undefined') { module.exports = api; return; }
  window.CairdeAudio = api;

  // In the editor: a recording picked for upload is replaced by its cleaned copy; a format
  // that cannot be cleaned is refused with the reason, as iPhone HEIC photos are
  var passing = false;
  addEventListener('change', function (e) {
    var input = e.target;
    if (passing || !input || input.type !== 'file' || !input.files || !input.files.length) return;
    var files = Array.prototype.slice.call(input.files);
    if (!files.some(function (f) { return isAudioName(f.name) || /^audio\//.test(f.type); })) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    Promise.all(files.map(function (f) {
      if (!(isAudioName(f.name) || /^audio\//.test(f.type))) return f;
      return f.arrayBuffer().then(function (buf) {
        var r = clean(new Uint8Array(buf), f.name);
        if (!r.ok) throw new Error(r.why);
        var ext = { mp3: '.mp3', mp4: '.m4a', wav: '.wav' }[r.kind];
        var name = f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[^\w.-]+/g, '-') + ext;
        return new File([r.bytes], name, { type: { mp3: 'audio/mpeg', mp4: 'audio/mp4', wav: 'audio/wav' }[r.kind], lastModified: Date.now() });
      });
    })).then(function (out) {
      var dt = new DataTransfer();
      out.forEach(function (f) { dt.items.add(f); });
      input.files = dt.files;
      passing = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      passing = false;
    }, function (err) {
      input.value = '';
      alert(err.message);
    });
  }, true);
  function refuse(e, files) {
    if (!files || !Array.prototype.some.call(files, function (f) { return isAudioName(f.name); })) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    alert('Please use the Upload button to add a recording, so the details in it can be removed first.');
  }
  addEventListener('drop', function (e) { refuse(e, e.dataTransfer && e.dataTransfer.files); }, true);
  addEventListener('paste', function (e) { refuse(e, e.clipboardData && e.clipboardData.files); }, true);
})();
