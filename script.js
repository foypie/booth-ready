// RESET HASH + FORCE TOP LOAD
window.addEventListener("load", function () {
  window.scrollTo(0, 0);

  if (window.location.hash) {
    history.replaceState(null, null, window.location.pathname);
  }
});

const API_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:4242'
    : window.location.origin;

let catalog = [];

const HOMEPAGE_CATALOG_LIMIT_V1 = 10;
const IS_FULL_CATALOG_PAGE_V1 = /\/catalog\.html$/i.test(window.location.pathname);
let catalogDisplayModeV1 = 'homepage';

function isBeatActive(beat) {
  if (!beat) return false;

  const status = String(beat.status || 'active').trim().toLowerCase();

  if (beat.active === false) return false;
  if (status === 'inactive') return false;
  if (status === 'hidden') return false;
  if (status === 'sold') return false;
  if (status === 'archived') return false;

  return true;
}

function getBeatFreshnessV1(beat, index) {
  const timestamp = beat?.createdAt || beat?.updatedAt || beat?.date || beat?.addedAt || '';
  const parsed = Date.parse(timestamp);

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  // Fallback keeps manually ordered legacy beats deterministic.
  return index;
}

function getVisibleCatalogV1(items) {
  const activeItems = Array.isArray(items) ? items.filter(isBeatActive) : [];

  if (IS_FULL_CATALOG_PAGE_V1) {
    return activeItems;
  }

  return activeItems
    .filter((beat) => beat.isBackfill !== true && beat.homepageEligible !== false)
    .map((beat, index) => ({ beat, index }))
    .sort((a, b) => getBeatFreshnessV1(b.beat, b.index) - getBeatFreshnessV1(a.beat, a.index))
    .slice(0, HOMEPAGE_CATALOG_LIMIT_V1)
    .map((entry) => entry.beat);
}

function refreshCatalogDisplayV1() {
  renderCatalog();

  if (typeof applyTitleArtEngineV1 === 'function') {
    requestAnimationFrame(() => applyTitleArtEngineV1());
  }
}

let licenses = [];

const LICENSE_TERM_PATHS = {
  basic: '/licenses/basic-license.html',
  premium: '/licenses/premium-license.html',
  unlimited: '/licenses/unlimited-license.html',
  exclusive: '/licenses/exclusive-license.html',
};

const COVER_MANIFEST = {
  '60s-remix': '/assets/beat-art-1.png',
  '60s': '/assets/beat-art-2.png',
  'black-shuga': '/assets/beat-art-3.png',
  'epic': '/assets/beat-art-4.png',
  'key-witness': '/assets/beat-art-5.png',
  'moonstruck': '/assets/beat-art-6.png',
  'mozee-along': '/assets/beat-art-7.png',
  'widgets': '/assets/beat-art-8.png',
  'laid-multiples': '/assets/beat-art-pool/clean-24/art-09.webp',
  'methods': '/assets/beat-art-pool/clean-24/art-10.webp',
};

const COVER_POOL = [
  '/assets/beat-art-1.png',
  '/assets/beat-art-2.png',
  '/assets/beat-art-3.png',
  '/assets/beat-art-4.png',
  '/assets/beat-art-5.png',
  '/assets/beat-art-6.png',
  '/assets/beat-art-7.png',
  '/assets/beat-art-8.png',
];

const DEFAULT_WAVEFORM = '/assets/waveforms/default-wave.svg';

// ============================================================
// Preview Audio Watermark Overlay v1 - 2026-05-14
// Plays a reusable vocal tag over public beat previews.
// This is a preview deterrent layer, not a clean-master delivery system.
// ============================================================
const PREVIEW_WATERMARK_TAG_SRC = '/assets/audio-tags/b4l-tag-v2.mp3';
const PREVIEW_WATERMARK_INTERVAL_MS = 7000;
let activePreviewWatermarkTimer = null;
let activePreviewWatermarkAudio = null;
let previewWatermarkUnlockedAudio = null;
let previewWatermarkUnlockAttempted = false;

