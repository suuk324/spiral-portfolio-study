# Pacome Comparison

This file compares the current local portfolio build with `https://pacomepertant.com/` and tracks what has already been aligned.

## Homepage

### Reference

- full-screen dark stage
- fixed grid background
- WebGL cylinder / helix made from duplicated project planes
- inertial wheel and horizontal drag input
- `spiral / list` toggle
- pill menu at top right
- angled showreel card at bottom left
- round sound control at bottom right

### Local Status

Implemented:

- full-screen stage shell in [styles.css](C:/Users/MOOM/Desktop/制作网站/滚动网站/styles.css)
- WebGL plane scene in [app.js](C:/Users/MOOM/Desktop/制作网站/滚动网站/app.js)
- duplicated project planes and source-matched helix math
- local `Three.js` dependency instead of CDN
- `spiral / list` toggle
- pill menu, showreel, and sound button shell
- loader with sound / without sound entry
- homepage loader now follows the live visual hierarchy more closely: centered orb, immediate `enter with sound`, bottom-centered `enter without sound`, and no visible progress counter
- the spiral scene now uses a small root framing correction so the desktop homepage cluster lands closer to the live screenshot after entry instead of sitting too low and too large
- homepage card textures now use a brighter shadow lift and softer canvas treatment, which brings the green and white cards noticeably closer to the live midtone range
- homepage stage assets have been refreshed from the live Sanity thumbnail source and kept as local files, so the scene keeps loading reliably while using imagery closer to the live homepage
- localized reference thumbnails in `assets/reference/` so the spiral scene now renders with real project art instead of fallback cards
- tighter showreel placement and a visible sound icon closer to the live homepage chrome
- homepage chrome geometry now matches the live `871x792` viewport measurements:
  - logo `64x64` at `(20, 20)`
  - toggle `168x17` at `(352, 35)`
  - menu `85x48` at `(766, 20)`
  - showreel frame bounding box `311x225` at `(-136, 698)`
  - sound button `48x48` at `(803, 724)`

Still weaker than reference:

- the loader copy, fade timing, and progress choreography are still simpler than the live site
- the first visible spiral composition after entering still needs another pass against the live scene phase
- some overlap / scale relationships are still looser than the live composition
- the top-left orb is now bright enough, but it still skews a bit cooler / more cyan than the live orb
- the overall scene is still darker than the live site, especially in the green and upper white cards
- post-processing is still simpler
- showreel, contact links, and about copy are now sourced from the live site, but the homepage motion still needs visual tightening

### Entry Timing Finding

- the live loader shows its two entry actions immediately; it is not a delayed-ready gate
- the scene phase still keeps evolving while the loader is on-screen, so the visible first composition depends on when `enter` is clicked
- because of that, the local homepage should be tuned by scene phase and entry timing first, not by reordering the project array

### Standardized Screenshot Check

- using the same check window on both sites, `4.5s` before entry and `1.0s` after clicking `enter without sound`, the local homepage now lands much closer to the live composition
- the highest-value fixes in this pass were:
  - loader structure matching the live opening hierarchy
  - a small scene root offset and scene scale correction for desktop framing
  - softer CSS glow and canvas treatment so the scene reads less heavy
  - an additional luminance pass raised the local screenshot measurements in the same timing window:
  - scene-center luminance: `35.61 -> 52.37`
  - green-card sample luminance: `33.12 -> 58.89`
  - upper-white-card sample luminance: `50.19 -> 84.46`
- a follow-up pass that combined refreshed local Sanity stage assets with a gentler post lift pushed the same samples further:
  - orb luminance: `90.51 -> 88.90`, now nearly on top of the live `88.40` while reducing the cyan cast
  - scene-center luminance: `51.87 -> 56.36`
  - green-card sample luminance: `55.99 -> 62.47`
  - blue-card sample luminance: `69.03 -> 75.65`
  - upper-white-card sample luminance: `82.33 -> 86.58`
- direct remote `TextureLoader` use with the Sanity URLs was not stable enough in the local browser session, so the working approach is to cache those thumbnails locally and keep WebGL loading from local files
- the current remaining homepage gaps are mostly tonal polish, not scene architecture

## List Mode

### Reference

- large centered project names
- hover preview follows pointer
- spiral scene hides away cleanly

### Local Status

Implemented:

- title list view
- hover preview card
- spiral hide / reveal timing

Remaining:

- typography and motion are still less precise than reference

## About Page

### Reference

