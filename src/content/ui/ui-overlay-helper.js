let globalZIndex = 2147000000;

/**
 * Creates a standardized overlay with Shadow DOM and Z-Index management.
 * @returns {Object} { overlay, shadowRoot, bringToFront, close }
 */
export function createShadowOverlay() {
  globalZIndex++;

  // 1. The Backdrop (The click-blocking overlay)
  // We make this absolute/fixed but allow it to accept clicks to bring to front
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    pointer-events: none; /* Let clicks pass through the empty parts if desired, 
                             but usually we want a modal experience. */
    z-index: ${globalZIndex};
    display: flex; justify-content: center; align-items: center;
  `;

  // 2. The Window Host (The actual box)
  const host = document.createElement('div');
  host.style.cssText = `
    width: 90%; max-width: 800px; height: 85vh; 
    border-radius: 8px; overflow: hidden; 
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    pointer-events: auto; /* Re-enable clicks */
    background: white;
    display: flex; flex-direction: column;
  `;

  // 3. Shadow DOM (Style isolation)
  const shadow = host.attachShadow({ mode: 'open' });

  overlay.appendChild(host);
  document.body.appendChild(overlay);

  // 4. Interaction Logic
  const bringToFront = () => {
    globalZIndex++;
    overlay.style.zIndex = globalZIndex;
  };

  const close = () => {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
  };

  // Auto-bring to front on click
  host.addEventListener('mousedown', bringToFront);

  return { overlay, shadow, bringToFront, close };
}
