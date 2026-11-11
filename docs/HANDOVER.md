# Handing the website over

Everything the group needs to own the website outright, and the order to do it in so
that the site, the editor and the domain keep working throughout. Written for the
developer handing over and the person in the group taking over, to work through
together.

## What there is to hand over

| Part | What it is | Who holds it now |
|---|---|---|
| GitHub organisation `cairde-corrin` | Owns the repository. Created 11 November 2026 | Organisation, administered from the developer's personal GitHub account. Confirm who else is an owner: membership is not public |
| Repository `cairde-corrin/cairde-corrin-site` | All code, pages, data, docs, and every photo uploaded in the editor | The organisation. **Public** (see below) |
| Netlify project `cairde-corrin` | Hosting, builds, branch previews | A Netlify team. To confirm: most likely the developer's personal team |
| Netlify Identity on that project | Editor logins. Invite only, email and password | Moves with the Netlify project |
| Git Gateway on that project | Lets the editor save to GitHub | Uses a GitHub access token belonging to **whoever generated it**, most likely the developer's personal GitHub account. Must be replaced (step 4) |
| Domain `cairdecorrin.ie` | Registered at Letshost until 17 June 2027, with DNS and the domain's email there | To confirm which Letshost account holds it |
| Email `hello@cairdecorrin.ie` | Hosted by Letshost on the same account | As the domain |
| `archive/` folder | 180 MB: the 4K master of the home page film, the fourteen "ecology films" awaiting a decision, and a README describing them. Not in the repository and not deployed | Only on the developer's computer. Must be copied over (step 6). The original photo sets, documents and folklore sources came from the group's own folders and stay there |

Nothing else is needed. There is no database, no server, no paid service and no
password anywhere in the repository.

**The repository is public.** Anyone can read it. That is fine for the code and the
pages, but every photo uploaded through the editor is stored there exactly as uploaded,
with the location the phone recorded, even though the website only ever shows copies
with the location removed. No photo has been uploaded yet. Decide before the first one
whether to make the repository private (the site works the same either way; a private
repository may need Git Gateway reconnected, see `MAINTENANCE.md`) or to accept it. This
is the first item in `OPEN-ITEMS.md`.

## Before you start

The group needs, in its own name and not in any one volunteer's:

- **A GitHub account** for the person taking over the technical side, with two-factor
  login on. Ideally two people, so the group is never locked out by one person leaving.
- **A Netlify account** for the same person, and a Netlify team to hold the project.
  The free plan is enough (`MAINTENANCE.md` explains its limits).
- **Access to the Letshost account** that holds the domain, or knowledge of who has it.

Use an email address the group controls, such as one at cairdecorrin.ie, for these
accounts where possible, so they do not follow a person out of the group.

## The order

Each step leaves everything working. Do not remove the developer from anything until
step 7.

1. **GitHub: add the group's people as owners.** In GitHub, organisation
   `cairde-corrin` -> **People** -> **Invite member**, role **Owner**. They accept. The
   repository does not move, so its address, the Netlify connection and every link stay
   the same.

2. **Netlify: bring the project into the group's team.** Either invite the group's person
   to the team that holds the project now, as an Owner, or transfer the project to the
   group's own team (**the project -> Project configuration -> General -> Transfer
   project**; the person transferring must be an Owner or Developer on both teams).
   The project keeps its name, its address, its deploys and its editor accounts.

3. **Check the build still runs.** Push any small change to `build`, or press **Trigger
   deploy** on the branch, and watch it go green. If Netlify has lost access to the
   repository, relink it: **Project configuration -> Build & deploy -> Continuous
   deployment -> Repository -> Manage repository -> Link to a different repository**,
   and choose the same one.

4. **Replace the Git Gateway token.** The editor saves to GitHub using a token that
   belongs to a GitHub user. Logged into GitHub as the group's person, open **the project
   -> Identity -> Services -> Git Gateway** in Netlify and generate a new access token.
   Then log in to the editor, save a draft, check it appears under **Workflow**, and
   delete it.

5. **Editors.** Invite the committee members who will post news (`MAINTENANCE.md`,
   "Adding and removing editors") and give them `EDITOR-GUIDE.md`.

6. **The archive.** Copy the developer's `archive/` folder to storage the group controls;
   a shared drive is fine. `archive/README.md`, inside it, says what each item is. The
   website does not need it to run, but the film cannot be re-encoded without its 4K
   master.

7. **Remove the developer**, last, and only once steps 3 and 4 have been checked:
   delete their editor login under Identity, remove them from the Netlify team, and
   remove their GitHub account from the organisation. Then save one more test draft in
   the editor to confirm nothing depended on them.

8. **The domain**, whenever the group is ready, following `DOMAIN-SETUP.md`. It does not
   depend on the steps above, but it is simpler once the Netlify project sits with the
   group. If the Letshost account is held by one person, ask Letshost how to move it to
   the group's own contact details.

## After the handover

`MAINTENANCE.md` is the routine. `docs/README.md` lists every other document.
