# Moving the news editor off Git Gateway

The news editor at `/admin/` is Decap CMS. Editors log in with Netlify Identity, and
their posts reach the GitHub repository through Netlify Git Gateway. Netlify lists Git
Gateway as deprecated: it still works for sites that have it, Netlify still fixes major
security issues, but it no longer fixes bugs and does not recommend new set-ups [1].
Nothing needs to change while it keeps working. This page says how to tell when it
has stopped being good enough, and exactly what to do then.

## When to move

Move when any one of these is true:

1. Netlify announces a shut-down date for Git Gateway, or **Identity -> Services ->
   Git Gateway** disappears from the Netlify dashboard. Check the Netlify changelog [2]
   now and then.
2. Editors can log in but cannot save or publish, and the error mentions Git Gateway or
   `/.netlify/git/`. Netlify will not fix functional bugs in it [1], so a fault that
   lasts more than a day or two is unlikely to be fixed.
3. Netlify ends Identity. It was deprecated in February 2025 and reinstated in
   February 2026 [3]; without Identity, Git Gateway has no way to log anyone in.

Do not move earlier than you need to. The move costs every editor a GitHub account.

## What each editor will need

- **A GitHub account** of their own (free), with two-factor login switched on.
- **Write access to the repository** `cairde-corrin/cairde-corrin-site`. Decap's GitHub
  backend requires every user to have push access [4]. The repository owner adds each
  editor under **GitHub -> the repository -> Settings -> Collaborators**. Write access
  also lets them change code directly on GitHub, so add only people you would trust
  with that.
- **A new way in.** The login button becomes "Login with GitHub", which opens a
  GitHub window. The invite emails and Netlify passwords stop being used.

Each change an editor saves is recorded under their GitHub name, as it is now under their
Netlify name and email.

## Steps

Do this on the `build` branch and check it on the branch preview before merging, like
any other change. Publish or delete any open drafts first (the **Workflow** tab).

1. **Create a GitHub OAuth app.** GitHub -> Settings -> Developer settings -> OAuth
   Apps -> **New OAuth App**. Any name and homepage. Set the authorization callback URL
   to exactly `https://api.netlify.com/auth/done`. Copy the Client ID, generate a
   Client Secret, and copy that too [5].
2. **Give it to Netlify.** Netlify -> the site -> Project configuration -> Security ->
   OAuth -> **Install provider** -> GitHub. Paste the Client ID and Secret [5].
3. **Change `site/admin/config.yml`.** Replace the whole `backend:` block:

       backend:
         name: git-gateway
         branch: main
         status_endpoint: /admin/status.json

   with:

       backend:
         name: github
         repo: cairde-corrin/cairde-corrin-site
         branch: main

   Nothing else in the file changes: the News fields, the editorial workflow (it works
   on the GitHub backend [6]), the media folder and the upload cap all stay. If the
   login window reports that it cannot find the site, add `site_domain:
   cairde-corrin.netlify.app` (or the live domain) under `branch` [7].
4. **Remove the Identity widget.** In `site/admin/index.html`, delete the
   `netlify-identity-widget` script line and the comment above it. Delete
   `site/admin/status.json`, `site/admin/emails/` and
   `site/admin/vendor/netlify-identity-widget-2.0.3/`, and remove the widget lines from
   `tools/vendor_cms.sh`.
5. **Update the privacy page in the same commit.** The admin area will then also talk
   to GitHub, not only Netlify: `api.github.com` for every save, `githubstatus.com`
   for a status check Decap makes on each login (the GitHub backend has no setting to
   turn it off), and GitHub's image server for the editor's profile picture. The public
   pages are unaffected.
6. **Check on the preview** (`https://build--cairde-corrin.netlify.app/admin/`): log in
   with GitHub, save a draft, and confirm a `cms/...` pull request appears on GitHub.
   Delete that draft rather than publishing it, then merge as usual.
7. **Switch off the old services** once the merged change works on production:
   Netlify -> Identity -> Git Gateway -> disable, then disable Identity. Nothing on the
   site uses them afterwards.

## Decap, or something else?

Checked in November 2026:

- **Decap CMS** is actively maintained: 18 releases since May 2026, the latest 3.17.3
  on 26 October 2026 [8]. Its GitHub backend is a one-block change, keeps the editor
  the same for people who already know it, and needs no new code. **This is the
  recommended target.**
- **Decap Turbo** is a hosted service from the Decap team. Editors log in with a Turbo
  account instead of GitHub, which makes it the closest match to what Git Gateway
  gives today [9]. It is already in the Decap build this site serves (backend
  `turbo-github`). But it is a hosted third-party service between the editor and
  GitHub, sold in plans (its documentation refers to "Pro and above"; check the current
  pricing), so it means a new processor on the privacy page and possibly a recurring
  cost. Consider it only if asking editors for GitHub accounts is not acceptable.
- **Sveltia CMS** is a rewrite of the same idea, very actively developed (0.262.4 on
  11 November 2026) and largely compatible with Decap's `config.yml` [10]. It
  supports the editorial workflow on GitHub [11]. But it is still in beta and warns
  of breaking changes before 1.0, and it does not support Git Gateway or Netlify
  Identity at all [10], so it is not a way to keep the current set-up. Revisit it
  once it reaches 1.0.
- **Static CMS**, the other well-known Netlify CMS fork, was archived in September
  2024 and is not maintained [12]. Do not use it.

## Sources

1. Netlify Docs, Git Gateway: <https://docs.netlify.com/manage/security/secure-access-to-sites/git-gateway/>
2. Netlify changelog: <https://www.netlify.com/changelog/>
3. Netlify, Identity changes (updated 19 February 2026): <https://www.netlify.com/blog/auth0-extension-identity-changes/>
4. Decap CMS, GitHub backend: <https://decapcms.org/docs/github-backend/>
5. Netlify Docs, OAuth provider tokens: <https://docs.netlify.com/manage/security/secure-access-to-sites/oauth-provider-tokens/>
6. Decap CMS, Editorial workflows: <https://decapcms.org/docs/editorial-workflows/>
7. Decap CMS, Backends overview (`site_domain`, `base_url`): <https://decapcms.org/docs/backends-overview/>
8. npm, decap-cms release history: <https://www.npmjs.com/package/decap-cms?activeTab=versions>
9. Decap CMS, Turbo overview: <https://decapcms.org/docs/turbo-overview/>
10. Sveltia CMS, Migrating from Netlify CMS or Decap CMS: <https://sveltiacms.app/en/docs/migration/netlify-decap-cms>
11. Sveltia CMS, Editorial workflow: <https://sveltiacms.app/en/docs/workflows/editorial>
12. Static CMS on GitHub (archived): <https://github.com/StaticJsCMS>
