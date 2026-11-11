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
- **Netlify injects a promotional HTML comment on production.** Unknown whether that is
  a setting or a plan feature.
- **The gallery is not in the main navigation.** The nav already holds nine items and
  is tight between 901 and 1000 px, so a tenth waits for the Phase 8 nav work. Until
  then the gallery is reached from the home page's photo section, which links to it
  once it has at least one photo.
- **Video thumbnails depend on YouTube at build time.** If YouTube cannot be reached
  while Netlify builds, the build stops with a message naming the video, and nothing is
  published until it succeeds.

## Deferred to Phase 8

- **Sub-11px type site-wide.** Interacts with the 901-1000 px nav rule.
- **Trail structured data for AEO:** distance and ascent.
- **Netlify Pretty URLs creates two working URLs per page.**
- **The domain.** Canonicals and og:image point at www.cairdecorrin.ie, which does not
  resolve, so the site is effectively unindexable.

## Needs people, not code

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
