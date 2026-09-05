# MyCourseVille Batch Downloader Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Google Chrome Extension (Manifest V3) that injects checkboxes into MyCourseVille's Course Materials section and provides a floating action bar to batch-download selected files and folders into an organized `.zip` archive.

**Architecture:** A lightweight Chrome Manifest V3 content script runs on `https://www.mycourseville.com/*`. It observes the DOM for Course Materials (`#courseville-material-list`), injects styled tri-state checkboxes into folders and file rows, manages selection state, displays a floating action bar, and concurrently downloads S3 files into a hierarchical JSZip archive before triggering browser download.

**Tech Stack:** JavaScript (ES6+), Chrome Extensions API (Manifest V3), JSZip v3.10.1, Vanilla CSS.

**Spec:** [`docs/superpowers/specs/2026-09-05-mcv-file-downloader-design.md`](file:///Users/theanrawichthungpromsri/Documents/workspace/tools/mcv-file-download/docs/superpowers/specs/2026-09-05-mcv-file-downloader-design.md)

## Global Constraints
- Manifest Version: 3
- Zero heavy build dependencies (pure JS/CSS loadable directly via Chrome `Load unpacked`)
- Host permissions: `https://www.mycourseville.com/*` and `https://*.amazonaws.com/*`
- Preserves folder structure in zip matching the course structure on screen
- Retries on network error with graceful degradation (skip failed file if retry exhausted, continue packaging rest)

---

### Task 1: Extension Scaffold, Manifest V3, and Vendor Libraries

**Files:**
- Create: `manifest.json`
- Create: `lib/jszip.min.js`
- Create: `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`
- Test: `tests/manifest.test.js`

**Interfaces:**
- Consumes: Chrome Extension MV3 API, JSZip
- Produces: Valid Chrome extension base directory loadable in Chrome

- [ ] **Step 1: Write manifest validation test**

```javascript
// tests/manifest.test.js
const fs = require('fs');
const path = require('path');

test('manifest.json has required MV3 fields and permissions', () => {
  const manifestRaw = fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw);
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.name).toBe('MyCourseVille Batch Downloader');
  expect(manifest.permissions).toContain('downloads');
  expect(manifest.host_permissions).toContain('https://www.mycourseville.com/*');
  expect(manifest.host_permissions).toContain('https://*.amazonaws.com/*');
  expect(manifest.content_scripts[0].js).toContain('lib/jszip.min.js');
  expect(manifest.content_scripts[0].js).toContain('content.js');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node -e "require('./tests/manifest.test.js')"`
Expected: FAIL (files missing)

- [ ] **Step 3: Create manifest.json, download JSZip, and generate extension icons**

Write `manifest.json`:
```json
{
  "manifest_version": 3,
  "name": "MyCourseVille Batch Downloader",
  "version": "1.0.0",
  "description": "Select multiple course materials and download them as a structured ZIP archive.",
  "permissions": [
    "downloads",
    "storage"
  ],
  "host_permissions": [
    "https://www.mycourseville.com/*",
    "https://*.amazonaws.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://www.mycourseville.com/*"
      ],
      "js": [
        "lib/jszip.min.js",
        "content.js"
      ],
      "css": [
        "styles.css"
      ],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```
Obtain JSZip v3.10.1 minified file into `lib/jszip.min.js`.
Generate simple clean PNG icons for 16px, 48px, and 128px.

- [ ] **Step 4: Run test to verify it passes**

Run: `node -e "require('./tests/manifest.test.js')"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add manifest.json lib/ icons/ tests/
git commit -m "feat: scaffold extension manifest, vendor jszip, and icons"
```

---

### Task 2: Floating Action Bar and Modal Styling

**Files:**
- Create: `styles.css`
- Test: `tests/styles.test.js`

**Interfaces:**
- Consumes: Target DOM element IDs / classes
- Produces: CSS rules for checkboxes, floating action toolbar, and progress modal

- [ ] **Step 1: Write styles inspection test**

```javascript
// tests/styles.test.js
const fs = require('fs');
const path = require('path');

test('styles.css contains required component classes', () => {
  const css = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');
  expect(css).toContain('.mcv-checkbox');
  expect(css).toContain('.mcv-floating-bar');
  expect(css).toContain('.mcv-progress-modal');
  expect(css).toContain('.mcv-btn-download');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node -e "require('./tests/styles.test.js')"`
Expected: FAIL

- [ ] **Step 3: Implement styles.css**

Implement comprehensive styles in `styles.css`:
- Custom rounded checkbox `.mcv-checkbox` with smooth check/indeterminate transitions.
- Floating bottom bar `.mcv-floating-bar` with glassmorphic backdrop filter, box shadow, pill shape, badge `.mcv-badge`, and buttons (`.mcv-btn`, `.mcv-btn-primary`).
- Progress modal overlay `.mcv-progress-modal` with animated progress bar, status text, and cancel button.
- Smooth CSS animations (`fadeIn`, `slideUp`, `pulse`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node -e "require('./tests/styles.test.js')"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add styles.css tests/styles.test.js
git commit -m "feat: add styling for checkboxes, floating bar, and progress modal"
```

---

### Task 3: DOM Injection, Checkbox Hierarchy & Selection State

**Files:**
- Create: `content.js` (selection and injection logic)
- Test: `tests/selection.test.js`

**Interfaces:**
- Consumes: `#courseville-material-list`, `.cv-course-home-folder-container`, `table.cv-course-home-material-table tbody tr`
- Produces: `getSelectedItems()`, `injectCheckboxes()`, `updateSelectionState()`

- [ ] **Step 1: Write test for selection state and tri-state calculation**

```javascript
// tests/selection.test.js
// Test DOM structure mirroring MyCourseVille course materials
// Verify:
// 1. Toggling folder checkbox toggles all children
// 2. Toggling individual child updates folder to indeterminate
// 3. Select all checks all files
// 4. Deselect all unchecks all files
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node -e "require('./tests/selection.test.js')"`
Expected: FAIL

- [ ] **Step 3: Implement DOM injection & selection state in content.js**

Implement in `content.js`:
- `initMCVDownloader()`: Sets up DOM observer and runs initial injection.
- `injectFolderCheckbox(folderContainer)`: Injects checkbox into `button.cv-course-home-folder-control`, binds toggle event with `e.stopPropagation()`.
- `injectFileCheckbox(row, folderPath)`: Injects checkbox into file row `td`, binds change event.
- `updateFolderState(folderContainer)`: Computes checked/indeterminate/unchecked state for the folder.
- `renderFloatingBar()`: Mounts floating bar at bottom of viewport.
- `updateFloatingBar()`: Updates badge count, shows/hides bar based on `selectedItems.size > 0`.
- "Select All" & "Deselect All" handlers.

- [ ] **Step 4: Run test to verify it passes**

Run: `node -e "require('./tests/selection.test.js')"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add content.js tests/selection.test.js
git commit -m "feat: implement DOM injection, folder-file hierarchy, and selection state"
```

---

### Task 4: Concurrent File Fetching, ZIP Packaging & Progress Modal

**Files:**
- Modify: `content.js`
- Test: `tests/downloader.test.js`

**Interfaces:**
- Consumes: Selected file URLs, JSZip
- Produces: `startBatchDownload()`, `fetchWithRetry()`, `createZipArchive()`

- [ ] **Step 1: Write unit test for filename sanitization and concurrency queue**

```javascript
// tests/downloader.test.js
// Verify:
// 1. sanitizeName strips illegal characters
// 2. Concurrency pool executes tasks with max 3 concurrent workers
// 3. Retries failed downloads up to 2 times
// 4. Builds ZIP with correct folder paths
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node -e "require('./tests/downloader.test.js')"`
Expected: FAIL

- [ ] **Step 3: Implement downloader engine in content.js**

Implement:
- `sanitizeName(name)`: Strips invalid filename characters (`/:*?"<>|`).
- `getCourseTitle()`: Extracts course code and course title from the page header to name the ZIP (e.g. `2110205_Statistics_Materials.zip`).
- `fetchWithRetry(url, maxRetries = 2)`: Fetches file data as `ArrayBuffer` with automatic retries on network error.
- `downloadQueue(items, concurrency = 3, onProgress)`: Manages concurrent downloads and updates progress.
- `createZip(downloadedItems)`: Packages buffers into JSZip hierarchy matching folders and root files.
- `showProgressModal(totalFiles)` / `updateProgressModal(current, total, currentFileName, status)` / `closeProgressModal()`.
- Download trigger: creates object URL from ZIP blob and triggers click on invisible `<a>` element.

- [ ] **Step 4: Run test to verify it passes**

Run: `node -e "require('./tests/downloader.test.js')"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add content.js tests/downloader.test.js
git commit -m "feat: implement concurrent file fetching, JSZip packaging, and progress modal"
```

---

### Task 5: End-to-End Verification & User Guide

**Files:**
- Create: `README.md`
- Test: Chrome browser live verification on `https://www.mycourseville.com/?q=courseville/course/81798&from=home`

- [ ] **Step 1: Create README.md with clear loading and usage instructions**
Document how to load the unpacked extension in Chrome (`chrome://extensions` -> Developer mode -> Load unpacked).

- [ ] **Step 2: Run automated test suite**
Run: `npm test` or node test runner across all tests.
Expected: All test suites PASS.

- [ ] **Step 3: Live In-Browser Testing with browser subagent**
Inject the script or verify directly on the active course page in browser to confirm checkboxes, folder toggle, select all, floating bar, and modal appearance.

- [ ] **Step 4: Commit and finalize**

```bash
git add README.md
git commit -m "docs: add user instructions and complete verification"
```
