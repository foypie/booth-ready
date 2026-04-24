// Booth Ready — Safe Founder Rail Patch
// Adds existing lower-left founder photo into the right rail between BUILT DIFFERENT and STAY CONNECTED.
// Does not touch checkout, beat cards, waveforms, pricing, catalog, or server logic.

(function () {
  function findFounderImage() {
    const candidates = Array.from(document.querySelectorAll("img"));

    return candidates.find((img) => {
      const src = (img.getAttribute("src") || "").toLowerCase();
      const alt = (img.getAttribute("alt") || "").toLowerCase();
      const parentClass = (img.parentElement?.className || "").toString().toLowerCase();

      return (
        src.includes("pierre") ||
        src.includes("founder") ||
        src.includes("bottom") ||
        src.includes("lower") ||
        alt.includes("pierre") ||
        alt.includes("founder") ||
        parentClass.includes("manifesto-photo")
      );
    });
  }

  function findRightRail() {
    return (
      document.querySelector(".poster-side") ||
      document.querySelector(".right-rail") ||
      document.querySelector("aside")
    );
  }

  function findStayConnectedPanel(rail) {
    if (!rail) return null;

    const panels = Array.from(rail.children);
    return panels.find((panel) =>
      (panel.textContent || "").toLowerCase().includes("stay connected")
    );
  }

  function installFounderRailCard() {
    if (document.querySelector(".founder-rail-card")) return;

    const rail = findRightRail();
    const founderImg = findFounderImage();

    if (!rail || !founderImg) {
      console.warn("Founder rail patch: right rail or founder image not found.");
      return;
    }

    const card = document.createElement("section");
    card.className = "founder-rail-card";

    const img = document.createElement("img");
    img.src = founderImg.currentSrc || founderImg.src;
    img.alt = "Pierre Foy — Booth Ready";

    const meta = document.createElement("div");
    meta.className = "founder-rail-meta";
    meta.innerHTML = `
      <strong>PIERRE FOY</strong>
      <span>Booth Ready</span>
    `;

    card.appendChild(img);
    card.appendChild(meta);

    const stayPanel = findStayConnectedPanel(rail);

    if (stayPanel) {
      rail.insertBefore(card, stayPanel);
    } else {
      rail.appendChild(card);
    }

    founderImg.classList.add("founder-photo-moved");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installFounderRailCard);
  } else {
    installFounderRailCard();
  }
})();