function stopPreviewWatermark() {
  if (activePreviewWatermarkTimer) {
    clearInterval(activePreviewWatermarkTimer);
    activePreviewWatermarkTimer = null;
  }

  if (activePreviewWatermarkAudio) {
    try {
      activePreviewWatermarkAudio.pause();
      activePreviewWatermarkAudio.currentTime = 0;
    } catch (error) {
      console.warn('Preview watermark stop warning:', error);
    }
    activePreviewWatermarkAudio = null;
  }
}

// ============================================================
// Preview Audio Watermark Overlay v1.2 - Mobile Audio Unlock
// Real mobile/tablet browsers may block delayed secondary audio.
// This unlocks one reusable tag audio object during the user tap.
// ============================================================
function getPreviewWatermarkAudio() {
  if (!previewWatermarkUnlockedAudio) {
    previewWatermarkUnlockedAudio = new Audio(PREVIEW_WATERMARK_TAG_SRC);
    previewWatermarkUnlockedAudio.preload = 'auto';
    previewWatermarkUnlockedAudio.volume = 0.9;
  }

  return previewWatermarkUnlockedAudio;
}

function unlockPreviewWatermarkAudio() {
  if (previewWatermarkUnlockAttempted) return;
  previewWatermarkUnlockAttempted = true;

  const tagAudio = getPreviewWatermarkAudio();
  const originalVolume = tagAudio.volume;

  try {
    tagAudio.volume = 0;
    tagAudio.currentTime = 0;

    const unlockPromise = tagAudio.play();

    if (unlockPromise && typeof unlockPromise.then === 'function') {
      unlockPromise
        .then(() => {
          tagAudio.pause();
          tagAudio.currentTime = 0;
          tagAudio.volume = originalVolume;
        })
        .catch((error) => {
          tagAudio.volume = originalVolume;
          console.warn('Preview watermark unlock warning:', error);
        });
    } else {
      tagAudio.pause();
      tagAudio.currentTime = 0;
      tagAudio.volume = originalVolume;
    }
  } catch (error) {
    tagAudio.volume = originalVolume;
    console.warn('Preview watermark unlock warning:', error);
  }
}

function playPreviewWatermarkTag() {
  const tagAudio = getPreviewWatermarkAudio();
  activePreviewWatermarkAudio = tagAudio;

  try {
    tagAudio.pause();
    tagAudio.currentTime = 0;
    tagAudio.volume = 0.9;
  } catch (error) {
    console.warn('Preview watermark reset warning:', error);
  }

  tagAudio.play().catch((error) => {
    console.warn('Preview watermark playback warning:', error);
  });
}

function startPreviewWatermark(audio) {
  stopPreviewWatermark();

  if (!audio) return;

  // Wait briefly so the beat starts first, then place the tag over the preview.
  activePreviewWatermarkTimer = setInterval(() => {
    if (!audio || audio.paused || audio.ended) {
      stopPreviewWatermark();
      return;
    }

    playPreviewWatermarkTag();
  }, PREVIEW_WATERMARK_INTERVAL_MS);
}

// ============================================================
// Preview Audio Watermark Overlay v1.1 - Mobile/Tablet Safety Binding
// Ensures any .preview-audio playback path starts/stops the watermark,
// including mobile/tablet/future responsive render paths.
// ============================================================
function bindPreviewWatermarkGlobalFallback() {
  if (window.__previewWatermarkGlobalFallbackBound) return;
  window.__previewWatermarkGlobalFallbackBound = true;

  document.addEventListener('play', (event) => {
    const audio = event.target;
    if (!audio || !audio.classList || !audio.classList.contains('preview-audio')) return;

    document.querySelectorAll('.preview-audio').forEach((other) => {
      if (other !== audio) other.pause();
    });

    unlockPreviewWatermarkAudio();
    startPreviewWatermark(audio);
  }, true);

  document.addEventListener('pause', (event) => {
    const audio = event.target;
    if (!audio || !audio.classList || !audio.classList.contains('preview-audio')) return;
    stopPreviewWatermark();
  }, true);

  document.addEventListener('ended', (event) => {
    const audio = event.target;
    if (!audio || !audio.classList || !audio.classList.contains('preview-audio')) return;
    stopPreviewWatermark();
  }, true);
}


