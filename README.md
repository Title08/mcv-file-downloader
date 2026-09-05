<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="MyCourseVille Batch Downloader" />
</p>

<h1 align="center">MyCourseVille Batch Downloader</h1>

<p align="center">
  <strong>A modern Google Chrome extension to batch download course materials from MyCourseVille into neatly organized ZIP archives.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-brightgreen.svg" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Platform-Chromium-orange.svg" alt="Platform">
  <img src="https://img.shields.io/badge/Tests-Passing-success.svg" alt="Tests">
  <a href="https://github.com/Title08/mcv-file-downloader/pulls"><img src="https://img.shields.io/badge/PRs-Welcome-brightgreen.svg" alt="PRs Welcome"></a>
</p>

---

## 💡 Overview

Downloading course materials on [MyCourseVille](https://www.mycourseville.com) usually requires students to manually click and save dozens of slide decks, problem sets, and reading files one by one every week.

**MyCourseVille Batch Downloader** injects sleek, intuitive checkboxes directly into your course material sections. You can pick individual files or select entire folders with a single click. Everything is downloaded concurrently and bundled into a structured `.zip` archive—mirroring your instructor's folder layout.

---

## ✨ Features

- 📁 **Smart Folder & File Selection**: Checking a folder checkbox automatically selects or deselects all files nested within it.
- 🔄 **Tri-State Checkbox Support**: Folders show an indeterminate state `[-]` when only some files are selected.
- 🪄 **Floating Action Pill**: Sleek glassmorphic bottom toolbar with:
  - Live selected file counter badge.
  - **Select All** & **Clear** quick controls.
  - One-click **Download ZIP** action.
- 📦 **Preserves Folder Hierarchy**: Automatically creates subdirectories inside the `.zip` archive matching the course material structure (e.g. `Lecture Slides/Week 1.pdf`).
- ⚡ **Fast & Resilient Downloader Engine**: Downloads files in parallel with automatic exponential backoff retries on network hiccups.
- 📊 **Real-time Download Modal**: Live progress bar with completion percentage, active file indicator, and an abort/cancel button.
- 🔒 **100% Client-Side & Private**: Runs entirely in your local browser. No third-party servers, no telemetry, and your student credentials never leave your session.

---

## 📥 Installation

### Install in Google Chrome / Brave / Microsoft Edge

1. **Clone or Download this repository**:
   ```bash
   git clone https://github.com/Title08/mcv-file-downloader.git
   ```
   *(Or click **Code** > **Download ZIP** on GitHub and unzip it on your computer).*

2. **Open Extensions page in your browser**:
   - In Chrome: navigate to `chrome://extensions`
   - In Brave: navigate to `brave://extensions`
   - In Edge: navigate to `edge://extensions`

3. **Enable Developer Mode**:
   - Toggle on the **Developer mode** switch in the top-right corner.

4. **Load the Extension**:
   - Click the **Load unpacked** button in the top-left corner.
   - Select the `mcv-file-downloader` project folder.

5. 🎉 **Done!** The extension is now active and will automatically run when you visit MyCourseVille.

---

## 🎯 How to Use

1. Go to [MyCourseVille](https://www.mycourseville.com) and log in.
2. Open any enrolled course page.
3. Scroll down to the **Course Material** section.
4. Checkboxes will automatically appear next to each folder header and file item:
   - Check an entire folder to select all materials inside it.
   - Or check individual files to cherry-pick what you need.
5. A floating action bar will slide up at the bottom of your screen displaying the number of selected files.
6. Click **Download ZIP**.
7. Watch the real-time progress bar. Once all files are fetched and compressed, your browser will automatically save the generated `.zip` file!

---

## 🛡️ Permissions & Privacy

This extension follows the principle of least privilege:

| Permission | Purpose |
| :--- | :--- |
| `downloads` | Used to trigger the browser save prompt for the generated `.zip` archive. |
| `storage` | Used for persisting lightweight user preferences. |
| `host_permissions` | Restricted to `https://www.mycourseville.com/*` and AWS S3 storage (`https://*.amazonaws.com/*`) where MyCourseVille files are securely hosted. |

> **🔒 Privacy First**: Your privacy is fully respected. No credentials, tokens, cookies, or files are ever sent to external third-party servers. All processing and ZIP compression happen directly inside your browser.

---

## 🛠️ Tech Stack & Architecture

- **Manifest**: Chrome Extensions Manifest V3
- **Scripting**: Modern Vanilla JavaScript (ES6+, zero dependencies)
- **Styling**: Vanilla CSS with glassmorphism, responsive grid alignment, and micro-animations
- **Archiving**: [JSZip](https://stuk.github.io/jszip/) v3.10.1 (bundled locally for offline reliability)
- **Testing**: Zero-dependency automated test suite in Node.js

---

## 📂 Project Structure

```
mcv-file-downloader/
├── manifest.json            # Manifest V3 configuration
├── content.js               # Injected logic (DOM observers, selection, downloader, ZIP builder)
├── styles.css               # Modern glassmorphism toolbar, checkboxes & modal styles
├── lib/
│   └── jszip.min.js         # Bundled JSZip v3.10.1 library
├── icons/                   # Extension icons (16px, 48px, 128px)
├── tests/                   # Automated test suite
│   ├── dom-mock.js
│   ├── manifest.test.js
│   ├── styles.test.js
│   ├── selection.test.js
│   └── downloader.test.js
├── LICENSE                  # MIT License
├── package.json
└── README.md
```

---

## 🧪 Testing & Verification

Run the automated test suite locally:

```bash
# Run tests
npm test
```

The test suite validates:
- `tests/manifest.test.js`: Manifest V3 schema, permissions, content script declarations, and icon files.
- `tests/styles.test.js`: CSS component classes, keyframe animations, and design tokens.
- `tests/selection.test.js`: In-page DOM injection, folder-file hierarchy, tri-state toggling, and floating bar state.
- `tests/downloader.test.js`: Filename sanitization, concurrency queue pool, exponential-backoff retry logic, and ZIP archive tree structure.

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are welcome!
Feel free to open an [Issue](https://github.com/Title08/mcv-file-downloader/issues) or submit a [Pull Request](https://github.com/Title08/mcv-file-downloader/pulls).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
