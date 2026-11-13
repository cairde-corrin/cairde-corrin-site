// Photos are shrunk and re-encoded here, in the editor's browser, before Decap uploads
// them: at most 2000 px on the long side, as WebP, or JPEG where the browser cannot write
// WebP (Safari). Drawing a photo onto a canvas and encoding the canvas keeps only the
// pixels, so the location, time and camera details the phone stored never leave the
// device and never reach the repository. The camera's rotation is applied first, since
// the rotation tag is dropped with the rest.
//
// This runs in the capture phase, ahead of Decap's own handlers. It takes the files from
// the file picker, puts the re-encoded copies back in the same input and lets Decap's
// normal upload carry on with them. HEIC photos are converted where the browser can read
// them (Safari) and refused with an explanation where it cannot. Photos dropped or pasted
// onto the page are refused, so nothing reaches Decap without passing through here.
//
// Before the location is dropped it is read, for the editor only: where a JPEG was taken,
// which way the camera faced and when (exif() below). It stays in this browser tab, kept
// against the name of the cleaned copy, and the photo field (editor.js) shows it and offers
// to fill in the stop's position, direction and time, or the small line under a photo. The
// uploaded copy carries none of it.
(function () {
  var LONG_SIDE = 2000, QUALITY = 0.85;
  var HEIC_MSG = 'This photo is in Apple’s HEIC format, which this browser cannot read, ' +
    'so it has not been uploaded.\n\nOn an iPhone, choose it again from Photo Library ' +
    'rather than Choose File. On a computer, upload a JPEG copy instead.';
  var READ_MSG = 'This file could not be read as a photo, so it has not been uploaded. ' +
    'Please choose a JPEG, PNG or WebP photo.';
  var DROP_MSG = 'Please add photos with the Choose an image button rather than by dragging ' +
    'or pasting them: that is how the website removes the location stored in the photo.';
  function isHeic(f) { return /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name); }
  function isImage(f) { return /^image\//i.test(f.type) || /\.(jpe?g|png|webp|hei[cf]|tiff?|bmp)$/i.test(f.name); }

  function load(file) {
    return new Promise(function (ok, fail) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); ok(img); };
      img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('unreadable')); };
      img.src = url;  // an <img> applies the camera's rotation tag when it is drawn
    });
  }
  function encode(canvas, type) {
    return new Promise(function (ok) { canvas.toBlob(ok, type, QUALITY); });
  }
  // A canvas holds no location, but some browsers add metadata of their own when they
  // encode it (Safari writes a small Exif and Photoshop block into every JPEG). Drop all
  // of it: in a JPEG every APP1-APP15 segment and comment, keeping only JFIF (APP0) and
  // the colour profile (APP2); in a WebP the EXIF and XMP chunks.
  function strip(b, type) {
    var out = [], i, n, m;
    if (type === 'image/jpeg' && b[0] === 0xFF && b[1] === 0xD8) {
      out.push(b.subarray(0, 2)); i = 2;
      while (i + 4 <= b.length && b[i] === 0xFF) {
        m = b[i + 1];
        if (m === 0xDA) break;                          // image data follows: keep the rest
        n = (b[i + 2] << 8) | b[i + 3];
        if (!((m >= 0xE1 && m <= 0xEF && m !== 0xE2) || m === 0xFE)) out.push(b.subarray(i, i + 2 + n));
        i += 2 + n;
      }
      out.push(b.subarray(i));
    } else if (type === 'image/webp' && b.length > 12) {
      out.push(b.slice(0, 12)); i = 12;
      while (i + 8 <= b.length) {
        var id = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
        n = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24);
        var chunk = b.slice(i, i + 8 + n + (n & 1));
        if (id === 'VP8X') chunk[8] &= ~0x0C;           // clear the "has EXIF / XMP" flags
        if (id !== 'EXIF' && id !== 'XMP ') out.push(chunk);
        i += 8 + n + (n & 1);
      }
      var size = out.reduce(function (s, c) { return s + c.length; }, 0) - 8;
      out[0][4] = size & 255; out[0][5] = (size >> 8) & 255; out[0][6] = (size >> 16) & 255; out[0][7] = (size >> 24) & 255;
    } else return b;
    return new Blob(out, { type: type });
  }
  // Where, which way and when a JPEG was taken, from its Exif block: { lat, lon, facing,
  // taken: 'YYYY-MM-DD HH:MM' } with whichever of these the camera wrote, or null. The time
  // is the camera's own clock, as it showed it.
  function exif(b) {
    if (!(b && b[0] === 0xFF && b[1] === 0xD8)) return null;
    var i = 2, n;
    while (i + 4 <= b.length && b[i] === 0xFF && b[i + 1] !== 0xDA) {
      n = (b[i + 2] << 8) | b[i + 3];
      if (b[i + 1] === 0xE1 && String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]) === 'Exif') return tiff(b.subarray(i + 10, i + 2 + n));
      i += 2 + n;
    }
    return null;
  }
  function tiff(t) {
    if (t.length < 8) return null;
    var le = t[0] === 0x49;
    var u16 = function (o) { return le ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1]; };
    var u32 = function (o) { return (le ? (t[o] | (t[o + 1] << 8) | (t[o + 2] << 16)) + t[o + 3] * 16777216 : t[o] * 16777216 + ((t[o + 1] << 16) | (t[o + 2] << 8) | t[o + 3])); };
    // an IFD's entries by tag: { type, count, at } where at is the value or its offset
    function ifd(o) {
      var out = {};
      if (!(o > 0 && o + 2 <= t.length)) return out;
      for (var k = 0, c = u16(o); k < c && o + 14 + k * 12 <= t.length; k++) {
        var e = o + 2 + k * 12, type = u16(e + 2), count = u32(e + 4), size = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8][type] * count || 0;
        out[u16(e)] = { type: type, count: count, at: size <= 4 ? e + 8 : u32(e + 8) };
      }
      return out;
    }
    var rat = function (o) { var d = u32(o + 4); return d ? u32(o) / d : NaN; };
    var str = function (x) { var s = ''; for (var k = 0; x && k < x.count && x.at + k < t.length && t[x.at + k]; k++) s += String.fromCharCode(t[x.at + k]); return s; };
    var dms = function (x) { return x && x.type === 5 && x.count >= 3 && x.at + 24 <= t.length ? rat(x.at) + rat(x.at + 8) / 60 + rat(x.at + 16) / 3600 : NaN; };
    var root = ifd(u32(4)), info = {};
    var ex = root[0x8769] ? ifd(u32(root[0x8769].at)) : {}, gps = root[0x8825] ? ifd(u32(root[0x8825].at)) : {};
    var when = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d)/.exec(str(ex[0x9003]) || str(root[0x0132]));
    if (when) info.taken = when[1] + '-' + when[2] + '-' + when[3] + ' ' + when[4] + ':' + when[5];
    var lat = dms(gps[2]), lon = dms(gps[4]);
    if (isFinite(lat) && isFinite(lon) && (lat || lon)) {
      info.lat = str(gps[1]) === 'S' ? -lat : lat;
      info.lon = str(gps[3]) === 'W' ? -lon : lon;
    }
    var dir = gps[17] && gps[17].type === 5 && gps[17].at + 8 <= t.length ? rat(gps[17].at) : NaN;
    if (isFinite(dir)) info.facing = Math.round(dir) % 360;
    return Object.keys(info).length ? info : null;
  }

  // What was read from each cleaned copy, by its file name, for the photo field
  var found = {};
  function shrink(file) {
    if (!isImage(file) || /gif$/i.test(file.type)) return Promise.resolve(file);
    var info = null;
    return file.slice(0, 262144).arrayBuffer().then(function (head) {
      try { info = exif(new Uint8Array(head)); } catch (e) { info = null; }
      return load(file);
    }).then(function (img) {
      var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, LONG_SIDE / Math.max(w, h));
      var c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      var g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, c.width, c.height);
      return encode(c, 'image/webp').then(function (blob) {
        if (blob && blob.type === 'image/webp') return blob;
        g.globalCompositeOperation = 'destination-over';  // JPEG has no transparency
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        return encode(c, 'image/jpeg');
      });
    }).then(function (blob) {
      return blob.arrayBuffer().then(function (buf) {
        var clean = strip(new Uint8Array(buf), blob.type);
        return clean instanceof Blob ? clean : new Blob([clean], { type: blob.type });
      });
    }).then(function (blob) {
      var ext = blob.type === 'image/webp' ? '.webp' : '.jpg';
      var name = file.name.replace(/\.[^.]*$/, '') + ext;
      if (info) found[key(name)] = info;
      return new File([blob], name, { type: blob.type, lastModified: Date.now() });
    });
  }

  // Decap saves an upload under its name in lower case with unusual characters changed, so
  // names are compared by their letters and digits only
  function key(name) { return String(name).split('/').pop().toLowerCase().replace(/[^a-z0-9]/g, ''); }

  // Loaded by tools/selftest.js in Node to test strip() and exif(); nothing below runs there.
  if (typeof window === 'undefined') { module.exports = { strip: strip, exif: exif }; return; }
  // the photo field asks with the path Decap gave the upload
  window.CairdePhotoInfo = function (path) { return found[key(path)] || null; };

  var passing = false;
  addEventListener('change', function (e) {
    var input = e.target;
    if (passing || !input || input.type !== 'file' || !input.files || !input.files.length) return;
    var files = Array.prototype.slice.call(input.files);
    if (!files.some(isImage)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    Promise.all(files.map(shrink)).then(function (out) {
      var dt = new DataTransfer();
      out.forEach(function (f) { dt.items.add(f); });
      input.files = dt.files;
      passing = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      passing = false;
    }, function () {
      input.value = '';
      alert(files.some(isHeic) ? HEIC_MSG : READ_MSG);
    });
  }, true);
  function refuse(e, files) {
    if (!files || !Array.prototype.some.call(files, isImage)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    alert(DROP_MSG);
  }
  addEventListener('drop', function (e) { refuse(e, e.dataTransfer && e.dataTransfer.files); }, true);
  addEventListener('paste', function (e) { refuse(e, e.clipboardData && e.clipboardData.files); }, true);
})();
