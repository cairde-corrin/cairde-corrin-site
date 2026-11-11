# Deploying cairdecorrin.ie

The site is static. There is no build, no npm, no framework and nothing to
compile. Netlify takes the `site/` folder and serves it exactly as it is.

If you can drag a folder onto a web page, you can deploy this.

## Where it lives

    production       https://cairde-corrin.netlify.app         deploys from main
    branch preview   https://build--cairde-corrin.netlify.app  deploys from build
    cairdecorrin.ie  registered, DNS not yet pointed at Netlify: pending

Until the domain is connected (see "Connecting the domain" below), the site is only
reachable at the two netlify.app addresses. The site's canonical URLs and its social
preview images already use `https://www.cairdecorrin.ie/`, so link previews will not
show a picture until the domain resolves.

## The short version

1. Go to <https://app.netlify.com/drop>
2. Drag the **`site`** folder onto it.
3. Wait about twenty seconds.

That publishes a separate working copy at a random `*.netlify.app` address.
Useful for showing someone a one-off copy. It does not touch the production site
at cairde-corrin.netlify.app or the domain.

**Drag `site/`, not the folder above it.** If you drag the whole repository you
will publish a site whose home page is a directory listing, and the `/s/1` sign
addresses will not work.

## The proper version, connected to git

Set this up once and every push deploys itself.

1. In Netlify: **Add new site -> Import an existing project**, and connect the
   repository.
2. Netlify reads `netlify.toml` at the repository root and fills in the
   settings itself:

       publish   = "site"
       command   = ""            (empty on purpose)

   If the interface offers to install dependencies or run a build, say no.
   There is nothing to install. `netlify.toml` also pins `NPM_FLAGS` to
   `--version` so that a future Netlify default cannot quietly add a build step.
3. **Deploy site.**

After that, every push to the main branch redeploys. Pull requests get their own
preview URL.

## Connecting the domain

1. Netlify: **Domain management -> Add a domain** -> `cairdecorrin.ie`.
2. Set `www.cairdecorrin.ie` as the primary domain, and let Netlify redirect the
   bare domain to it. Every canonical URL in the site's own markup is
   `https://www.cairdecorrin.ie/...`, so the two must agree or search engines
   will see the site twice.
3. Point DNS at Netlify. Either delegate the nameservers to Netlify DNS, or, if
   the registrar keeps the zone, add:

       www   CNAME   cairde-corrin.netlify.app
       @     ALIAS   apex-loadbalancer.netlify.com      (or the registrar's
                                                         equivalent of ALIAS)

4. Wait for the certificate. Netlify issues a Let's Encrypt certificate
   automatically once DNS resolves; it usually takes a few minutes and can take
   an hour. Do not announce the address until `https://` works.
5. Turn on **Force HTTPS**.

## Checks before you deploy

Run these from the repository root. None of them needs anything installed
beyond Python 3, Pillow, and a copy of Chrome.

    python3 tools/serve.py site 8080      # then open http://localhost:8080
    python3 tools/linkcheck.py --external

`linkcheck.py` exits non-zero if any internal link is dead. The external pass is
slower and depends on other people's servers being up; a 429 usually means rate
limiting rather than a broken link, so re-run it before believing it.

Use `tools/serve.py`, not `python3 -m http.server`. The built-in server does not
answer Range requests, so the scroll-driven hero silently refuses to seek and
appears broken locally while working perfectly in production.

## Checks after you deploy

- Open `https://www.cairdecorrin.ie/s/1` and confirm it lands on stop 1. Then
  `/s/10`, which should land on the reserved page, and `/s`, which should land on
  the trails page. **These addresses are reserved for interpretation signage.**
  Once signs are printed they cannot be changed, so treat them as fixed now.
- Open the trails page and confirm the map draws. If it does not, the GeoJSON
  did not deploy or a path is wrong.
- Open the home page in Chrome or Safari and scroll: the hero should scrub. In
  Firefox it should show a still image and never move. Both are correct.

## Caching, and the one thing to remember

`site/_headers` sets how long browsers keep each kind of file:

| what | how long | why |
|---|---|---|
| `/assets/img/`, `/assets/video/`, `/assets/audio/`, `/assets/fonts/` | 1 year, immutable | the file name carries the width or the date, so a changed file is a new name |
| `/assets/css/`, `/assets/js/` | 1 hour, revalidated | `site.css` and `site.js` keep their names when their contents change |
| `/assets/data/` | 1 day | |
| everything else, including all pages | 5 minutes, revalidated | edits go live promptly |

**If you edit a photograph, give it a new file name.** Overwriting
`stream-1800.webp` with different pixels will show the old picture to anyone who
has visited in the past year, and there is no way to force a refresh. Editing
`site.css` or `site.js` is fine: those revalidate hourly.

## Rolling back

Netlify keeps every deploy. **Deploys -> pick an earlier one -> Publish deploy.**
It is immediate and it does not touch the repository. Do that first if something
is wrong in production, then fix the cause without anybody watching.

## What must never change

`site/_redirects` maps the `/s/N` addresses to stop pages. Those addresses are
reserved for interpretation signage in development. The target of a redirect may change
whenever the content moves. The left-hand side may not.

## Things that are not set up, and were not asked for

No analytics, no forms, no Netlify Identity, no functions, no edge handlers, no
environment variables. The site collects nothing, and `site/privacy/` says so.
Adding any of them makes that page wrong, so change it in the same commit.
