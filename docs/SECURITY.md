# Security

How the website could be attacked, what protects it, what is accepted and why, and what to
do if an editor's account is lost or misused. For whoever looks after the site.

## What there is to protect

The public site is static: no database, no server code, no forms, no visitor accounts.
Visitors give it nothing, so there is little to steal from it. What matters is:

1. **The site's integrity.** Nobody but the group should be able to change what it says,
   or make it serve something harmful to visitors.
2. **The editor.** Editors log in with Netlify Identity, and what they publish is written
   to the GitHub repository through Netlify Git Gateway, which acts on GitHub with a
   token. An editor's session is therefore a key to the repository.
3. **The repository**, which Netlify builds and publishes on every change to `main`.

## The threats, and what stops each

**Someone injects script into a page through the editor.** Raw HTML in a post's text
would run in every visitor's browser. *Mitigated:* Markdown is built with raw HTML
switched off (`.eleventy.js`), so `<script>` or an `onerror` attribute in a post appears as
text. Titles, summaries and captions are escaped by the templates. Every block of an
editable page is written by `_includes/blocks.js`, which escapes every field and renders
the paragraph fields as inline Markdown with raw HTML off; a block's links must be a path on
this site or an `https://` address, and the structured data built from the page's fields
has every `<` escaped, so no field can close its script element. An uploaded GPS track is
rebuilt from positions and heights in the editor's browser before upload (`site/admin/tracks.js`)
and again at build (`_includes/gpx.js`), so no time or name in it reaches the public
repository or the site. The photo picker only reads a list of the site's own photos and
writes a path; it uploads nothing and has no address field. The build check workflow (`.github/workflows/build-check.yml`) runs with read access to
the code and write access to issues only, uses no secret beyond the run's own token, and
pins its two actions to release commits. The build refuses any
page that would load something from another website (`_includes/images.js`) and any page
with an inline script other than the two the site carries on purpose (`_includes/csp.js`).
Behind that, every page carries a Content Security Policy that lets the browser run
scripts only from this site, so injected script would not run even if it reached a page.

**Someone frames the site or the editor to trick a user into clicking.** *Mitigated:*
`X-Frame-Options: DENY` and `frame-ancestors 'none'` on every response (`site/_headers`).

**A stolen or misused editor session writes code into the repository.** Git Gateway does
not limit where a session may write: through it an editor can change any file, including
`netlify.toml`, `package.json`, `.eleventy.js` or the layouts, which run in the next
production build. Moving the build settings elsewhere would not help, because the build
always runs code from the repository. *Mitigated once the GitHub settings below are on:*
the check in `.github/workflows/editor-content-only.yml` fails any editor pull request
into `main` that changes anything except posts, gallery photos, the editable page text,
the articles list, the social posts and uploaded photos. With `main` protected so that
every change needs a pull request that passes that check, and the Git Gateway token
belonging to an account without admin rights, an editor session can only ever publish
content. **Until those settings are on, this threat is open.**

**Someone guesses or phishes an editor's password.** Netlify Identity offers no password
rules and no two-factor login, and a session stays logged in on a device until the editor
logs out. *Accepted, with care:* registration is closed (invite only, no Google or GitHub
logins), so only invited people have accounts; each editor gets their own; and
`EDITOR-GUIDE.md` asks for a long, unique password and logging out on shared computers.
The settings below limit what a stolen account could do.

**A dependency is compromised.** *Low:* the build has two direct dependencies, Eleventy
and its image plugin, pinned in `package-lock.json`; `npm audit` reported no known
vulnerability on 12 November 2026. Decap and the Identity widget are served from this
site at versions pinned by SHA-256 (`tools/vendor_cms.sh`), so no CDN can change them.

**Behold, or the feed, is compromised.** The build reads the Instagram feed from Behold.
*Mitigated:* every post must link to an `instagram.com` post and every picture is
re-encoded, so nothing Behold sends is published as it arrived; captions are escaped like
any text; nothing from Behold reaches visitors' browsers at runtime, so the Content
Security Policy is unchanged. The worst case is wrong pictures or captions on the home
page until `FEED_ID` is emptied. Behold itself only has read access to the account.

**The build hook address leaks.** Anyone holding it can start production builds, each
costing 15 credits. *Mitigated:* it is a GitHub Actions secret, never in the repository;
`MAINTENANCE.md`, "The weekly rebuild", says how to replace it.

**Photos give away where an editor lives or walks.** *Mitigated:* photos are stripped of
their location, time and camera details in the editor's browser before upload, and again
by the build (`CONTRIBUTING.md`, "Uploaded photos").

## What is accepted, and why

