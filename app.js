const THREE_MODULE_URL = "/node_modules/three/build/three.module.js";
const HLS_MODULE_URL = "/node_modules/hls.js/dist/hls.mjs";
const SANITY_PROJECT_ID = "u7lvkmbp";
const SANITY_DATASET = "production";
const HOME_INITIAL_SCROLL_OFFSET = 2.15;
const HOME_DEFAULT_SPIN = 0.00025;
const HOME_DEFAULT_CARD_WIDTH = 1.62;
const HOME_DEFAULT_CARD_HEIGHT = 1;
const HOME_FRONT_GAMMA = 0.8;
const HOME_FRONT_GAIN = 1.4;
const HOME_FRONT_LIFT = 0.028;
const HOME_BACK_GAMMA = 0.88;
const HOME_BACK_GAIN = 1.02;
const HOME_BACK_LIFT = 0.018;
const HOME_POST_GAMMA = 0.92;
const HOME_POST_LIFT = 0.024;
const STAGE_LOOP_COPIES = 2;
const PLANE_VERTEX_SHADER = `
  uniform float uScrollSpeed;
  varying vec2 vUv;
  #define PI 3.14159265359

  void main() {
    vUv = uv;

    vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 newPosition = position;
    newPosition.z = sin(uv.x * PI) * 0.2;

    vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    viewPosition.x += pow(worldPosition.y, 2.0) * 0.1;
    viewPosition.x += sin(uv.y * PI) * uScrollSpeed * 2.0;

    gl_Position = projectionMatrix * viewPosition;
  }
`;

const PLANE_FRAGMENT_SHADER = `
  uniform sampler2D uTexture;
  uniform float uColorStrength;
  uniform float uZoom;
  uniform vec2 uPlaneSizes;
  uniform vec2 uImageSizes;
  uniform float uRevealProgress;
  uniform float uFrontGamma;
  uniform float uFrontGain;
  uniform float uFrontLift;
  uniform float uBackGamma;
  uniform float uBackGain;
  uniform float uBackLift;
  varying vec2 vUv;

  float roundedRectSDF(vec2 uv, vec2 size, float radius) {
    vec2 d = abs(uv - 0.5) - size * 0.5 + radius;
    return length(max(d, 0.0)) - radius;
  }

  void main() {
    vec2 ratio = vec2(
      min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
      min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
    );

    vec2 uv = vec2(
      vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
      vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
    );

    vec2 zoomedUv = (uv - 0.5) / uZoom + 0.5;
    vec4 color;

  if (gl_FrontFacing) {
    color = texture2D(uTexture, zoomedUv);
    color = mix(color, vec4(0.0, 0.0, 0.0, 1.0), uColorStrength);
    color.rgb = pow(color.rgb, vec3(uFrontGamma));
    color.rgb *= uFrontGain;
    color.rgb += vec3(uFrontLift);
  } else {
      float offset = 40.0 / 1024.0;
      vec4 c = vec4(0.0);

      c += texture2D(uTexture, uv + vec2(-offset, -offset)) * 1.0;
      c += texture2D(uTexture, uv + vec2(0.0, -offset)) * 2.0;
      c += texture2D(uTexture, uv + vec2(offset, -offset)) * 1.0;
      c += texture2D(uTexture, uv + vec2(-offset, 0.0)) * 2.0;
      c += texture2D(uTexture, uv) * 4.0;
      c += texture2D(uTexture, uv + vec2(offset, 0.0)) * 2.0;
      c += texture2D(uTexture, uv + vec2(-offset, offset)) * 1.0;
      c += texture2D(uTexture, uv + vec2(0.0, offset)) * 2.0;
      c += texture2D(uTexture, uv + vec2(offset, offset)) * 1.0;
      c /= 16.0;

    color = vec4(pow(c.rgb, vec3(uBackGamma)) * uBackGain + vec3(uBackLift), c.a);
  }

    float reveal = clamp(uRevealProgress, 0.0, 1.0);
    vec2 revealSize = vec2(reveal);
    float radius = 0.05 * reveal;
    float sdf = roundedRectSDF(vUv, revealSize, radius);
    float alpha = 1.0 - smoothstep(0.0, 0.002, sdf);
    alpha *= smoothstep(0.1, 1.0, uRevealProgress);

    gl_FragColor = vec4(color.rgb, alpha);
  }
`;

const POST_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vUv = uv;
  }
`;

const POST_FRAGMENT_SHADER = `
  uniform sampler2D tDiffuse;
  uniform vec3 uFillColor;
  uniform float uPostGamma;
  uniform float uPostLift;
  varying vec2 vUv;

  float remap(float value, float min1, float max1, float min2, float max2) {
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
  }

  void main() {
    float linearGradientBottom = remap(vUv.y, 0.0, 0.2, 1.0, 0.0);
    float linearGradientTop = remap(vUv.y, 0.8, 1.0, 0.0, 1.0);
    linearGradientTop = clamp(linearGradientTop, 0.0, 1.0);
    linearGradientBottom = clamp(linearGradientBottom, 0.0, 1.0);

    float strength = clamp(linearGradientTop + linearGradientBottom, 0.0, 1.0);
    vec4 textureColor = texture2D(tDiffuse, vUv);
    vec3 finalColor = mix(textureColor.rgb, uFillColor, strength);
    finalColor = pow(finalColor, vec3(uPostGamma));
    finalColor += vec3(uPostLift);

    gl_FragColor = vec4(finalColor, textureColor.a);
  }
`;

const referenceMedia = {
  pathsOfLife: "/assets/reference/paths-of-life.png",
  disease: "/assets/reference/the-disease-spread-on-tiktok.png",
  psychedelics: "/assets/reference/ah-psychedelics.png",
  thought: "/assets/reference/thought.png",
  jupiter: "/assets/reference/jupiter.png",
  chromatik: "/assets/reference/chromatik.png",
  digitalTravel: "/assets/reference/digital-travel.png",
  mercedesAmg: "/assets/reference/mercedes-amg.png",
  purityRevealed: "/assets/reference/the-purity-revealed.png"
};

function getSanityImageUrl(assetRef, width = 1600) {
  if (!assetRef) {
    return "";
  }

  const normalizedRef = assetRef.startsWith("image-") ? assetRef.slice(6) : assetRef;
  const parts = normalizedRef.split("-");
  const format = parts.pop();
  const dimensions = parts.pop();
  const assetId = parts.join("-");
  const url = new URL(`https://cdn.sanity.io/images/${SANITY_PROJECT_ID}/${SANITY_DATASET}/${assetId}-${dimensions}.${format}`);

  if (width) {
    url.searchParams.set("w", String(width));
  }

  url.searchParams.set("auto", "format");
  return url.toString();
}