- huge sticky copy block
- horizontal project strip
- same fixed chrome language as homepage

### Local Status

Implemented:

- sticky large-copy section
- horizontal strips
- reused shell controls
- top copy now uses the live reference wording and a dimmer, smaller type treatment closer to the live site
- mobile-width sticky timing now lasts almost as long as the live reference in the in-app browser
- social links now match the live order and lowercase presentation instead of mixing oversized credit links into the same list

Remaining:

- image-strip motion and cropping still feel more like a study than a full clone
- credits placement still needs another pass if we want the bottom section to read exactly like the live page

## Project Detail

### Reference

- dark outer shell with white content card
- hero media
- project summary section
- stacked styleframes
- strong next-project section

### Local Status

Implemented:

- white inner project card
- hero video support using the live Mux playback ids and poster frames
- summary block
- stacked frames
- next-project section
- all 9 local project pages now use the live reference descriptions, years, thumbnail assets, and Sanity styleframe images instead of placeholder cross-project frames
- top spacing, hero placement, frame geometry, and bottom handoff geometry have been tuned against the live page at the in-app browser viewport
- the bottom handoff now places `back to home`, the next-project image, and the title much closer to the live positions

Remaining:

- the local detail page still uses a much simpler player surface than the live fullscreen video overlay and timeline controls
- fine visual polish remains around type rendering and premium media feel

## Current Priority

The homepage is the main focus. The architecture is already close enough that the biggest remaining gap is visual composition:

1. tighten the first visible spiral composition against the live scene phase after entry
2. neutralize the orb hue and keep lifting the green / upper-white card midtones without blowing the blue frame card
3. refine the last bit of WebGL card overlap / scale relationships
4. polish the detail-page player surface if we want to match the live overlay behavior

## 2026-06-08 Progress

- fixed the local `/__asset` proxy in [dev-server.js](C:/Users/MOOM/Desktop/制作网站/滚动网站/dev-server.js) so remote Sanity thumbnails can actually flow through the local server
- switched homepage stage textures to prefer proxied Sanity thumbnail URLs, with the existing local files kept as the fallback path
- warmed the orb hue slightly in [styles.css](C:/Users/MOOM/Desktop/制作网站/滚动网站/styles.css) so it reads less cyan and closer to the live green bias
- added URL-only debug hooks in [app.js](C:/Users/MOOM/Desktop/制作网站/滚动网站/app.js):
  - `autoEnter=without-sound&autoEnterDelay=4500`
  - `homeOffset=<number>`
  - `homeSpin=<number>`

Most important finding from this pass:

- the local auto-scroll used to be frame-based (`scrollOffset += wheelDeltaY` once per frame), so the first visible composition drifted whenever the render loop ran at a different FPS
- that drift is now fixed by making the homepage spin time-based
- after that change, repeated headless captures at `871x792`, `4500ms wait`, click `enter without sound`, then `1000ms wait` are visually stable again

Current verification artifacts from this pass:

- live baseline: `.codex-live-standard-4500-1000.png`
- stable local baseline after the time-based fix: `.codex-local-cdp-timebased-1.png`
- phase experiments:
  - `.codex-local-cdp-homeoffset-0.5.png`
  - `.codex-local-cdp-homeoffset-1.2.png`

Current conclusion:

- the remaining homepage gap is now mostly a controlled phase/composition problem rather than a texture-loading or timing-instability problem
- next tuning should stay on `homeOffset` / `homeSpin` first; only revisit project order if those stable controls still cannot land the same first readable cluster as the live screenshot

## 2026-06-08 Information Architecture And Inner-Page Pass

New findings from the live site source and direct browser checks:

- the live site uses clean public routes:
  - `/`
  - `/about/`
  - `/projects/<slug>`
- keeping the local study on `about.html` and `project.html?slug=...` was now a real structural mismatch, not just a cosmetic one
- the `about` first viewport in the live site relies on larger, dimmer copy with tighter line-height than the local build had
- the project detail page reads cleaner when the fixed homepage header chrome is removed and the page is allowed to stand on its own card + close-button structure

What changed in the local build:

- added route rewrites in [dev-server.js](C:/Users/MOOM/Desktop/制作网站/滚动网站/dev-server.js) so these now resolve locally:
  - `http://localhost:4173/about/`
  - `http://localhost:4173/projects/paths-of-life`
- updated [app.js](C:/Users/MOOM/Desktop/制作网站/滚动网站/app.js) to:
  - build project links with `/projects/<slug>`
  - resolve the active project slug from either query params or pathname
  - keep home, about, list, canvas, strip, and next-project navigation aligned to the cleaner route structure
