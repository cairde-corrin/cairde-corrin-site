# Connecting cairdecorrin.ie to the website

This is the complete procedure for making the website answer at
`https://www.cairdecorrin.ie`. It assumes you have not followed any of the earlier work.
Allow an evening for the changes and a day for them to settle. Nothing here costs money.

## Why it matters

Every page already tells search engines and social media that its real address is
`https://www.cairdecorrin.ie/...` (the canonical link, the sharing image, the sitemap
and the structured data all say so). Until the domain points at the website, all of those
addresses fail, so search engines have nothing to index and shared links show no picture.
The site itself does not need to change; the domain does.

## What is there now (checked 11 November 2026)

| | |
|---|---|
| Registrar | Letshost (Team Blue Internet Services IE Ltd), registration runs to 17 June 2027 |
| DNS | Letshost: name servers `ns5.dnsireland.com`, `ns6.dnsireland.com`, `ns7.dnsireland.ie` |
| `cairdecorrin.ie` | A record `185.43.232.252`, a Letshost server |
| `www.cairdecorrin.ie` | CNAME to `cairdecorrin.ie` |
| `http://cairdecorrin.ie` | Letshost web forwarding: a 301 redirect to `https://cairde-corrin.netlify.app/` |
| `https://...` | Fails. The Letshost server presents a certificate for `forwarder.letshost.ie` that expired on 5 August 2025 |
| Email | MX `0 mail.cairdecorrin.ie`; `mail.cairdecorrin.ie` is its own A record, `185.43.232.252` |
| SPF | TXT `v=spf1 a mx include:spf.antispamcloud.com ip4:185.43.232.252 ~all` |
| `ftp.cairdecorrin.ie` | CNAME to `cairdecorrin.ie` |
| Record lifetime (TTL) | about 4 hours |

The website itself is the Netlify project `cairde-corrin`, at
`https://cairde-corrin.netlify.app`.

## Before you start

- **You need two logins:** the Letshost account that holds the domain, and a Netlify
  account with access to the `cairde-corrin` project.
- **Email at cairdecorrin.ie is hosted by Letshost and must not be touched.** This
  procedure changes only the two records the website uses. Leave the MX record, the
  `mail` record and the SPF TXT record exactly as they are. Ask Letshost first whether
  the group still uses email or FTP on its Letshost hosting; the answer only matters for
  step 5.
- **Keep DNS at Letshost.** Netlify can also run the domain's DNS, but moving it means
  recreating the email records there by hand, and a mistake stops email. Nothing here
  needs Netlify DNS.
- **Optional, a day ahead:** if the Letshost control panel lets you, lower the TTL of the
  `@` A record and the `www` CNAME to 300 seconds. Changes then take minutes instead of
  up to four hours.

## Steps

### 1. Add the domain in Netlify

1. Netlify -> the `cairde-corrin` project -> **Domain management** -> **Add a domain**
   -> **Add a domain you already own**.
2. Enter `www.cairdecorrin.ie` and confirm. Netlify adds `cairdecorrin.ie` alongside it
   automatically and will redirect one to the other.
3. Netlify asks whether you want to use Netlify DNS. **Do not.** Choose to keep your
   current DNS provider (external DNS). It then shows the domain as awaiting DNS
   verification and lists the records it expects; they should match step 3 below. If
   they differ, use Netlify's values.

### 2. Make www the primary domain

In **Domain management**, use the options button beside `www.cairdecorrin.ie` ->
**Set as primary domain**. The `www` form is what every page already names as its address,
and Netlify recommends a `www` primary when DNS stays elsewhere. Visitors who type
`cairdecorrin.ie` will be redirected to `www.cairdecorrin.ie`.

### 3. Change two DNS records at Letshost

In the Letshost control panel, open the DNS zone for `cairdecorrin.ie`.

| Name | Type | Change from | Change to |
|---|---|---|---|
| `@` (the bare domain) | A | `185.43.232.252` | `75.2.60.5` |
| `www` | CNAME | `cairdecorrin.ie` | `cairde-corrin.netlify.app` |

`75.2.60.5` is Netlify's load balancer address for external DNS. If Letshost offers an
ALIAS, ANAME or "flattened CNAME" record type for the bare domain, Netlify prefers
`ALIAS @ apex-loadbalancer.netlify.com` instead of the A record; either works.

Do not change any other record.

### 4. Turn off the Letshost web forwarding

The current redirect from `http://cairdecorrin.ie` to `cairde-corrin.netlify.app` is a
Letshost "web forwarding" or "URL redirect" setting, separate from the DNS records. Remove
it, or it may keep answering in place of Netlify. If you cannot find it, ask Letshost
support to remove the web forwarding for `cairdecorrin.ie`.

### 5. Decide about FTP

`ftp.cairdecorrin.ie` points at the bare domain, so after step 3 it would point at
Netlify. If nobody uses FTP on the Letshost hosting, leave it. If someone does, change it
to an A record for `185.43.232.252` so it keeps reaching Letshost.

### 6. Wait, then check the certificate

DNS changes take from a few minutes (if you lowered the TTL) to four hours, occasionally a
day. Once Netlify sees the records, it issues a free Let's Encrypt certificate for both
names automatically. Watch **Domain management -> HTTPS**. If the domain shows as verified
but no certificate has appeared after an hour, use the option there to verify the DNS
configuration or provision the certificate. There is no CAA record on the domain, so
nothing blocks Let's Encrypt.

