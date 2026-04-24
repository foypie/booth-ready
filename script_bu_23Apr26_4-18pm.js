const API_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:4242'
    : window.location.origin;

let catalog = [];
let licenses = [];

/**
 * Explicit cover mapping for known beats.
 * Add specific assignments here whenever you want a beat to use a particular cover.
 */
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

/**
 * Cover pool used automatically for future beats not found in COVER_MANIFEST.
 */
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

function formatPrice(price) {
  return `$${Number(price).toFixed(0)}`;
}

function shortLicenseName(license) {
  const name = String(license?.name || '').toLowerCase();
  if (name.includes('basic')) return 'Basic';
  if (name.includes('premium')) return 'Premium';
  if (name.includes('unlimited')) return 'Unlimited';
  return license?.name || 'License';
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

function getCoverUrl(beat, index) {
  const key = getBeatKey(beat);

  if (key && COVER_MANIFEST[key]) {
    return COVER_MANIFEST[key];
  }

  if (COVER_POOL.length > 0) {
    const poolIndex = key
      ? hashString(key) % COVER_POOL.length
      : index % COVER_POOL.length;
    return COVER_POOL[poolIndex];
  }

  return null;
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

  if (!audio || !playButton || !progress || !currentTimeEl || !durationEl || !waveformHit) {
    return;
  }

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
      audio.play().catch((err) => console.error(err));
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

function renderCatalog() {
  const container = document.getElementById('beatGrid');
  if (!container) return;

  container.innerHTML = '';

  catalog.forEach((beat, index) => {
    const card = document.createElement('article');
    card.className = 'beat-card';

    const art = getArtBackground(beat, index);
    const waveformUrl = getWaveformUrl(beat);

    const priceButtons = licenses
      .map((license) => `
          <button
            class="price-option"
            type="button"
            data-license="${license.code}"
            aria-label="Buy ${beat.name} - ${license.name} for ${formatPrice(license.price)}"
          >
            <span class="price-option-price">${formatPrice(license.price)}</span>
            <span class="price-option-name">${shortLicenseName(license)}</span>
          </button>
        `)
      .join('');

    card.innerHTML = `
      <div class="beat-art" style='--art:${art};'></div>

      <h3 class="beat-title">${beat.name}</h3>
      <p class="beat-subtitle">${beat.meta || ''}</p>

      <div class="preview-player">
        <button class="preview-play" type="button" aria-label="Play preview">▶</button>

        <div class="preview-wave-wrap">
          <div class="preview-progress"></div>
          <img
            class="preview-wave"
            src="${waveformUrl}"
            alt="${beat.name} waveform"
          />
          <button class="preview-wave-hit" type="button" aria-label="Seek preview"></button>
        </div>

        <div class="preview-times">
          <span class="preview-time-current">0:00</span>
          <span class="preview-time-sep">/</span>
          <span class="preview-time-duration">0:00</span>
        </div>

        <audio
          class="preview-audio"
          preload="metadata"
          src="/audio/${encodeURIComponent(beat.file)}"
        ></audio>
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
}

async function loadCatalog() {
  try {
    const res = await fetch(`${API_BASE}/api/catalog`);
    const data = await res.json();

    catalog = data.catalog || [];
    licenses = data.licenses || [];

    renderCatalog();
    renderLicenses();
  } catch (err) {
    console.error(err);
    const banner = document.getElementById('statusBanner');
    if (banner) {
      banner.hidden = false;
      banner.textContent = 'Failed to load catalog.';
    }
  }
}

window.addEventListener('DOMContentLoaded', loadCatalog);