function getMuxStreamUrl(playbackId) {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

function getMuxPosterUrl(playbackId, width = 1280, height = 720, time = 0) {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=${width}&height=${height}&fit_mode=smartcrop&time=${time}`;
}

const siteProfile = {
  email: "pertantpacome@gmail.com",
  showreelUrl: "https://www.behance.net/gallery/202093435/Showreel-2024",
  showreelPlaybackId: "ycc6bXk6hOWxGnyb6F3wvUxPPLiDML00P9OPkYMjuSN8",
  showreelCover: "/assets/reference/showreel-cover.png",
  socials: [
    { label: "Instagram", short: "ig", url: "https://www.instagram.com" },
    { label: "X / Twitter", short: "x", url: "https://www.x.com/pacomepertant" },
    { label: "Behance", short: "be", url: "https://www.behance.net/pacomepertant" },
    { label: "LinkedIn", short: "in", url: "https://www.linkedin.com/in/pac%C3%B4me-pertant-b4437126b/" }
  ],
  aboutSocials: [
    { label: "instagram", url: "https://www.instagram.com" },
    { label: "x / twitter", url: "https://www.x.com/pacomepertant" },
    { label: "behance", url: "https://www.behance.net/pacomepertant" },
    { label: "linkedin", url: "https://www.linkedin.com/in/pac%C3%B4me-pertant-b4437126b/" }
  ],
  credits: {
    designLabel: "@louis_bcqt",
    designUrl: "https://x.com/louis_bcqt",
    developmentLabel: "@colindmg",
    developmentUrl: "https://x.com/colindmg"
  }
};

const projects = [
  {
    slug: "paths-of-life",
    title: "Paths of life",
    year: "2024",
    image: referenceMedia.pathsOfLife,
    thumbnailUrl: getSanityImageUrl("image-53f8a4a889052e6d9f92fc347533062abaf7c28a-1396x770-png"),
    videoPlaybackId: "79CoZbPvtdGp00mUU3pkRZujFUDwR02LHciDlc9Gl7G7k",
    videoPosterUrl: getMuxPosterUrl("79CoZbPvtdGp00mUU3pkRZujFUDwR02LHciDlc9Gl7G7k"),
    description: "Paths of Life is a short film about the different paths we take through life; it features a main character and graphic forms that metaphorically and conceptually illustrate the journey of this main character.",
    caseUrl: "https://www.behance.net/gallery/201777435/Paths-Of-Life",
    frames: [
      getSanityImageUrl("image-c0339b80af376198eb9824c9147b1716d98f25f4-1401x787-webp"),
      getSanityImageUrl("image-0682241c8abec328eae3063cd78cbb6bdf7f33ec-1396x786-webp"),
      getSanityImageUrl("image-d74a16d8d2e88d26d00f347147e197ca8ddd46c1-1396x787-webp")
    ],
    width: 320
  },
  {
    slug: "the-disease-spread-on-tiktok",
    title: "The disease spread on Tiktok",
    year: "2024",
    image: referenceMedia.disease,
    thumbnailUrl: getSanityImageUrl("image-19fa225f5d92c65608e2234c0b0bd1fb2e3d681c-3840x1920-png"),
    videoPlaybackId: "tl4p3L4FYyKx6S4j2Vo1ONIsUu1q5QR3YoTvb76f0202o",
    videoPosterUrl: getMuxPosterUrl("tl4p3L4FYyKx6S4j2Vo1ONIsUu1q5QR3YoTvb76f0202o"),
    description: "Youtube content creator Leo Duff commissioned me for his video \"The disease spread on TikTok\", in which he tackles the problem of ADD (attention deficit disorder). The goal was to create an animation that would simplify and popularize how the ADD brain works.",
    caseUrl: "https://www.behance.net/gallery/221358177/The-disease-spread-on-Tiktok",
    frames: [
      getSanityImageUrl("image-8c83cd2256e6e28750060836ba761ea4dcef427b-2048x1024-webp"),
      getSanityImageUrl("image-cac001b4124310995ff7af4d2b4b2b2b8d6f5826-2800x1400-webp"),
      getSanityImageUrl("image-785c967e8b81619e6d952152eda4de5501ebe3e9-2800x1400-webp")
    ],
    width: 360
  },
  {
    slug: "ah-psychedelics",
    title: "Ah, Psychedelics",
    year: "2025",
    image: referenceMedia.psychedelics,
    thumbnailUrl: getSanityImageUrl("image-1ca122cfaaff3f8b109554a29cc7a1132d13a0c6-1280x717-png"),
    videoPlaybackId: "4T5ePLKwMgGBHjNGk018tJ198RPD5qEaIIc6HQ02MjF5c",
    videoPosterUrl: getMuxPosterUrl("4T5ePLKwMgGBHjNGk018tJ198RPD5qEaIIc6HQ02MjF5c"),
    description: "What if psychedelics weren't just drugs, but medical treatments? This motion design explores the therapeutic potential of psychedelics, using scientific research to deconstruct preconceived ideas.",
    caseUrl: "https://www.behance.net/gallery/223730619/Ah-PsychedelicsExplainer",
    frames: [
      getSanityImageUrl("image-e6b91fc118c818b6f9bdca3d7c9097e45f4728f7-1920x1080-webp"),
      getSanityImageUrl("image-a94d7ac7b864bdc99757d0ef67420f255ca6b328-1920x1080-webp"),
      getSanityImageUrl("image-0ab7b4afefb865bb52f4c21910637cd004c8f56e-1920x1080-webp")
    ],
    width: 330
  },
  {
    slug: "thought",
    title: "Thought",
    year: "2025",
    image: referenceMedia.thought,
    thumbnailUrl: getSanityImageUrl("image-41a99c4ae85965e19dcc6befe7caaae6c2d54d9c-1146x644-png"),
    videoPlaybackId: "xID01eUh12oDNh5MRbAh6fRHQtlq6upbqwinWRzWnE38",
    videoPosterUrl: getMuxPosterUrl("xID01eUh12oDNh5MRbAh6fRHQtlq6upbqwinWRzWnE38"),
    description: "Exploring the emergence of new, spontaneous ideas.",
    caseUrl: "https://www.behance.net/gallery/217440473/Thought",
    frames: [
      getSanityImageUrl("image-b914fc76feb83565da1443ddde76460ca53a628a-1920x1080-webp"),
      getSanityImageUrl("image-ecd26b748f6480d043f23da1c11742843e1d5e96-1920x1080-webp"),
      getSanityImageUrl("image-72bb1c5c6980b6ef269c5daf343f80fe1dba7ceb-1920x1080-webp")
    ],
    width: 340
  },
  {
    slug: "jupiter",
    title: "Jupiter",
    year: "2026",
    image: referenceMedia.jupiter,
    thumbnailUrl: getSanityImageUrl("image-bff6c9518d1b998df04c33101d61ad965fd23a98-1413x760-png"),
    videoPlaybackId: "00j0002c6600iaejjGj002bhmaJqSlW02PstH7do6QJRPJImM",
    videoPosterUrl: getMuxPosterUrl("00j0002c6600iaejjGj002bhmaJqSlW02PstH7do6QJRPJImM"),
    description: "Release motion created a few months ago for Jupiter, to mark the launch of their stablecoin.",
    caseUrl: null,
    frames: [
      getSanityImageUrl("image-210a5bf2623baa889a063d57eed6b6691f7b8d0a-1920x1080-png"),
      getSanityImageUrl("image-2a7abb8206251d838e6098e22c7138b14ab6a626-1920x1080-png"),
      getSanityImageUrl("image-c81cb0cff370a067b2b9ef4d5fccc45da93513e8-1920x1080-png")
    ],
    width: 460
  },
  {
    slug: "chromatik",
    title: "Chromatik",
    year: "2025",
    image: referenceMedia.chromatik,
    thumbnailUrl: getSanityImageUrl("image-80de59a860bc12ff92d9d349ffe319cfb92a8de8-1258x984-png"),
    videoPlaybackId: "02Bf00ukchvF00C017njOiuDYNLW6HjDDgCFq6FL8eal1k8",
    videoPosterUrl: getMuxPosterUrl("02Bf00ukchvF00C017njOiuDYNLW6HjDDgCFq6FL8eal1k8"),
    description: "A visual and sound experiment. Shapes, blend tones, and retro tones collide to create a playful study in motion & texture.",
    caseUrl: "https://www.behance.net/gallery/238825325/CHROMATIK",
    frames: [
      getSanityImageUrl("image-e051555ca7b36d957930af02322d9ad5d2ba4a89-1080x1080-webp"),
      getSanityImageUrl("image-76f2105215ab670f9b708cbd5bbda24af440ddfc-1080x1080-webp"),
      getSanityImageUrl("image-22d77c92b7c5483e62d7e83d206f1a3326440bc9-1080x1080-webp")
    ],
    width: 300
  },
  {
    slug: "digital-travel",
    title: "Digital Travel",
    year: "2024",
    image: referenceMedia.digitalTravel,
    thumbnailUrl: getSanityImageUrl("image-219c0768c852e48380fd831ed0772f7c173ac0ea-1280x719-png"),
    videoPlaybackId: "ju6elgST7uaWqO9MLc4ODA9V8dkOLmYFdrbSPtXTFaM",
    videoPosterUrl: getMuxPosterUrl("ju6elgST7uaWqO9MLc4ODA9V8dkOLmYFdrbSPtXTFaM"),
    description: "A personal project in which a user logs on to his computer ans clicks on a simple play button, leading to the appearance of shapes, colors and anything else that might happen inside a computer while it's loading.",
    caseUrl: "https://www.behance.net/gallery/191741223/DIgital-Travel",
    frames: [
      getSanityImageUrl("image-e4883a908b634c82a380c6de3a46cae8e3bacb4c-950x538-webp"),
      getSanityImageUrl("image-ba830865f555c4cb43e89395aab77d636523dee9-956x537-webp"),
      getSanityImageUrl("image-67bacd3b38aefef4e0b55d46ea880330d1f821dd-954x537-webp")
    ],
    width: 320
  },
  {
    slug: "mercedes-amg",
    title: "Mercedes AMG",
    year: "2025",
    image: referenceMedia.mercedesAmg,
    thumbnailUrl: getSanityImageUrl("image-f430b963c80253937547780211cd3abe7b23924c-1920x1080-png"),
    videoPlaybackId: "J6q7eMxUJgjTxJbliCliQSeZtUQYN00iAONNIkyFEZYE",
    videoPosterUrl: getMuxPosterUrl("J6q7eMxUJgjTxJbliCliQSeZtUQYN00iAONNIkyFEZYE"),
    description: "AMG-GT is a 3D motion study project made at school, using Cinema4D and AfterEffects.",
    caseUrl: null,
    frames: [
      getSanityImageUrl("image-c7598f69c07a132203463f8c226fdc22a74bb2dc-1200x675-jpg"),
      getSanityImageUrl("image-da0d2c21fa9279670b5cc32418b90c36895bd5fc-1920x1080-jpg")
    ],
    width: 280
  },
  {
    slug: "the-purity-revealed",
    title: "The purity revealed",
    year: "2025",
    image: referenceMedia.purityRevealed,
    thumbnailUrl: getSanityImageUrl("image-689cc8437a49fac1ba8f12012d73cf9d20ce46fb-3840x2160-png"),
    videoPlaybackId: "qAQWnnz023A00z77cnBAm18r6vyFgkcde9EKurPYVIZAM",
    videoPosterUrl: getMuxPosterUrl("qAQWnnz023A00z77cnBAm18r6vyFgkcde9EKurPYVIZAM"),
    description: "A personal project in which I imagined a collaboration between the Swarovski brand and Evian. The collaboration would involve distributing limited edition products from both brands at events such as Roland Garros, Fashion Week, Dubai Week and the Met Gala.",
    caseUrl: "https://www.behance.net/gallery/221365289/The-purity-revealed",
    frames: [
      getSanityImageUrl("image-f81118f82a6de006c2e7cd1f9536fb8bde0a4f5c-1920x1080-webp"),
      getSanityImageUrl("image-5e9a5260adfb4958efacee863d5f760906a2d131-960x540-webp"),
      getSanityImageUrl("image-cd25e78cc10daec35a2b1f9ba270cbb2dc3c2df5-2800x1575-webp")
    ],
    width: 320
  }
];

const state = {
  hoveredSlug: null,
  currentMode: "spiral",
  stage: null
};

let hlsConstructorPromise = null;

const body = document.body;
const menuButton = document.getElementById("menu-button");
const menuClose = document.getElementById("menu-close");
const menuPanel = document.getElementById("menu-panel");
const soundButton = document.getElementById("sound-button");

window.__portfolioProjects = projects;
window.__portfolioState = state;

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildProjectPath(slug) {
  return `/projects/${slug}`;
}

function getCurrentProjectSlug() {
  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get("slug");
  if (querySlug) {
    return querySlug;
  }

  const pathname = window.location.pathname.replace(/\/+$/, "");
  const match = pathname.match(/\/projects\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getNumericQueryParam(name, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = new URLSearchParams(window.location.search).get(name);
  if (raw === null || raw.trim() === "") {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function lerp(start, end, alpha) {
  return start + (end - start) * alpha;
}

function getProject(slug) {
  return projects.find((project) => project.slug === slug) || projects[0];
}

function getProjectThumbnail(project) {
  return project.thumbnailUrl || project.image;
}

function getProjectStageTextureUrl(project, width = 768) {
  const source = project.thumbnailUrl || project.image;
  if (!source) {
    return "";
  }

  try {
    const url = new URL(source, window.location.href);
    if (url.hostname === "cdn.sanity.io") {
      url.searchParams.set("w", String(width));
      url.searchParams.set("auto", "format");
    }

    if (url.origin !== window.location.origin) {
      return `${window.location.origin}/__asset?url=${encodeURIComponent(url.href)}`;
    }

    return url.href;
  } catch {
    return source;
  }
}

function getProjectStageZoom(project) {
  return getNumericQueryParam(`zoom-${project.slug}`, project.stageZoom ?? 1);
}

function loadHlsConstructor() {
  if (!hlsConstructorPromise) {
    hlsConstructorPromise = import(HLS_MODULE_URL).then((module) => module.default);
  }

  return hlsConstructorPromise;
}

function getNextProject(slug) {
  const index = projects.findIndex((project) => project.slug === slug);
  if (index === -1) {
    return projects[1] || projects[0];
  }
  return projects[(index + 1) % projects.length];
}

function setupChrome() {
  if (!menuButton || !menuPanel) {
    return;
  }

  const closeMenu = () => {
    body.classList.remove("menu-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuPanel.setAttribute("aria-hidden", "true");
  };

  const openMenu = () => {
    body.classList.add("menu-open");
    menuButton.setAttribute("aria-expanded", "true");
    menuPanel.setAttribute("aria-hidden", "false");
  };

  menuButton.addEventListener("click", () => {
    if (body.classList.contains("menu-open")) {
      closeMenu();
      return;
    }
    openMenu();
  });

  menuClose?.addEventListener("click", closeMenu);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  qsa(".menu-nav a, .menu-mail").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  soundButton?.addEventListener("click", () => {
    const enabled = soundButton.getAttribute("aria-pressed") === "true";
    soundButton.setAttribute("aria-pressed", String(!enabled));
  });
}

function hydrateReferenceChrome() {
  qsa(".showreel-card").forEach((link) => {
    link.href = siteProfile.showreelUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  qsa(".showreel-frame img").forEach((image) => {
    image.src = siteProfile.showreelCover;
    image.alt = "Showreel cover";
  });

  const previewImage = qs("#list-preview-image");
  if (previewImage) {
    previewImage.src = getProjectThumbnail(getProject("the-disease-spread-on-tiktok"));
    previewImage.alt = "Project preview";
  }

  qsa('a[href^="mailto:"]').forEach((link) => {
    link.href = `mailto:${siteProfile.email}`;
  });

  qsa(".menu-mail").forEach((link) => {
    link.textContent = siteProfile.email;
  });

  const menuSocials = qsa(".menu-socials");
  menuSocials.forEach((wrapper) => {
    wrapper.innerHTML = siteProfile.socials.map((social) => {
      return `<a href="${social.url}" target="_blank" rel="noopener noreferrer" aria-label="${social.label}">${social.short}</a>`;
    }).join("");
  });

  const aboutSocials = qs(".about-socials");
  if (aboutSocials) {
    aboutSocials.innerHTML = `
      <div class="about-social-links">
        ${siteProfile.aboutSocials.map((social) => `<a href="${social.url}" target="_blank" rel="noopener noreferrer">${social.label}</a>`).join("")}
      </div>
      <p class="about-credits">
        <span>design <a href="${siteProfile.credits.designUrl}" target="_blank" rel="noopener noreferrer">${siteProfile.credits.designLabel}</a></span>
        <span>development <a href="${siteProfile.credits.developmentUrl}" target="_blank" rel="noopener noreferrer">${siteProfile.credits.developmentLabel}</a></span>
      </p>
    `;
  }
}

function setMode(mode, immediate = false) {
  state.currentMode = mode;
  body.classList.toggle("mode-list", mode === "list");
  body.classList.toggle("mode-spiral", mode === "spiral");
  qs("#spiral-toggle")?.classList.toggle("is-active", mode === "spiral");
  qs("#list-toggle")?.classList.toggle("is-active", mode === "list");
  qs("#spiral-toggle")?.setAttribute("aria-selected", String(mode === "spiral"));
  qs("#list-toggle")?.setAttribute("aria-selected", String(mode === "list"));
  state.stage?.setMode(mode, immediate);
}

function buildHomeList() {
  const list = qs("#list-stack");
  if (!list) {
    return;
  }

  const listMarkup = projects.map((project) => {
    return `
      <div class="list-item">
        <button type="button" data-slug="${project.slug}">${project.title}</button>
        <span>${project.year}</span>
      </div>
    `;
  }).join("");

  list.innerHTML = listMarkup;
}

function setupListPreview() {
  const preview = qs("#list-preview");
  const previewImage = qs("#list-preview-image");
  const previewMeta = qs("#list-preview-meta");
  const listButtons = qsa(".list-item button");

  if (!preview || !previewImage || !previewMeta || listButtons.length === 0) {
    return;
  }

  const movePreview = (event) => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      return;
    }
    preview.style.transform = `translate3d(${event.clientX + 28}px, ${event.clientY - 36}px, 0) scale(1)`;
  };

  listButtons.forEach((button) => {
    button.addEventListener("mouseenter", () => {
      const project = getProject(button.dataset.slug);
      state.hoveredSlug = project.slug;
      button.parentElement?.classList.add("is-hovered");
      preview.classList.add("is-visible");
      preview.setAttribute("aria-hidden", "false");
      previewImage.src = getProjectThumbnail(project);
      previewImage.alt = project.title;
      previewMeta.textContent = `${project.title} / ${project.year}`;
    });

    button.addEventListener("mouseleave", () => {
      state.hoveredSlug = null;
      button.parentElement?.classList.remove("is-hovered");
      preview.classList.remove("is-visible");
      preview.setAttribute("aria-hidden", "true");
    });

    button.addEventListener("mousemove", movePreview);
    button.addEventListener("click", () => {
      window.location.href = buildProjectPath(button.dataset.slug);
    });
  });
}

function runLoader() {
  const enterWithSound = qs("#enter-with-sound");
  const enterWithoutSound = qs("#enter-without-sound");
  const params = new URLSearchParams(window.location.search);
  const previewMode = params.get("preview") === "1";
  const autoEnterMode = params.get("autoEnter");
  const autoEnterDelay = Number(params.get("autoEnterDelay") || "0");

  const finishLoader = (soundOn) => {
    if (soundOn) {
      soundButton?.setAttribute("aria-pressed", "true");
    }
    body.classList.remove("is-loading");
  };

  if (previewMode) {
    finishLoader(false);
    return;
  }

  enterWithSound?.addEventListener("click", () => finishLoader(true));
  enterWithoutSound?.addEventListener("click", () => finishLoader(false));

  if (autoEnterMode === "with-sound" || autoEnterMode === "without-sound") {
    window.setTimeout(() => {
      finishLoader(autoEnterMode === "with-sound");
    }, Number.isFinite(autoEnterDelay) ? Math.max(0, autoEnterDelay) : 0);
  }
}

async function loadThree() {
  const module = await import(THREE_MODULE_URL);
  return module;
}

class SpiralStage {
  constructor(container, items, three) {
    this.container = container;
    this.projects = items;
    this.THREE = three;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.renderTarget = null;
    this.postScene = null;
    this.postCamera = null;
    this.postQuad = null;
    this.root = null;
    this.raycaster = null;
    this.pointer = new this.THREE.Vector2();
    this.meshes = [];
    this.textures = new Map();
    this.currentMode = "spiral";
    this.scrollOffset = getNumericQueryParam("homeOffset", HOME_INITIAL_SCROLL_OFFSET);
    this.wheelDeltaY = 0;
    this.targetWheelDeltaY = 0;
    this.minWheelSpeed = getNumericQueryParam("homeSpin", HOME_DEFAULT_SPIN);
    this.wheelDirection = 1;
    this.hoveredMesh = null;
    this.activePointerId = null;
    this.lastDragX = 0;
    this.dragStartX = 0;
    this.touchVelocityX = 0;
    this.isDragging = false;
    this.dragThreshold = 8;
    this.lastFrameTime = performance.now();
    this.rafId = 0;
    this.layout = this.getLayout();
    this.tone = this.getToneSettings();
    this.projectCount = this.projects.length;
    this.totalPlanes = this.projectCount * STAGE_LOOP_COPIES;
    this.onResize = this.onResize.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onCanvasClick = this.onCanvasClick.bind(this);
    this.render = this.render.bind(this);
  }

  getLayout() {
    const compact = window.matchMedia("(max-width: 900px)").matches;
    const defaults = compact ? {
      radius: 2,
      verticalGap: 0.5,
      angleGap: 0.85,
      cameraZ: 8,
      sceneOffsetX: -0.08,
      sceneOffsetY: 0.08,
      sceneScale: 0.97
    } : {
      radius: 2,
      verticalGap: 0.5,
      angleGap: 0.85,
      cameraZ: 8,
      sceneOffsetX: -0.18,
      sceneOffsetY: 0.24,
      sceneScale: 0.95
    };

    return {
      radius: getNumericQueryParam("stageRadius", defaults.radius),
      verticalGap: getNumericQueryParam("stageGapY", defaults.verticalGap),
      angleGap: getNumericQueryParam("stageAngle", defaults.angleGap),
      cameraZ: getNumericQueryParam("stageCameraZ", defaults.cameraZ),
      sceneOffsetX: getNumericQueryParam("stageX", defaults.sceneOffsetX),
      sceneOffsetY: getNumericQueryParam("stageY", defaults.sceneOffsetY),
      sceneScale: getNumericQueryParam("stageScale", defaults.sceneScale),
      planeWidth: getNumericQueryParam("stageCardWidth", HOME_DEFAULT_CARD_WIDTH),
      planeHeight: getNumericQueryParam("stageCardHeight", HOME_DEFAULT_CARD_HEIGHT)
    };
  }

  getToneSettings() {
    return {
      frontGamma: getNumericQueryParam("frontGamma", HOME_FRONT_GAMMA),
      frontGain: getNumericQueryParam("frontGain", HOME_FRONT_GAIN),
      frontLift: getNumericQueryParam("frontLift", HOME_FRONT_LIFT),
      backGamma: getNumericQueryParam("backGamma", HOME_BACK_GAMMA),
      backGain: getNumericQueryParam("backGain", HOME_BACK_GAIN),
      backLift: getNumericQueryParam("backLift", HOME_BACK_LIFT),
      postGamma: getNumericQueryParam("postGamma", HOME_POST_GAMMA),
      postLift: getNumericQueryParam("postLift", HOME_POST_LIFT)
    };
  }

  async init() {
    this.setupScene();
    this.createPlanes();
    this.attachEvents();
    this.render();
    void this.loadTextures();
  }

  async loadTextures() {
    const loader = new this.THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    const results = await Promise.allSettled(this.projects.map(async (project) => {
      const texture = await this.loadTextureForProject(loader, project);
      texture.colorSpace = this.THREE.SRGBColorSpace;
      texture.anisotropy = 8;

      const previousTexture = this.textures.get(project.slug);
      this.textures.set(project.slug, texture);

      this.meshes.forEach((mesh) => {
        if (mesh.userData.project.slug !== project.slug) {
          return;
        }

        mesh.material.uniforms.uTexture.value = texture;
        mesh.material.uniforms.uImageSizes.value.set(
          texture.image.width || 1024,
          texture.image.height || 640
        );
      });

      if (previousTexture && previousTexture !== texture && typeof previousTexture.dispose === "function") {
        previousTexture.dispose();
      }
    }));

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.warn(`Texture load failed for ${this.projects[index].slug}`, result.reason);
      }
    });
  }

  async loadTextureForProject(loader, project) {
    const stageTextureUrl = getProjectStageTextureUrl(project);
    const fallbackTextureUrl = new URL(project.image, window.location.href).href;
    const candidates = Array.from(new Set([
      stageTextureUrl,
      fallbackTextureUrl
    ].filter(Boolean)));
    let lastError = null;

    for (const candidate of candidates) {
      try {
        return await loader.loadAsync(candidate);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error(`Unable to load texture for ${project.slug}`);
  }

  createPlaceholderTexture(project) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 640;

    const context = canvas.getContext("2d");
    if (!context) {
      const fallback = new this.THREE.DataTexture(new Uint8Array([18, 20, 26, 255]), 1, 1);
      fallback.colorSpace = this.THREE.SRGBColorSpace;
      fallback.needsUpdate = true;
      return fallback;
    }

    const seed = Array.from(project.slug).reduce((total, char) => total + char.charCodeAt(0), 0);
    const hue = seed % 360;
    const accent = `hsl(${hue} 86% 62%)`;
    const accentSoft = `hsla(${hue} 92% 68% / 0.26)`;

    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#050608");
    gradient.addColorStop(0.6, "#0b0f16");
    gradient.addColorStop(1, "#121826");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = accentSoft;
    context.fillRect(56, 56, canvas.width - 112, canvas.height - 112);

    context.strokeStyle = "rgba(255,255,255,0.12)";
    context.lineWidth = 2;
    context.strokeRect(56, 56, canvas.width - 112, canvas.height - 112);

    context.fillStyle = accent;
    context.fillRect(56, canvas.height - 126, 170, 14);

    context.fillStyle = "rgba(255,255,255,0.9)";
    context.font = "600 58px Inter, Arial, sans-serif";
    context.textBaseline = "alphabetic";
    context.fillText(project.title, 56, canvas.height - 154);

    context.fillStyle = "rgba(255,255,255,0.46)";
    context.font = "500 24px Inter, Arial, sans-serif";
    context.fillText(project.year, 56, canvas.height - 84);

    const texture = new this.THREE.CanvasTexture(canvas);
    texture.colorSpace = this.THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

  setupScene() {
    const { clientWidth, clientHeight } = this.container;

    this.scene = new this.THREE.Scene();
    this.camera = new this.THREE.PerspectiveCamera(window.matchMedia("(max-width: 900px)").matches ? 45 : 35, clientWidth / clientHeight, 0.1, 100);
    this.camera.position.set(0, 0, this.layout.cameraZ);

    this.renderer = new this.THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(clientWidth, clientHeight);
    this.renderer.outputColorSpace = this.THREE.SRGBColorSpace;
    this.renderer.domElement.className = "webgl-canvas";
    this.renderer.setClearColor(0x0e0d0e, 0);
    this.renderTarget = new this.THREE.WebGLRenderTarget(clientWidth, clientHeight, {
      colorSpace: this.THREE.SRGBColorSpace
    });

    this.root = new this.THREE.Group();
    this.root.position.set(this.layout.sceneOffsetX, this.layout.sceneOffsetY, 0);
    this.root.scale.setScalar(this.layout.sceneScale);
    this.scene.add(this.root);

    this.postScene = new this.THREE.Scene();
    this.postCamera = new this.THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postQuad = new this.THREE.Mesh(
      new this.THREE.PlaneGeometry(2, 2),
      new this.THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: this.renderTarget.texture },
          uFillColor: { value: new this.THREE.Color("#444444") },
          uPostGamma: { value: this.tone.postGamma },
          uPostLift: { value: this.tone.postLift }
        },
        vertexShader: POST_VERTEX_SHADER,
        fragmentShader: POST_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false
      })
    );
    this.postScene.add(this.postQuad);

    this.raycaster = new this.THREE.Raycaster();
    this.container.appendChild(this.renderer.domElement);
  }

  createPlanes() {
    const total = this.totalPlanes;

    for (let index = 0; index < total; index += 1) {
      const project = this.projects[index % this.projectCount];
      const texture = this.textures.get(project.slug) || this.createPlaceholderTexture(project);
      const baseZoom = getProjectStageZoom(project);
      this.textures.set(project.slug, texture);
      const geometry = new this.THREE.PlaneGeometry(1, 1, 8, 8);
      const material = new this.THREE.ShaderMaterial({
        uniforms: {
          uTexture: { value: texture },
          uColorStrength: { value: 0 },
          uZoom: { value: baseZoom },
          uPlaneSizes: { value: new this.THREE.Vector2(this.layout.planeWidth, this.layout.planeHeight) },
          uFrontGamma: { value: this.tone.frontGamma },
          uFrontGain: { value: this.tone.frontGain },
          uFrontLift: { value: this.tone.frontLift },
          uBackGamma: { value: this.tone.backGamma },
          uBackGain: { value: this.tone.backGain },
          uBackLift: { value: this.tone.backLift },
          uImageSizes: {
            value: new this.THREE.Vector2(
              texture.image?.width || 1024,
              texture.image?.height || 640
            )
          },
          uRevealProgress: { value: 0 },
          uScrollSpeed: { value: 0 }
        },
        vertexShader: PLANE_VERTEX_SHADER,
        fragmentShader: PLANE_FRAGMENT_SHADER,
        transparent: true,
        side: this.THREE.DoubleSide,
        depthWrite: false
      });

      const mesh = new this.THREE.Mesh(geometry, material);

      mesh.userData = {
        loopIndex: index,
        project,
        baseZoom,
        hover: 0,
        hoverTarget: 0,
        hiddenProgress: 1,
        hiddenTarget: 1,
        hideTimer: 0
      };

      mesh.scale.set(this.layout.planeWidth, this.layout.planeHeight, 1);

      this.root.add(mesh);
      this.meshes.push(mesh);
    }
  }

  attachEvents() {
    window.addEventListener("resize", this.onResize);
    this.container.addEventListener("wheel", this.onWheel, { passive: true });
    this.container.addEventListener("pointermove", this.onPointerMove);
    this.container.addEventListener("pointerleave", this.onPointerLeave);
    this.container.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener("click", this.onCanvasClick);
  }

  setMode(mode, immediate = false) {
    this.currentMode = mode;
    if (mode === "list") {
      this.hoveredMesh = null;
      state.hoveredSlug = null;
      this.container.style.cursor = "default";
    }

    this.meshes.forEach((mesh, index) => {
      if (mesh.userData.hideTimer) {
        window.clearTimeout(mesh.userData.hideTimer);
        mesh.userData.hideTimer = 0;
      }

      if (immediate) {
        mesh.userData.hiddenTarget = mode === "list" ? 1 : 0;
        mesh.userData.hiddenProgress = mesh.userData.hiddenTarget;
        return;
      }

      const delay = (index % 4) * (mode === "list" ? 30 : 50);
      mesh.userData.hideTimer = window.setTimeout(() => {
        mesh.userData.hiddenTarget = mode === "list" ? 1 : 0;
      }, delay);
    });
  }

  onResize() {
    this.layout = this.getLayout();
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.position.z = this.layout.cameraZ;
    this.camera.fov = window.matchMedia("(max-width: 900px)").matches ? 45 : 35;
    this.camera.updateProjectionMatrix();
    this.root.position.set(this.layout.sceneOffsetX, this.layout.sceneOffsetY, 0);
    this.root.scale.setScalar(this.layout.sceneScale);
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderTarget.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  onWheel(event) {
    if (!body.classList.contains("page-home") || state.currentMode !== "spiral") {
      return;
    }

    this.targetWheelDeltaY += event.deltaY * 0.0015;
    this.targetWheelDeltaY = clamp(this.targetWheelDeltaY, -2, 2);
    this.wheelDirection = event.deltaY > 0 ? 1 : -1;
  }

  onPointerMove(event) {
    const rect = this.container.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.pointer.set(x, y);

    if (this.activePointerId === event.pointerId) {
      if (!this.isDragging && Math.abs(event.clientX - this.dragStartX) > this.dragThreshold) {
        this.isDragging = true;
      }
      if (!this.isDragging) {
        return;
      }
      event.preventDefault();
      const touchDeltaX = -(event.clientX - this.lastDragX) * 0.5;
      this.lastDragX = event.clientX;
      this.targetWheelDeltaY -= touchDeltaX * 0.003;
      this.targetWheelDeltaY = clamp(this.targetWheelDeltaY, -2, 2);
      this.wheelDirection = touchDeltaX < 0 ? 1 : -1;
      this.touchVelocityX = touchDeltaX;
    }
  }

  onPointerLeave() {
    this.pointer.set(0, 0);
    if (!this.activePointerId) {
      this.hoveredMesh = null;
      state.hoveredSlug = null;
      this.container.style.cursor = "default";
    }
  }

  onPointerDown(event) {
    this.activePointerId = event.pointerId;
    this.lastDragX = event.clientX;
    this.dragStartX = event.clientX;
    this.touchVelocityX = 0;
    this.isDragging = false;
  }

  onPointerUp(event) {
    if (this.activePointerId !== event.pointerId) {
      return;
    }
    if (this.isDragging) {
      this.targetWheelDeltaY -= this.touchVelocityX * 0.002;
      this.targetWheelDeltaY = clamp(this.targetWheelDeltaY, -2, 2);
    }
    this.activePointerId = null;
    this.isDragging = false;
    this.touchVelocityX = 0;
  }

  onCanvasClick() {
    if (!this.hoveredMesh || this.currentMode !== "spiral") {
      return;
    }
    if (this.isDragging) {
      return;
    }
    window.location.href = buildProjectPath(this.hoveredMesh.userData.project.slug);
  }

  updateMeshes(delta) {
    const total = this.totalPlanes;
    const centerIndex = Math.floor(total / 2);

    this.meshes.forEach((mesh) => {
      const { loopIndex, hiddenTarget } = mesh.userData;
      const hoverTarget = this.hoveredMesh === mesh ? 1 : 0;
      const hoverRate = hoverTarget ? 0.09 : 0.07;
      const hoverEase = 1 - Math.pow(1 - hoverRate, delta * 0.2);
      const hiddenEase = 1 - Math.pow(1 - 0.05, delta * 0.15);
      mesh.userData.hover = lerp(mesh.userData.hover, hoverTarget, hoverEase);
      mesh.userData.hiddenProgress = lerp(mesh.userData.hiddenProgress, hiddenTarget, hiddenEase);

      let normalizedIndex = loopIndex - this.scrollOffset;
      normalizedIndex = ((normalizedIndex % total) + total) % total;

      const order = normalizedIndex - centerIndex;
      const hiddenDirection = hiddenTarget > 0.5 ? 1.5 : -1.5;
      const y = order * this.layout.verticalGap - 0.8 - mesh.userData.hiddenProgress * hiddenDirection;
      const radius = this.layout.radius * (1 - mesh.userData.hiddenProgress / 2);
      const angle = order * this.layout.angleGap;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const revealProgress = (1 - mesh.userData.hover * 0.05) * (1 - mesh.userData.hiddenProgress);

      mesh.position.set(x, y, z);
      mesh.rotation.x = 0;
      mesh.rotation.y = -angle + Math.PI / 2;
      mesh.rotation.z = 0;
      mesh.scale.set(this.layout.planeWidth, this.layout.planeHeight, 1);
      mesh.material.opacity = 1;
      mesh.material.uniforms.uPlaneSizes.value.set(this.layout.planeWidth, this.layout.planeHeight);
      mesh.material.uniforms.uColorStrength.value = 0.55 * mesh.userData.hover;
      mesh.material.uniforms.uZoom.value = mesh.userData.baseZoom + 0.05 * mesh.userData.hover;
      mesh.material.uniforms.uRevealProgress.value = Math.max(0, revealProgress);
      mesh.material.uniforms.uScrollSpeed.value = this.wheelDeltaY;
    });
  }

  updateHoverState() {
    if (this.currentMode !== "spiral") {
      this.hoveredMesh = null;
      state.hoveredSlug = null;
      this.container.style.cursor = "default";
      return;
    }

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(this.meshes, false);
    const visibleTarget = intersections.find((entry) => {
      const mesh = entry.object;
      if (!entry.face || mesh.userData.hiddenProgress >= 0.01) {
        return false;
      }
      const normal = entry.face.normal.clone().transformDirection(mesh.matrixWorld);
      return normal.dot(this.raycaster.ray.direction) < 0;
    }) || null;

    this.hoveredMesh = visibleTarget ? visibleTarget.object : null;
    state.hoveredSlug = this.hoveredMesh ? this.hoveredMesh.userData.project.slug : null;
    this.container.style.cursor = this.hoveredMesh ? "pointer" : "default";
  }

  render() {
    const now = performance.now();
    const delta = Math.min(now - this.lastFrameTime, 50);
    const frameFactor = delta / (1000 / 60);
    const wheelEase = 1 - Math.pow(1 - 0.1, frameFactor);
    this.lastFrameTime = now;

    this.wheelDeltaY = lerp(this.wheelDeltaY, this.targetWheelDeltaY, wheelEase);
    this.scrollOffset += this.wheelDeltaY * frameFactor;
    if (Math.abs(this.targetWheelDeltaY) < this.minWheelSpeed) {
      this.targetWheelDeltaY = this.wheelDirection * this.minWheelSpeed;
    }
    this.targetWheelDeltaY *= Math.pow(0.9, frameFactor);

    this.updateMeshes(delta);
    this.scene.updateMatrixWorld(true);
    this.updateHoverState();
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
    this.rafId = window.requestAnimationFrame(this.render);
  }
}

async function createSpiralStage(container) {
  const THREE = await loadThree();
  const stage = new SpiralStage(container, projects, THREE);
  await stage.init();
  return stage;
}

async function initHomePage() {
  const params = new URLSearchParams(window.location.search);
  const previewMode = params.get("preview") === "1";
  buildHomeList();
  setupListPreview();
  runLoader();

  qs("#spiral-toggle")?.addEventListener("click", () => setMode("spiral"));
  qs("#list-toggle")?.addEventListener("click", () => setMode("list"));

  const scene = qs("#card-scene");
  if (scene) {
    try {
      state.stage = await createSpiralStage(scene);
      window.__portfolioStage = state.stage;
    } catch (error) {
      console.error("Failed to initialize spiral stage", error);
    }
  }

  setMode(params.get("mode") === "list" ? "list" : "spiral", previewMode);
}

function fillAboutTrack(track, directionOffset = 0) {
  if (!track) {
    return;
  }

  const items = [...projects, ...projects].map((project, index) => {
    return `
      <a class="about-thumb" href="${buildProjectPath(project.slug)}" style="transform:translateY(${((index + directionOffset) % 4) * 10}px)">
        <img src="${getProjectThumbnail(project)}" alt="${project.title}">
        <span>view project</span>
      </a>
    `;
  }).join("");

  track.innerHTML = items;
}

function initAboutPage() {
  const aboutCopy = qs(".about-copy-sticky p");
  if (aboutCopy) {
    aboutCopy.innerHTML = "I&rsquo;m Pacome Pertant, motion and sound designer based in Paris. I move shapes and sound to create emotional content. Always playing with rhythm, sound and visual narrative on a 2D and/or 3D canvas. Clean at times, experimental at others.";
  }

  fillAboutTrack(qs("#about-strip-track-a"), 0);
  fillAboutTrack(qs("#about-strip-track-b"), 2);
}

function getProjectHeroMarkup(project) {
  if (project.videoPlaybackId) {
    return `
      <video
        class="project-hero-video"
        data-playback-id="${project.videoPlaybackId}"
        poster="${project.videoPosterUrl}"
        playsinline
        autoplay
        muted
        loop
        preload="metadata"
      ></video>
    `;
  }

  return `<img src="${getProjectThumbnail(project)}" alt="${project.title}">`;
}

async function hydrateProjectHeroVideo(root, project) {
  if (!project.videoPlaybackId) {
    return;
  }

  const video = root.querySelector(".project-hero-video");
  if (!video) {
    return;
  }

  const streamUrl = getMuxStreamUrl(project.videoPlaybackId);
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;

  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = streamUrl;
    try {
      await video.play();
    } catch (error) {
      console.warn(`Native HLS autoplay failed for ${project.slug}`, error);
    }
    return;
  }

  try {
    const Hls = await loadHlsConstructor();
    if (!Hls?.isSupported()) {
      return;
    }

    const hls = new Hls({
      maxBufferLength: 30,
      lowLatencyMode: false,
      startLevel: -1
    });

    hls.loadSource(streamUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch((error) => {
        console.warn(`Mux autoplay failed for ${project.slug}`, error);
      });
    });
  } catch (error) {
    console.warn(`Failed to initialize project video for ${project.slug}`, error);
  }
}

async function renderProjectPage() {
  const root = qs("#project-page");
  if (!root) {
    return;
  }

  const project = getProject(getCurrentProjectSlug());
  const nextProject = getNextProject(project.slug);
  const hasCaseUrl = project.caseUrl && project.caseUrl !== "#";
  const caseLinkMarkup = hasCaseUrl
    ? `<a class="project-link" href="${project.caseUrl}" target="_blank" rel="noopener noreferrer">see the case</a>`
    : "";

  document.title = `${project.title} - Portfolio Study`;

  root.innerHTML = `
    <article class="project-card">
      <a class="project-close" href="/" aria-label="Back to home">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 7l10 10"></path>
          <path d="M17 7L7 17"></path>
        </svg>
      </a>

      <div class="project-hero">
        ${getProjectHeroMarkup(project)}
      </div>

      <section class="project-info">
        <h1>${project.title}</h1>
        <div class="project-copy">
          <p>${project.description}</p>
          ${caseLinkMarkup}
        </div>
      </section>

      <section class="project-frames">
        ${project.frames.map((frame, index) => `
          <div class="project-frame">
            <img src="${frame}" alt="${project.title} frame ${index + 1}">
          </div>
        `).join("")}
      </section>
    </article>

    <section class="project-next">
      <div class="project-next-inner">
        <a class="project-next-back" href="/">back to home</a>

        <a class="project-next-figure" href="${buildProjectPath(nextProject.slug)}">
          <img src="${getProjectThumbnail(nextProject)}" alt="${nextProject.title}">
          <span class="project-tag project-tag-accent project-tag-top">keep scrolling !</span>
          <span class="project-tag project-tag-bottom">next up...</span>
        </a>

        <p class="project-next-title">${nextProject.title}</p>
      </div>
    </section>
  `;

  await hydrateProjectHeroVideo(root, project);
}

async function init() {
  setupChrome();
  hydrateReferenceChrome();

  if (body.classList.contains("page-home")) {
    await initHomePage();
  }

  if (body.classList.contains("page-about")) {
    initAboutPage();
  }

  if (body.classList.contains("page-project")) {
    await renderProjectPage();
  }
}

void init();
