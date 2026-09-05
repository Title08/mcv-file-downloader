# 🚀 MyCourseVille Batch Downloader (Chrome Extension)

> A modern Google Chrome extension (Manifest V3) that injects checkboxes into MyCourseVille's Course Materials, enabling one-click batch downloading of files and folders into an organized `.zip` archive.

---

## ✨ Features

- 📁 **Folder & File Checkboxes**: Ticking a folder checkbox automatically selects all files nested inside that folder.
- 🔄 **Tri-State Checkbox Support**: Folders show an indeterminate state `[-]` when partially selected.
- 🪄 **Floating Action Toolbar**: A sleek glassmorphic pill floats at the bottom of the screen when items are selected with:
  - Total selected item count badge.
  - **Select All** button (selects all materials across all folders & root level).
  - **Clear** button (resets selection).
  - **Download ZIP** primary action button.
- 📦 **Organized ZIP Archive**: Preserves the original folder hierarchy (e.g., `Lecture Slides/Week 1.pdf`, `Calculus/Problem Set 1.pdf`) inside a single `.zip` file.
- ⚡ **Concurrent & Resilient Downloads**: Concurrency-limited downloading with automatic exponential-backoff retries for failed requests.
- 📊 **Live Progress Modal**: Real-time progress bar, percentage indicator, currently downloaded filename, and cancel capability.

---

## 📥 How to Install in Google Chrome

1. Open **Google Chrome**.
2. Navigate to `chrome://extensions` in the address bar (or go to **Menu** > **Extensions** > **Manage Extensions**).
3. Toggle on **Developer mode** in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select this project folder:
   ```
   /Users/theanrawichthungpromsri/Documents/workspace/tools/mcv-file-download
   ```
6. The extension **MyCourseVille Batch Downloader** will now appear in your list of active extensions!

---

## 🎯 How to Use

1. Go to [MyCourseVille](https://www.mycourseville.com) and log in.
2. Open any course page (e.g. `2110205 Statistics for Computer Engineering`).
3. Scroll to the **Course Material** section.
4. You will see checkboxes next to each folder header and next to each file row.
5. Check any folders or individual files you want to download.
6. The floating toolbar will appear at the bottom of your screen showing how many files you've selected.
7. Click **Download ZIP**.
8. Watch the real-time progress bar; once complete, your browser will automatically save the generated `.zip` archive!

---

## 🧪 Testing & Verification

Run the automated test suite:
```bash
npm test
```

This validates:
- `tests/manifest.test.js`: Manifest V3 specification, permissions, content scripts, and icon assets.
- `tests/styles.test.js`: CSS component classes, animations, and design tokens.
- `tests/selection.test.js`: In-page DOM injection, folder-file hierarchy, tri-state toggling, and floating bar state.
- `tests/downloader.test.js`: Filename sanitization, concurrency queue pool, retry logic, and JSZip structure.

---

## 📂 Project Structure

```
mcv-file-download/
├── manifest.json            # Manifest V3 configuration
├── content.js               # Injected logic (DOM, selection, downloader, ZIP)
├── styles.css               # Modern glassmorphism & responsive styles
├── lib/
│   └── jszip.min.js         # Bundled JSZip v3.10.1 library
├── icons/                   # Extension icons (16px, 48px, 128px)
├── tests/                   # Test suite
│   ├── dom-mock.js
│   ├── manifest.test.js
│   ├── styles.test.js
│   ├── selection.test.js
│   └── downloader.test.js
├── package.json
└── README.md
```
