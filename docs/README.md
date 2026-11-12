# The documents

Every document about the Cáirde Corrin website, and who it is for. Each one covers its
own ground and points to the others rather than repeating them.

## If you write news for the site

- **`EDITOR-GUIDE.md`** - logging in, writing a post, photos, video, publishing, and
  what to do when something looks wrong. Nothing else here is needed.

## If you look after the site

- **`MAINTENANCE.md`** - the routine: Netlify usage and what happens if the site is
  paused, putting the site back after a bad deploy, adding and removing editors,
  updating the editor, and the occasional checks.
- **`DEPLOY.md`** - how the site is built and published, the one-time Netlify set-up,
  how the editor is wired up, caching, and the checks after a deploy.
- **`DOMAIN-SETUP.md`** - the complete procedure for connecting cairdecorrin.ie, written
  to be followed cold.
- **`SECURITY.md`** - the threat model, what protects the site and the editor, revoking an
  editor, recovering from a compromise, and the GitHub settings that complete it.
- **`HANDOVER.md`** - what the group needs to own the site outright, and the order to
  transfer it in.
- **`CMS-MIGRATION.md`** - what to do if Netlify's Git Gateway, which the editor uses to
  save, stops working.

## If you change the site itself

- **`DEVELOPER-GUIDE.md`** - how the whole thing works, with a diagram: the build, the
  content and image pipelines, the editor and Git Gateway, deploying, every integration.

- **`CONTRIBUTING.md`** - the rules (nothing invented, the sign addresses never change,
  everything borrowed is credited), the verified figures and where each comes from, how
  to add media, news by hand, stops and pages, and how changes are checked and released.
- **`../tools/README.md`** - what each helper script does.

## About the project

- **`PROJECT-SUMMARY.md`** - what the site covers against the group's original plan,
  what it adds, where every kind of claim comes from, and its known limitations. The
  document to give someone who asks "can we rely on this?".
- **`OPEN-ITEMS.md`** - everything still outstanding, grouped by whether it needs code,
  a decision, or someone outside the code. Kept up to date with each change.
