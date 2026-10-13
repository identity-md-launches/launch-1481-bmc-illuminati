# BMC Illuminati design system

This documents the implemented source as delivered on 2026-10-13, rather than a proposed redesign.
The existing site and routes are retained. The final layer uses black, warm white and gold, actual
Genesis artwork, restrained surfaces and clear transaction states. The product and “Mint BMC Pass”
action appear in the first viewport at 390 px. The mint entry likewise exposes Connect Wallet first.

## Source of truth

- `website/platform.css`: shared tokens and overrides for the preserved application stylesheet.
- `website/site.js`: recovered editable React application and new wallet, gallery, staking and dashboard.
- `website/styles.css`, `website/mint/index.html`, `website/app.js`: standalone mint UI with the same palette.
- `web/src/platform.ts`: shared loading, unavailable, account/network and read-only blockchain state.
- `website/assets/index-CPnoBN9P.css`: original layout primitives; retained byte for byte.

## Colors and semantic roles

| Role | Shared token / mint equivalent | Value |
| --- | --- | --- |
| Canvas | `--color-bg` / `--bg` | `#090909` |
| Raised background | `--color-bg-elevated` | `#121210` |
| Surface | `--color-surface` / `--card` | `#151512` |
| Surface hover | `--color-surface-hover` | `#22221c` |
| Primary text | `--color-text` / `--text` | `#f5f0e4` |
| Secondary/muted text | `--color-text-secondary`, `--color-text-muted` / `--muted` | `#bcb7aa` |
| Hairline separator | `--color-border` / `--line` | `#35352c` |
| Input/control boundary | `--color-border-strong` | `#777263` |
| Main action | `--color-accent`, `--gold-500` / `--gold` | `#d4af37` |
| Link / hover / notice | `--color-accent-strong`, `--gold-300` / `--gold2` | `#ecd68d` |
| Focus indicator | `--color-focus` | `#fff1b0` |
| Error | `--color-danger` / `--danger` | `#ffa79b` |
| Disabled button surface | Component rule | `#25251e` |

Gold buttons use black text. Status labels pair color with readable words; neither availability nor
failure depends on color alone. Informational notices use a gold leading rule and native disclosure.
No gradient text, perpetual glow, nested card treatment or ornamental shadow is added.

Computed solid-color ratios (WCAG relative-luminance formula): body 17.51:1, muted text on surface
9.14:1, button text 9.47:1, light-gold links on surface 12.69:1, control boundary 3.81:1, focus against
canvas 17.50:1 and error text on surface 9.80:1. The rendered home probe separately passed its text
contrast checks. These sample ratios do not claim every image pixel or all possible browser states
were exhaustively measured. Decorative low-contrast separators do not serve as field boundaries.

## Typography

The retained UI uses `"SF Pro Text", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
Helvetica, Arial, sans-serif`; the mint page uses the equivalent system stack. No font is downloaded.
Georgia / Times New Roman provides the display heading; the inherited SF Mono / system monospace
stack is limited to addresses, hashes and code. Body prose remains in the sans-serif face.

The final scale has six possible steps: **14, 16, 20, 24, 36 and 56 px**. Small labels and addresses
are 14, inputs/body 16, tertiary headings 20, section headings 24; the main display changes from
56 desktop to 36 mobile. The rendered home uses five distinct sizes per viewport. Weights are 400,
600 and 700. Display tracking is -0.035em; body and labels have natural spacing, with no small
tracked-capital eyebrow. Body line height is approximately 1.6 and headings 1.05–1.3. Numerical
balances use tabular figures. Errors and data statuses use ordinary sentences.

## Spacing, geometry and responsiveness

Spacing primarily uses 4, 8, 12, 16, 20, 24, 32, 48, 56 and 64 px. The shared content cap is 76rem;
mobile side gutters are 16px. The standalone mint has a 1280px outer navigation cap and 1180px main
content cap. Actions have at least 44px height, 8px corner radius, and visible focus. Notices use
square leading rules; cards use 10–14px radii and simple boundaries. Artwork previews use a small
4px radius and preserve their full visual area. Addresses wrap in explanatory and transaction areas.

The root hero uses two columns on desktop. At 700px and below it becomes one column; the primary
action spans the row, secondary actions share the next row, and the real artwork becomes a compact
100px image beside its caption. This preserves first-screen product/action visibility without
hiding the art or waiting for an intro. Root galleries go from four to three columns at 960px and
two at 700px. Staking moves from two columns to one at 700px. Dashboard values become labeled rows.

The main navigation collapses below 1250px using the inherited small-screen menu plus a tablet
override. Mobile header wallet controls move into the menu/page to avoid crowding. Community links
wrap below the brand. Small navigation links have at least 24px targets with spacing; ten measured
home controls fall below the comfortable 44px size, and the probe reports that limitation. Primary
buttons, menu toggle, wallet controls and form actions meet 44px.

The mint page adjusts its statistics/gallery at 850px, then changes the hero/forms to one column
and gallery to two columns at 600px. Its mobile hero artwork is 84px. Dialog width is limited to
600px or the viewport minus 32px, with internal vertical scrolling and a dim backdrop. Both views
honor safe-area bottom spacing. Root, mint and six hash routes were checked at 320/390/768/1440px.

