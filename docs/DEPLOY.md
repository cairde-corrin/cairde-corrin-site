# Deploying cairdecorrin.ie

The site is static. The build is Eleventy: it copies every hand-written file in
`site/` to `_site/` unchanged, renders the News section and `sitemap.xml`, and
Netlify serves `_site/`.

The site deploys by pushing to git. Netlify builds it from the repository on every
push, so there is nothing to upload by hand.

## Where it lives

    production       https://cairde-corrin.netlify.app         deploys from main
    branch preview   https://build--cairde-corrin.netlify.app  deploys from build
    cairdecorrin.ie  registered, DNS not yet pointed at Netlify: pending

Until the domain is connected (see "Connecting the domain" below), the site is only
reachable at the two netlify.app addresses. The site's canonical URLs and its social
preview images already use `https://www.cairdecorrin.ie/`, so link previews will not
show a picture until the domain resolves.

## The short version

Commit, then push. Netlify builds and publishes the branch you pushed:

    git push origin build      # the branch preview, build--cairde-corrin.netlify.app
    git push origin main       # production, cairde-corrin.netlify.app

Never push to `main` directly: merge a checked phase from `build` as described in
`docs/CONTRIBUTING.md`. News posts saved in the news editor are the one exception;
they commit to `main` themselves (see "The news editor" below).

**Do not deploy by dragging a folder onto Netlify Drop.** Dragging `site/` publishes a
site with no News pages and no sitemap, because those only exist after the build.
Dragging `_site/` works once but publishes a separate copy at a random address, with
no news editor, and it goes stale the moment anyone saves a post.

## Setting it up, once

1. In Netlify: **Add new site -> Import an existing project**, and connect the
   repository.
2. Netlify reads `netlify.toml` at the repository root and fills in the
   settings itself:

       publish   = "_site"
       command   = "npm run build"
       NODE_VERSION = "24.13.0"

   Keep these in `netlify.toml`, not the Netlify interface, so they travel with the
   repository. Netlify installs the one pinned dependency, Eleventy, from
   `package-lock.json`, and the build copies `site/` into `_site/` unchanged.
3. **Deploy site.**
4. Under **Site configuration -> Build & deploy -> Continuous deployment -> Branches and deploy contexts**,
   set branch deploys to include `build`, and keep deploy previews on for pull
   requests. Draft news posts are pull requests, so this is what gives an editor a
   preview link.

After that, every push to `main` redeploys production and every push to `build`
redeploys the branch preview.

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

Run these from the repository root, after `npm run build`. Beyond the build, none of
them needs anything installed except Python 3, Pillow, and a copy of Chrome.

    python3 tools/serve.py _site 8080     # then open http://localhost:8080
    python3 tools/linkcheck.py --external

`linkcheck.py` exits non-zero if any internal link is dead. The external pass is
slower and depends on other people's servers being up; a 429 usually means rate
limiting rather than a broken link, so re-run it before believing it.

Use `tools/serve.py`, not `python3 -m http.server`. The built-in server does not
answer Range requests, so the scroll-driven hero silently refuses to seek and
appears broken locally while working perfectly in production.

## The news editor

The site has a news editor at `/admin/`, built with Decap CMS. Editors log in with
Netlify Identity and their posts are saved to the repository through Netlify Git
Gateway. Both scripts are served from `site/admin/vendor/` at pinned versions; nothing
in the admin area loads from a CDN, and no public page loads any Netlify script.

**The news editor commits straight to `main`, not to `build`.** A post saved as a
draft goes to its own `cms/...` branch and pull request; pressing **Publish** merges it
into `main`, and production redeploys. That bypasses the build branch on purpose, for
news posts, gallery photos and the home page's social posts only. It is not a route for code: layouts, templates,
`config.yml` and every other file still go through `build` and are merged by hand.
After a post is published, bring `build` level with `git switch build && git merge
main` before the next phase.

The editor works only once this phase is on `main`. On the branch preview, drafts
still go to `cms/...` branches, but **Publish** would merge a post into a `main` that
has no News section yet. Do not publish from the preview before the merge.

**Set-up, once, in the Netlify interface:**

1. **Site configuration -> Identity -> Enable Identity.**
2. **Registration preferences -> Invite only.** Leave external providers (Google,
   GitHub and so on) off.
3. **Identity -> Services -> Git Gateway -> Enable Git Gateway.** Netlify asks for
   access to the GitHub repository.
4. **Identity -> Invite users**, and enter each editor's email address.

Leave **Identity -> Emails** alone. Netlify sends its own default emails: the invite,
the password reset and the email-address change. Each one links to the site root, with
the token after a `#`, for example `https://www.cairdecorrin.ie/#invite_token=...`. A
short inline script at the top of `site/index.njk` notices one of those three tokens
and forwards the browser to `/admin/` with the `#...` part intact, where the login
window takes over. On any other visit it does nothing; it loads nothing, sends nothing
and sets no cookie. Do not remove it while the editor uses Netlify Identity, or invite
links will open the home page and go no further.

**The templates in `site/admin/emails/` are not used.** Custom email templates are a
Netlify Pro feature, so on the free plan there is no setting to point at them. They are
kept because they would work as they are on Pro: set the three template paths under
**Identity -> Emails** to `/admin/emails/invitation.html`, `recovery.html` and
`email-change.html`. Netlify reads them from the production deploy. The forwarder can
stay in place either way.

**What to know about Git Gateway.** Netlify's documentation lists Git Gateway as
deprecated: it keeps working for sites that have it, Netlify still fixes major
security issues, but it no longer fixes bugs and does not recommend new set-ups.
`docs/CMS-MIGRATION.md` says how to tell when it has to be replaced and exactly how to
move the editor to Decap's GitHub backend.

**Updating Decap or the widget.** `tools/vendor_cms.sh` downloads the pinned
versions from npm, checks the tarballs against the recorded SHA-256 and copies the
files into `site/admin/vendor/`. To move to a new version, change the version and
hash in that script, change the two paths in `site/admin/index.html`, and check
`/admin/` on the branch preview before merging. `site/admin/index.html` hides two
pieces of Decap by their style label and button text, so after an update check that
the top-bar **Media** button is still hidden while **Contents** and **Workflow** show,
and that the body's Image button offers no "Insert from URL". It also refuses HEIC
uploads; try one.

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
| `/assets/img/`, `/assets/video/`, `/assets/audio/`, `/assets/fonts/` | 1 year, immutable | the file name carries the width or the date, so a changed file is a new name. Photos and video stills from the news editor, under `/assets/img/news/`, are named by a hash of their contents, so the same holds |
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

No analytics, no forms, no functions, no edge handlers, no environment variables.
Netlify Identity is used only by the news editor at `/admin/`; no public page loads
it. The public site collects nothing, and `site/privacy/` says so, including what
the news editor does. Adding anything that collects information makes that page
wrong, so change it in the same commit.