function formatPrice(price) {
  return `$${Number(price).toFixed(0)}`;
}

function licensePathForCode(code) {
  const key = String(code || '').toLowerCase().trim();
  return LICENSE_TERM_PATHS[key] || '/licenses/';
}

function licenseCodeFromName(name) {
  const value = String(name || '').toLowerCase();
  if (value.includes('basic')) return 'basic';
  if (value.includes('premium')) return 'premium';
  if (value.includes('unlimited')) return 'unlimited';
  if (value.includes('exclusive')) return 'exclusive';
  return '';
}

function scrollToCurrentHash() {
  const hash = window.location.hash;
  if (!hash) return;

  const target = document.querySelector(hash);
  if (!target) return;

  setTimeout(() => {
    target.scrollIntoView({
      behavior: 'auto',
      block: 'start'
    });
  }, 180);
}

function shortLicenseName(license) {
  const name = String(license?.name || '').toLowerCase();
  if (name.includes('basic')) return 'Basic';
  if (name.includes('premium')) return 'Premium';
  if (name.includes('unlimited')) return 'Unlimited';
  return license?.name || 'License';
}

function updateSectionHeading() {
  const posterHead = document.querySelector('.poster-head');
  if (!posterHead) return;
  const eyebrow = posterHead.querySelector('.eyebrow');
  const title = posterHead.querySelector('h2');
  if (eyebrow) eyebrow.textContent = 'LATEST BEATS';
  if (title) title.textContent = 'READY FOR BARS';
}

function updateRightRailCopy() {
  const builtCopy = document.querySelector('.built-copy');
  if (!builtCopy) return;

  builtCopy.innerHTML = `
    <div class="red-swipe"></div>
    <p>CRATE DIGGING.<br>HARD DRUMS.</p>
    <strong>BOOM BAP.</strong>
    <span>MADE FOR EMCEES.<br>MADE FOR DEEJAYS.</span>
  `;
}

function removeLowerStripArtifacts() {
  const selectors = [
    '.manifesto-note',
    '.lower-right-note',
    '.respect-note',
    '.bottom-strip-note'
  ];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => node.remove());
  });

  document.querySelectorAll('.manifesto-band').forEach((band) => {
    const children = Array.from(band.children);
    if (children.length > 2) {
      children.slice(2).forEach((node) => node.remove());
    }
    band.style.gridTemplateColumns = '180px minmax(0,1fr)';
    band.style.overflow = 'hidden';
  });
}

function moveFounderPhotoToRightRail() {
  if (document.querySelector('.founder-rail-card')) return;

  const rail = document.querySelector('.poster-side');
  const stayPanel = Array.from(document.querySelectorAll('.poster-side > *'))
    .find((node) => (node.textContent || '').toLowerCase().includes('stay connected'));

  const founderPhotoWrap = document.querySelector('.manifesto-photo');
  const founderImg = founderPhotoWrap ? founderPhotoWrap.querySelector('img') : null;

  if (!rail || !stayPanel || !founderImg) return;

  const card = document.createElement('section');
  card.className = 'founder-rail-card';

  card.innerHTML = `
    <img src="${founderImg.getAttribute('src')}" alt="Mista Foy - Booth Ready">
    <div class="founder-rail-meta">
      <strong>MISTA FOY</strong>
      <span>BOOTH READY</span>
    </div>
  `;

  rail.insertBefore(card, stayPanel);
  founderPhotoWrap.classList.add('founder-photo-moved');

  const band = founderPhotoWrap.closest('.manifesto-band');
  if (band) band.classList.add('single-slogan-strip');
}

function renderLicenses() {
  const grid = document.getElementById('licenseGrid');
  if (!grid) return;
  grid.innerHTML = '';
  licenses.forEach((license) => {
    const code = licenseCodeFromName(license.name) || String(license.code || '').toLowerCase();
    const box = document.createElement('article');
    box.className = 'license-box';
    box.innerHTML = `
      <h4>${license.name}</h4>
      <div class="license-price">${formatPrice(license.price)}</div>
      <p>${license.description || ''}</p>
      <a class="license-terms-inline" href="${licensePathForCode(code)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:12px;color:#ffb25c;font-weight:800;text-transform:uppercase;font-size:.76rem;letter-spacing:.05em;">View License Terms</a>
    `;
    grid.appendChild(box);
  });
}