## Components and interaction states

| Component | Implemented behavior |
| --- | --- |
| Navigation | Skip link first in keyboard order; current route exposed; mobile button has expanded state, Escape closes and restores focus. Route changes focus the main region, not initial load. |
| Wallet controls | Explicit Connect, wallet selection, address/network, Switch to Ethereum, interface Disconnect. Every variant keeps a persistent `role="status"` region beside its controls; compact/quiet variants omit only the default account-access hint. Nonempty wallet messages always display. The empty region is visually clipped without taking layout space; desktop header messages wrap within 24ch using the existing 14px secondary-text token. |
| Deployment disclosure | Names both actual addresses and labels the source-matched read-only deployment. Public transaction lock is stated next to the product/action. |
| Collection statistics | Loading, live block-tagged read, unavailable/retry and closed/sold-out states. No zero substituted for a failed read. |
| Artwork gallery | Real local Genesis previews, Standard SVG tab, eight initial previews, then up to twelve more per action, original links and image errors. The separate planned-slot diagram remains explicitly illustrative, starts at eight slots, adds eight per action and resets to eight when a rarity filter changes; all 500 slots remain accessible. |
| Staking form | Labeled decimal amount, exact-amount intent, available wallet balance and inline invalid-amount message; all money actions disabled with an adjacent reason. Unknown position/rewards/unlock are unavailable. |
| Dashboard | Read-only BMC/ETH/NFT balances, bounded ownership search and per-token lookup links; account changes discard stale owned-token results. |
| Mint flow | Distinct Genesis/Mystery actions, current price and remaining supply; Mystery risk acknowledgement; separate reveal action. Expiry disclosure explains that reveal selects remaining Standard inventory first, then Genesis if no Standard remains, and retains the manipulation warning. Initial HTML and code both enforce PRE_LAUNCH. |
| Transaction review | Native modal dialog, default focus on Cancel, Escape/cancel with focus return, sender/recipient/spender/amount/estimated fee, separate approval and mint confirmations. Pending/rejected/reverted/unknown outcomes are explicit. |
| Transaction status | Etherscan links for known hashes, two-confirmation progress, persisted pending lock, manual recheck without automatic resend. |
| Community | Confirmed GitHub/Etherscan plus collection/staking navigation; X and Telegram shown as unconfirmed text with icons, not invented links. |

All image alt text describes the actual artwork. Decorative icons are hidden from accessibility APIs.
Inputs have persistent labels and 16px text. Inline form errors use described-by and invalid state;
wallet and transaction messages use live status regions. Focus uses a light outline with offset.
Forced-color rules retain a system focus/control boundary. Root background effects and initial
animations are disabled; the original intro remains optional via Replay. Reduced motion suppresses
nonessential animation and smooth scrolling. Nothing autoplays on the landing screen.

## Better Interface review across six domains

The pinned guide was consulted during implementation, including all six domains and its documentation
workflow. Applicable findings were repaired and checked again. Full validation commands, source
locations and limitations are in [docs/VALIDATION.md](docs/VALIDATION.md).

The review revision keeps the existing tokens, typography, breakpoints and artwork. Its changes are
limited to visible wallet feedback, accurate expiry wording and a shorter planned-slot preview.
The revised 390px allocation grid measures 850.75px in Chromium, down from 5184.5px. Browser status
semantics were checked, but actual screen-reader announcements remain unverified.

| Domain | Applied review and outcome |
| --- | --- |
| Accessibility | Semantic links/buttons/labels, keyboard skip/menu/gallery/dialog, visible focus, cancellation focus return, status announcements, readable contrasts, reduced motion. Physical screen-reader and native wallet extension testing remain unperformed. |
| Layout | First-screen action at 390, compact header, two-to-one-column forms, wrapping addresses and community links, galleries and subpath routes. No horizontal page overflow in tested widths, including a 200% CSS text-size root check. |
| Writing | Short product heading and plain description, exact burn/fee consequences, no promised yield, unknown data distinguished from zero, explicit contract discrepancy and unofficial socials. Duplicate wallet helper copy found by the probe was removed. |
| Typography | One six-step scale, three intentional font roles/weights, system fonts, no small tracked caps, readable line lengths. Root rendered probe passes. |
| Colors | Black/gold identity, warm readable text, distinguishable errors and focus, solid-color ratios above; semantic state words supplement color. |
| UI | Explicit transaction reviews, default-deny writes, persisted pending state, normal retry without resend, local real artwork, bounded read/lookup, safe disabled staking with a working amount form. |

The pinned design-critic probe passed **16/16** on the final export. Chromium and WebKit screenshots
were made and inspected. Screenshot files live only in `test/scratch/` during verification and are
not shipped to fit the bundle budget. CSS text enlargement is not a native browser-zoom test; the
RTL check verifies layout only, not a translated/localized experience. English was retained from the
existing site. Independent contract security review remains a separate release requirement.

## Guidance attribution

Design review used [Better Interface by Jakub Krehel](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface),
MIT, and its referenced documentation guidance from
[Impeccable by Paul Bakaus](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md),
Apache-2.0. License notices are included in `docs/DESIGN-GUIDANCE-LICENSE.txt`. These guides inform
design checks; they do not certify accessibility or financial security.
