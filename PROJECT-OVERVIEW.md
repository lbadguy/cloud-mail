# Cloud Mail SWNB Project Overview

This document is the handoff point for future agents and maintainers. It describes the production topology, the fork relationship, the Resend engagement customization, reading privacy, source headers, and the upstream update workflow. Never add tokens, raw private messages, or credentials here.

## 1. Repository and production

- Integrated stable upstream release: `v3.4.0`.

- Fork: `https://github.com/lbadguy/cloud-mail`
- Upstream: `https://github.com/maillab/cloud-mail`
- Production branch: `main`
- Production site: `https://mymail.lc7c.com`
- Worker configuration: `mail-worker/wrangler.production.jsonc`
- Production D1: `lc7c-cloud-mail-db`
- Production KV: configured in `wrangler.production.jsonc`
- Production deployment workflow: `.github/workflows/deploy-production.yml`

Git remotes are intentionally asymmetric: `origin` may push to the fork, while `upstream` is fetch-only. Do not push directly to the author's repository.

## 2. Main components

- `mail-worker/`: Cloudflare Worker, Hono APIs, D1/KV access, inbound email handling, Resend webhooks, and scheduled maintenance.
- `mail-vue/`: Vue 3 + Vite frontend bundled into Worker assets.
- `mail-worker/src/init/init.js`: compatible database initialization and additive migrations. Upstream versioned migrations are kept separate from the fork's `engagementDB` and `trashDB` migrations to avoid name collisions.
- `mail-worker/src/service/resend-service.js`: Resend webhook verification and event processing.
- `mail-worker/src/service/email-service.js`: email persistence and engagement counters.
- `mail-worker/src/lib/email-list-columns.js`: fields exposed to the frontend email list.
- `mail-vue/src/components/email-scroll/index.vue`: list status icons and tooltips.
- `mail-vue/src/views/content/index.vue`: sent-email engagement labels in the detail view.
- `mail-worker/src/api/update-api.js`: administrator-only update status and update dispatch API.

## 3. Resend engagement tracking customization

Subscribed events:

- `email.delivered`
- `email.complained`
- `email.bounced`
- `email.delivery_delayed`
- `email.failed`
- `email.opened`
- `email.clicked`

Added D1 fields on `email`:

- `first_opened_at`, `last_opened_at`, `open_count`
- `first_clicked_at`, `last_clicked_at`, `click_count`

Added table:

- `email_tracking_event`, with a uniqueness constraint used for webhook de-duplication.

Important behavior:

- The UI says “opened”. Clicking the indicator shows every recorded open time and explains that previews, security scanners, and privacy proxies can also trigger the event.
- Tracking is displayed for sent mail only.
- Webhook signatures are verified with Cloudflare Web Crypto HMAC-SHA256.
- Early events are retried when the email row has not reached D1 yet.

## 4. Administrator no-recipient claim

Inbound messages for addresses that do not yet exist remain isolated with `user_id=0`, `account_id=0`, and status `NOONE`.

- Creating an address does not automatically expose historical no-recipient mail.
- Only the administrator can use the claim action in `All Mail > No Recipient`.
- A message can only be claimed by an existing, active account whose address exactly matches the original recipient, case-insensitively. There is no fuzzy or `+tag` fallback.
- Claiming restores the message to the inbox and updates both the email and attachment ownership in one D1 batch transaction.
- Missing accounts, already-claimed messages, and other non-matches are skipped and reported to the administrator.

## Compose sender controls

The compose header lets users edit the display name for one message and choose among their own mailboxes without changing the mailbox currently selected in the sidebar. It reuses `/account/list` with its existing 30-item cursor pagination and permissions; `/email/send` still resolves the sender address from the owned `accountId`. No database migration is needed.

Drafts retain the selected mailbox and per-message name. Sender-only edits in replies and forwards count as changes when deciding whether to save a draft. The default mailbox name is not renamed. `manyType=divide` sends one independent message per recipient; the existing Resend path supports up to 100 recipients and rejects attachments in this mode.

