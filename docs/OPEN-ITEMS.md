# Open items

What is still untested, unfinished or waiting on someone. Every phase of work adds to
this file and removes what it settles, so it stays the one place to look.

## Not yet tested

- **CMS end to end.** Invite, accept, write a post with a photo in the BODY, save as
  draft, confirm it is not live, publish, verify on the site, delete.
- **HEIC on a real iPhone.** Choose File from Files versus Photo Library. The current
  behaviour is inferred from WebKit source, not observed.
- **A completed signup with a real token.** The forwarder on the home page was tested
  with made-up tokens only.
- **The video player with a real group video.** The click-to-load player was tested
  with a public test video, not one the group owns. Check the thumbnail and playback on
  the first real post with a video.
- **The social block with real posts.** Tested with made-up Instagram and Facebook
  addresses. Check the cards and links once the group adds real ones.
- **The navigation on a real phone, by finger.** Tested in Phase 8b in WebKit 27.2
  (Safari's engine, by Playwright, with emulated touch), Chrome 157, real Firefox 154,
  and real Mobile Safari 26.1 in the iOS Simulator (an iPhone 17, driven by script, so
  rendering and behaviour but not real touches). Real desktop Safari was not driven:
  that needs Safari's "Allow remote automation" setting, and WebKit passed every check.
- **A real screen reader.** Accessible names were read from Chrome's accessibility tree
  and the keyboard walked in three engines, but no one has listened to the site with
  VoiceOver, TalkBack or NVDA.

## Known gaps, code

- **Browser-side image shrink not built.** Originals still enter the repository at 2 to
  13 MB each with GPS intact, and stay in its history. This now covers gallery photos
  as well as news photos.
- **Git Gateway is deprecated.** The migration path is in `docs/CMS-MIGRATION.md`.
- **The Decap button hiding depends on internal labels** and needs re-checking after any
  Decap update (see DEPLOY.md, "Updating Decap or the widget").
- **Netlify custom email templates are Pro-only.** The templates in
  `site/admin/emails/` are unused; a forwarder on the home page handles the default
  emails instead.
- **Netlify injects a promotional HTML comment on production.** Every production page
  served from `cairde-corrin.netlify.app` starts its `<head>` with "This site is hosted
  on Netlify. Anyone can build and deploy a site like this one for free:
  https://netlify.new/?...utm_source=ai-legible..." and "Netlify hosting facts for this
  site". Branch previews do not get it, and it does not depend on who is asking (a
  browser, a search engine and an AI crawler all received it, 11 November 2026). It
  makes no request, sets nothing and is invisible, so it does not affect visitors or
  the privacy page. **Setting or plan feature: neither, as far as anything published
  shows.** Netlify documents no setting for it, no plan that removes it and no changelog
  entry; two support-forum threads (August and September 2026) asking exactly this have
  no answer from Netlify. It is not the "Powered by Netlify" badge, which Netlify does
  document, with an off switch (Project configuration -> General), and which this site
  does not carry. One forum user guessed it is not added on custom domains; check that
  when the domain is connected (`docs/DOMAIN-SETUP.md`, last check). Not worth paying to
  remove; if it matters, ask Netlify support.
- **New video stills have to be committed.** The build fetches a missing still once and
  writes it into `site/assets/img/video/`; until someone commits it, Netlify fetches it
  again on every build (see CONTRIBUTING, "Videos"). A failed fetch no longer stops a
  build.
- **Decap's login button fails contrast.** Lighthouse measures its text at 3.4:1
  (#798291 on #eff0f4) on `/admin/`. It is Decap's own interface, not the site's; it
  could be overridden in `site/admin/index.html`, but only through Decap's generated
  class names.
- **Text over the home page film is not machine-checked for contrast.** Lighthouse
  cannot measure text over video, and the frames vary.
- **The species list uses schema.org's Taxon type,** which schema.org still marks as
  pending (it comes from Bioschemas). It validates, but search engines may ignore it
  until it is final.
- **Netlify Pretty URLs creates two working URLs per page.** Links to `.html` pages are
  rewritten to extensionless addresses as they are served, so `/stops/stop-1` and
  `/stops/stop-1.html` both work. The canonical link names one of them.

## Needs people, not code

- **Connect the domain.** `cairdecorrin.ie` resolves, but to Letshost: plain `http`
  forwards to `cairde-corrin.netlify.app`, and every `https://www.cairdecorrin.ie` address,
  which all canonicals, `og:image` and the sitemap use, fails on an expired Letshost
  certificate. Until it is connected the site is effectively unindexable and shared
  links show no picture. `docs/DOMAIN-SETUP.md` is the complete procedure; it needs the
  Letshost and Netlify logins, and must leave the domain's email records alone.
- Stops 4 to 10 do not exist.
- About page: structure and names.
- Twenty audio transcripts.
- Fourteen photographs to identify.
- Pl@ntNet contributor name.
- The oral-history contributor's consent, which is still outstanding.
- The photography credit for the group's own photographs: the photographer has not yet
  agreed to be credited by name, so the site credits Cáirde Corrin until they do.
- Species names to confirm.
- Corrin Moor and Corrin Wetlands pages have no content.
- **Which YouTube videos the group owns.** The player is only for the group's own
  videos; someone needs to say which channel that is.
- **The group's Instagram and Facebook posts** for the home page block.