function hashString(input) {
  const str = String(input || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getBeatKey(beat) {
  return slugify(beat?.slug || beat?.name || '');
}

function getCoverUrl(beat, index) {
  const explicitArt = String(beat?.art || beat?.artImage || beat?.cover || beat?.coverUrl || '').trim();

  if (explicitArt) {
    return explicitArt;
  }

  const key = String(getBeatKey(beat) || beat?.slug || beat?.name || index || '').trim().toLowerCase();

  if (typeof COVER_MANIFEST !== 'undefined' && COVER_MANIFEST && COVER_MANIFEST[key]) {
    return COVER_MANIFEST[key];
  }

  if (typeof COVER_POOL !== 'undefined' && Array.isArray(COVER_POOL) && COVER_POOL.length > 0) {
    return COVER_POOL[index % COVER_POOL.length];
  }

  return '';
}

function getArtBackground(beat, index) {
  const coverUrl = getCoverUrl(beat, index);
  if (!coverUrl) {
    return 'linear-gradient(135deg, rgba(76,35,18,.92), rgba(10,8,7,.95))';
  }
  return `linear-gradient(180deg, rgba(0,0,0,.03), rgba(0,0,0,.10)), url("${coverUrl}") center/cover`;
}

function getWaveformUrl(beat) {
  return `/assets/waveforms/${getBeatKey(beat)}.svg`;
}

function injectLicenseTermLinks() {
  const licenseSection = document.getElementById('licenses-section') || document.getElementById('licenses');
  if (licenseSection && !licenseSection.querySelector('.license-current-terms-note')) {
    const head = licenseSection.querySelector('.license-section-head');
    if (head) {
      const note = document.createElement('p');
      note.className = 'license-current-terms-note';
      note.style.cssText = 'margin:10px 0 0;color:#dfcfba;font-size:.9rem;line-height:1.45;max-width:780px;';
      note.innerHTML = 'Current Booth Ready License Terms are available below. By completing a purchase, you agree to the terms applicable to the license selected.';
      head.appendChild(note);
    }
  }

  document.querySelectorAll('.license-conversion-card, .license-box').forEach((card) => {
    if (card.querySelector('.license-terms-inline')) return;
    const heading = card.querySelector('h4');
    const code = licenseCodeFromName(heading ? heading.textContent : '');
    if (!code) return;

    if (code === 'exclusive') {
      const summary = card.querySelector('.license-card-summary');
      if (summary && /own the beat/i.test(summary.textContent || '')) {
        summary.textContent = 'Secure an exclusive license for your record. Once sold, the beat is removed from the public catalog. Booth Ready retains copyright ownership unless a separate written transfer agreement is signed.';
      }
    }

    const link = document.createElement('a');
    link.className = 'license-terms-inline';
    link.href = licensePathForCode(code);
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'View License Terms';
    link.style.cssText = 'display:inline-block;margin-top:12px;color:#ffb25c;font-weight:800;text-transform:uppercase;font-size:.76rem;letter-spacing:.05em;';
    card.appendChild(link);
  });

  document.querySelectorAll('.stay-links a').forEach((link) => {
    if ((link.textContent || '').trim().toLowerCase() === 'terms') {
      link.href = '/licenses/';
    }
  });
}

async function launchCheckout(beat, licenseCode, triggerButton) {
  const originalHTML = triggerButton.innerHTML;
  triggerButton.disabled = true;
  triggerButton.classList.add('is-loading');
  triggerButton.innerHTML = `<span class="price-option-price">...</span><span class="price-option-name">Opening</span>`;
  try {
    const res = await fetch(`${API_BASE}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        beatSlug: beat.slug,
        licenseCode,
      }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    alert(data.error || 'Checkout failed');
  } catch (err) {
    console.error(err);
    alert('Error connecting to checkout');
  } finally {
    triggerButton.disabled = false;
    triggerButton.classList.remove('is-loading');
    triggerButton.innerHTML = originalHTML;
  }
}

function bindWaveformPlayer(card) {
  const audio = card.querySelector('audio');
  const playButton = card.querySelector('.preview-play');
  const progress = card.querySelector('.preview-progress');
  const currentTimeEl = card.querySelector('.preview-time-current');
  const durationEl = card.querySelector('.preview-time-duration');
  const waveformHit = card.querySelector('.preview-wave-hit');
  const waveformImg = card.querySelector('.preview-wave');
  if (!audio || !playButton || !progress || !currentTimeEl || !durationEl || !waveformHit) return;

  waveformImg.addEventListener('error', () => {
    waveformImg.src = DEFAULT_WAVEFORM;
  });

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  function syncUI() {
    const duration = audio.duration || 0;
    const current = audio.currentTime || 0;
    const ratio = duration > 0 ? (current / duration) * 100 : 0;
    progress.style.width = `${ratio}%`;
    currentTimeEl.textContent = formatTime(current);
    durationEl.textContent = formatTime(duration);
    playButton.textContent = audio.paused ? '▶' : '❚❚';
  }

  playButton.addEventListener('click', () => {
    if (audio.paused) {
      unlockPreviewWatermarkAudio();
      document.querySelectorAll('.preview-audio').forEach((other) => {
        if (other !== audio) other.pause();
      });
      audio.play()
        .then(() => startPreviewWatermark(audio))
        .catch((err) => console.error(err));
    } else {
      audio.pause();
      stopPreviewWatermark();
    }
  });

  waveformHit.addEventListener('click', (event) => {
    const rect = waveformHit.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = ratio * audio.duration;
      syncUI();
    }
  });

  audio.addEventListener('timeupdate', syncUI);
  audio.addEventListener('play', syncUI);
  audio.addEventListener('pause', () => {
    syncUI();
    stopPreviewWatermark();
  });
  audio.addEventListener('loadedmetadata', syncUI);
  audio.addEventListener('ended', () => {
    syncUI();
    stopPreviewWatermark();
  });

  syncUI();
}

function bindViewAllButton() {
  const button = document.querySelector('.view-all');

  if (!button) return;

  if (IS_FULL_CATALOG_PAGE_V1) {
    if (button.dataset.latestBeatsBound === 'true') return;
    button.dataset.latestBeatsBound = 'true';

    button.textContent = 'LATEST BEATS';
    button.setAttribute('aria-label', 'Return to latest beats');

    button.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = '/#beats';
    });

    return;
  }

  if (button.dataset.catalogPageBound === 'true') return;
  button.dataset.catalogPageBound = 'true';

  button.textContent = 'VIEW ALL BEATS';
  button.setAttribute('aria-label', 'View all beats');
  button.setAttribute('href', '/catalog.html');

  button.addEventListener('click', (event) => {
    event.preventDefault();
    window.location.href = '/catalog.html';
  });
}

function renderCatalog() {
  const container = document.getElementById('beatGrid');
  if (!container) return;
  container.innerHTML = '';

  getVisibleCatalogV1(catalog).forEach((beat, index) => {
    const card = document.createElement('article');
    card.className = 'beat-card';
    const art = getArtBackground(beat, index);
    const waveformUrl = getWaveformUrl(beat);

    const priceButtons = licenses.map((license) => `
      <button
        class="price-option"
        type="button"
        data-license="${license.code}"
        aria-label="Buy ${beat.name} - ${license.name} for ${formatPrice(license.price)}"
      >
        <span class="price-option-price">${formatPrice(license.price)}</span>
        <span class="price-option-name">${shortLicenseName(license)}</span>
      </button>
    `).join('');

    card.innerHTML = `
      <div class="beat-art" style='--art:${art};'></div>
      <h3 class="beat-title">${beat.name}</h3>
      <p class="beat-subtitle">${beat.meta || ''}</p>
      <div class="preview-player">
        <button class="preview-play" type="button" aria-label="Play preview">▶</button>
        <div class="preview-wave-wrap">
          <div class="preview-progress"></div>
          <img class="preview-wave" src="${waveformUrl}" alt="${beat.name} waveform" />
          <button class="preview-wave-hit" type="button" aria-label="Seek preview"></button>
        </div>
        <div class="preview-times">
          <span class="preview-time-current">0:00</span>
          <span class="preview-time-sep">/</span>
          <span class="preview-time-duration">0:00</span>
        </div>
        <audio class="preview-audio" preload="metadata" src="/audio/${encodeURIComponent(beat.file)}"></audio>
      </div>
      <div class="price-button-row">
        ${priceButtons}
      </div>
      <p class="checkout-terms-note" style="margin:8px 0 0;color:#d6bfaa;font-size:.58rem;line-height:1.3;">
        By completing your purchase, you agree to the <a href="/licenses/" target="_blank" rel="noopener" style="color:#ffb25c;font-weight:800;">Booth Ready License Terms</a> for the license selected.
      </p>
    `;

    card.querySelectorAll('.price-option').forEach((button) => {
      button.addEventListener('click', () => {
        launchCheckout(beat, button.dataset.license, button);
      });
    });

    container.appendChild(card);
    bindWaveformPlayer(card);
  });

  bindViewAllButton();
  updateSectionHeading();
  updateRightRailCopy();
  removeLowerStripArtifacts();
  moveFounderPhotoToRightRail();
  injectLicenseTermLinks();
}

async function loadCatalog() {
  try {
    const res = await fetch(`${API_BASE}/api/catalog`);
    const data = await res.json();
    catalog = data.catalog || [];
    licenses = data.licenses || [];
    renderCatalog();
    renderLicenses();
    scrollToCurrentHash();
  } catch (err) {
    console.error(err);
    const banner = document.getElementById('statusBanner');
    if (banner) {
      banner.hidden = false;
      banner.textContent = 'Failed to load catalog.';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  bindPreviewWatermarkGlobalFallback();
  bindViewAllButton();
  updateSectionHeading();
  updateRightRailCopy();
  removeLowerStripArtifacts();
  moveFounderPhotoToRightRail();
  injectLicenseTermLinks();
  loadCatalog();
});

/* ============================================================
   Title Art Engine v1
   Scalable, rule-based, data-driven title-art system.
   - Uses beat.titleArt when present
   - Falls back to beat name parsing
   - No beat-specific CSS
   - Does not alter card dimensions, grid, audio, or license layout
   ============================================================ */

const TITLE_ART_ENGINE_V1 = {
  tokens: {
    primaryClass: 'title-art-token-primary',
    accentClass: 'title-art-token-accent'
  },

  modes: new Set(['single', 'stacked', 'accent', 'compact'])
};

function titleArtWords(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function inferTitleArtSpec(beat) {
  const name = String(beat?.name || beat?.title || '').trim();
  const words = titleArtWords(name);

  if (!words.length) return null;

  if (beat?.titleArt && typeof beat.titleArt === 'object') {
    const supplied = {
      mode: String(beat.titleArt.mode || '').trim().toLowerCase(),
      primary: String(beat.titleArt.primary || '').trim(),
      accent: String(beat.titleArt.accent || '').trim(),
      lines: Array.isArray(beat.titleArt.lines) ? beat.titleArt.lines.map(String).filter(Boolean) : null
    };

    if (!TITLE_ART_ENGINE_V1.modes.has(supplied.mode)) {
      supplied.mode = '';
    }

    if (supplied.mode && (supplied.primary || supplied.lines?.length)) {
      return supplied;
    }
  }

  if (words.length === 1) {
    return {
      mode: 'single',
      primary: words[0],
      accent: ''
    };
  }

  if (words.length === 2) {
    return {
      mode: 'accent',
      primary: words[0],
      accent: words[1]
    };
  }

  if (words.length <= 4) {
    return {
      mode: 'stacked',
      lines: words
    };
  }

  return {
    mode: 'compact',
    lines: words
  };
}

function escapeTitleArtText(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getTitleArtHTML(spec) {
  if (!spec) return '';

  const mode = spec.mode || 'single';

  if (mode === 'single') {
    return `<span class="title-art-line title-art-primary title-art-primary--single">${escapeTitleArtText(spec.primary)}</span>`;
  }

  if (mode === 'accent') {
    return `
      <span class="title-art-line title-art-primary">${escapeTitleArtText(spec.primary)}</span>
      <span class="title-art-line title-art-accent">${escapeTitleArtText(spec.accent)}</span>
    `;
  }

  const lines = Array.isArray(spec.lines) && spec.lines.length
    ? spec.lines
    : titleArtWords(spec.primary);

  return lines.map((line) => (
    `<span class="title-art-line title-art-primary">${escapeTitleArtText(line)}</span>`
  )).join('');
}

function applyTitleArtEngineV1() {
  const cards = document.querySelectorAll('.beat-card');

  cards.forEach((card) => {
    const artEl = card.querySelector('.beat-art');
    const titleEl = card.querySelector('.beat-title') || card.querySelector('h3');

    if (!artEl || !titleEl) return;

    const title = String(titleEl.textContent || '').trim();

    // Preserve original 8 legacy titled covers. Title Art Engine applies to clean-art/admin beats.
    const isLegacyTitledCover = [
      '60s Remix',
      '60s',
      'Black Shuga',
      'Epic',
      'Key Witness',
      'Moonstruck',
      'Mozee Along',
      'Widgets'
    ].includes(title);

    if (isLegacyTitledCover) return;

    if (artEl.querySelector('.title-art-engine-v1')) return;

    const beat = Array.isArray(window.__boothReadyCatalog)
      ? window.__boothReadyCatalog.find((item) => String(item?.name || item?.title || '').trim() === title)
      : null;

    const spec = inferTitleArtSpec(beat || { name: title });

    if (!spec) return;

    const overlay = document.createElement('div');
    overlay.className = `title-art-engine-v1 title-art-mode-${spec.mode || 'single'}`;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = getTitleArtHTML(spec);

    artEl.appendChild(overlay);
    artEl.classList.add('has-title-art-engine-v1');
  });
}


/* ============================================================
   Dynamic Mobile Title-Art Font Fit v1
   Purpose:
   - Mobile/catalog generated title-art only.
   - Measures actual rendered text inside each thumbnail.
   - Reduces font-size per title line until it fits the safe title-art area.
   - Does not transform/scale the overlay container.
   - Does not change card dimensions, grid, data, audio, checkout, admin, or legacy baked-in covers.
   ============================================================ */

function resetDynamicTitleArtFontFitV1() {
  document
    .querySelectorAll('.beat-card .beat-art .title-art-engine-v1')
    .forEach((overlay) => {
      overlay.removeAttribute('data-title-art-font-fit');
      overlay.querySelectorAll('.title-art-line').forEach((line) => {
        line.style.removeProperty('font-size');
      });
    });
}

function fitDynamicMobileTitleArtFontV1() {
  const overlays = document.querySelectorAll('.beat-card .beat-art .title-art-engine-v1');

  // Outside mobile: remove inline font fitting and allow normal CSS rules to govern.
  if (window.matchMedia('(min-width: 769px)').matches) {
    resetDynamicTitleArtFontFitV1();
    return;
  }

  overlays.forEach((overlay) => {
    const art = overlay.closest('.beat-art');
    if (!art) return;

    const lines = Array.from(overlay.querySelectorAll('.title-art-line'));
    if (!lines.length) return;

    // Start every pass from the CSS-defined size, not from a previous inline fit.
    lines.forEach((line) => {
      line.style.removeProperty('font-size');
    });

    const overlayRect = overlay.getBoundingClientRect();
    if (!overlayRect.width) return;

    // Conservative safe width: this prevents long words like "Memories"
    // from visually crowding the right thumbnail edge even when they technically fit.
    const safeLineWidth = overlayRect.width * 0.88;

    lines.forEach((line) => {
      const computed = window.getComputedStyle(line);
      const originalPx = parseFloat(computed.fontSize || '0');
      if (!originalPx) return;

      let lineRect = line.getBoundingClientRect();
      let fittedPx = originalPx;

      if (lineRect.width > safeLineWidth) {
        fittedPx = originalPx * (safeLineWidth / lineRect.width);
      }

      // Keep title art readable. Accent/script lines can tolerate slightly smaller type.
      const isAccent = line.classList.contains('title-art-accent');
      const minPx = isAccent ? 10 : 11;

      fittedPx = Math.max(minPx, fittedPx);

      if (fittedPx < originalPx) {
        line.style.fontSize = `${fittedPx.toFixed(2)}px`;
      }
    });

    overlay.setAttribute('data-title-art-font-fit', 'true');
  });
}

function scheduleDynamicTitleArtFontFitV1() {
  requestAnimationFrame(() => {
    applyTitleArtEngineV1();
    fitDynamicMobileTitleArtFontV1();
  });
}

if (!window.__dynamicTitleArtFontFitV1ResizeBound) {
  let dynamicTitleArtFontFitTimer = 0;

  const scheduleResizeFontFit = () => {
    window.clearTimeout(dynamicTitleArtFontFitTimer);
    dynamicTitleArtFontFitTimer = window.setTimeout(() => {
      scheduleDynamicTitleArtFontFitV1();
    }, 120);
  };

  window.addEventListener('resize', scheduleResizeFontFit);
  window.addEventListener('orientationchange', scheduleResizeFontFit);
  window.__dynamicTitleArtFontFitV1ResizeBound = true;
}

if (typeof renderCatalog === 'function' && !window.__titleArtEngineV1Wrapped) {
  const __originalRenderCatalogForTitleArtV1 = renderCatalog;

  renderCatalog = function(...args) {
    const result = __originalRenderCatalogForTitleArtV1.apply(this, args);

    try {
      if (Array.isArray(args[0])) {
        window.__boothReadyCatalog = args[0];
      }
    } catch (err) {}

    scheduleDynamicTitleArtFontFitV1();

    return result;
  };

  window.__titleArtEngineV1Wrapped = true;
}

document.addEventListener('DOMContentLoaded', () => {
  scheduleDynamicTitleArtFontFitV1();
});

/* ============================================================
   Stay Connected Lead Capture v1 - 2026-05-13
   - Email required
   - Phone optional
   - SMS consent required only when phone is entered
   - Posts to /api/subscribe
   ============================================================ */
function bindStayConnectedForms() {
  document.querySelectorAll('.stay-form').forEach((form) => {
    if (form.dataset.stayConnectedBound === 'true') return;
    form.dataset.stayConnectedBound = 'true';

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const emailInput = form.querySelector('input[name="email"]');
      const phoneInput = form.querySelector('input[name="phone"]');
      const consentInput = form.querySelector('input[name="smsConsent"]');
      const status = form.querySelector('.stay-form-status');
      const submitButton = form.querySelector('button[type="submit"]');

      const email = emailInput ? emailInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';
      const smsConsent = Boolean(consentInput && consentInput.checked);

      if (status) {
        status.textContent = '';
        status.className = 'stay-form-status';
      }

      if (!email) {
        if (status) {
          status.textContent = 'Please enter your email address.';
          status.classList.add('is-error');
        }
        return;
      }

      if (phone && !smsConsent) {
        if (status) {
          status.textContent = 'Please check the text-message consent box to receive SMS updates.';
          status.classList.add('is-error');
        }
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.dataset.originalText = submitButton.textContent;
        submitButton.textContent = '...';
      }

      try {
        const response = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            phone,
            smsConsent,
            source: form.dataset.subscribeSource || 'stay-connected',
            page: window.location.pathname || '/'
          })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.error || 'Signup failed. Please try again.');
        }

        if (status) {
          status.textContent = result.message || 'Thanks — you are on the Booth Ready list.';
          status.classList.add('is-success');
        }

        form.reset();
      } catch (error) {
        if (status) {
          status.textContent = error.message || 'Signup failed. Please try again.';
          status.classList.add('is-error');
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = submitButton.dataset.originalText || '→';
        }
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindStayConnectedForms();
});

