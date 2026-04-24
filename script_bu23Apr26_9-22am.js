const API_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:4242'
    : window.location.origin;

let catalog = [];
let licenses = [];

/**
 * Explicit cover mapping for known beats.
 * Add new assignments here when you want a specific cover for a specific beat.
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
 * You can replace these files later with alternate branded packs without changing logic.
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

const FALLBACK_ART =
  'linear-gradient(135deg, rgba(76,35,18,.92), rgba(10,8,7,.95))';

function formatPrice(price) {
  return `$${Number(price).toFixed(0)}`;
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

/**
 * Deterministic string hash.
 * Ensures a new beat always gets the same fallback cover assignment.
 */
function hashString(input) {
  const str = String(input || '');
  let hash = 0;

  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function getBeatKey(beat) {
  return (beat?.slug || beat?.name || '').toLowerCase().trim();
}

function getCoverUrl(beat, index) {
  const key = getBeatKey(beat);

  if (key && COVER_MANIFEST[key]) {
    return COVER_MANIFEST[key];
  }

  if (COVER_POOL.length > 0) {
    const poolIndex =
      key
        ? hashString(key) % COVER_POOL.length
        : index % COVER_POOL.length;

    return COVER_POOL[poolIndex];
  }

  return null;
}

function getArtBackground(beat, index) {
  const coverUrl = getCoverUrl(beat, index);

  if (!coverUrl) return FALLBACK_ART;

  return `linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.34)), url("${coverUrl}") center/cover`;
}

function renderCatalog() {
  const container = document.getElementById('beatGrid');
  if (!container) return;

  container.innerHTML = '';

  catalog.forEach((beat, index) => {
    const card = document.createElement('article');
    card.className = 'beat-card';

    const licenseOptions = licenses
      .map(
        (license) =>
          `<option value="${license.code}" ${license.code === 'basic' ? 'selected' : ''}>${license.name}</option>`
      )
      .join('');

    const art = getArtBackground(beat, index);

    card.innerHTML = `
      <div class="beat-art" style='--art:${art};'>
        <div class="play-circle">▶</div>
        <div class="wave-strip"></div>
      </div>

      <h3 class="beat-title">${beat.name}</h3>
      <p class="beat-subtitle">${beat.meta || ''}</p>

      <div class="audio-shell">
        <audio controls preload="metadata" src="/audio/${encodeURIComponent(beat.file)}"></audio>
      </div>

      <div class="license-label">LICENSE</div>

      <div class="license-row">
        <select class="license-select">
          ${licenseOptions}
        </select>
        <div class="price-pill">${formatPrice(licenses[0]?.price || 0)}</div>
      </div>

      <div class="license-copy">${licenses[0]?.description || ''}</div>

      <button class="buy-button">Buy Now</button>
    `;

    const select = card.querySelector('.license-select');
    const button = card.querySelector('.buy-button');
    const pricePill = card.querySelector('.price-pill');
    const licenseCopy = card.querySelector('.license-copy');

    function syncLicenseUI() {
      const selected = licenses.find((license) => license.code === select.value) || licenses[0];
      if (!selected) return;

      pricePill.textContent = formatPrice(selected.price);
      licenseCopy.textContent = selected.description || '';
    }

    select.addEventListener('change', syncLicenseUI);
    syncLicenseUI();

    button.addEventListener('click', async () => {
      const licenseCode = select.value;
      const originalLabel = button.textContent;

      button.disabled = true;
      button.textContent = 'Opening Checkout...';

      try {
        const res = await fetch(`${API_BASE}/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
        button.disabled = false;
        button.textContent = originalLabel;
      }
    });

    container.appendChild(card);
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
