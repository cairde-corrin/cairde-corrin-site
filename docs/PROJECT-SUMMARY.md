# Cáirde Corrin - project summary

A static website for a voluntary group in Fermoy, Co. Cork, covering the Glenabo
catchment and Corrin Hill, built to support a partnership proposal to Coillte. Written
in August 2026 and brought up to date in November 2026. This is the document to give
someone who asks what the site covers and whether it can be relied on.

The governing rule throughout: **nothing is invented.** Every figure,
coordinate, area, date, species name and description traces to a file in this
repository, a document the group supplied, or a source that was fetched and
checked. Where a fact was not available the site says "to be surveyed" or leaves
the section out. That rule cost the site some polish and is the reason it can be
put in front of a landowner.

26 pages. 99 MB deployed, of which 87 MB is audio, film and photography.

---

## 1. Coverage against the group's site map

From `Cáirde Corrin Site Map.pptx`. Every box in the deck, and what exists.

| The deck asked for | Status | Where |
|---|---|---|
| **Home**: logo, vision, strands of work | done | `/` |
| **About**: our structure | **partial** | `/about/` has vision, mission, partners and how to get involved. There is no structure section because no source describes the committee's structure. |
| **About**: our names | **not done** | No named living person is published without written consent for the naming. |
| **About**: who we work with | done | `/about/` |
| **About**: how to get involved | done | `/about/` |
| **Strand 1**: map of trails showing points | done | `/trails/`, interactive vector map |
| **Strand 1**: stops 1 to 10, each with title, text, images, audio | **3 of 10** | Stops 1-3 are built from real field data. 4-10 exist as pages so the sign addresses resolve, and say they are to be surveyed. Only stop 1 has audio. |
| **Strand 2**: coming soon | done | `/new-spaces/`, the four phases from the proposal |
| **Strand 2**: Corrin Moor dedicated page | **shell** | `/new-spaces/corrin-moor.html`, `noindex`. No source document describes it. |
| **Strand 2**: Corrin Wetlands dedicated page | **shell** | `/new-spaces/corrin-wetlands.html`, `noindex`. A presentation exists but is a vision deck, not fact. |
| **Strand 3**: why invasives are a problem, link to invasives.ie | done | `/water/` |
| **Strand 3**: plant examples - cherry laurel, rhododendron, Japanese knotweed | done | `/water/`, all three, attributed to Invasive Species Ireland |
| **Strand 3**: animal examples - grey squirrel, mink, Asian hornet | done | `/water/`, all three |
| **Strand 3**: pictures from area | done | `/water/` |
| **Strand 3**: links to surveys | done | `/water/` to the National Biodiversity Data Centre and to `/recordings/` |
| **Strand 3**: what to do / what not to do | done | `/water/` |
| **Strand 3**: 1% changes you can make | done | `/water/`, using the group's own phrasing |
| **Links**: Corrin nature reserve, Biodiversity.ie, Invasives.ie, Leave No Trace, Coillte, Tree Council | done | `/links/`, all six, each URL fetched before it was added |
| **QR**: each stop reachable by direct link | done | `/s/1` to `/s/10` in `site/_redirects` |

**Nothing in the deck was skipped for convenience.** The four gaps are: no
committee structure or names because there is no source and no consent; seven
stops unsurveyed; two dedicated pages with nothing factual to put on them; nine
stops without audio.

## 2. What exists that the deck did not ask for

| Addition | Why |
|---|---|
| `/species/` | 13 species recorded on the trails in August 2026, each with its determination, records, and a licensed reference photograph. The deck had no species page; the group had the records. |
| `/folklore/` | Five stories from the Schools' Collection summarised and linked to dúchas.ie. The deck mentioned folklore only as stop content. |
| `/recordings/` | Nineteen field recordings from one morning, in the order they were made, with real durations. Plus three short films. |
| `/credits/` | Every photograph, licence, map source, folklore reference and determination in one place. Written because the accuracy claim is worthless if the sources are not visible. |
| `/privacy/`, `/terms/` | Published. Terms carries the land access and liability position, which matters for a site describing ground the group does not own. |
| The catchment mapping | The flow-routed catchment (about 360 ha), the 9.9 km² action area, the modelled channel network and relief, drawn as a vector map with layer controls. |
| The home page film | The 4K clip the group already had, scrubbed by scroll position where the browser can do it. |
| News, gallery and an editor | A news section, a photo gallery and the home page's social posts, written by committee members in a small editor at `/admin/` (`docs/EDITOR-GUIDE.md`). Photos are re-encoded with their location removed; videos load nothing from YouTube until played. |
| `sitemap.xml`, `robots.txt`, structured data | 16 URLs. Schema.org data on every page, validated against the schema.org vocabulary: the organisation, the loop with its length and climb, the catchment with its area, each stop, the species list, the stories and the recordings. |

## 3. Provenance

Where every class of claim on the site comes from.

