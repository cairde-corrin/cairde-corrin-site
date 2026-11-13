# How the site is built and published

For whoever looks after the technical side. The routine (usage, rolling back, editors,
updating the editor) is in `MAINTENANCE.md`; connecting the domain is `DOMAIN-SETUP.md`.

## How it works

The pages are hand-written HTML kept as Nunjucks templates in `site/`. `npm run build`
runs Eleventy, which renders them into `_site/`, adds the shared header and footer and
the structured data, re-encodes any photos uploaded in the editor, and copies every other
file (images, audio, video, fonts, CSS, JavaScript, map data, `_redirects`, `_headers`)
across unchanged. Netlify runs that build on every push and publishes `_site/`. Nothing
is ever uploaded by hand.

## Where it lives

    production       https://cairde-corrin.netlify.app         deploys from main
    branch preview   https://build--cairde-corrin.netlify.app  deploys from build
    cairdecorrin.ie  registered with Letshost, not yet pointed at Netlify (DOMAIN-SETUP.md)

Every page already names `https://www.cairdecorrin.ie/` as its address in its canonical
link, its sharing image and the sitemap, so until the domain is connected search engines
have nothing to index and shared links show no picture.

## Publishing a change

    git push origin build      # the branch preview
    git push origin main       # production

Changes are prepared and checked on `build` and merged to `main` as described in
`CONTRIBUTING.md`. The editor is the one exception: it saves news, gallery photos and the
home page's social posts straight to `main` (see "The editor" below).

**Do not deploy by dragging a folder onto Netlify Drop.** Dragging `site/` publishes the
templates unrendered, with no news, no header and no sitemap. Dragging `_site/` works
once but creates a separate copy at a random address, with no editor, which goes stale
the moment anyone publishes a post.

## Setting it up, once

This has been done for the current project. It is here for rebuilding from scratch.

1. In Netlify: **Add new project -> Import an existing project**, and connect the
   GitHub repository.
2. Netlify reads `netlify.toml` at the repository root: publish `_site`, command
   `npm run build`, Node 24.13.0. Keep those settings in that file, not in the Netlify
   interface, so they travel with the repository. Netlify installs the two pinned
   dependencies, Eleventy and its image plugin, from `package-lock.json`.
3. **Deploy.**
4. Under **Project configuration -> Build & deploy -> Continuous deployment -> Branches
   and deploy contexts**, add `build` to the branch deploys and keep deploy previews on
   for pull requests. Drafts in the editor are pull requests, so this is what gives them
   a preview.
5. Set up the editor's logins, below.

## The editor

The editor at `/admin/` is Decap CMS. Editors log in with Netlify Identity, and what they
publish reaches the repository through Netlify Git Gateway. Decap and the login widget
are served from `site/admin/vendor/` at pinned versions: nothing in the editor loads from
a CDN, and no public page loads any Netlify script.

**It commits straight to `main`.** A saved draft goes to its own `cms/...` branch and pull
request; **Publish** merges it into `main`, and production redeploys. That bypasses
`build` on purpose, for news posts, gallery photos and the social posts only; layouts,
templates, `config.yml` and everything else still go through `build`. Because `main`
moves on its own, bring `build` level with `git switch build && git merge main` before
starting any work.

**Setting up its logins, once, in Netlify:**

1. **Project configuration -> Identity -> Enable Identity.**
2. **Registration preferences -> Invite only.** Leave external providers (Google,
   GitHub and so on) off.
3. **Identity -> Services -> Git Gateway -> Enable Git Gateway.** Netlify asks for
   access to the GitHub repository.
4. Invite the editors (`MAINTENANCE.md`).

**The emails.** Leave **Identity -> Emails** alone. Netlify sends its own invitation,
password-reset and email-change emails, and each links to the site's home page with a
code after a `#`, for example `https://www.cairdecorrin.ie/#invite_token=...`. A one-line
script at the top of `site/index.njk` notices those three codes and forwards the browser
to `/admin/` with the code intact, where the login window takes over. On any other visit
it does nothing: it loads nothing, sends nothing and sets no cookie. Do not remove it
while the editor uses Netlify Identity.

The templates in `site/admin/emails/` are not used: custom email templates are a paid
Netlify feature. They are kept because they would work as they are on a paid plan (set
the three template paths under **Identity -> Emails** to `/admin/emails/invitation.html`,
`recovery.html` and `email-change.html`).

**Git Gateway** is listed by Netlify as deprecated: it keeps working, but Netlify no
longer fixes bugs in it. `CMS-MIGRATION.md` says when and how to replace it.

## Checks before you deploy

From the repository root, after `npm run build`:

    python3 tools/serve.py _site 8080       # look at it: http://localhost:8080
    python3 tools/compare_build.py          # every copied file identical to its source
    python3 tools/linkcheck.py --external   # dead links, inside and out
    python3 tools/ldcheck.py                # structured data against schema.org
    node tools/selftest.js                  # the build's own parsers and checks, and reachability
    node tools/reachcheck.js                # every page reachable; sitemap.xml agrees (full report)

Use `tools/serve.py`, not `python3 -m http.server`: the built-in server does not answer
Range requests, so the home page film refuses to seek and looks broken locally while
working in production. The external link check depends on other people's servers; a 429
usually means rate limiting, so run it again before believing it.

## Checks after you deploy

- Open `/s/1` and confirm it lands on stop 1, then `/s/10` (the reserved page) and `/s`
  (the trails page). These are the sign addresses.
- Open the trails page: the map draws, and the elevation profile shows under it.
- Open the home page in Chrome or Safari and scroll: the film should move with the
  scroll. In Firefox it should show a still image and never move. Both are correct.
- Open `/admin/` and log in.

## Caching

`site/_headers` sets how long browsers keep each kind of file:

| What | How long | Why |
|---|---|---|
| `/assets/img/`, `/assets/video/`, `/assets/audio/`, `/assets/fonts/` | 1 year, immutable | a changed file always gets a new name: hand-made images carry their width or an edition date, editor photos a hash of their contents, video stills their video's ID and size |
| `/assets/css/`, `/assets/js/` | 1 hour, revalidated | `site.css` and `site.js` keep their names when they change |
| `/assets/data/` | 1 day | |
| everything else, including all pages | 5 minutes, revalidated | edits go live promptly |

**If you change a photograph, give it a new file name.** Overwriting a file with
different pixels shows the old picture to anyone who visited in the past year, and there
is no way to force a refresh. `map.js` and the map data carry a version instead
(`CONTRIBUTING.md`, "Adding media").

## What must never change

The left-hand side of the `/s/N` lines in `site/_redirects`. Those addresses are printed
on trail signs. Where they point may change whenever a page moves.

## What is deliberately not here

No analytics, no forms, no server functions, no edge functions, no environment
variables. The public site collects nothing, and `site/privacy/` says so, including what
the editor and a played video do. Adding anything that collects information makes that
page wrong, so change it in the same commit.

Netlify adds a short promotional HTML comment to production pages on its own. It is
invisible and makes no requests; `OPEN-ITEMS.md` records what is known about it.
