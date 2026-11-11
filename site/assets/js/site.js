/* Cáirde Corrin - shared site behaviour */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* mobile nav */
  var tgl = document.getElementById('navtoggle'), links = document.getElementById('navlinks');
  if (tgl && links) tgl.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    tgl.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  /* Scroll reveals. threshold must stay 0: it is a fraction of the TARGET's area, so
     anything taller than about nine viewports can never reach a 0.1 ratio and would
     stay at opacity 0 forever. The recordings list is 7191 px and did exactly that.
     The rootMargin is what sets the trigger point, and it is height-independent. */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
  document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });

  /* ---- Scroll-driven film -------------------------------------------------------
     The hero is a video scrubbed by scroll position. Whether an engine can actually do
     that is measured at runtime rather than sniffed from the user agent: the clip is
     scrubbed for 350 ms inside whatever is already buffered, and the frames it really
     presents are counted with requestVideoFrameCallback. Chrome and Safari present
     about 21 of 22 possible; Firefox presents 1 or 2, keeps the poster, and the rest of
     the download is aborted.

     The probe has to run against this clip. Cheaper proxies were tested and none is
     faithful - Firefox scrubs a 256px version, a 0.7s version and a 920 KB low-bitrate
     version of the same 1600x900 footage without trouble. What defeats it is decode
     cost per frame at the shipping bitrate, so only the shipping file predicts it. */
  var strip = document.getElementById('filmstrip');
  var vid = document.getElementById('herovideo');
  var panels = [].slice.call(document.querySelectorAll('.film-panel'));
  var SCRUB_MIN_FRAMES = 8, PROBE_MS = 350;
  var PROBE_NEEDS = 1.2;    /* seconds buffered before a first probe is a fair test */
  var RETRY_NEEDS = 3.0;    /* and before the second, final one */
  var STALL_MS = 10000;     /* silence this long means the transfer is dead, not slow */

  /* The connection and motion tests are the same whichever hero runs. Only the
     width test differs, so heavyOk() still means exactly what it always did. */
  function connOk() {
    if (reduce) return false;
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (c) {
      if (c.saveData) return false;
      if (c.effectiveType === '2g' || c.effectiveType === 'slow-2g') return false;
    }
    return true;
  }
  function heavyOk()  { return connOk() && innerWidth >= 900; }
  function mobileOk() { return connOk() && innerWidth < 900; }

  function buffered(v) {
    try { return v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0; }
    catch (e) { return 0; }
  }

  /* Seek once per animation frame across `upto` seconds and count presented frames. */
  function scrubBurst(v, upto, ms, done) {
    if (typeof v.requestVideoFrameCallback !== 'function') return done(0);
    if (!upto || !isFinite(upto) || upto <= 0 || !v.seekable.length) return done(0);
    var seen = {}, n = 0, stop = false, t0 = performance.now();
    (function cb() {
      v.requestVideoFrameCallback(function (now, meta) {
        var k = meta.mediaTime.toFixed(3);
        if (!(k in seen)) { seen[k] = 1; n++; }
        if (!stop) cb();
      });
    })();
    (function step() {
      var p = (performance.now() - t0) / ms;
      if (p >= 1) { stop = true; return setTimeout(function () { done(n); }, 60); }
      v.currentTime = p * upto;
      requestAnimationFrame(step);
    })();
  }

  /* Safari will not paint a frame until the element has played once. */
  function prime(v, cb) {
    var p = v.play();
    if (p && p.then) p.then(function () { v.pause(); cb(); }).catch(function () { cb(); });
    else { try { v.pause(); } catch (e) {} cb(); }
  }

  function filmProgress() {
    var r = strip.getBoundingClientRect();
    var span = strip.offsetHeight - innerHeight;
    if (span <= 0) return 0;
    return Math.min(1, Math.max(0, -r.top / span));
  }

  var SPAN = 0.16;
  function paintPanels(p) {
    for (var i = 0; i < panels.length; i++) {
      var at = parseFloat(panels[i].dataset.at) || 0;
      /* the first panel is fully lit on arrival and only fades out */
      var dist = i === 0 ? Math.max(0, p - at) : Math.abs(p - at);
      var o = Math.max(0, 1 - dist / SPAN);
      o = o * o * (3 - 2 * o);
      panels[i].style.opacity = o.toFixed(3);
      panels[i].style.transform = 'translate3d(0,' + ((p - at) * -70).toFixed(1) + 'px,0)';
    }
  }
  function paintFilm() {
    var p = filmProgress(), d = vid.duration;
    if (d && isFinite(d)) {
      var t = p * (d - 0.001);
      if (Math.abs(vid.currentTime - t) > 0.008) vid.currentTime = t;
    }
    paintPanels(p);
  }
  var filmQueued = false;
  function onFilm() {
    if (filmQueued) return;
    filmQueued = true;
    requestAnimationFrame(function () { filmQueued = false; paintFilm(); });
  }

  function startFilm() {
    strip.classList.add('scrub');
    addEventListener('scroll', onFilm, { passive: true });
    addEventListener('resize', onFilm, { passive: true });
    paintFilm();
  }
  function abandonFilm() {
    vid.removeAttribute('src');
    while (vid.firstChild) vid.removeChild(vid.firstChild);
    try { vid.load(); } catch (e) {}          /* stops the transfer */
  }

  /* ---- mobile hero: a scrubbed frame sequence -----------------------------------
     iOS Safari will not seek a video reliably, so phones get 30 stills instead of
     the clip. They are cropped 9:16 from the same 4K master and carry the same
     grade, so the poster and the frames match. The first 8 arrive before scrubbing
     starts; the rest follow in the background. The connection and motion gates are
     the same ones the desktop hero uses. */
  var FRAME_COUNT = 30, FRAME_LEAD = 8;
  function frameUrl(i) {
    return 'assets/frames-mobile/f' + (i < 10 ? '0' + i : i) + '.webp';
  }
  function startFrames() {
    var holder = document.getElementById('filmframes');
    var shown = document.getElementById('filmframe');
    if (!holder || !shown) return;
    var imgs = new Array(FRAME_COUNT), ready = 0, running = false, last = -1;

    function paintFrames() {
      var p = filmProgress();
      var i = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(p * (FRAME_COUNT - 1))));
      if (i !== last && imgs[i] && imgs[i].complete) { last = i; shown.src = imgs[i].src; }
      paintPanels(p);
    }
    var queued = false;
    function onFrames() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; paintFrames(); });
    }
    function begin() {
      if (running) return;
      running = true;
      strip.classList.add('scrub', 'frames');
      addEventListener('scroll', onFrames, { passive: true });
      addEventListener('resize', onFrames, { passive: true });
      paintFrames();
    }
    function load(i, then) {
      var im = new Image();
      imgs[i] = im;
      im.onload = im.onerror = function () { if (then) then(); };
      im.src = frameUrl(i);
    }
    /* the lead frames gate the start; the tail loads behind it */
    for (var i = 0; i < FRAME_LEAD; i++) {
      load(i, function () { if (++ready >= FRAME_LEAD) begin(); });
    }
    var next = FRAME_LEAD;
    (function tail() {
      if (next >= FRAME_COUNT) return;
      load(next++, function () { setTimeout(tail, 0); });
    })();
  }

  if (strip && vid && heavyOk()) {
    /* heavyOk() is checked before this point on purpose: reduced motion, narrow
       viewports, saveData and 2g never reach here, so they never request the file. */
    vid.preload = 'auto';
    vid.load();

    var attempts = 0, settled = false, probing = false, stallTimer = null;

    function settle(canScrub) {
      if (settled) return;
      settled = true;
      clearTimeout(stallTimer);
      vid.removeEventListener('progress', onData);
      vid.removeEventListener('canplaythrough', onData);
      vid.removeEventListener('loadeddata', onData);
      vid.removeEventListener('error', onError);
      if (canScrub) { vid.currentTime = 0; startFilm(); } else abandonFilm();
    }
    function onError() { settle(false); }

    /* The old code gave up after a flat twelve seconds, which on any connection
       below about 2.4 Mbps killed the transfer before enough had arrived to test
       anything - the probe never ran at all. This clock only runs while nothing
       is arriving, so a slow connection waits and a dead one gives up. */
    function armStall() {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(function () { settle(false); }, STALL_MS);
    }

    /* readyState 4 is the engine saying it can play the whole clip without
       stalling. Short of that, a real span of buffered video is a fair test. */
    function readyToProbe() {
      return vid.readyState >= 4 ||
             buffered(vid) >= (attempts ? RETRY_NEEDS : PROBE_NEEDS);
    }

    function onData() {
      armStall();
      if (settled || probing || !readyToProbe()) return;
      probing = true;
      attempts++;
      prime(vid, function () {
        var upto = Math.max(0.5, Math.min(buffered(vid), vid.duration || 0) - 0.1);
        scrubBurst(vid, upto, PROBE_MS, function (n) {
          probing = false;
          if (n >= SCRUB_MIN_FRAMES) return settle(true);
          /* One retry, and only while more data can still change the answer.
             An engine that cannot scrub a fully buffered clip will not improve. */
          if (attempts < 2 && vid.readyState < 4) return armStall();
          settle(false);
        });
      });
    }

    vid.addEventListener('progress', onData);
    vid.addEventListener('canplaythrough', onData);
    vid.addEventListener('loadeddata', onData);
    vid.addEventListener('error', onError);
    armStall();
  } else if (strip && mobileOk()) {
    /* the video element must never fetch on this path */
    if (vid) abandonFilm();
    startFrames();
  }

  /* ---- photograph carousel ------------------------------------------------------
     Scroll-snap does the work; these buttons just nudge it by one card. The track is
     focusable, so arrow keys already scroll it without any of this. */
  var track = document.getElementById('car-track');
  var carPrev = document.getElementById('car-prev'), carNext = document.getElementById('car-next');
  if (track && carPrev && carNext) {
    var step = function () {
      var first = track.querySelector('.car-item');
      return first ? first.getBoundingClientRect().width + 20 : 320;
    };
    var smooth = reduce ? 'auto' : 'smooth';
    carPrev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: smooth }); });
    carNext.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: smooth }); });
    var ends = function () {
      var max = track.scrollWidth - track.clientWidth;
      carPrev.disabled = track.scrollLeft < 4;
      carNext.disabled = track.scrollLeft > max - 4;
    };
    track.addEventListener('scroll', function () { requestAnimationFrame(ends); }, { passive: true });
    addEventListener('resize', ends, { passive: true });
    ends();
  }

  /* nav treatment over the film (home only) */
  var ticking = false;
  var nav = document.getElementById('nav');

  function frame() {
    ticking = false;
    /* The nav stays transparent for the whole film, however long it is pinned. */
    if (nav) nav.classList.toggle('over', !!strip && strip.getBoundingClientRect().bottom > 80);
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  frame();
})();
