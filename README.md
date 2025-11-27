# LLM Novel Translator (BYOK)

![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

**LLM Novel Translator** is an open-source Chrome Extension designed to translate web novels using the power of Large Language Models (LLMs). It features a unique **auto-generating glossary** system that maintains consistency of terms (names, places, ranks) across chapters.

This extension operates on a **Bring Your Own Key (BYOK)** model, ensuring your privacy and giving you full control over model selection and costs.

## 📥 Install

### Chrome Web Store
> [!NOTE]
> **[Download from Chrome Web Store](https://chrome.google.com/webstore/detail/placeholder-link)** (Coming Soon)

### Manual Installation (Load Unpacked)
1.  Download the latest release or clone this repository.
2.  Run `npm install` and `npm run build` to generate the `dist` folder.
3.  Open Chrome and navigate to `chrome://extensions/`.
4.  Enable **Developer mode** in the top right corner.
5.  Click **Load unpacked** and select the `dist` folder from this project.

## ✨ Features

*   **📖 Novel-Optimized Translation**: Specifically tuned for narrative text, preserving tone and dialogue better than traditional machine translation.
*   **🧠 Auto-Glossary**: Automatically detects and remembers proper nouns (character names, locations, cultivation ranks) to ensure they are translated consistently in future chapters.
*   **🔑 BYOK (Bring Your Own Key)**: Connect directly to your preferred AI providers. No middleman, no markup on API costs.
*   **🛡️ Privacy-First**: No central server. All logic runs in your browser, and requests are sent directly to the AI provider.
*   **🔌 Multi-Provider Support**: Works with:
    *   [OpenRouter](https://openrouter.ai/) (Recommended for access to all models)
    *   OpenAI
    *   Google Gemini
    *   DeepSeek
    *   xAI (Grok)
*   **⚙️ Granular Control**: Configure different models for different tasks (e.g., use a cheaper model for glossary extraction and a smarter model for final translation).

## 🚀 Usage

1.  **Setup API Keys**:
    *   Click the extension icon and open the **Options** page.
    *   Navigate to the **API Keys** tab.
    *   Enter your API key for your chosen provider (e.g., OpenRouter).
2.  **Configure Models**:
    *   Go to **Model / Translation Config**.
    *   Select your Source and Target languages.
    *   Choose which models to use for Glossary Generation, Segmentation, and Translation.
3.  **Translate**:
    *   Navigate to a novel chapter.
    *   Click the extension icon -> **Translate**.
    *   Sit back while the extension analyzes the text, updates the glossary, and translates the content.

## 🛠️ Development

This project is built with **Vite** and **Vanilla JS** (using ES Modules). It uses **Vitest** for testing.

### Prerequisites
*   Node.js (v18 or higher)
*   npm

### Setup
```bash
# Clone the repo
git clone https://github.com/your-username/llm-novel-translator.git
cd llm-novel-translator

# Install dependencies
npm install
```

### Build Scripts
*   `npm run build`: Builds the extension for production into the `dist` folder.
*   `npm run watch`: Watches for changes and rebuilds automatically (useful for development).
    *   Note: You may need to reload the extension in `chrome://extensions/` after changes to the background script.

### Testing
```bash
# Run unit tests
npm test

# Run tests with UI
npm run test:ui
```

## 📂 Project Structure

*   `src/background`: Service worker logic (API handling, glossary management).
*   `src/content`: Content scripts for page interaction and text extraction.
*   `src/popup`: Extension popup UI.
*   `src/options`: Options page for configuration.
*   `src/lib`: Shared utilities and helpers.
*   `dist`: Compiled output (generated after build).

## 🔒 Privacy

This extension is designed to be completely serverless regarding our infrastructure.
*   **No Data Collection**: We do not collect your API keys, translation text, or reading history.
*   **Direct Connection**: Your browser connects directly to the API endpoints of the providers you configure (e.g., `api.openai.com`).
*   **Local Storage**: Configuration and glossary data are stored in your browser's local storage (`chrome.storage.local`).

## 📄 License

This project is licensed under the **AGPL-3.0** License. See the [LICENSE](LICENSE) file for details.
