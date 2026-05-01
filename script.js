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
let licenses = [];

const COVER_MANIFEST = {
  '60s-remix': '/assets/beat-art-1.png',
  '60s': '/assets/beat-art-2.png',
  'black-shuga': '/assets/beat-art-3.png',
  'epic': '/assets/beat-art-4.png',
  'key-witness': '/assets/beat-art-5.png',
  'moonstruck': '/assets/beat-art-6.png',
  'mozee-along': '/assets/beat-art-7.png',
  'widgets': '/assets/beat-art-8.png',
};

const COVER_POOL = Object.values(COVER_MANIFEST);
const KNOWN_ART_KEYS = new Set(Object.keys(COVER_MANIFEST));

const DEFAULT_WAVEFORM = '/assets/waveforms/default-wave.svg';

function formatPrice(price) {
  return `$${Number(price).toFixed(0)}`;
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
    const box = document.createElement('article');
    box.className = 'license-box';
    box.innerHTML = `
      <h4>${license.name}</h4>
      <div class="license-price">${formatPrice(license.price)}</div>
      <p>${license.description || ''}</p>
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

function getBeatMeta(beat) {
  return String(beat?.meta || beat?.description || beat?.style || '').trim();
}

function isKnownArtBeat(beat) {
  return KNOWN_ART_KEYS.has(getBeatKey(beat));
}

function getCoverUrl(beat) {
  const key = getBeatKey(beat);
  if (key && COVER_MANIFEST[key]) return COVER_MANIFEST[key];

  // New beats are assigned one of the same 8 Booth Ready backgrounds.
  // This is stable per beat slug, so the card does not change every refresh.
  if (COVER_POOL.length === 0) return '';
  const poolIndex = key ? hashString(key) % COVER_POOL.length : 0;
  return COVER_POOL[poolIndex];
}

function getArtBackground(beat) {
  const coverUrl = getCoverUrl(beat);
  return `linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.30)), url("${coverUrl}") center/cover`;
}

function getWaveformUrl(beat) {
  return `/assets/waveforms/${getBeatKey(beat)}.svg`;
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
    const data = await res.json().catch(() => ({}));
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

  const audioCandidates = String(audio.dataset.audioCandidates || '')
    .split('|')
    .filter(Boolean);

  let audioCandidateIndex = Math.max(0, audioCandidates.indexOf(audio.getAttribute('src')));

  function tryNextAudioCandidate(shouldPlay = false) {
    if (audioCandidateIndex >= audioCandidates.length - 1) return false;

    audioCandidateIndex += 1;
    audio.src = audioCandidates[audioCandidateIndex];
    audio.load();

    if (shouldPlay) {
      audio.play().catch(() => {
        tryNextAudioCandidate(true);
      });
    }

    return true;
  }

  audio.addEventListener('error', () => {
    tryNextAudioCandidate(false);
  });

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
      document.querySelectorAll('.preview-audio').forEach((other) => {
        if (other !== audio) other.pause();
      });
      audio.play().catch((err) => {
        console.warn('Audio play failed, trying next candidate.', err);
        tryNextAudioCandidate(true);
      });
    } else {
      audio.pause();
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
  audio.addEventListener('pause', syncUI);
  audio.addEventListener('loadedmetadata', syncUI);
  audio.addEventListener('ended', syncUI);

  syncUI();
}

function bindViewAllButton() {
  const button = document.querySelector('.view-all');
  const main = document.querySelector('.poster-main');
  if (!button || !main) return;
  button.setAttribute('type', 'button');
  button.setAttribute('aria-label', 'View all beats');
  button.addEventListener('click', () => {
    main.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}


function uniqueList(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function titleCaseWords(input) {
  return String(input || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : '')
    .join(' ');
}

function getAudioCandidates(beat) {
  const rawFile = String(beat?.file || '').trim();
  const rawNoExt = rawFile.replace(/\.[a-z0-9]+$/i, '');
  const name = String(beat?.name || '').trim();
  const slug = getBeatKey(beat);

  const baseNames = uniqueList([
    rawNoExt,
    rawFile,
    name,
    slug,
    slug.replace(/-/g, ' '),
    slug.replace(/-/g, '_'),
    name.replace(/\s+/g, '-'),
    name.replace(/\s+/g, '_'),
    name.replace(/\s+/g, ''),
    rawNoExt.replace(/\s+/g, '-'),
    rawNoExt.replace(/\s+/g, '_'),
    rawNoExt.replace(/\s+/g, ''),
    titleCaseWords(slug),
    titleCaseWords(slug).replace(/\s+/g, '-'),
    titleCaseWords(slug).replace(/\s+/g, '_'),
  ]);

  const variants = [];
  baseNames.forEach((base) => {
    if (!base) return;
    variants.push(base);
    variants.push(base.toLowerCase());
    variants.push(base.toUpperCase());
    variants.push(titleCaseWords(base));
  });

  const extensions = ['mp3', 'MP3', 'wav', 'WAV', 'm4a', 'M4A', 'aac', 'AAC', 'ogg', 'OGG'];

  const files = [];
  variants.forEach((variant) => {
    const hasExt = /\.[a-z0-9]+$/i.test(variant);
    if (hasExt) {
      files.push(variant);
    } else {
      extensions.forEach((ext) => files.push(`${variant}.${ext}`));
    }
  });

  return uniqueList(files).map((file) => `/audio/${encodeURIComponent(file)}`);
}

function audioCandidatesAttribute(beat) {
  return getAudioCandidates(beat).join('|');
}

function isBeatVisible(beat) {
  const status = String(beat?.status || (beat?.active === false ? 'hidden' : 'active')).toLowerCase().trim();
  return beat?.active !== false && status !== 'hidden' && status !== 'sold' && status !== 'inactive';
}

function renderCatalog() {
  const container = document.getElementById('beatGrid');
  if (!container) return;
  container.innerHTML = '';

  const visibleCatalog = catalog.filter(isBeatVisible);

  if (catalog.length > 0 && visibleCatalog.length === 0) {
    const banner = document.getElementById('statusBanner');
    if (banner) {
      banner.hidden = false;
      banner.textContent = 'No active beats are currently available.';
    }
  }

  visibleCatalog.forEach((beat) => {
    const card = document.createElement('article');
    card.className = isKnownArtBeat(beat) ? 'beat-card beat-card-known-art' : 'beat-card beat-card-generic-art';
    const art = getArtBackground(beat);
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
      <div class="beat-art" style='--art:${art};'>
        ${isKnownArtBeat(beat) ? '' : `<div class="beat-art-title">${beat.name}</div>`}
      </div>
      <h3 class="beat-title">${beat.name}</h3>
      <p class="beat-subtitle">${getBeatMeta(beat)}</p>
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
        <audio class="preview-audio" preload="metadata" data-audio-candidates="${audioCandidatesAttribute(beat)}" src="${getAudioCandidates(beat)[0]}"></audio>
      </div>
      <div class="price-button-row">
        ${priceButtons}
      </div>
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
}

async function loadCatalog() {
  try {
    let usedLocalCatalog = false;

    try {
      const localRes = await fetch('/data/beats.json', { cache: 'no-store' });

      if (localRes.ok) {
        const localData = await localRes.json();

        if (Array.isArray(localData)) {
          catalog = localData;
        } else if (Array.isArray(localData.catalog)) {
          catalog = localData.catalog;
        } else {
          throw new Error('beats.json must be an array or contain a catalog array');
        }

        licenses = Array.isArray(localData.licenses)
          ? localData.licenses
          : [
              { code: 'basic', name: 'Basic License', price: 29 },
              { code: 'premium', name: 'Premium License', price: 79 },
              { code: 'unlimited', name: 'Unlimited License', price: 199 },
            ];

        usedLocalCatalog = true;
      }
    } catch (localErr) {
      console.warn('Local beats.json not used; falling back to API catalog.', localErr);
    }

    if (!usedLocalCatalog) {
      const res = await fetch(`${API_BASE}/api/catalog`);
      const data = await res.json();
      catalog = data.catalog || [];
      licenses = data.licenses || [];
    }

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
  bindViewAllButton();
  updateSectionHeading();
  updateRightRailCopy();
  removeLowerStripArtifacts();
  moveFounderPhotoToRightRail();
  loadCatalog();
});



(function injectGenericBeatArtStyles() {
  if (document.getElementById('genericBeatArtStyles')) return;
  const style = document.createElement('style');
  style.id = 'genericBeatArtStyles';
  style.textContent = `
    .beat-card-generic-art .beat-art {
      position: relative;
      overflow: hidden;
      background: var(--art) !important;
      background-size: cover !important;
      background-position: center center !important;
    }

    /* Covers any baked-in title from the reused art and replaces it with the real beat name. */
    .beat-card-generic-art .beat-art::before {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: 46%;
      z-index: 1;
      background: linear-gradient(180deg, rgba(12,6,4,.98) 0%, rgba(12,6,4,.94) 58%, rgba(12,6,4,.18) 100%);
      pointer-events: none;
    }

    .beat-card-generic-art .beat-art-title {
      position: absolute;
      left: 9px;
      right: 9px;
      top: 9px;
      z-index: 2;
      color: #e2d0a8;
      font-family: Anton, Impact, sans-serif;
      font-size: clamp(22px, 2.35vw, 38px);
      line-height: .88;
      letter-spacing: .025em;
      text-transform: uppercase;
      text-shadow: 0 3px 0 rgba(0,0,0,.8), 0 0 18px rgba(0,0,0,.95);
      overflow-wrap: anywhere;
    }

    .beat-card-generic-art .beat-subtitle {
      display: block !important;
      color: #d9c7a3 !important;
      opacity: 1 !important;
      visibility: visible !important;
      min-height: 12px;
    }
  `;
  document.head.appendChild(style);
})();
