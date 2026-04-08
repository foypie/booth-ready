const API_URL = "http://localhost:4242";

async function fetchCatalog() {
  const response = await fetch(`${API_URL}/api/catalog`);
  if (!response.ok) throw new Error("Unable to load catalog");
  return response.json();
}

async function buyBeat(beatSlug, licenseCode, button) {
  try {
    button.disabled = true;
    button.textContent = "Opening Checkout...";

    const response = await fetch(`${API_URL}/create-checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ beatSlug, licenseCode }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(`Error: ${data.error || "Unable to create checkout session"}`);
      button.disabled = false;
      button.textContent = "Buy Now";
      return;
    }

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("Error: No checkout URL returned from server");
      button.disabled = false;
      button.textContent = "Buy Now";
    }
  } catch (error) {
    console.error("Checkout error:", error);
    alert("Something went wrong connecting to checkout.");
    button.disabled = false;
    button.textContent = "Buy Now";
  }
}

function renderLicenses(licenses) {
  const grid = document.getElementById("licenseGrid");
  grid.innerHTML = "";

  licenses.forEach((license) => {
    const box = document.createElement("article");
    box.className = "license-box";
    box.innerHTML = `
      <h4>${license.name} — $${license.price}</h4>
      <p>${license.description}</p>
    `;
    grid.appendChild(box);
  });
}

function renderCatalog(catalog, licenses) {
  const beatGrid = document.getElementById("beatGrid");
  beatGrid.innerHTML = "";

  catalog.forEach((beat) => {
    const card = document.createElement("article");
    card.className = "beat-card";

    const optionsHtml = licenses.map((license) => (
      `<option value="${license.code}" data-price="${license.price}" data-description="${license.description}">${license.name} — $${license.price}</option>`
    )).join("");

    const defaultLicense = licenses[0];

    card.innerHTML = `
      <h3>${beat.name}</h3>
      <div class="meta">${beat.meta}</div>
      <audio controls preload="metadata">
        <source src="${API_URL}/audio/${beat.file}" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>

      <div class="license-row">
        <div>
          <label class="field-label">License tier</label>
          <select class="license-select">
            ${optionsHtml}
          </select>
        </div>
        <div>
          <label class="field-label">Price</label>
          <div class="price-pill">$${defaultLicense.price}</div>
        </div>
      </div>

      <div class="license-copy">${defaultLicense.description}</div>

      <button class="buy-button">Buy ${beat.name}</button>
    `;

    const select = card.querySelector(".license-select");
    const pricePill = card.querySelector(".price-pill");
    const licenseCopy = card.querySelector(".license-copy");
    const button = card.querySelector(".buy-button");

    const syncSelection = () => {
      const selected = select.options[select.selectedIndex];
      const price = selected.getAttribute("data-price");
      const description = selected.getAttribute("data-description");
      const label = selected.textContent.split("—")[0].trim();

      pricePill.textContent = `$${price}`;
      licenseCopy.textContent = description;
      button.textContent = `Buy ${beat.name} (${label})`;
    };

    select.addEventListener("change", syncSelection);
    syncSelection();

    button.addEventListener("click", () => {
      buyBeat(beat.slug, select.value, button);
    });

    beatGrid.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const banner = document.getElementById("statusBanner");

  try {
    const data = await fetchCatalog();
    renderCatalog(data.catalog, data.licenses);
    renderLicenses(data.licenses);
  } catch (error) {
    console.error(error);
    banner.classList.add("show");
    banner.textContent = "The catalog could not be loaded. Make sure your Node server is running on http://localhost:4242, then open the site at that same localhost address instead of double-clicking the HTML file.";
  }
});
