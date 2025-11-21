import { extractText } from '../dom-adapter.js';
import { createShadowOverlay } from './ui-overlay-helper.js';

export function showTextPreview() {
  const extractedData = extractText(); // returns [{ text: "..." }, ...]

  const { shadow, close, bringToFront } = createShadowOverlay();

  // Inject Styles
  const style = document.createElement('style');
  style.textContent = `
    :host { font-family: system-ui, -apple-system, sans-serif; color: #333; display: flex; flex-direction: column; height: 100%; }
    .header { 
      padding: 15px 20px; border-bottom: 1px solid #eee; background: #f8f9fa; 
      display: flex; justify-content: space-between; align-items: center;
    }
    .header h2 { margin: 0; font-size: 18px; }
    .close-btn { 
      background: none; border: none; font-size: 24px; cursor: pointer; color: #666;
    }
    .close-btn:hover { color: #000; }
    .content { 
      flex: 1; overflow-y: auto; padding: 20px; background: #fff; 
      font-family: monospace; font-size: 13px; line-height: 1.5;
    }
    .line-item {
      padding: 8px; border-bottom: 1px solid #f0f0f0; white-space: pre-wrap;
    }
    .line-item:last-child { border-bottom: none; }
    .empty-msg { color: #888; font-style: italic; text-align: center; margin-top: 20px; }
    .stats { font-size: 12px; color: #666; margin-top: 4px; }
  `;
  shadow.appendChild(style);

  // 4. Build DOM
  const wrapper = document.createElement('div');
  wrapper.style.cssText = "display: flex; flex-direction: column; height: 100%;";

  // Content Generation
  const contentHtml = extractedData.length > 0
                      ? extractedData.map(item => `<div class="line-item">${escapeHtml(item.text)}</div>`).join('')
                      : `<div class="empty-msg">No text extracted. Check site configuration.</div>`;

  wrapper.innerHTML = `
    <div class="header">
      <div>
        <h2>Extraction Preview</h2>
        <div class="stats">Found ${extractedData.length} text blocks</div>
      </div>
      <button class="close-btn">×</button>
    </div>
    <div class="content">
      ${contentHtml}
    </div>
  `;

  shadow.appendChild(wrapper);

  // 5. Bind Events
  wrapper.querySelector('.close-btn').onclick = close;
}

// Simple utility to prevent HTML injection in the preview
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
