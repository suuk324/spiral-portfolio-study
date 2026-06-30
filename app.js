const SITE_ROOT_URL = new URL("./", import.meta.url);

function resolveSiteUrl(path = "") {
  return new URL(String(path).replace(/^\/+/, ""), SITE_ROOT_URL).toString();
}

function resolveSitePath(path = "") {
  return new URL(String(path).replace(/^\/+/, ""), SITE_ROOT_URL).pathname;
}

const THREE_MODULE_URL = resolveSiteUrl("node_modules/three/build/three.module.js");
const HLS_MODULE_URL = resolveSiteUrl("node_modules/hls.js/dist/hls.mjs");
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
const HOME_MAX_PIXEL_RATIO = 2.25;
const HOME_MOBILE_MAX_PIXEL_RATIO = 2;
const HOME_RENDER_TARGET_SAMPLES = 4;
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
    float edgeSoftness = max(fwidth(sdf) * 2.5, 0.004);
    float alpha = 1.0 - smoothstep(-edgeSoftness, edgeSoftness, sdf);
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

const userImages = [
  resolveSiteUrl("assets/user-images/optimized/user-01.webp"),
  resolveSiteUrl("assets/user-images/optimized/user-02.webp"),
  resolveSiteUrl("assets/user-images/optimized/user-03.webp"),
  resolveSiteUrl("assets/user-images/optimized/user-04.webp"),
  resolveSiteUrl("assets/user-images/optimized/user-05.webp"),
  resolveSiteUrl("assets/user-images/optimized/user-06.webp"),
  resolveSiteUrl("assets/user-images/optimized/user-07.webp"),
  resolveSiteUrl("assets/user-images/optimized/user-08.webp"),
  resolveSiteUrl("assets/user-images/optimized/user-09.webp"),
  resolveSiteUrl("assets/user-images/optimized/user-10.webp"),
  resolveSiteUrl("assets/user-images/optimized/user-11.webp"),
  resolveSiteUrl("assets/user-images/optimized/user-12.webp"),
  resolveSiteUrl("assets/user-images/optimized/user-13.webp"),
  resolveSiteUrl("assets/user-images/optimized/user-14.webp"),
];

const referenceMedia = {
  pathsOfLife: userImages[0],
  disease: userImages[1],
  psychedelics: userImages[2],
  thought: userImages[3],
  jupiter: userImages[4],
  chromatik: userImages[5],
  digitalTravel: userImages[6],
  mercedesAmg: userImages[7],
  purityRevealed: userImages[8]
};

const curatedProjectCardMedia = {
  "odd-modular-music-controller": {
    cover: userImages[2],
    reservedImages: [userImages[2]]
  },
  "manta-matrix": {
    cover: userImages[1],
    reservedImages: [userImages[1], userImages[3]]
  },
  "showreel-2025": {
    cover: userImages[0],
    reservedImages: [userImages[0]]
  },
  "ah-psychedelics": {
    cover: userImages[4],
    reservedImages: [userImages[4]]
  },
  "thought": {
    cover: userImages[5],
    reservedImages: [userImages[5]]
  },
  "jupiter": {
    cover: userImages[6],
    reservedImages: [userImages[6]]
  },
  "chromatik": {
    cover: userImages[7],
    reservedImages: [userImages[7]]
  },
  "digital-travel": {
    cover: userImages[8],
    reservedImages: [userImages[8]]
  },
  "mercedes-amg": {
    cover: userImages[9],
    reservedImages: [userImages[9]]
  },
  "the-purity-revealed": {
    cover: userImages[12],
    reservedImages: [userImages[12]]
  }
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
  email: "3156686189@qq.com",
  contactLabel: "3156686189@qq.com",
  showreelUrl: resolveSitePath("about/"),
  showreelPlaybackId: "ycc6bXk6hOWxGnyb6F3wvUxPPLiDML00P9OPkYMjuSN8",
  showreelCover: resolveSiteUrl("assets/reference/showreel-cover.png"),
  profileImage: resolveSiteUrl("assets/profile/portrait-cutout.png"),
  socials: [
    { label: "GitHub", short: "gh", url: "https://github.com/suuk324" },
    { label: "小红书", short: "red", account: "a15706750107" },
    { label: "Bilibili", short: "bili", account: "阿呆呆呢" }
  ],
  aboutSocials: [
    { label: "github", value: "suuk324", url: "https://github.com/suuk324" },
    { label: "小红书", value: "a15706750107" },
    { label: "bilibili", value: "阿呆呆呢" }
  ]
};

function buildReportPages(basePath, count) {
  return Array.from({ length: count }, (_, index) => `${basePath}/page-${String(index + 1).padStart(3, "0")}.jpg`);
}

