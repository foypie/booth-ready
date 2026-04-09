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

    card.innerHTML = `
      <h3>${beat.title}</h3>
      <p>${beat.description || ''}</p>

      <audio controls preload="metadata" src="/audio/${encodeURIComponent(beat.file)}"></audio>

      <label>License</label>
      <select class="license-select">
        ${licenses
          .map(
            (l) =>
              `<option value="${l.id}">${l.name} — ${formatPrice(l.price)}</option>`
          )
          .join('')}
      </select>

      <button class="buy-btn">Buy Now</button>
    `;

    const select = card.querySelector('.license-select');
    const button = card.querySelector('.buy-btn');

    button.addEventListener('click', async () => {
      const licenseId = select.value;

      try {
        const res = await fetch(`${API_BASE}/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            beatId: beat.id,
            licenseId,
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

async function loadData() {
  try {
    const [catalogRes, licensesRes] = await Promise.all([
      fetch(`${API_BASE}/api/catalog`),
      fetch(`${API_BASE}/api/licenses`),
    ]);

    catalog = await catalogRes.json();
    licenses = await licensesRes.json();

    renderCatalog();
  } catch (err) {
    console.error(err);
    document.getElementById('catalog').innerHTML =
      '<p style="color:red;">Failed to load catalog</p>';
  }
}

loadData();