# Looking after the website

For whoever holds the technical side of cairdecorrin.ie. Committee members who only
write news need `EDITOR-GUIDE.md` instead. How the site is built and deployed is in
`DEPLOY.md`; the rules for changing it are in `CONTRIBUTING.md`.

The site needs very little looking after. Most months nothing at all needs doing. This
document covers the few things that do come up.

## What runs where

| Part | Where | Notes |
|---|---|---|
| The code and every page | GitHub, `cairde-corrin/cairde-corrin-site` | Public repository. `main` is live, `build` is where changes are prepared |
| Hosting and builds | Netlify, project `cairde-corrin` | Builds from GitHub on every push and every editor publish |
| Editor logins | Netlify Identity, on the same project | Invite only |
| Saving editor changes to GitHub | Netlify Git Gateway | Deprecated by Netlify but working; see `CMS-MIGRATION.md` |
| The domain and its email | Letshost | Registration runs to 17 June 2027 |

## Netlify usage and what it costs

The site is on Netlify's free plan, which has a hard monthly limit and never bills. Which
kind of free plan it is depends on when the Netlify account was created; check under the
team's **Usage & billing**.

**Credit-based Free plan** (accounts created from 4 September 2025): 300 credits a month.

| What uses credits | Cost |
|---|---|
| A production deploy: every push to `main`, which includes **every Publish in the editor** | 15 credits |
| Bandwidth served to visitors | 20 credits per GB |
| Web requests | 2 credits per 10,000 |
| Branch previews, draft previews, failed deploys | free |

As a guide: the home page with its film is about 6 MB to a first-time visitor and most
other pages far less, so a gigabyte is a few hundred first visits. Ten publishes and five
gigabytes in a month is 250 credits, close to the limit. Busy months, or a long run of
small corrections each published separately, can use it up. Encourage editors to get a
post right in draft and publish once.

**Legacy Free plan** (older accounts): 300 build minutes and 100 GB of bandwidth a
month. A build here takes about a minute, so bandwidth is the limit that matters.

Netlify emails the account owner as usage passes 50%, 75% and 100%. Read those emails.

### If the site is paused

When a free plan runs out, Netlify pauses every project on the account and visitors see
"Site not available". Nothing is lost: the repository, the deploys and the editor
accounts all stay.

- **Credit-based plan:** the credits reset at the start of the next monthly cycle and
  the site comes back. To bring it back sooner, the only route is a paid plan.
- **Legacy plan:** running out of build minutes stops new deploys but keeps the site
  up; running out of bandwidth pauses the site, and Netlify's documentation says the
  account then has to be upgraded to restore it.

If this happens more than once, it is a decision for the committee: a paid Netlify
plan, Netlify's open-source programme (which has a larger allowance and keeps sites up,
but has its own conditions to check), or reducing what the site serves (the home page
film is the largest single item). See `OPEN-ITEMS.md`.

## Putting the site back after a bad deploy

Netlify keeps every deploy. In Netlify: **the project -> Deploys**, choose the last good
deploy, **Publish deploy**. It takes effect within a minute and changes nothing in the
repository.

Do that first, then find the cause calmly. Note that the next push to `main`, or the next
editor publish, deploys the repository as it then stands, which brings the fault back
unless it has been fixed or the change reverted. `CONTRIBUTING.md` ("Undoing a release")
has the git steps.

## Adding and removing editors

**Adding someone.** In Netlify: **the project -> Identity -> Invite users**, and enter
their email. They get Netlify's standard invitation email; `EDITOR-GUIDE.md` tells them
what to do with it. Send them that guide.

**Removing someone.** **Identity**, click the person, **Delete user**. They can no longer
log in. What they published stays on the site, and their name and email stay in the
repository's change history.

**If someone's invitation link opens the home page and stops there.** Netlify's default
emails link to the site's home page with a code after a `#`; a short script at the top of
the home page passes that on to the editor. If it fails, ask them to open the editor
address and use **Forgot password?**. `DEPLOY.md` explains the mechanism.

Editors log in with email and password only; registration is closed, so nobody can sign
themselves up.

## When a video post is published

Nothing needs doing. The build fetches the video's still picture from YouTube the first
time and keeps fetching it on later builds until it is in the repository. If you want
builds not to depend on YouTube at all, run a build on `build` after merging `main`
and commit the new files in `site/assets/img/video/`; it is optional tidying, not a fix.

## Updating Decap, the editor

The editor is Decap CMS, served from the site itself at a pinned version, together with
Netlify's login widget. Update it only for a reason (a security fix, or a bug that
affects the editors); it works as it is.

1. On `build`, change the version and SHA-256 in `tools/vendor_cms.sh` and run it. It
   downloads the new version from npm, checks the hash, and replaces
   `site/admin/vendor/`.
2. Change the two script paths in `site/admin/index.html` to the new folder names.
3. Push to `build`, open `https://build--cairde-corrin.netlify.app/admin/`, log in, and
   check:
   - the top bar shows **Contents** and **Workflow**, and **no Media button** (it is
     hidden on purpose: it uploads straight to the live site with no size limit);
   - the **+** -> **Image** in the post text offers **Choose an image** and **no "Insert
     from URL"** (hidden so that no post loads a picture from another website);
   - a phone photo uploaded through **Choose an image** arrives in the media library as
     `.webp` (`.jpg` in Safari), and Chrome refuses a `.heic` file with a message; this is
     the step that keeps photo locations out of the repository, so do not skip it;
   - a draft saves. Do not publish from the preview; delete the draft instead.
4. Merge to `main` as usual.

Those first three checks matter because `site/admin/index.html` hides the Media and URL
buttons by Decap's internal labels, which an update can rename.

## Other things that come up

- **Git Gateway stops working** (editors can log in but not save). Netlify no longer
  fixes it. `CMS-MIGRATION.md` says how to tell, and how to move the editor to a login
  with GitHub accounts.
- **The domain.** Renew it with Letshost before 17 June 2027. Connecting it to the site,
  if that has not been done, is `DOMAIN-SETUP.md`.
- **Links to other websites break over time.** Twice a year, run
  `python3 tools/linkcheck.py --external` and fix or remove what it reports.
- **Structured data.** After changing a page's facts or layout, run
  `python3 tools/ldcheck.py`.
- **Someone asks for a change to a page with figures on it** (trails, stops, species,
  folklore). `CONTRIBUTING.md` says where every figure comes from and how to change one
  safely. Nothing gets published that cannot be traced to a source.
- **Photos in the repository.** The editor shrinks every photo to at most 2000 px and
  strips its location, time and camera details in the editor's own browser before upload,
  so the public repository holds only those copies, about a megabyte each. If a photo
  ever arrives by another route (a hand commit), the build strips it again before
  publishing, but the file in the repository would keep its metadata: shrink and strip
  it first (`CONTRIBUTING.md`, "Uploaded photos").

## Where everything else is

`docs/README.md` lists every document and who it is for.