function positionShowreelMarqueeChars(marquee, chars, progress = 0) {
  const width = marquee.clientWidth || 424;
  const height = marquee.clientHeight || 302;
  const radius = Math.min(width, height) * 0.2;
  const straightX = width - radius * 2;
  const straightY = height - radius * 2;
  const arcLength = (Math.PI * radius) / 2;
  const perimeter = straightX * 2 + straightY * 2 + arcLength * 4;
  const spacing = Math.max(14, perimeter / Math.max(chars.length, 1));
  const travel = progress * perimeter;

  const getPoint = (rawDistance) => {
    let distance = rawDistance;

    if (distance < straightX) {
      return { x: radius + distance, y: 0, angle: 0 };
    }
    distance -= straightX;

    if (distance < arcLength) {
      const theta = -Math.PI / 2 + distance / radius;
      return {
        x: width - radius + Math.cos(theta) * radius,
        y: radius + Math.sin(theta) * radius,
        angle: (theta + Math.PI / 2) * 180 / Math.PI
      };
    }
    distance -= arcLength;

    if (distance < straightY) {
      return { x: width, y: radius + distance, angle: 90 };
    }
    distance -= straightY;

    if (distance < arcLength) {
      const theta = distance / radius;
      return {
        x: width - radius + Math.cos(theta) * radius,
        y: height - radius + Math.sin(theta) * radius,
        angle: (theta + Math.PI / 2) * 180 / Math.PI
      };
    }
    distance -= arcLength;

    if (distance < straightX) {
      return { x: width - radius - distance, y: height, angle: 180 };
    }
    distance -= straightX;

    if (distance < arcLength) {
      const theta = Math.PI / 2 + distance / radius;
      return {
        x: radius + Math.cos(theta) * radius,
        y: height - radius + Math.sin(theta) * radius,
        angle: (theta + Math.PI / 2) * 180 / Math.PI
      };
    }
    distance -= arcLength;

    if (distance < straightY) {
      return { x: 0, y: height - radius - distance, angle: 270 };
    }
    distance -= straightY;

    const theta = Math.PI + distance / radius;
    return {
      x: radius + Math.cos(theta) * radius,
      y: radius + Math.sin(theta) * radius,
      angle: (theta + Math.PI / 2) * 180 / Math.PI
    };
  };

  chars.forEach((char, index) => {
    const distance = (travel + index * spacing) % perimeter;
    const { x, y, angle } = getPoint(distance);
    char.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${angle}deg)`;
  });
}

function hydrateShowreelMarquees() {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  qsa(".showreel-marquee").forEach((marquee) => {
    if (marquee.dataset.ready === "true") {
      return;
    }

    marquee.dataset.ready = "true";
    const text = marquee.dataset.marqueeText || "profile • about me • portfolio • ";
    let ringText = text;
    while (ringText.length < 56) {
      ringText += text;
    }
    const chars = Array.from(ringText).map((letter) => {
      const span = document.createElement("span");
      span.className = "showreel-marquee-char";
      span.textContent = letter;
      marquee.appendChild(span);
      return span;
    });

    positionShowreelMarqueeChars(marquee, chars, 0);

    if (reduceMotion) {
      return;
    }

    const duration = 12000;
    const start = performance.now();
    const tick = () => {
      const progress = ((performance.now() - start) % duration) / duration;
      positionShowreelMarqueeChars(marquee, chars, progress);
    };

    window.setInterval(tick, 1000 / 60);
  });
}

const projects = [
  {
    slug: "odd-modular-music-controller",
    title: "声迹 O.D.D",
    year: "2026",
    image: resolveSiteUrl("assets/odd/board-02.webp"),
    thumbnailUrl: resolveSiteUrl("assets/odd/board-02.webp"),
    videoPlaybackId: null,
    videoPosterUrl: null,
    description: "面向 DJ、电子音乐制作人与现场表演者的模块化音乐控制器。项目通过磁吸式硬件模块、AI 辅助调音与便携式交互终端，把自然采样、即时创作与复古物理操作组织成一套可随身携带的创作体验。",
    caseUrl: "",
    lockMedia: true,
    kicker: "Product design / interaction / portable music device",
    facts: [
      { label: "类型", value: "产品设计 / 交互设计" },
      { label: "关键词", value: "模块化 / 采样 / 便携创作 / AI 辅助" },
      { label: "输出", value: "产品方案 / 展板 / 设计报告" }
    ],
    boards: [
      {
        src: resolveSiteUrl("assets/odd/board-01.webp"),
        alt: "ODD 模块化音乐控制器展板总览"
      },
      {
        src: resolveSiteUrl("assets/odd/board-02.webp"),
        alt: "ODD 模块化音乐控制器细节与结构展板"
      }
    ],
    reportPages: buildReportPages(resolveSiteUrl("assets/odd/report-pages"), 61),
    reportLabel: "设计报告预览",
    frames: [
      resolveSiteUrl("assets/odd/board-01.webp"),
      resolveSiteUrl("assets/odd/board-02.webp")
    ],
    width: 340
  },
  {
    slug: "manta-matrix",
    title: "Manta Matrix",
    year: "2026",
    image: resolveSiteUrl("assets/manta/board-01.webp"),
    thumbnailUrl: resolveSiteUrl("assets/manta/board-01.webp"),
    videoPlaybackId: null,
    videoPosterUrl: null,
    description: "针对深海作业潜水员设计的分布式智能生命保障系统。项目围绕高压、低温、黑暗与强流环境下的作业风险，提出由移动救援海上浮岛、生命监测氧气面罩与潜水辅助动力装置组成的主动防护网络，将预警、监测、现场干预与上浮救援整合进同一套系统。",
    caseUrl: "",
    lockMedia: true,
    kicker: "System design / safety equipment / deep-sea rescue",
    facts: [
      { label: "类型", value: "系统设计 / 健康产品设计" },
      { label: "关键词", value: "主动应急 / 救援预处理 / 生命监测 / 分布式保障" },
      { label: "输出", value: "系统方案 / 展板 / 设计报告" }
    ],
    boards: [
      {
        src: resolveSiteUrl("assets/manta/board-01.webp"),
        alt: "Manta Matrix 深海作业安全浮岛与监测救援设备展板"
      },
      {
        src: resolveSiteUrl("assets/manta/board-02.webp"),
        alt: "Manta Matrix 浮岛、氧气面罩与潜水辅助动力装置细节展板"
      }
    ],
    reportPages: buildReportPages(resolveSiteUrl("assets/manta/report-pages"), 37),
    reportLabel: "设计报告预览",
    frames: [
      resolveSiteUrl("assets/manta/board-01.webp"),
      resolveSiteUrl("assets/manta/board-02.webp")
    ],
    width: 360
  },
  {
    slug: "showreel-2025",
    title: "智能家居",
    year: "2026",
    image: resolveSiteUrl("assets/user-images/optimized/user-01.webp"),
    thumbnailUrl: resolveSiteUrl("assets/user-images/optimized/user-01.webp"),
    videoPlaybackId: null,
    videoPosterUrl: null,
    description: "智能家居方向的课程设计报告，围绕家庭场景中的产品系统、交互体验与使用流程展开方案整理。",
    caseUrl: "",
    kicker: "Product design / smart home / course report",
    facts: [
      { label: "类型", value: "智能家居 / 产品系统设计" },
      { label: "输出", value: "设计报告页面预览" },
      { label: "状态", value: "设计报告已接入" }
    ],
    reportPages: buildReportPages(resolveSiteUrl("assets/projects/showreel-2025/report-pages"), 34),
    reportLabel: "智能家居设计报告预览",
    frames: [
      resolveSiteUrl("assets/user-images/optimized/user-01.webp")
    ],
    width: 340
  },
  {
    slug: "ah-psychedelics",
    title: "电饭煲",
    year: "2024",
    image: resolveSiteUrl("assets/user-images/optimized/user-05.webp"),
    thumbnailUrl: resolveSiteUrl("assets/user-images/optimized/user-05.webp"),
    videoPlaybackId: null,
    videoPosterUrl: null,
    description: "电饭煲产品设计课程报告，围绕家电产品造型、功能结构与用户使用体验展开设计表达。",
    caseUrl: "",
    kicker: "Product design / home appliance / rice cooker",
    facts: [
      { label: "类型", value: "产品设计 / 家电设计" },
      { label: "输出", value: "设计报告预览" },
      { label: "状态", value: "设计报告已接入" }
    ],
    reportPages: buildReportPages(resolveSiteUrl("assets/projects/ah-psychedelics/report-pages"), 13),
    reportLabel: "电饭煲设计报告预览",
    frames: [
      resolveSiteUrl("assets/user-images/optimized/user-05.webp")
    ],
    width: 330
  },
  {
    slug: "thought",
    title: "小排量机车",
    year: "2025",
    image: resolveSiteUrl("assets/user-images/optimized/user-06.webp"),
    thumbnailUrl: resolveSiteUrl("assets/user-images/optimized/user-06.webp"),
    videoPlaybackId: null,
    videoPosterUrl: null,
    description: "小排量机车产品设计报告，聚焦交通工具造型、比例控制、结构表达与使用场景。",
    caseUrl: "",
    kicker: "Product design / mobility / motorcycle",
    facts: [
      { label: "类型", value: "交通工具设计 / 产品设计" },
      { label: "输出", value: "设计报告预览" },
      { label: "状态", value: "设计报告已接入" }
    ],
    reportPages: buildReportPages(resolveSiteUrl("assets/projects/thought/report-pages"), 33),
    reportLabel: "小排量机车设计报告预览",
    frames: [
      resolveSiteUrl("assets/user-images/optimized/user-06.webp")
    ],
    width: 340
  },
  {
    slug: "jupiter",
    title: "冲牙器",
    year: "2025",
    image: resolveSiteUrl("assets/user-images/optimized/user-07.webp"),
    thumbnailUrl: resolveSiteUrl("assets/user-images/optimized/user-07.webp"),
    videoPlaybackId: null,
    videoPosterUrl: null,
    description: "冲牙器产品设计报告，围绕个人护理产品的功能结构、握持体验、使用流程与造型表达展开设计。",
    caseUrl: "",
    kicker: "Product design / oral care / water flosser",
    facts: [
      { label: "类型", value: "产品设计 / 个人护理产品" },
      { label: "输出", value: "设计报告页面预览" },
      { label: "状态", value: "设计报告已接入" }
    ],
    reportPages: buildReportPages(resolveSiteUrl("assets/projects/jupiter/report-pages"), 26),
    reportLabel: "冲牙器设计报告预览",
    frames: [
      resolveSiteUrl("assets/user-images/optimized/user-07.webp")
    ],
    width: 460
  },
  {
    slug: "chromatik",
    title: "LUNE 车顶帐篷",
    year: "2025",
    image: resolveSiteUrl("assets/user-images/optimized/user-08.webp"),
    thumbnailUrl: resolveSiteUrl("assets/user-images/optimized/user-08.webp"),
    videoPlaybackId: null,
    videoPosterUrl: null,
    description: "LUNE 一体式全自动充气车顶帐篷目标导向设计报告，围绕户外出行场景、用户目标与产品系统体验展开方案。",
    caseUrl: "",
    kicker: "Goal-directed design / outdoor product / roof tent",
    facts: [
      { label: "类型", value: "户外产品设计 / 目标导向设计" },
      { label: "输出", value: "设计报告预览" },
      { label: "状态", value: "设计报告已接入" }
    ],
    reportPages: buildReportPages(resolveSiteUrl("assets/projects/chromatik/report-pages"), 27),
    reportLabel: "LUNE 目标导向设计报告预览",
    frames: [
      resolveSiteUrl("assets/user-images/optimized/user-08.webp")
    ],
    width: 300
  },
  {
    slug: "digital-travel",
    title: "Digital Travel",
    year: "2024",
    image: resolveSiteUrl("assets/user-images/optimized/user-09.webp"),
    thumbnailUrl: resolveSiteUrl("assets/user-images/optimized/user-09.webp"),
    videoPlaybackId: null,
    videoPosterUrl: null,
    description: "该项目详情页框架已建立，等待后续接入设计报告素材或展板图片。",
    caseUrl: "",
    frames: [
      resolveSiteUrl("assets/user-images/optimized/user-09.webp")
    ],
    width: 320
  },
  {
    slug: "mercedes-amg",
    title: "设计与材料",
    year: "2025",
    image: resolveSiteUrl("assets/user-images/optimized/user-10.webp"),
    thumbnailUrl: resolveSiteUrl("assets/user-images/optimized/user-10.webp"),
    videoPlaybackId: null,
    videoPosterUrl: null,
    description: "设计与材料课程作业，围绕材料特性、产品语义和设计表达之间的关系展开整理。",
    caseUrl: "",
    kicker: "Material study / product design / course work",
    facts: [
      { label: "类型", value: "设计与材料 / 课程作业" },
      { label: "输出", value: "课程作业页面预览" },
      { label: "状态", value: "设计报告已接入" }
    ],
    reportPages: buildReportPages(resolveSiteUrl("assets/projects/mercedes-amg/report-pages"), 16),
    reportLabel: "设计与材料课程作业预览",
    frames: [
      resolveSiteUrl("assets/user-images/optimized/user-10.webp")
    ],
    width: 280
  },
  {
    slug: "the-purity-revealed",
    title: "专题设计一",
    year: "2025",
    image: resolveSiteUrl("assets/user-images/optimized/user-13.webp"),
    thumbnailUrl: resolveSiteUrl("assets/user-images/optimized/user-13.webp"),
    videoPlaybackId: null,
    videoPosterUrl: null,
    description: "大三专题设计一设计报告，展示专题设计阶段的研究、方案推导与最终设计表达。",
    caseUrl: "",
    kicker: "Product design / studio project / design report",
    facts: [
      { label: "类型", value: "专题设计 / 产品设计" },
      { label: "输出", value: "设计报告预览" },
      { label: "状态", value: "设计报告已接入" }
    ],
    reportPages: buildReportPages(resolveSiteUrl("assets/projects/the-purity-revealed/report-pages"), 37),
    reportLabel: "专题设计一设计报告预览",
    frames: [
      resolveSiteUrl("assets/user-images/optimized/user-13.webp")
    ],
    width: 320
  }
];

function getUniqueImageList(images) {
  return Array.from(new Set(images.filter(Boolean)));
}

function getProjectFrames(images, projectIndex, coverImage, frameCount = 3) {
  const uniqueImages = getUniqueImageList(images);
  if (!uniqueImages.length) {
    return coverImage ? [coverImage] : [];
  }

  const frames = [];
  const used = new Set();
  const startIndex = (projectIndex + 1) % uniqueImages.length;

  for (let offset = 0; offset < uniqueImages.length && frames.length < frameCount; offset += 1) {
    const candidate = uniqueImages[(startIndex + offset) % uniqueImages.length];
    if (!candidate || used.has(candidate)) {
      continue;
    }

    used.add(candidate);
    frames.push(candidate);
  }

  if (!frames.length && coverImage) {
    frames.push(coverImage);
  }

  return frames;
}

function applyUserImagesToProjects(projectList, images) {
  const reservedImages = new Set(
    Object.values(curatedProjectCardMedia).flatMap((entry) => [
      entry.cover,
      ...(entry.reservedImages || [])
    ]).filter(Boolean)
  );
  const uniqueImages = getUniqueImageList(images).filter((image) => !reservedImages.has(image));
  if (!uniqueImages.length) {
    console.warn("No user images found for project cards.");
    return;
  }

  Object.entries(curatedProjectCardMedia).forEach(([slug, media]) => {
    const project = projectList.find((entry) => entry.slug === slug);
    if (!project || !media.cover) {
      return;
    }

    project.image = media.cover;
    project.thumbnailUrl = media.cover;
    project.videoPlaybackId = null;
    project.videoPosterUrl = null;
  });

  const curatedSlugs = new Set(Object.keys(curatedProjectCardMedia));
  const mutableProjects = projectList.filter((project) => !project.lockMedia && !curatedSlugs.has(project.slug));

  if (uniqueImages.length < mutableProjects.length) {
    console.warn(`Only ${uniqueImages.length} unique images found for ${mutableProjects.length} projects. Some covers may repeat.`);
  }

  mutableProjects.forEach((project, index) => {
    const coverImage = uniqueImages[index] || uniqueImages[index % uniqueImages.length];

    project.image = coverImage;
    project.thumbnailUrl = coverImage;
    project.videoPlaybackId = null;
    project.videoPosterUrl = null;
    project.frames = getProjectFrames(uniqueImages, index, coverImage);
  });

  const duplicateCovers = [];
  const coverTracker = new Set();
  projectList.forEach((project) => {
    if (coverTracker.has(project.image)) {
      duplicateCovers.push(project.image);
      return;
    }

    coverTracker.add(project.image);
  });

  if (duplicateCovers.length) {
    console.warn("Duplicate project cover images detected:", duplicateCovers);
  }
}

applyUserImagesToProjects(projects, userImages);

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
  return resolveSitePath(`projects/${encodeURIComponent(slug)}/`);
}

function normalizeProjectKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  const normalizedSlug = normalizeProjectKey(slug);
  const matchedProject = projects.find((project) => {
    return normalizeProjectKey(project.slug) === normalizedSlug ||
      normalizeProjectKey(project.title) === normalizedSlug;
  });

  return matchedProject || projects[0];
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
    if (/^https?:\/\//i.test(siteProfile.showreelUrl || "")) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      return;
    }

    link.removeAttribute("target");
    link.removeAttribute("rel");
  });

  qsa(".showreel-frame img").forEach((image) => {
    image.src = siteProfile.showreelCover;
    image.alt = "Showreel cover";
  });

  hydrateShowreelMarquees();

  const previewImage = qs("#list-preview-image");
  if (previewImage) {
    previewImage.src = getProjectThumbnail(projects[0]);
    previewImage.alt = "Project preview";
  }

  qsa('a[href^="mailto:"]').forEach((link) => {
    if (siteProfile.email) {
      link.href = `mailto:${siteProfile.email}`;
      return;
    }

    link.href = "#";
    link.setAttribute("aria-disabled", "true");
  });

  qsa(".menu-mail").forEach((link) => {
    link.textContent = siteProfile.email || siteProfile.contactLabel;
    if (!siteProfile.email) {
      link.href = "#";
      link.setAttribute("aria-disabled", "true");
    }
  });

  const menuSocials = qsa(".menu-socials");
  menuSocials.forEach((wrapper) => {
    wrapper.innerHTML = siteProfile.socials.length
      ? siteProfile.socials.map((social) => {
        if (social.url) {
          return `<a href="${social.url}" target="_blank" rel="noopener noreferrer" aria-label="${social.label}">${social.short}</a>`;
        }

        return `<span class="menu-social-chip" title="${social.label}: ${social.account || social.short}">${social.short}</span>`;
      }).join("")
      : `<span class="menu-socials-pending">links pending</span>`;
  });

  const aboutSocials = qs(".about-socials");
  if (aboutSocials) {
    aboutSocials.innerHTML = `
      <div class="about-social-links">
        ${siteProfile.aboutSocials.length
          ? siteProfile.aboutSocials.map((social) => {
            const label = `${social.label} / ${social.value || ""}`.trim();
            if (social.url) {
              return `<a href="${social.url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
            }

            return `<span>${label}</span>`;
          }).join("")
          : "<span>social links pending</span>"}
      </div>
      <p class="about-credits">
        <span>product design / interaction / visual expression</span>
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
    this.pointerInside = false;
    this.pointerClientX = 0;
    this.pointerClientY = 0;
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

  getPixelRatio() {
    const nativeRatio = window.devicePixelRatio || 1;
    const compact = window.matchMedia("(max-width: 900px)").matches;
    const cap = window.matchMedia("(max-width: 900px)").matches ? HOME_MOBILE_MAX_PIXEL_RATIO : HOME_MAX_PIXEL_RATIO;
    const targetRatio = compact ? nativeRatio : Math.max(nativeRatio, 2);
    return Math.max(1, Math.min(targetRatio, cap));
  }

  getRenderTargetSamples() {
    if (!this.renderer?.capabilities?.isWebGL2) {
      return 0;
    }

    const maxSamples = this.renderer.capabilities.maxSamples || HOME_RENDER_TARGET_SAMPLES;
    return Math.max(0, Math.min(HOME_RENDER_TARGET_SAMPLES, maxSamples));
  }

  createRenderTarget(width, height) {
    const pixelRatio = this.getPixelRatio();
    const target = new this.THREE.WebGLRenderTarget(
      Math.max(1, Math.ceil(width * pixelRatio)),
      Math.max(1, Math.ceil(height * pixelRatio)),
      {
        colorSpace: this.THREE.SRGBColorSpace,
        minFilter: this.THREE.LinearFilter,
        magFilter: this.THREE.LinearFilter,
        depthBuffer: true,
        stencilBuffer: false,
        samples: this.getRenderTargetSamples()
      }
    );

    target.texture.colorSpace = this.THREE.SRGBColorSpace;
    target.texture.minFilter = this.THREE.LinearFilter;
    target.texture.magFilter = this.THREE.LinearFilter;
    target.texture.generateMipmaps = false;
    return target;
  }

  resizeRenderTarget(width, height) {
    const pixelRatio = this.getPixelRatio();
    this.renderTarget.setSize(
      Math.max(1, Math.ceil(width * pixelRatio)),
      Math.max(1, Math.ceil(height * pixelRatio))
    );
    this.renderTarget.samples = this.getRenderTargetSamples();
  }

  configureCardTexture(texture) {
    texture.colorSpace = this.THREE.SRGBColorSpace;
    texture.magFilter = this.THREE.LinearFilter;
    texture.minFilter = this.renderer?.capabilities?.isWebGL2
      ? this.THREE.LinearMipmapLinearFilter
      : this.THREE.LinearFilter;
    texture.generateMipmaps = Boolean(this.renderer?.capabilities?.isWebGL2);
    texture.anisotropy = this.renderer
      ? Math.min(16, this.renderer.capabilities.getMaxAnisotropy?.() || 8)
      : 8;
    texture.needsUpdate = true;
    return texture;
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
      this.configureCardTexture(texture);

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
    return this.configureCardTexture(texture);
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
    this.renderer.setPixelRatio(this.getPixelRatio());
    this.renderer.setSize(clientWidth, clientHeight);
    this.renderer.outputColorSpace = this.THREE.SRGBColorSpace;
    this.renderer.domElement.className = "webgl-canvas";
    this.renderer.setClearColor(0x0e0d0e, 0);
    this.renderTarget = this.createRenderTarget(clientWidth, clientHeight);

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
      const geometry = new this.THREE.PlaneGeometry(1, 1, 32, 18);
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
        extensions: {
          derivatives: true
        },
        transparent: true,
        side: this.THREE.DoubleSide,
        depthWrite: false,
        depthTest: true,
        blending: this.THREE.NormalBlending
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
    this.renderer.setPixelRatio(this.getPixelRatio());
    this.resizeRenderTarget(this.container.clientWidth, this.container.clientHeight);
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
    this.pointerInside = true;
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;

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
    this.pointerInside = false;
    if (!this.activePointerId) {
      this.setHoveredMesh(null);
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

  onCanvasClick(event) {
    if (this.currentMode !== "spiral") {
      return;
    }
    if (this.isDragging) {
      return;
    }
    const targetMesh = this.resolveMeshFromClientPoint(event.clientX, event.clientY);
    if (!targetMesh) {
      return;
    }
    window.location.href = buildProjectPath(targetMesh.userData.project.slug);
  }

  setHoveredMesh(mesh) {
    this.hoveredMesh = mesh;
    state.hoveredSlug = mesh ? mesh.userData.project.slug : null;
    this.container.style.cursor = mesh ? "pointer" : "default";
  }

  isMeshFrontFacing(mesh) {
    const normal = new this.THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
    const meshWorldPosition = new this.THREE.Vector3();
    mesh.getWorldPosition(meshWorldPosition);
    const toCamera = new this.THREE.Vector3().copy(this.camera.position).sub(meshWorldPosition);
    return normal.dot(toCamera) > 0;
  }

  pointInTriangle(point, a, b, c) {
    const cross1 = (point.x - b.x) * (a.y - b.y) - (a.x - b.x) * (point.y - b.y);
    const cross2 = (point.x - c.x) * (b.y - c.y) - (b.x - c.x) * (point.y - c.y);
    const cross3 = (point.x - a.x) * (c.y - a.y) - (c.x - a.x) * (point.y - a.y);
    const hasNegative = cross1 < -0.5 || cross2 < -0.5 || cross3 < -0.5;
    const hasPositive = cross1 > 0.5 || cross2 > 0.5 || cross3 > 0.5;
    return !(hasNegative && hasPositive);
  }

  projectMeshToScreen(mesh, rect) {
    const geometry = mesh.geometry;
    const positions = geometry.attributes.position;
    const uvs = geometry.attributes.uv;
    const indices = geometry.index ? geometry.index.array : null;
    const projectionMatrix = this.camera.projectionMatrix;
    const viewMatrix = this.camera.matrixWorldInverse;
    const pointCount = positions.count;
    const screenPoints = new Array(pointCount);
    const localPosition = new this.THREE.Vector3();
    const worldPosition = new this.THREE.Vector3();
    const deformedPosition = new this.THREE.Vector3();
    const viewPosition = new this.THREE.Vector3();
    const clipPosition = new this.THREE.Vector4();
    const centerWorldPosition = new this.THREE.Vector3();

    for (let index = 0; index < pointCount; index += 1) {
      localPosition.fromBufferAttribute(positions, index);
      worldPosition.copy(localPosition).applyMatrix4(mesh.matrixWorld);
      deformedPosition.copy(localPosition);
      deformedPosition.z = Math.sin(uvs.getX(index) * Math.PI) * 0.2;
      viewPosition.copy(deformedPosition).applyMatrix4(mesh.matrixWorld).applyMatrix4(viewMatrix);
      viewPosition.x += Math.pow(worldPosition.y, 2) * 0.1;
      viewPosition.x += Math.sin(uvs.getY(index) * Math.PI) * this.wheelDeltaY * 2;

      clipPosition.set(viewPosition.x, viewPosition.y, viewPosition.z, 1).applyMatrix4(projectionMatrix);
      const inverseW = clipPosition.w !== 0 ? 1 / clipPosition.w : 0;
      const ndcX = clipPosition.x * inverseW;
      const ndcY = clipPosition.y * inverseW;

      screenPoints[index] = {
        x: rect.left + (ndcX * 0.5 + 0.5) * rect.width,
        y: rect.top + (-ndcY * 0.5 + 0.5) * rect.height
      };
    }

    mesh.getWorldPosition(centerWorldPosition);
    const depth = centerWorldPosition.applyMatrix4(viewMatrix).z;

    return {
      depth,
      indices,
      screenPoints
    };
  }

  resolveMeshFromClientPoint(clientX, clientY) {
    if (this.currentMode !== "spiral") {
      return null;
    }

    const rect = this.container.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }

    const point = { x: clientX, y: clientY };
    let bestMatch = null;
    let bestDepth = -Infinity;

    this.meshes.forEach((mesh) => {
      if (mesh.userData.hiddenProgress >= 0.01) {
        return;
      }

      const { depth, indices, screenPoints } = this.projectMeshToScreen(mesh, rect);
      const triangleCount = indices ? indices.length / 3 : screenPoints.length / 3;

      for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
        const indexA = indices ? indices[triangleIndex * 3] : triangleIndex * 3;
        const indexB = indices ? indices[triangleIndex * 3 + 1] : triangleIndex * 3 + 1;
        const indexC = indices ? indices[triangleIndex * 3 + 2] : triangleIndex * 3 + 2;
        if (
          this.pointInTriangle(
            point,
            screenPoints[indexA],
            screenPoints[indexB],
            screenPoints[indexC]
          ) &&
          depth > bestDepth
        ) {
          bestDepth = depth;
          bestMatch = mesh;
        }
      }
    });

    return bestMatch;
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
    if (this.currentMode !== "spiral" || !this.pointerInside || this.isDragging) {
      this.setHoveredMesh(null);
      return;
    }
    this.setHoveredMesh(this.resolveMeshFromClientPoint(this.pointerClientX, this.pointerClientY));
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
    this.renderer.clear(true, true, true);
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
    aboutCopy.innerHTML = "陈镔睿的个人作品集页面正在整理中。后续会补充个人介绍、联系方式和完整作品说明。";
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

function getProjectActionLinks(project) {
  const links = [];

  if (Array.isArray(project.reportPages) && project.reportPages.length) {
    links.push(`<a class="project-link" href="#project-report">查看报告预览</a>`);
  }

  if (Array.isArray(project.boards) && project.boards.length) {
    links.push(`<a class="project-link project-link-secondary" href="#project-works">查看作品展示</a>`);
  }

  if (project.caseUrl && project.caseUrl !== "#" && project.allowExternalCase) {
    links.push(`<a class="project-link project-link-secondary" href="${project.caseUrl}" target="_blank" rel="noopener noreferrer">see the case</a>`);
  }

  return links.join("");
}

function hasProjectMaterials(project) {
  return Boolean(
    (Array.isArray(project.reportPages) && project.reportPages.length) ||
    (Array.isArray(project.boards) && project.boards.length) ||
    project.contentReady
  );
}

function getProjectFacts(project) {
  if (Array.isArray(project.facts) && project.facts.length) {
    return project.facts;
  }

  return [
    { label: "类型", value: "作品项目" },
    { label: "状态", value: "框架已建立 / 内容待补充" },
    { label: "待接入", value: "设计报告预览 / 展板图片" }
  ];
}

function getProjectDescription(project) {
  if (hasProjectMaterials(project)) {
    return project.description;
  }

  return "项目详情页框架已建立。后续接入设计报告素材或展板图片后，这里会补充完整的项目介绍、设计过程和成果展示。";
}

function getProjectStatusMarkup(project) {
  if (hasProjectMaterials(project)) {
    return "";
  }

  return `
    <div class="project-status">
      <span>项目内容待补充</span>
      <p>等待接入设计报告素材或展板图片。</p>
    </div>
  `;
}

function ensureMeta(selector, createAttributes) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    Object.entries(createAttributes).forEach(([key, value]) => {
      node.setAttribute(key, value);
    });
    document.head.appendChild(node);
  }
  return node;
}

function setNamedMeta(name, content) {
  const node = ensureMeta(`meta[name="${name}"]`, { name });
  node.setAttribute("content", content);
}

function setPropertyMeta(property, content) {
  const node = ensureMeta(`meta[property="${property}"]`, { property });
  node.setAttribute("content", content);
}

function setCanonical(url) {
  let node = document.head.querySelector('link[rel="canonical"]');
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", "canonical");
    document.head.appendChild(node);
  }
  node.setAttribute("href", url);
}

function updateProjectMeta(project) {
  const title = `${project.title} - 陈镔睿作品集`;
  const description = getProjectDescription(project);
  const image = new URL(getProjectThumbnail(project), window.location.origin).href;
  const canonical = new URL(buildProjectPath(project.slug), window.location.origin).href;

  document.title = title;
  setNamedMeta("description", description);
  setNamedMeta("twitter:card", "summary_large_image");
  setPropertyMeta("og:title", title);
  setPropertyMeta("og:description", description);
  setPropertyMeta("og:type", "article");
  setPropertyMeta("og:image", image);
  setPropertyMeta("og:url", canonical);
  setCanonical(canonical);
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
  const actionLinksMarkup = getProjectActionLinks(project);
  const projectFrames = hasProjectMaterials(project) && Array.isArray(project.frames) && project.frames.length
    ? project.frames
    : [getProjectThumbnail(project)].filter(Boolean);
  const factsMarkup = `
    <ul class="project-facts" aria-label="Project facts">
      ${getProjectFacts(project).map((fact) => `
        <li>
          <span>${fact.label}</span>
          <strong>${fact.value}</strong>
        </li>
      `).join("")}
    </ul>
  `;
  const statusMarkup = getProjectStatusMarkup(project);
  const boardsMarkup = Array.isArray(project.boards) && project.boards.length
    ? `
      <section class="project-boards" id="project-works" aria-label="Project boards">
        <div class="project-section-head">
          <p class="project-report-kicker">Works</p>
          <h2>作品展示</h2>
        </div>
        ${project.boards.map((board) => `
          <figure class="project-board">
            <img src="${board.src}" alt="${board.alt || project.title}">
          </figure>
        `).join("")}
      </section>
    `
    : "";
  const reportPagesMarkup = Array.isArray(project.reportPages) && project.reportPages.length
    ? project.reportPages.map((src, index) => `
      <figure class="project-report-page${index >= 8 ? " is-extra" : ""}">
        <img
          src="${src}"
          alt="${project.title} 设计报告第 ${index + 1} 页"
          loading="${index < 2 ? "eager" : "lazy"}"
          decoding="async"
        >
        <figcaption>${String(index + 1).padStart(2, "0")}</figcaption>
      </figure>
    `).join("")
    : "";
  const reportMarkup = reportPagesMarkup
    ? `
      <section class="project-report" id="project-report" aria-label="Report preview">
        <div class="project-report-head">
          <div>
            <p class="project-report-kicker">Report</p>
            <h2>${project.reportLabel || "Report preview"}</h2>
          </div>
          <span class="project-report-count">${project.reportPages.length} pages</span>
        </div>
        <div class="project-report-tools" aria-label="Report navigation">
          ${Array.isArray(project.boards) && project.boards.length ? `<a href="#project-works">只看展板</a>` : ""}
          ${project.reportPages.length > 8 ? `<button type="button" data-report-toggle aria-expanded="false">展开完整报告</button>` : ""}
          <a href="#project-top">返回顶部</a>
        </div>
        ${project.reportPages.length > 8 ? `<p class="project-report-note">默认显示前 8 页，展开后可连续查看完整报告页面。</p>` : ""}
        <div class="project-report-pages">
          ${reportPagesMarkup}
        </div>
      </section>
    `
    : `
      <section class="project-report project-report-empty" id="project-report" aria-label="Report placeholder">
        <div class="project-report-head">
          <div>
            <p class="project-report-kicker">Report</p>
            <h2>设计报告待接入</h2>
          </div>
        </div>
        <div class="project-empty-panel">
          <p>后续提供设计报告素材后，会在这里展示完整报告页面预览。</p>
        </div>
      </section>
  `;

  updateProjectMeta(project);

  root.innerHTML = `
    <article class="project-card" id="project-top">
      <a class="project-close" href="${resolveSitePath("")}" aria-label="Back to home">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 7l10 10"></path>
          <path d="M17 7L7 17"></path>
        </svg>
      </a>

      <div class="project-hero">
        ${getProjectHeroMarkup(project)}
      </div>

      <section class="project-info">
        <div>
          <p class="project-kicker">${project.kicker || project.year}</p>
          <h1>${project.title}</h1>
        </div>
        <div class="project-copy">
          <p>${getProjectDescription(project)}</p>
          ${factsMarkup}
          ${statusMarkup}
          <div class="project-actions">
            ${actionLinksMarkup}
          </div>
        </div>
      </section>

      ${boardsMarkup || `
      <section class="project-frames" id="project-preview">
        <div class="project-section-head">
          <p class="project-report-kicker">Preview</p>
          <h2>现有预览图</h2>
        </div>
        ${projectFrames.map((frame, index) => `
          <div class="project-frame">
            <img src="${frame}" alt="${project.title} frame ${index + 1}">
          </div>
        `).join("")}
      </section>
      `}

      ${reportMarkup}
    </article>

    <section class="project-next">
      <div class="project-next-inner">
        <a class="project-next-back" href="${resolveSitePath("")}">back to home</a>

        <a class="project-next-figure" href="${buildProjectPath(nextProject.slug)}">
          <img src="${getProjectThumbnail(nextProject)}" alt="${nextProject.title}">
          <span class="project-tag project-tag-accent project-tag-top">keep scrolling !</span>
          <span class="project-tag project-tag-bottom">next up...</span>
        </a>

        <p class="project-next-title">${nextProject.title}</p>
      </div>
    </section>
  `;

  const reportToggle = root.querySelector("[data-report-toggle]");
  reportToggle?.addEventListener("click", () => {
    const report = root.querySelector("#project-report");
    const expanded = report?.classList.toggle("is-expanded") || false;
    reportToggle.setAttribute("aria-expanded", String(expanded));
    reportToggle.textContent = expanded ? "收起报告" : "展开完整报告";
  });

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