Sender state helpers and tests: `mail-vue/src/utils/compose-sender.js`, `mail-vue/test/compose-sender.test.js`. UI: `mail-vue/src/layout/write/index.vue`.

## 5. Upstream update workflow

The workflow `.github/workflows/sync-upstream.yml` is disabled by default and can only be started manually.

When started manually for a check:

1. Fetch the latest stable upstream Release tag.
2. Create an `update/upstream-*` branch.
3. Merge that stable release into the branch.
4. Run frontend privacy tests, build the frontend, run Worker unit tests, and run Wrangler dry-run.
5. Push the verified branch and open a Pull Request against `main`.

It does not deploy production automatically. A text merge is not considered sufficient: review the behavior of the tracking fields, webhook handling, frontend list/detail fields, and database migrations.

Administrator-triggered behavior:

1. The admin opens System Settings in `mymail`.
2. The Worker checks the upstream latest Release and shows the release notes when a newer semantic version exists.
3. `Ignore this version` stores only that tag in the browser and does not suppress later versions.
4. `Update now` calls the authenticated Worker endpoint.
5. The Worker dispatches `sync-upstream.yml` with `apply=true` using a server-side GitHub token.
6. The workflow merges and validates upstream, pushes the verified result to `main`, and explicitly dispatches `deploy-production.yml` (pushes made with `GITHUB_TOKEN` do not trigger another push workflow).
7. A merge conflict or failed validation stops the update before production deployment.

The sync workflow also updates the frontend's displayed `currentVersion` to the exact stable release tag before validation, so the version label does not remain stuck on an older release after a successful update.

## 6. Required GitHub Actions configuration

Existing deployment secrets must remain configured:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `JWT_SECRET`

Add this repository secret for the administrator update button:

- `GITHUB_UPDATE_TOKEN`: a fine-grained GitHub token scoped to `lbadguy/cloud-mail` with `Actions: Read and write` permission. Contents write is not required: the workflow's own `GITHUB_TOKEN` performs the verified branch push. Keep this token only in Worker secrets; never place it in frontend code or committed `wrangler` vars.

The Worker variables are:

- `UPDATE_REPOSITORY=lbadguy/cloud-mail`
- `UPDATE_RELEASE_REPOSITORY=maillab/cloud-mail`
- `UPDATE_WORKFLOW=sync-upstream.yml`

## 7. Conflict and compatibility checklist

For every upstream update, inspect changes to:

- `mail-worker/src/entity/email.js`
- `mail-worker/src/init/init.js`
- `mail-worker/src/service/email-service.js`
- `mail-worker/src/service/resend-service.js`
- `mail-worker/src/lib/email-list-columns.js`
- `mail-vue/src/components/email-scroll/index.vue`
- `mail-vue/src/views/content/index.vue`

Then verify:

- D1 additive migrations still run against an existing database.
- The tracking fields and event table still exist.
- Duplicate webhook deliveries do not increase counters twice.
- Resend signature verification still rejects invalid requests.
- Frontend build, Worker unit tests, Wrangler dry-run, and a real sent-email test pass.

## 8. Current caveats

- GitHub Releases and `upstream/main` are different concepts. Both the UI and sync workflow use the latest stable Release; unreleased upstream commits are not installed.
- The upstream 3.4 theme selector uses the same persisted `themeMode` store as the header, including System mode.
- A stable Release is not a guarantee of zero bugs or compatibility with this Cloudflare account.
- The update button starts a controlled automation; it is not an unconditional blind deployment.
- Keep unrelated local files and deployment notes out of feature commits unless they are explicitly part of the requested change.

## 9. Reading privacy and source headers

### Reading privacy (default on)

