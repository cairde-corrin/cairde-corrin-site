# Open items

Everything about the website that is still outstanding, in one place, grouped by what it
needs: a decision by the group, some code, or a person to do or confirm something. When
an item is settled, remove it here in the same change.

Last reviewed 11 November 2026.

## Needs a decision

1. **What to do if Netlify's free allowance runs out.** On the credit-based free plan,
   each editor publish costs 15 of 300 monthly credits and visitors' bandwidth costs more,
   so a busy month could pause the site until the next (`MAINTENANCE.md`). Options if it
   happens: a paid plan, Netlify's open-source programme (larger allowance, its own
   conditions), or serving less (the home page film is the largest item). First check
   which plan the account is on.
2. **When to move the editor off Git Gateway.** Netlify has deprecated it; it works, but
   will not be fixed if it breaks. `CMS-MIGRATION.md` says what would trigger the move
   and what it costs editors (each would need a GitHub account).
3. **The fourteen "ecology films" in `archive/`.** Screen recordings of a third-party
   plant platform, not field footage, 131 MB. Keep, or let go.
4. **Firefox downloads the 8 MB home page film and cannot show it** (it shows a still
   instead). Accepted so far as the price of the film working everywhere else; worth
   revisiting if Firefox use matters.
5. **Netlify's promotional comment.** Netlify adds an invisible "This site is hosted on
   Netlify..." HTML comment to every production page. It is not a documented setting or
   plan feature, Netlify has not answered the two forum threads asking about it, and it
   is not the "Powered by Netlify" badge (which has an off switch and which this site does
   not carry). It makes no request and sets nothing. Decided: do not pay to remove it.
   Check whether it is still there once the domain is connected.

## Needs code

- **Decap's login button fails contrast** (3.4:1, its own styling). It could be
  overridden in `site/admin/index.html`, but only through Decap's generated class names,
  which an update can change.
- **Netlify's Pretty URLs give each stop page two working addresses**
  (`/stops/stop-1` and `/stops/stop-1.html`). Turn Pretty URLs off in Netlify's post
  processing settings, or accept it: the canonical link already names one address.
- **Contrast of the text over the home page film** has never been measured: automatic
  checks cannot read text over video. Check it across the film's frames.
- **The species list uses schema.org's `Taxon` type**, which schema.org still marks as
  pending. It validates; search engines may ignore it until it is final. Nothing to do
  but notice when it is.

## Needs another person

**Content and confirmation, from the group**

- Stops 4 to 10: positions, photographs, bearings and text. The pages and sign
  addresses already exist.
- Audio for stops 2 and 3. None of the nineteen recordings matches those stops in time
  or place, so none has been used.
- Twenty audio transcripts.
- GPS traces of the routes beyond the Glenabo loop.
- The About page: the committee's structure, and names, once each person agrees to be
  named.
- The local authority on the About page. "The local authority" is used until the group
  confirms which one (Cork County Council is the likely answer, but it is an inference).
- The Corrin Moor and Corrin Wetlands pages have no content yet.
- Fourteen photographs to identify.
- The species in the ten home page carousel photographs; their descriptions name no
  species until then.
- Species names to confirm, and Tormentil, which is carried as a proposed determination.
- The Pl@ntNet contributor's name, for the credits.
- The photography credit: Eoin O Keefe is a working attribution, unconfirmed.
- Veronica Whyte's consent.
- Which YouTube channel is the group's, since the video player is for its own videos
  only; and the group's Instagram and Facebook posts for the home page.
- A field check of the catchment divide in the south-east, around 52.116°N 8.295°W, where
  the modelled boundary is least certain.

**Accounts and set-up**

- Connect the domain: `DOMAIN-SETUP.md`. Needs the Letshost and Netlify logins. Until
  then every `https://www.cairdecorrin.ie` address fails, so the site cannot be indexed
  and shared links show no picture.
- The handover: `HANDOVER.md`. Several parts currently sit with the developer's personal
  accounts.

**Tests that need a real person or a real device**

- The editor end to end, by a committee member: accept an invitation, write a post with a
  photo in the text, save it, check it is not live, publish, check it on the site, delete
  it. The invitation itself has only been tested with made-up codes.
- Photos chosen on a real iPhone, from Photo Library and through **Choose File**. The
  browser-side shrink, which also converts iPhone HEIC, was tested in Safari's engine,
  Chrome and Firefox on a computer, not on a phone.
- The navigation and the map on a real phone, by finger, outdoors. So far tested in
  Safari's engine, Chrome, Firefox and the iPhone simulator, driven by script.
- A screen reader (VoiceOver, TalkBack or NVDA). Labels were checked in the browser's
  accessibility tree, but nobody has listened to the site.
- The first real video post and the first real social posts, to see the still and the
  cards with the group's own material.
