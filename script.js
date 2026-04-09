// Detect environment (local vs production)
const API_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:4242'
    : window.location.origin;

// Load catalog
async function loadCatalog() {
  try {
    const res = await fetch(`${API_BASE}/api/catalog`);
    const beats = await res.json();

    const container = document.getElementById('catalog');
    container.innerHTML = '';

    beats.forEach((beat) => {
      const div = document.createElement('div');
      div.className = 'beat-card';

      div.innerHTML = `
        <h3>${beat.title}</h3>
        <audio controls src="${beat.preview_url}"></audio>
        <button onclick="checkout('${beat.id}')">Buy</button>
      `;

      container.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    document.getElementById('catalog').innerHTML =
      '<p style="color:red;">Failed to load catalog</p>';
  }
}

// Checkout
async function checkout(beatId) {
  try {
    const res = await fetch(`${API_BASE}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beatId }),
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    }
  } catch (err) {
    console.error(err);
    alert('Checkout failed');
  }
}

// Load on page start
window.addEventListener('DOMContentLoaded', loadCatalog);