const API_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:4242'
    : window.location.origin;

let catalog = [];
let licenses = [];

function formatPrice(price) {
  return `$${Number(price).toFixed(0)}`;
}

function renderCatalog() {
  const container = document.getElementById('catalog');
  if (!container) return;

  container.innerHTML = '';

  catalog.forEach((beat) => {
    const card = document.createElement('article');
    card.className = 'beat-card';

    const licenseOptions = licenses
      .map(
        (license) => `
          <option value="${license.code}">
            ${license.name} — ${formatPrice(license.price)}
          </option>
        `
      )
      .join('');

    card.innerHTML = `
      <h3>${beat.name}</h3>
      <p>${beat.meta}</p>
      <audio controls preload="none" src="/audio/${encodeURIComponent(beat.file)}"></audio>

      <label for="license-${beat.slug}">License</label>
      <select id="license-${beat.slug}">
        ${licenseOptions}
      </select>

      <button type="button" data-beat-slug="${beat.slug}">
        Buy Now
      </button>
    `;

    const button = card.querySelector('button');
    button.addEventListener('click', async () => {
      const select = card.querySelector(`#license-${beat.slug}`);
      await checkout(beat.slug, select.value, button);
    });

    container.appendChild(card);
  });
}

async function loadCatalog() {
  const container = document.getElementById('catalog');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/catalog`);
    if (!res.ok) {
      throw new Error(`Catalog request failed: ${res.status}`);
    }

    const data = await res.json();
    catalog = Array.isArray(data.catalog) ? data.catalog : [];
    licenses = Array.isArray(data.licenses) ? data.licenses : [];

    if (!catalog.length || !licenses.length) {
      throw new Error('Catalog payload was empty.');
    }

    renderCatalog();
  } catch (err) {
    console.error('Catalog load error:', err);
    container.innerHTML = '<p style="color:red;">Failed to load catalog</p>';
  }
}

async function checkout(beatSlug, licenseCode, button) {
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = 'Redirecting...';

    const res = await fetch(`${API_BASE}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beatSlug, licenseCode }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Checkout failed');
    }

    if (data.url) {
      window.location.href = data.url;
      return;
    }

    throw new Error('No checkout URL returned.');
  } catch (err) {
    console.error('Checkout error:', err);
    alert(err.message || 'Checkout failed');
    button.disabled = false;
    button.textContent = originalText;
  }
}

window.addEventListener('DOMContentLoaded', loadCatalog);