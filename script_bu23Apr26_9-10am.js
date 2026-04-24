const API_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:4242'
    : window.location.origin;

let catalog = [];
let licenses = [];

const artThemes = [
  'linear-gradient(135deg, rgba(76,35,18,.92), rgba(10,8,7,.95)), url("/assets/beat-art-1.png") center/cover',
  'linear-gradient(135deg, rgba(83,53,20,.90), rgba(14,10,8,.94)), url("/assets/beat-art-2.png") center/cover',
  'linear-gradient(135deg, rgba(72,41,18,.90), rgba(12,9,7,.95)), url("/assets/beat-art-3.png") center/cover',
  'linear-gradient(135deg, rgba(73,46,20,.90), rgba(11,9,7,.95)), url("/assets/beat-art-4.png") center/cover',
];

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

function renderCatalog() {
  const container = document.getElementById('beatGrid');
  if (!container) return;

  container.innerHTML = '';

  catalog.forEach((beat, index) => {
    const card = document.createElement('article');
    card.className = 'beat-card';

    const licenseOptions = licenses
      .map(
        (l) =>
          `<option value="${l.code}" ${l.code === 'basic' ? 'selected' : ''}>${l.name} — ${formatPrice(l.price)}</option>`
      )
      .join('');

    const art = artThemes[index % artThemes.length];

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
      const selected = licenses.find((l) => l.code === select.value) || licenses[0];
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
        } else {
          alert(data.error || 'Checkout failed');
          button.disabled = false;
          button.textContent = originalLabel;
        }
      } catch (err) {
        console.error(err);
        alert('Error connecting to checkout');
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