- Personal Settings > Reading privacy > Block read tracking. The switch is stored per account in the current browser by `mail-vue/src/store/privacy.js`; it is not synced to other devices. Missing preferences fail closed.
- The short explanation lives in a hover/focus/tap help icon beside the switch. In mail detail, the far-right shield temporarily toggles protection for that open message only; switching mail, leaving the route, or changing the account/global preference restores the default. It never writes the per-account preference.
- `mail-vue/src/utils/email-html.js` sanitizes HTML with DOMPurify, removes automatic image/network attributes, strips active elements and tracking-link pings, and generates a document whose CSP is placed before email content.
- `mail-vue/src/components/shadow-html/index.vue` now uses a script-disabled sandboxed iframe, not Shadow DOM. CSP blocks external CSS imports, CSS images, fonts, frames, media, scripts, forms, and network connections while preserving ordinary inline mail layout. Embedded raster data images are allowed; external/CID-rewritten images may be hidden.
- Reply/forward quotes and reopened drafts are sanitized before entering TinyMCE. In protection mode their styles are stripped to avoid unsandboxed CSS requests.
- Protection off explicitly permits external mail images; it does not enable scripts. Never turn it off on a suspect message for testing.
- Local mailbox read/unread flags and outgoing Resend engagement events are unchanged. This does not undo historical requests or protect intentional links, replies, attachments opened separately, other mail clients, or untrusted browser extensions.

### Source and authentication (detail only)

- New inbound mail stores allowlisted, bounded PostalMime header claims in nullable `email.source_headers`; `sourceHeadersDB` is additive and repeat-safe. There is no raw MIME archive or reliable originating-peer IP provided by this implementation.
- Production workflow prepares the column before deploying code, after confirming a D1 recovery point. A manual deploy must likewise prepare this column first. Normal `/api/init` remains repeat-safe; retaining the column after Worker rollback is harmless.
- Personal endpoint `/api/email/source?emailId=...` restricts SQL to the logged-in owner. `/api/allEmail/source` uses the existing `all-email:query` permission/admin middleware. Both return `Cache-Control: no-store`.
- Source headers are deliberately excluded from full and brief list projections. The toolbar source icon appears after Forward (after Delete in administrator All Mail). It lazily fetches headers when clicked and opens a dialog; opening a mail alone does not fetch them. Raw headers remain collapsed.
- `mail-vue/src/utils/email-source-summary.js` extracts a display summary: sending server, candidate IPs, signing domains and SPF/DKIM/DMARC claims. MAIL FROM SPF takes precedence over HELO SPF; mixed results stay mixed, and a DKIM signature alone never becomes a successful authentication result. The summary is not an independent verifier. Short help tooltips explain these limitations.
- `mail-worker/src/lib/email-source.js` extracts deduplicated candidate public IPs from Received/X-Originating-IP. These can be relay/provider addresses or forged claims, not a verified person or location. Authentication-Results are shown as unverified header claims, not independently validated results.
- No IP/geolocation lookup, third-party request, DNS lookup, or sending of private mail is performed. Historical messages cannot be backfilled; internal mail may lack source data.

### Repeatable verification

Use PowerShell 7, stop on failures, and check native exit codes. Note: upstream `mail-worker`'s `pnpm test` **deploys a test Worker**, so use the explicit unit-test command below instead.

1. `pnpm --dir mail-vue test` (DOM sanitization, CSP, preferences).
2. From `mail-worker`: `pnpm exec vitest run --config vitest.unit.config.js` (source capture/access, schema/data preservation, existing engagement/claim tests).
3. `pnpm --dir mail-vue build`.
4. From `mail-worker`: `pnpm exec wrangler deploy --dry-run --config wrangler.production.jsonc`.
5. From `mail-vue`: `node test/privacy-probe-server.mjs`; open `http://127.0.0.1:3001/test/privacy-browser.html` in a real browser. It serves only synthetic localhost tracking probes: repeated protected views/editor must produce zero requests, with a positive unprotected image control. Stop the server afterward. Test files are not production entry points.
   Also open `/test/privacy-ui.html` for actual mail-detail/settings components with synthetic data and local-only API mocks: verify toolbar order, temporary shield override without changing the global default, reset after mail/route changes, dialog summary/raw collapse/Escape behavior and desktop/mobile layouts. `/test/probe/count` records local image and source API requests; unexpected mock API paths are rejected. Node tests also cover dual SPF results, quoted/commented claims, mixed DKIM, ARC/Received-SPF fallback and malformed data.