- **The editor's policy is looser than the public site's.** Decap needs `'unsafe-eval'`
  (its settings validator compiles code at runtime) and inline styles. Only logged-in
  editors use that page. It loads nothing from any other site, with one exception: when an
  editor pastes the address of a photo on Wikimedia Commons, the page asks the Commons API
  (`commons.wikimedia.org`) for its author and licence and shows a preview from Commons'
  image servers (`upload.wikimedia.org`, `thumb.wikimedia.org`). Those three hosts are the
  only ones its policy adds, and only on the editor's page. The public site still loads
  nothing from Wikimedia: the build downloads and re-encodes the photo and serves it itself.
- **Inline styles are allowed on public pages.** The pages use `style` attributes; style
  injection cannot run code, and raw HTML is switched off anyway.
- **Draft previews run the build on editor content.** A draft becomes a pull request with
  a Netlify deploy preview. A malicious draft could only change its own preview address,
  never the live site, and the check above marks it as failed.
- **The Media button and "Insert from URL" are hidden, not removed.** Anyone logged in can
  still reach the media library directly. With `main` protected it cannot write there.

## Settings only an owner can switch on

These need an owner of the GitHub organisation and of the Netlify project. Do them in
this order.

1. **A GitHub account for Git Gateway.** Create a GitHub account for the group's editor
   connection, give it **Write**, not Admin, on `cairde-corrin/cairde-corrin-site`, and
   generate the Git Gateway token from it (Netlify: the project -> Identity -> Services ->
   Git Gateway).
2. **Tell the check its name.** GitHub: the repository -> Settings -> Secrets and
   variables -> Actions -> Variables -> **New repository variable**: name
   `CMS_GITHUB_USER`, value that account's username.
3. **Protect `main`.** GitHub: the repository -> Settings -> Branches (or Rules) -> a rule
   for `main`: require a pull request before merging (no approvals, so editors can still
   publish), require the status check **Editor content only** to pass, and let nobody
   bypass it except the organisation's owners.
4. **Netlify Identity roles.** Give each editor the role `editor` (Identity -> the user ->
   Edit), then set Git Gateway's roles to `editor` (Identity -> Services -> Git Gateway),
   so only people with that role can save.

**What changes for editors:** almost nothing. If **Publish** reports an error straight
after saving, the check has not finished yet: wait a minute and publish again.

**Taking things down.** Decap's **Delete published entry** and **Unpublish** commit
straight to `main` rather than through a pull request (its GitHub backend moves the branch
itself), so protection on `main` refuses them; the check is not involved, and it allows
deleting content. GitHub cannot narrow that rule by path for this repository: push rules
limited to certain files exist only for private repositories. Letting the editor account
push to `main` directly would skip the check altogether. So `site/admin/editor.js` hides
those two buttons, and each post, gallery photo and article has a **Take this off the
website** tick instead (`hidden: true`), published through a pull request like any other
change. `.eleventy.js` leaves every entry with that tick out of the build. To delete one
for good, remove the file on `build` and release it (`CONTRIBUTING.md`).

## Revoking an editor

1. **Netlify: the project -> Identity -> the user -> Delete user.** They can no longer
   log in or renew a session.
2. **Allow an hour.** A session already open on their device holds a token that keeps
   working for up to an hour after it was issued. If that hour matters, do step 3 too.
3. **Stop all saving at once:** Identity -> Services -> Git Gateway -> **Disable**. Every
   editor's saves stop immediately. Re-enable it, with a new token, once the hour has
   passed.

## If an editor account was misused, or the repository changed unexpectedly

1. **Put the site back.** Netlify: the project -> Deploys -> the last good deploy ->
   **Publish deploy**. Visitors see the good version within a minute.
2. **Stop the gateway:** Identity -> Services -> Git Gateway -> **Disable**.
3. **Find what changed:** on GitHub, the commits and closed pull requests on `main` since
   the last good deploy, especially anything outside `site/_content/`, `site/_data/` and
   `site/assets/uploads/`.
4. **Undo it in git** on `build` and release as usual (`CONTRIBUTING.md`, "Undoing a
   release"), so the next publish does not bring it back.
5. **Close the door:** delete the editor, generate a new Git Gateway token, re-enable the
   gateway, and ask every editor to change their password.
6. If anything ran in a build, also check Netlify's environment variables (the site uses
   none, so any that appear are not the group's) and the build settings.

## Checking the protections still work

The build fails if a page gains an unexpected inline script or loads anything from
another site, and `node tools/selftest.js` covers the photo stripping. In a browser, the
developer console reports anything the Content Security Policy blocks.