| Claim | Source | Confidence |
|---|---|---|
| Relief 21-213 m OD, longest flow path about 4 km | Low end: OPW gauge 18124, the river at the confluence. High end and flow path: Copernicus GLO-30 inside the routed boundary (`tools/catchment.py`) | Low end ±1 m; high end is a wooded cell, bare ground about 9 m lower; flow path overstated by up to 8% (D8) |
| Catchment about 3.6 km² (about 360 ha) | Flow-routed on Copernicus GLO-30 to the Blackwater confluence (`tools/catchment.py --write`); the boundary measures 3.58 km². Compared with c. 3.7 and c. 3.92 km² (Roughan & O'Donovan, 2021 and 2022) and 3.75 km² (FABDEM, a check only) | Firm to about ±20 ha |
| Action area 9.9 km² (about 990 ha) | A drawn proposal traced from the group's map; the outline measures 9.86 km² | As drawn |
| Outlet 52.1333°N 8.3002°W, Munster Blackwater, HA 18 | Derived from the catchment geometry | Firm |
| Channel network | Modelled from elevation for the group's original map, **not walked**, clipped to the routed boundary. No length is published | Modelled, and labelled "partial" |
| Stop 1-3 positions, bearings, times | EXIF of the photographs taken at each stop. Never estimated. Times are Irish summer time | Firm, ±10-20 m as GPS allows |
| Stop and photograph elevations | The walk's own GPX and Copernicus GLO-30, rounded to 5 m. Not EXIF: the Pixel 8a records height above the ellipsoid, about 57 m above sea level here | ±5 m |
| Recording durations and times | ffprobe. Timestamps reconstructed from `creation_time` as end-of-recording UTC, validated against 10 independent photograph timestamps, all within 20 s | Firm |
| Species names and determinations | Pl@ntNet records made by a group contributor, read off the source recordings | **As accepted by the contributor. Not independently verified.** Tormentil is marked proposed. |
| Species reference photographs | Wikimedia Commons, 12 files, each CC BY or CC BY-SA, binomial in the file title, photographer and licence displayed | Firm on licence; the photograph shows the species, not the recorded plant |
| Folklore | National Folklore Collection, UCD, on dúchas.ie under CC BY-NC 4.0. Volume and page recorded for each. Summarised, never reproduced. | Firm as to source; the stories are folklore |
| The four phases, the 600 m extension, the 15 km loop, Waste Recovery Services, the consent and assessment conditions | `Cairde Corrin 4-Phase Proposal to Coillte.docx`, close to verbatim | Firm |
| Vision and mission wording | The group's own site map deck, verbatim | Firm |
| Invasive species descriptions | After Invasive Species Ireland, attributed and linked on the page | Second-hand, attributed |
| Base mapping | OpenStreetMap contributors, ODbL | Firm |
| Photographs of the catchment | 4 and 11 April 2026, in-catchment position confirmed against the catchment polygon from each file's GPS | Firm |
| Hero film | Composite: photographed in the Glenabo catchment on 11 April 2026, **with wildlife added digitally**. Disclosed on the credits page. | Disclosed |

## 4. Outstanding

Everything not yet done, from stops 4 to 10 to names awaiting consent, is kept in one
place, `docs/OPEN-ITEMS.md`, grouped by whether it needs code, a decision, or someone
outside the code.

## 5. Known limitations

Things that are true about this site and worth saying out loud.

- **Firefox does not get the film.** It accepts every seek and paints nothing, at any resolution, bitrate, GOP length or seek method. The site measures this at runtime rather than sniffing the browser's name, and serves the poster instead. It still downloads the 7.99 MB clip before it can tell: a cold Firefox visit transfers 8.29 MB where 0.30 MB would do. That is why the film is encoded at CRF 22 rather than 18, which cost 11.91 MB for a difference nobody sees at this size.
- **Positions are phone GPS**, good to roughly 10-20 m. The site says so on the credits page and in the terms. Do not navigate by it.
- **The channel network is modelled, not surveyed.** It is drawn from elevation data and labelled partial.
- **Species determinations are not verified.** One contributor, one app, no second opinion.
- **The site is heavy where it is heavy for a reason.** 33 MB of audio and 27 MB of film. Nothing loads until it is asked for: the audio is `preload="none"`, the films are posters until pressed, and the hero is fetched only where the browser can scrub it. A page without media is 85 KB cold.
- **No committee names, and no photographs of identifiable people.** Consent is held for the archive photographs that show people; the names await the individuals' agreement to being named.
- **`/new-spaces/corrin-moor.html` and `corrin-wetlands.html` are shells** and carry `noindex`. They exist so the navigation is honest about what is coming, not because there is content.
- **The invasive species descriptions are second-hand.** Attributed to Invasive Species Ireland rather than presented as the group's own survey work.
- **No analytics, no forms, no cookies, no third-party requests.** The one exception is a video in a news post, which loads from YouTube only when a visitor presses play. Adding anything else makes `/privacy/` wrong.
- **The catchment is modelled.** Its boundary is flow-routed on a 30 m elevation
  model and is good to about one cell, roughly ±20 ha. The earlier figures,
  3.30 km² and 330 ha, came from a boundary traced off a map image; they are
  withdrawn and must not come back. Other delineations give 3.7 to 3.92 km²; see
  `docs/CONTRIBUTING.md`. The action area is still a traced drawing: it is published
  as 9.9 km² and its outline measures 9.86 km².
- **Good enough for maps and discussion, not for boundaries.** The positions and areas
  are adequate for web mapping, navigation and discussion, and not for boundary
  definition, planning submissions or anything with a legal consequence.
