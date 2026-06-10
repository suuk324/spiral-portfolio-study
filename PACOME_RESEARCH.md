# Pacome Homepage Research

This note captures the parts of `https://pacomepertant.com/` that matter for rebuilding the same effect locally.

## Verified From Source

The homepage is not a DOM card stack. It is a WebGL scene with a small DOM shell around it.

Reference facts extracted from `.codex-research/rgzkqdZW.js`:

- `Controls`
  - `targetWheelDeltaY += deltaY * 15e-5`
  - clamp wheel target to `[-2, 2]`
  - easing `0.1`
  - min wheel speed `0.002`
  - touch drag is horizontal
  - drag threshold `8`
- `Camera`
  - `PerspectiveCamera(width < 900 ? 45 : 35, aspect, 0.1, 100)`
  - `camera.position.z = 8`
- `ProjectPlane`
  - geometry: `PlaneGeometry(1, 1, 8, 8)`
  - duplicated project list: `projects.length * 2`
  - `baseScaleX = 1.7`
  - `baseScaleY = 1`
  - `verticalGap = 0.5`
  - `angleGap = 0.85`
  - `baseRadius = 2`
  - `centerIndex = Math.floor(projectsCount / 2)`
  - `y = order * verticalGap - 0.8 - hiddenProgress * hiddenDirection`
  - `radius = baseRadius * (1 - hiddenProgress / 2)`
  - `angle = order * angleGap`
  - `position = (cos(angle) * radius, y, sin(angle) * radius)`
  - `rotation.y = -angle + PI / 2`
  - `uColorStrength = 0.55 * hoverProgress`
  - `uZoom = 1 + 0.05 * hoverProgress`
  - `uRevealProgress = (1 - hoverProgress * 0.05) * (1 - hiddenProgress)`
  - `uScrollSpeed = wheelDeltaY`
- `Hover`
  - raycast hit only counts when face normal points toward the ray
  - hidden planes are ignored
- `Post processing`
  - top and bottom gradient mix toward `#444`

## Live Content Source

Current live content is served from Sanity plus Mux:

- Sanity project id: `u7lvkmbp`
- Sanity dataset: `production`
- Nuxt runtime config exposes the content source in `window.__NUXT__.config.public.sanity`
- Content payload contains, per project:
  - `title`
  - `year`
  - `shortDescription`
  - `behanceUrl`
  - `thumbnail`
  - `video.asset.playbackId`
  - `styleframes[]`

Current media URL patterns recovered from the live code:

- Sanity image:
  - `https://cdn.sanity.io/images/u7lvkmbp/production/<asset-id>-<dimensions>.<ext>?w=<width>&auto=format`
- Mux HLS stream:
  - `https://stream.mux.com/<playbackId>.m3u8`
- Mux poster:
  - `https://image.mux.com/<playbackId>/thumbnail.webp?width=1280&height=720&fit_mode=smartcrop&time=0`

## Local Alignment Status

Current local implementation already mirrors the main homepage logic in [app.js](C:/Users/MOOM/Desktop/制作网站/滚动网站/app.js):

- local `Three.js` module path: line `1`
- duplicated planes with `STAGE_LOOP_COPIES = 2`
- reference shader structure for front/back faces
- `PerspectiveCamera(45/35, ..., 0.1, 100)` and `cameraZ = 8`
- `radius = 2`, `verticalGap = 0.5`, `angleGap = 0.85`
- `centerIndex = Math.floor(total / 2)`
- horizontal drag inertia and wheel easing
- reveal/hide timing based on `index % 4`

The full-screen stage shell lives in [styles.css](C:/Users/MOOM/Desktop/制作网站/滚动网站/styles.css):

- `--scene-width: 100vw`
- `--scene-height: 100vh`
- `.card-scene` is full-screen and unframed
- menu, showreel, and utility controls are fixed overlays

## Remaining Gaps

The main remaining differences are visual, not architectural:

1. The reference site uses richer image content, so the cylinder reads more clearly at first glance.
2. The initial visible project order is extremely important. The homepage feel changes a lot depending on which project lands on the front-facing order slots.
3. The reference scene has a slightly more polished post-processed look.
4. The menu, showreel, and sound controls are close structurally, but still use placeholder content and proportions.

## Next High-Value Moves

1. Replace placeholder card art with assets closer to the reference tone.
2. Fine-tune initial project ordering until the first frame reads like the reference screenshot.
3. Tighten post-process contrast and haze only after the first-frame composition is correct.
4. After homepage parity is acceptable, bring `about` and project detail pages closer to the reference rhythm.