- switched HTML asset and module references to root-absolute paths so nested routes keep loading CSS, JS, and local images correctly
- updated the homepage loader copy in [index.html](C:/Users/MOOM/Desktop/制作网站/滚动网站/index.html) to match the live wording more closely: `motion & sound designer based in paris`
- tightened [styles.css](C:/Users/MOOM/Desktop/制作网站/滚动网站/styles.css) in three places:
  - menu sheet entry and inner-link reveal timing
  - about-page hero copy size, tone, and rhythm
  - project-page shell by hiding the fixed site header and slightly refining the card spacing

Verified locally after the pass:

- `/` still loads and enters normally
- `/about/` now loads styled content correctly instead of breaking relative assets
- `/projects/paths-of-life` now loads as a styled detail page and no longer depends on the old query-string-only route

## 2026-06-08 Phase Tuning Follow-up

Additional progress from the same session:

- added a reusable capture helper at [`.codex-research/capture-homepage.mjs`](C:/Users/MOOM/Desktop/制作网站/滚动网站/.codex-research/capture-homepage.mjs) so homepage comparison runs can be reproduced without rebuilding the long CDP command each time
- found and fixed a real bug in [`getNumericQueryParam()`](C:/Users/MOOM/Desktop/制作网站/滚动网站/app.js):
  - missing query params were being read as `null`
  - `Number(null)` became `0`
  - so the intended fallbacks for `homeOffset` and `homeSpin` were silently ignored
- this means some earlier `homeOffset` experiments were effectively testing `homeSpin=0`, which explained why the “same” phase looked different once the fallback bug was fixed

Current default homepage tuning now baked into [app.js](C:/Users/MOOM/Desktop/制作网站/滚动网站/app.js):

- `HOME_INITIAL_SCROLL_OFFSET = 2.15`
- `HOME_DEFAULT_SPIN = 0.00025`

Why these defaults:

- `homeOffset` sweeps below `2.0` never entered the same card family as the live first readable cluster
- the best visual neighborhood started around `2.1` to `2.25`
- `2.15` produced the closest balance between:
  - left blue frame presence
  - central green/black card dominance
  - right orange vertical card presence
- after the fallback bug was fixed, `0.002` spin was clearly too strong and pushed the first frame away from the live reference
- `0.00025` keeps a non-zero ambient drift without destroying the chosen first-frame composition

Useful artifacts from the sweep:

- offset contact sheets:
  - `.codex-research/phase-search/offset-contact-sheet.png`
  - `.codex-research/phase-search/offset-contact-sheet-2.png`
  - `.codex-research/phase-search/offset-contact-sheet-fine.png`
- low-spin contact sheet:
  - `.codex-research/phase-search-spin-fine/spin-contact-sheet-fine.png`
- current default capture:
  - `.codex-local-default-phase-final.png`

Current remaining gap after this phase pass:

- the homepage now lands in the correct project-family composition much more reliably, but the local stage still reads a bit cleaner and more separated than the live reference
- the next meaningful lever is likely subtle geometry polish:
  - overlap depth
  - group scale
  - slight x/y stage framing
  - not another large phase jump

## 2026-06-08 Geometry Tuning

This pass focused on the compact homepage geometry at the comparison viewport (`871x792`), not the desktop branch.

Useful implementation detail:

- the compact layout branch in [app.js](C:/Users/MOOM/Desktop/制作网站/滚动网站/app.js) is the one that matters for the current live baseline because `871 <= 900`
- I added URL-only geometry tuning hooks so the homepage can be searched without editing source every time:
  - `stageX`
  - `stageY`
  - `stageScale`
  - `stageRadius`
  - `stageGapY`
  - `stageAngle`
  - `stageCardWidth`
  - `stageCardHeight`

Important finding:

- the compact defaults for horizontal framing, overall scale, radius, and angle were already close enough
- the clearest remaining compact mismatch was vertical placement of the whole stage group
- lowering compact `sceneOffsetY` from `0.14` to `0.08` consistently moved the first readable cluster closer to the live reference

What changed in source:

- compact `sceneOffsetY` default is now `0.08`
- compact `sceneOffsetX` stays `-0.08`
- compact `sceneScale` stays `0.97`
- compact `radius` stays `2`
- compact `verticalGap` stays `0.5`
- compact `angleGap` stays `0.85`

Artifacts from this pass:

- framing sweep:
  - `.codex-research/geometry-search-xs/contact.png`
- radius/angle sweep:
  - `.codex-research/geometry-search-ra/contact.png`
- vertical/framing sweep:
  - `.codex-research/geometry-search-yg/contact.png`
- fine `stageY` sweep:
  - `.codex-research/geometry-search-yfine/contact.png`
- current default capture after the geometry pass:
  - `.codex-local-default-geometry-final.png`

Current conclusion after the geometry pass:

- the compact homepage is now closer in stage framing than before
- most remaining difference is no longer basic phase or vertical framing
- the next likely gains are in finer visual character:
  - card overlap feel
  - relative dominance of the left blue frame vs central green card
  - texture tonality / blur / post-process polish rather than large layout swings

## 2026-06-08 Tonal And Crop Pass

This pass stopped treating the remaining homepage gap as a geometry problem and measured it directly.

What the measurements showed:

- the biggest remaining mismatch was not the white top card anymore
- the real problem areas were:
  - `main_green` still too dark and too black-heavy
  - `right_orange` still too bright and too warm
  - `bg_center` slightly too dark
  - orb still a bit too cyan

To make this tunable without rewriting constants every time, [app.js](C:/Users/MOOM/Desktop/制作网站/滚动网站/app.js) now supports URL-only shader tuning for:

- `frontGamma`
- `frontGain`
- `frontLift`
- `backGamma`
- `backGain`
- `backLift`
- `postGamma`
- `postLift`

Additional artifacts from this pass:

- live/local diff image:
  - `.codex-research/diff-live-vs-local.png`
- tonal sweep:
  - `.codex-research/tone-search/top-candidates-contact.png`
- card-width sweep:
  - `.codex-research/cardwidth-search/contact.png`
- width + gain follow-up:
  - `.codex-research/tone-width-combo/contact.png`

Current defaults after this pass:

- `HOME_FRONT_GAIN = 1.4`
- `HOME_POST_GAMMA = 0.92`
- `HOME_POST_LIFT = 0.024`
- `HOME_DEFAULT_CARD_WIDTH = 1.62`
- compact `sceneOffsetY = 0.08`

Orb polish:

- [styles.css](C:/Users/MOOM/Desktop/制作网站/滚动网站/styles.css) orb gradient was pushed slightly greener again to reduce the blue/cyan cast

Why the card width changed:

- reducing card width from `1.70` to `1.62` improved the right orange card and overall crop balance more effectively than more large geometry moves
- after that crop shift, a higher `frontGain` (`1.4`) produced a better tradeoff than the lower gain that had looked best before the width change

Current best default capture:

- `.codex-local-homepage-current-best.png`

Net result from this pass:

- right orange card is closer to the live value range than before
- top white card is now extremely close
- orb is less cyan than earlier
- the homepage still differs from live in the exact green-card tonality and some blur/softness character, but the default build is materially closer than the previous geometry-only pass

## First-Frame Slot Mapping

The local homepage uses the same helix math as the reference, so the meaningful tuning surface is the actual project data order, not ad hoc position hacks.

Reference content order recovered from the live site `about` page and the cached source query:

1. `paths-of-life`
2. `the-disease-spread-on-tiktok`
3. `ah-psychedelics`
4. `thought`
5. `jupiter`
6. `chromatik`
7. `digital-travel`
8. `mercedes-amg`
9. `the-purity-revealed`

With the current `radius = 2`, `verticalGap = 0.5`, `angleGap = 0.85`, `cameraZ = 8`, duplicated `projects.length * 2`, and `centerIndex = totalPlanes / 2`, the key visible slots on first frame are:

- `order 1` -> right-center / front-right
- `order 2` -> main front card near center
- `order 3` -> upper-left readable front
- `order 4` -> upper-left rear
- `order 5` -> upper-center rear
- `order -2` -> lower-center / lower-left
- `order -1` -> lower-right

With the recovered reference order, the first visible assignments are:

- `order -2` -> `mercedes-amg`
- `order -1` -> `the-purity-revealed`
- `order 0` -> `paths-of-life`
- `order 1` -> `the-disease-spread-on-tiktok`
- `order 2` -> `ah-psychedelics`
- `order 3` -> `thought`
- `order 4` -> `jupiter`
- `order 5` -> `chromatik`

`digital-travel` becomes visible immediately after that first cluster at `order 6`, so any future visual mismatch should first be checked against loader timing, media contrast, and scene phase before changing the project order.