Do not add an HSTS header yet. It is hard to undo, and nothing here needs it.

### 7. Point the news editor at the domain

On the `build` branch, in `site/admin/config.yml`, change:

    site_url: https://cairde-corrin.netlify.app
    display_url: https://cairde-corrin.netlify.app

to:

    site_url: https://www.cairdecorrin.ie
    display_url: https://www.cairdecorrin.ie

These only set where the editor's "view live" links go; editors and posts are not
affected. Check on the branch preview, then merge as usual. The invite and
password-reset emails need no change: Netlify fills in the primary domain itself, and the
home page forwards their links to `/admin/` on any domain (`docs/DEPLOY.md`).

## What changes for the site

- **Nothing in the pages needs editing.** Canonical links, `og:image` and `og:url`,
  Twitter cards, the sitemap, `robots.txt` and the structured data all already use
  `https://www.cairdecorrin.ie`. They start working the moment the domain does.
- **Shared links get their pictures.** Facebook, LinkedIn and the like fetch `og:image`
  from `www.cairdecorrin.ie`, which until now failed. Links shared before the change may
  keep a blank preview until the platform refetches; Facebook's Sharing Debugger can force
  it.
- **The QR sign addresses work on the real domain.** `https://www.cairdecorrin.ie/s/1`
  and the rest are served by the same `_redirects` file. Print signs only after checking
  them on the real domain (below).
- **cairde-corrin.netlify.app keeps working.** Check in the last section whether Netlify
  now redirects it to `www.cairdecorrin.ie`. If it does not, add this as the first line of
  `site/_redirects` on `build`:

      https://cairde-corrin.netlify.app/*  https://www.cairdecorrin.ie/:splat  301!

  It names only the production `netlify.app` host, so branch previews such as
  `build--cairde-corrin.netlify.app` are not affected.

## Verify afterwards

Run these from any terminal. Each line says what a correct answer looks like.

    dig +short cairdecorrin.ie                  # 75.2.60.5
    dig +short www.cairdecorrin.ie              # cairde-corrin.netlify.app. then Netlify addresses
    dig +short MX cairdecorrin.ie               # 0 mail.cairdecorrin.ie.   (unchanged)
    dig +short mail.cairdecorrin.ie             # 185.43.232.252            (unchanged)

    curl -sI https://www.cairdecorrin.ie/ | head -1                    # HTTP/2 200
    curl -sI https://cairdecorrin.ie/ | grep -i -E '^HTTP|^location'   # 301 to https://www.cairdecorrin.ie/
    curl -sI http://www.cairdecorrin.ie/ | grep -i -E '^HTTP|^location' # 301 to https://www.cairdecorrin.ie/
    curl -sI https://www.cairdecorrin.ie/s/1 | grep -i location        # .../stops/stop-1.html
    curl -sI https://www.cairdecorrin.ie/assets/img/og-default.jpg | head -1   # 200
    curl -sI https://www.cairdecorrin.ie/sitemap.xml | head -1                 # 200
    curl -sI https://cairde-corrin.netlify.app/ | grep -i -E '^HTTP|^location' # see above

    echo | openssl s_client -connect www.cairdecorrin.ie:443 -servername www.cairdecorrin.ie 2>/dev/null \
      | openssl x509 -noout -subject -issuer -enddate
    # subject www.cairdecorrin.ie (or cairdecorrin.ie), issuer Let's Encrypt, a date months ahead

Then, by hand:

1. Open `https://www.cairdecorrin.ie` in a browser, and on a phone: the padlock shows, the
   film plays, the map on the trails page draws.
2. Scan or type every `/s/1` to `/s/10` address: each lands on its stop page or the
   reserved page.
3. Send an email to `hello@cairdecorrin.ie` and reply from it. Both must work; if not,
   undo step 3 at once (below) and check the MX, `mail` and SPF records with Letshost.
4. Log in at `https://www.cairdecorrin.ie/admin/` and check that a draft still saves.
5. Paste a page link into Facebook's Sharing Debugger: it should show the page's picture.
6. Optional: add the domain to Google Search Console and submit
   `https://www.cairdecorrin.ie/sitemap.xml`.
7. Note in `docs/OPEN-ITEMS.md` whether production pages on the new domain still carry
   Netlify's "This site is hosted on Netlify" comment (see the open item about it).

## If it goes wrong

Put the two records back as they were (`@` A `185.43.232.252`, `www` CNAME
`cairdecorrin.ie`) and re-enable the Letshost forwarding. Email is unaffected throughout as
long as the MX, `mail` and SPF records were left alone. Remove the domain from Netlify's
**Domain management** only if you are abandoning the move; the `netlify.app` address
works the whole time either way.

## Sources

- Netlify Docs, Configure external DNS for a custom domain: <https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/>
- Netlify Docs, Get started with domains: <https://docs.netlify.com/manage/domains/get-started-with-domains/>
- Netlify Docs, HTTPS (SSL): <https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/>
- Netlify Docs, Manage multiple domains: <https://docs.netlify.com/manage/domains/manage-domains/manage-multiple-domains/>