6. After pushing, verify the exact commit's production workflow, schema initialization, live Personal Settings/default-on switch and an incoming detail. Do not send a real test email or disable protection on a real suspect email without explicit user approval. Report new live inbound-header capture as unverified unless actual inbound data is available.

## Fork changelog and engagement history

- Login GitHub link points to the fork. The authenticated header GitHub button opens a drawer with separate feature and commit lists.
- Feature inventory and reviewed commit translations: `mail-vue/src/data/fork-history.js`. Add one item per new or changed feature when maintaining this fork.
- `mail-vue/scripts/changelog.mjs` reads every first-parent commit since fork base `ec7a2bb` at build time. It excludes the individual upstream commits brought in by merges. Uncurated future commits still appear using their subject. Production checkout must keep `fetch-depth: 0`. Source archives use the reviewed bundled snapshot.
- Personal and all-mail click history routes: `/email/clickEvents`, `/allEmail/clickEvents`. They reuse existing tracking rows and ownership/all-mail permissions. Both open and click histories are returned with `Cache-Control: no-store`; no database migration is required.
- Click indicators in lists and detail views open the same history component as open indicators. Event types are queried separately, newest first, and times follow the existing detail-date formatter.
- This feature does not collect or retain IP addresses, User-Agent values, or clicked URLs. Older tracking rows cannot supply those fields.

## Attachment previews

Mail detail attachments use a lazy-loaded, site-hosted preview dialog. Both personal mail and All Mail are supported. New binary endpoints `/email/attachmentPreview` and `/allEmail/attachmentPreview` resolve attachment IDs through D1, require matching email ownership or the existing All Mail read permission, and read only a saved `attachments/` storage key. Responses are streamed with a 25 MiB cap, `no-store`, `nosniff`, and an attachment disposition. No database changes are required. Existing public storage/download routes are unchanged by this feature.

- PDF: PDF.js canvas and text layers, page thumbnails, page navigation, zoom and fit width. Fonts, CMaps and decoders are shipped with the site. No scripting manager, annotation links, forms or XFA are enabled. Password-protected PDFs and documents over 500 pages fall back to downloading.
- Raster images: verify file signatures, decode and re-encode to a local PNG for display. SVG and HTML are not supported.
- Text: TXT/CSV/TSV/JSON/Markdown/XML/YAML/log files are escaped as text, not rendered as HTML or Markdown. UTF-8, UTF-16 BOM and GB18030 are handled. Limit: 2 MiB.
- DOCX: Mammoth in a terminable worker, with external file access disabled. Converted HTML is allowlisted and placed in a scriptless, opaque-origin sandbox with a restrictive CSP. This is a reading view, not original page layout.
- XLSX: read-excel-file in a worker, displaying saved values without formula evaluation, external relationships, charts or embedded objects. Up to 50 sheets; each preview shows at most 500 rows and 100 columns and reports truncation.
- Legacy DOC/XLS, PPT/PPTX, macro-enabled Office files, archives and other formats remain download-only. No online Office/Google viewer receives attachments or public file URLs.

Previews always block document remote content, independent of the mail-body privacy toggle. They do not claim to protect files subsequently opened in another app or prevent users from intentionally visiting links elsewhere. ZIP expansion is checked before Office parsing; parsing has a 15-second timeout and workers are terminated on close. New custom features must be added separately to `mail-vue/src/data/fork-history.js`; commit history is generated automatically.

Relevant checks: frontend `test/attachment-preview.test.js`, Worker `test/attachment-preview-auth.unit.spec.js`, frontend production build and Wrangler dry-run. Use synthetic hostile documents to verify external requests remain blocked; do not send real mail as part of routine preview QA.
