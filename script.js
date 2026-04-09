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
    card.className = 'card';

    const licenseOptions = licenses
      .map(
        (l) =>
          `<option value="${l.code}">${l.name} — ${formatPrice(l.price)}</option>`
      )
      .join('');

    card.innerHTML = `
      <h3>${beat.name}</h3>
      <p>${beat.meta || ''}</p>

      <audio controls preload="metadata" src="/audio/${encodeURIComponent(beat.file)}"></audio>

      <label>License</label>
      <select class="license-select">
        ${licenseOptions}
      </select>

      <button class="buy-btn">Buy Now</button>
    `;

    const select = card.querySelector('.license-select');
    const button = card.querySelector('.buy-btn');

    button.addEventListener('click', async () => {
      const licenseCode = select.value;

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
          alert('Checkout failed');
        }
      } catch (err) {
        console.error(err);
        alert('Error connecting to checkout');
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
  } catch (err) {
    console.error(err);
    document.getElementById('catalog').innerHTML =
      '<p style="color:red;">Failed to load catalog</p>';
  }
}

window.addEventListener('DOMContentLoaded', loadCatalog);