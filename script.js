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
  const key = getBeatKey(beat);
  if (key && COVER_MANIFEST[key]) return COVER_MANIFEST[key];
  if (COVER_POOL.length > 0) {
    const poolIndex = key ? hashString(key) % COVER_POOL.length : index % COVER_POOL.length;
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

function renderCatalog() {
  const container = document.getElementById('beatGrid');
  if (!container) return;
  container.innerHTML = '';

  catalog.forEach((beat, index) => {
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
  bindViewAllButton();
  updateSectionHeading();
  updateRightRailCopy();
  removeLowerStripArtifacts();
  moveFounderPhotoToRightRail();
  injectLicenseTermLinks();
  loadCatalog();
});
