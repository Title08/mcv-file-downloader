# MyCourseVille Batch File Downloader Chrome Extension - Design Specification

**Date:** 2026-09-05  
**Target:** Chrome Extension (Manifest V3)  
**Website:** `https://www.mycourseville.com/*`  

---

## 1. Overview
The **MyCourseVille Batch File Downloader** is a Google Chrome extension (Manifest V3) designed to enhance the MyCourseVille course materials interface. It injects interactive checkboxes into folder headers and file rows, introduces a sleek floating action bar for batch operations, and downloads selected files and folders as a structured `.zip` archive with folder hierarchy preserved.

---

## 2. Architecture & File Structure

```
mcv-file-download/
├── manifest.json
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── lib/
│   └── jszip.min.js
├── content.js
├── styles.css
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-09-05-mcv-file-downloader-design.md
```

### 2.1 Manifest Specifications (Manifest V3)
- **`manifest_version`**: 3
- **`name`**: MyCourseVille Batch Downloader
- **`version`**: 1.0.0
- **`description`**: Select multiple course materials and download them as a structured ZIP archive.
- **`permissions`**: `downloads`, `storage`
- **`host_permissions`**:
  - `https://www.mycourseville.com/*`
  - `https://*.amazonaws.com/*`
- **`content_scripts`**:
  - Matches: `https://www.mycourseville.com/*`
  - JS: `lib/jszip.min.js`, `content.js`
  - CSS: `styles.css`
  - Run at: `document_idle`

---

## 3. DOM Target & Injection Strategy

### 3.1 Target Container
- Main container: `section#courseville-material-list`
- Folder elements: `div.cv-course-home-folder-container`
  - Folder toggle button: `button.cv-course-home-folder-control`
  - Folder title extraction: `.cv-course-home-folder-control span.text-truncate` or equivalent text node
- File rows: `table.cv-course-home-material-table tbody tr`
  - Thumbnail cell: `td[data-col="thumbnail"]`
  - Title cell: `td[data-col="title"]`
  - Action / Download link: `td[data-col="action"] a[href]`
- Root files: Rows located directly under `section#courseville-material-list` not wrapped in a folder container.

### 3.2 Injected Checkbox Components
1. **Folder Checkbox**:
   - Injected into each `.cv-course-home-folder-control` beside the folder icon/name.
   - Clicking the checkbox toggles selection for all files nested inside that folder.
   - Event propagation (`stopPropagation`) is applied so toggling the checkbox does not accidentally trigger the folder expand/collapse accordion.
   - Supports tri-state:
     - `checked`: All files inside are selected.
     - `indeterminate` (`[-]`): Some files inside are selected.
     - `unchecked`: No files inside are selected.

2. **File Checkbox**:
   - Injected into each material row (e.g. prepended to thumbnail cell or row).
   - Toggling updates the row's selection state and recalculates parent folder state and total selection count.

3. **Lifecycle & Dynamic Updates**:
   - Uses `MutationObserver` on `#courseville-material-list` to re-inject checkboxes if the DOM is refreshed or re-rendered.
   - Idempotent injection via `data-mcv-downloader="injected"` attributes to avoid duplicate checkboxes.

---

## 4. User Interface (UI) Components

### 4.1 Floating Action Bar
- Position: Fixed at bottom-center or bottom-right of viewport (`z-index: 99999`).
- Visibility: Smooth slide-in transition when `selectedCount > 0`. Slides out when `0`.
- Elements:
  - **Count Badge**: Displays total selected files (e.g., `8 files selected`).
  - **Select All Button**: Selects all files across all folders and root level.
  - **Deselect All Button**: Clears all current selections.
  - **Download ZIP Button**: Primary action button styled with prominent call-to-action styling.

### 4.2 Download Progress Modal / Toast
- Displays during the download and compression phases.
- Shows:
  - Header: Course Name / Code (e.g. `2110205 Statistics for Computer Engineering`).
  - Overall progress bar with percentage.
  - Current item status: `Downloading 3 / 8: Week 2A - Random Variables.pdf`.
  - Compression status: `Packing files into ZIP...`.
  - Cancel button: Aborts pending requests and closes modal.

---

## 5. Fetching, ZIP Creation & Error Handling

### 5.1 Data Flow
1. User selects items and clicks "Download Selected (.zip)".
2. Extract list of download tasks:
   ```ts
   interface DownloadItem {
     url: string;
     filename: string;
     folderPath: string; // e.g. "Lecture Slides" or "" for root files
   }
   ```
3. Process tasks with a concurrency pool of 3 simultaneous connections to maintain speed without network saturation.
4. Fetch file data as `ArrayBuffer` / `Blob`.
5. Sanitize filenames and folder names (stripping `: * ? " < > | \ /`).
6. Append to `JSZip`:
   - `zip.folder(item.folderPath).file(item.filename, buffer)`
7. Generate ZIP blob via `zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })`.
8. Trigger browser download using a temporary `<a>` element or `chrome.downloads.download`.
9. Default filename: `[CourseCode]_[CourseName]_Materials.zip` (fallback `MyCourseVille_Materials.zip`).

### 5.2 Error Handling & Resilience
- Retries: Up to 2 automatic retries per file on network error or HTTP failure.
- Graceful Degradation: If a file fails after retries, the ZIP is still generated containing all other downloaded files, and an alert/toast details which files were skipped.
- CORS Handling: The extension includes `host_permissions` for `https://*.amazonaws.com/*` and `https://www.mycourseville.com/*`, bypassing browser cross-origin fetch blocks.

---

## 6. Testing & Verification
1. **Load Unpacked Extension**: Load the extension into Chrome via `chrome://extensions`.
2. **Visual Verification**: Verify checkboxes appear on folder headers and file rows on `https://www.mycourseville.com/?q=courseville/course/81798&from=home`.
3. **Selection Logic**:
   - Check folder -> verify all nested files are checked.
   - Uncheck one nested file -> verify folder checkbox changes to indeterminate.
   - Click "Select All" -> all files selected, badge count updates.
   - Click "Deselect All" -> floating bar hides.
4. **Download Test**:
   - Select multiple files from different folders.
   - Click "Download Selected (.zip)".
   - Verify progress bar updates accurately.
   - Unpack generated `.zip` file and confirm folder hierarchy and file readability.
