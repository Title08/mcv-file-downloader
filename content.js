/**
 * MyCourseVille Batch File Downloader - Content Script
 * Injects checkboxes, handles hierarchical selection, and provides batch ZIP downloading.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MCVDownloader = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let floatingBarEl = null;
  let progressModalEl = null;
  let currentAbortController = null;

  /**
   * Cleans names for safe file systems
   */
  function sanitizeName(str) {
    if (!str) return 'Untitled';
    return str
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Retrieves Course Title & Code from DOM or URL
   */
  function getCourseInfo() {
    let code = '';
    let name = '';

    // Check header or title elements
    const titleEl = document.querySelector('.cv-course-home-title, .cv-course-title, #courseville-course-title, h1');
    if (titleEl) {
      const text = titleEl.textContent.trim();
      const codeMatch = text.match(/\b\d{7}\b/);
      if (codeMatch) code = codeMatch[0];
      name = text.replace(code, '').replace(/[\(\)\|]/g, '').trim();
    }

    if (!code) {
      // Fallback: document.title (e.g. "2110205 (2026/1) | myCourseVille")
      const docTitle = typeof document !== 'undefined' && document.title ? document.title : '';
      const docCodeMatch = docTitle.match(/\b\d{7}\b/);
      if (docCodeMatch) code = docCodeMatch[0];
      
      const parts = docTitle.split('|');
      if (parts[0] && !name) {
        name = parts[0].replace(code, '').replace(/[\(\)\/\d]/g, '').trim();
      }
    }

    if (!code) {
      // Fallback: URL search params
      const urlParams = new URLSearchParams(window.location ? window.location.search : '');
      const q = urlParams.get('q') || '';
      const courseMatch = q.match(/course\/(\d+)/);
      if (courseMatch) code = `Course_${courseMatch[1]}`;
    }

    return {
      code: sanitizeName(code || 'MCV'),
      name: sanitizeName(name || 'Materials')
    };
  }

  /**
   * Update folder checkbox state based on its children
   */
  function updateFolderState(folderContainer) {
    const folderCb = folderContainer.querySelector('.mcv-folder-checkbox');
    if (!folderCb) return;

    const fileCbs = Array.from(folderContainer.querySelectorAll('.mcv-file-checkbox'));
    if (fileCbs.length === 0) {
      folderCb.checked = false;
      folderCb.indeterminate = false;
      return;
    }

    const checkedCount = fileCbs.filter(cb => cb.checked).length;

    if (checkedCount === 0) {
      folderCb.checked = false;
      folderCb.indeterminate = false;
    } else if (checkedCount === fileCbs.length) {
      folderCb.checked = true;
      folderCb.indeterminate = false;
    } else {
      folderCb.checked = false;
      folderCb.indeterminate = true;
    }
  }

  /**
   * Calculate total selected files and update floating toolbar
   */
  function updateFloatingBar() {
    if (!floatingBarEl) return;

    const selectedFiles = document.querySelectorAll('.mcv-file-checkbox:checked');
    const count = selectedFiles.length;

    const badge = floatingBarEl.querySelector('.mcv-badge');
    const label = floatingBarEl.querySelector('.mcv-info-label');

    if (badge) {
      badge.textContent = `${count} ${count === 1 ? 'file' : 'files'}`;
    }
    if (label) {
      label.textContent = 'selected';
    }

    if (count > 0) {
      floatingBarEl.classList.add('mcv-visible');
    } else {
      floatingBarEl.classList.remove('mcv-visible');
    }
  }

  /**
   * Injects checkbox into a folder header
   */
  function injectFolderCheckbox(folderContainer) {
    if (folderContainer.getAttribute('data-mcv-injected') === 'true') return;

    const folderControl = folderContainer.querySelector('.cv-course-home-folder-control');
    if (!folderControl) return;

    const folderTitleEl = folderControl.querySelector('span') || folderControl;
    const folderName = folderTitleEl.textContent.trim().replace(/\(\d+\s*items?\)/i, '').trim();

    const cbWrapper = document.createElement('span');
    cbWrapper.className = 'mcv-folder-checkbox-wrapper';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'mcv-checkbox mcv-folder-checkbox';
    checkbox.title = `Select folder: ${folderName}`;

    // Prevent folder toggle when clicking checkbox or wrapper
    const stopProp = (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
    };
    checkbox.addEventListener('click', stopProp);

    cbWrapper.addEventListener('click', (e) => {
      stopProp(e);
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        try {
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {
          checkbox.dispatchEvent({ type: 'change', target: checkbox });
        }
      }
    });

    checkbox.addEventListener('change', (e) => {
      stopProp(e);
      const isChecked = checkbox.checked;
      checkbox.indeterminate = false;

      const fileCbs = folderContainer.querySelectorAll('.mcv-file-checkbox');
      fileCbs.forEach(fileCb => {
        fileCb.checked = isChecked;
        const row = fileCb.closest('tr');
        if (row) {
          if (isChecked) row.classList.add('mcv-row-selected');
          else row.classList.remove('mcv-row-selected');
        }
      });

      updateFloatingBar();
    });

    cbWrapper.appendChild(checkbox);
    folderControl.prepend(cbWrapper);
    folderContainer.setAttribute('data-mcv-injected', 'true');
    folderContainer.setAttribute('data-mcv-folder-name', folderName);
  }

  /**
   * Injects checkbox into a dedicated table cell at the start of each file row
   */
  function injectFileCheckbox(row, folderName = '') {
    if (row.getAttribute('data-mcv-injected') === 'true') return;

    // Extract title & download link
    const titleCell = row.querySelector('td[data-col="title"]') || row;
    const filename = titleCell.textContent.trim();

    const linkEl = row.querySelector('td[data-col="action"] a[href]') || row.querySelector('a[href]');
    const downloadUrl = linkEl ? linkEl.getAttribute('href') : '';

    const checkboxTd = document.createElement('td');
    checkboxTd.className = 'mcv-col-checkbox';

    const cbWrapper = document.createElement('span');
    cbWrapper.className = 'mcv-checkbox-wrapper';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'mcv-checkbox mcv-file-checkbox';
    checkbox.title = `Select file: ${filename}`;
    checkbox.dataset.url = downloadUrl;
    checkbox.dataset.filename = filename;
    checkbox.dataset.folder = folderName;

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        row.classList.add('mcv-row-selected');
      } else {
        row.classList.remove('mcv-row-selected');
      }

      const folderContainer = row.closest('.cv-course-home-folder-container');
      if (folderContainer) {
        updateFolderState(folderContainer);
      }

      updateFloatingBar();
    });

    cbWrapper.appendChild(checkbox);
    checkboxTd.appendChild(cbWrapper);
    row.insertBefore(checkboxTd, row.firstChild);
    row.setAttribute('data-mcv-injected', 'true');
  }


  /**
   * Select All items across all folders and root
   */
  function selectAll() {
    const fileCbs = document.querySelectorAll('.mcv-file-checkbox');
    fileCbs.forEach(cb => {
      cb.checked = true;
      const row = cb.closest('tr');
      if (row) row.classList.add('mcv-row-selected');
    });

    const folderContainers = document.querySelectorAll('.cv-course-home-folder-container');
    folderContainers.forEach(container => updateFolderState(container));

    updateFloatingBar();
  }

  /**
   * Deselect All items
   */
  function deselectAll() {
    const fileCbs = document.querySelectorAll('.mcv-file-checkbox');
    fileCbs.forEach(cb => {
      cb.checked = false;
      const row = cb.closest('tr');
      if (row) row.classList.remove('mcv-row-selected');
    });

    const folderCbs = document.querySelectorAll('.mcv-folder-checkbox');
    folderCbs.forEach(cb => {
      cb.checked = false;
      cb.indeterminate = false;
    });

    updateFloatingBar();
  }

  /**
   * Collect all selected files with their folder hierarchy
   */
  function getSelectedItems() {
    const selectedCbs = Array.from(document.querySelectorAll('.mcv-file-checkbox:checked'));
    return selectedCbs.map(cb => {
      let ext = '';
      let cleanTitle = cb.dataset.filename || 'file';

      // Detect extension from title or URL
      const url = cb.dataset.url || '';
      const extMatch = cleanTitle.match(/\.([0-9a-zA-Z]+)$/) || url.match(/\.([0-9a-zA-Z]+)(?:\?|$)/);
      if (extMatch) {
        ext = extMatch[1].toLowerCase();
        if (!cleanTitle.toLowerCase().endsWith('.' + ext)) {
          cleanTitle = `${cleanTitle}.${ext}`;
        }
      }

      return {
        url: url,
        filename: sanitizeName(cleanTitle),
        folder: sanitizeName(cb.dataset.folder || '')
      };
    }).filter(item => Boolean(item.url));
  }

  /**
   * Concurrency Queue for downloading files with max active connections
   */
  async function downloadQueue(items, concurrency = 3, fetcher, onProgress) {
    const results = new Array(items.length);
    let currentIndex = 0;
    let completedCount = 0;

    const worker = async () => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        const item = items[index];
        try {
          const res = await fetcher(item);
          results[index] = res;
        } catch (err) {
          results[index] = { item, error: err, success: false };
        }
        completedCount++;
        if (typeof onProgress === 'function') {
          onProgress(completedCount, items.length, item);
        }
      }
    };

    const workerPromises = [];
    const poolSize = Math.min(concurrency, items.length);
    for (let i = 0; i < poolSize; i++) {
      workerPromises.push(worker());
    }

    await Promise.all(workerPromises);
    return results;
  }

  /**
   * Fetch a single file with exponential backoff retries
   */
  async function fetchWithRetry(url, maxRetries = 2, fetchFn = (typeof fetch !== 'undefined' ? fetch : null), signal = null) {
    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
      try {
        const options = signal ? { signal } : {};
        const response = await fetchFn(url, options);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.arrayBuffer();
        return data;
      } catch (err) {
        lastError = err;
        if (signal && signal.aborted) {
          throw err;
        }
        attempt++;
        if (attempt <= maxRetries) {
          const delay = Math.pow(2, attempt) * 150;
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Build JSZip archive from downloaded items
   */
  async function buildZip(downloadedItems, ZipLib = (typeof JSZip !== 'undefined' ? JSZip : null)) {
    if (!ZipLib) {
      throw new Error('JSZip library is not loaded');
    }

    const zip = new ZipLib();

    downloadedItems.forEach(res => {
      if (!res || !res.success || !res.data) return;
      const { item, data } = res;

      if (item.folder) {
        zip.folder(item.folder).file(item.filename, data);
      } else {
        zip.file(item.filename, data);
      }
    });

    return zip;
  }

  /**
   * Progress Modal Management
   */
  function showProgressModal(totalFiles, courseInfo, onCancel) {
    closeProgressModal();

    const overlay = document.createElement('div');
    overlay.className = 'mcv-modal-overlay mcv-modal-visible';
    overlay.id = 'mcv-progress-modal-root';

    const card = document.createElement('div');
    card.className = 'mcv-progress-modal';

    const header = document.createElement('div');
    header.className = 'mcv-modal-header';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'mcv-modal-title';
    title.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Downloading Course Materials
    `;
    const courseSub = document.createElement('div');
    courseSub.className = 'mcv-modal-course';
    courseSub.textContent = `${courseInfo.code} ${courseInfo.name}`;

    titleWrap.appendChild(title);
    titleWrap.appendChild(courseSub);
    header.appendChild(titleWrap);

    const progressContainer = document.createElement('div');
    progressContainer.className = 'mcv-progress-container';

    const meta = document.createElement('div');
    meta.className = 'mcv-progress-meta';
    const countSpan = document.createElement('span');
    countSpan.className = 'mcv-meta-count';
    countSpan.textContent = `0 / ${totalFiles} files`;
    const pctSpan = document.createElement('span');
    pctSpan.className = 'mcv-meta-pct';
    pctSpan.textContent = '0%';

    meta.appendChild(countSpan);
    meta.appendChild(pctSpan);

    const progressBar = document.createElement('div');
    progressBar.className = 'mcv-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'mcv-progress-fill';
    progressBar.appendChild(fill);

    const statusDetail = document.createElement('div');
    statusDetail.className = 'mcv-status-detail';
    statusDetail.textContent = 'Preparing download queue...';

    progressContainer.appendChild(meta);
    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(statusDetail);

    const footer = document.createElement('div');
    footer.className = 'mcv-modal-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'mcv-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      if (typeof onCancel === 'function') onCancel();
      closeProgressModal();
    });
    footer.appendChild(cancelBtn);

    card.appendChild(header);
    card.appendChild(progressContainer);
    card.appendChild(footer);
    overlay.appendChild(card);

    document.body.appendChild(overlay);
    progressModalEl = overlay;
  }

  function updateProgressModal(current, total, detailText, percentage = null) {
    if (!progressModalEl) return;

    const pct = percentage !== null ? percentage : Math.round((current / total) * 100);
    const countSpan = progressModalEl.querySelector('.mcv-meta-count');
    const pctSpan = progressModalEl.querySelector('.mcv-meta-pct');
    const fill = progressModalEl.querySelector('.mcv-progress-fill');
    const statusDetail = progressModalEl.querySelector('.mcv-status-detail');

    if (countSpan) countSpan.textContent = `${current} / ${total} files`;
    if (pctSpan) pctSpan.textContent = `${pct}%`;
    if (fill) fill.style.width = `${pct}%`;
    if (statusDetail && detailText) statusDetail.textContent = detailText;
  }

  function closeProgressModal() {
    if (progressModalEl) {
      progressModalEl.remove();
      progressModalEl = null;
    }
  }

  /**
   * Main Batch Download Orchestrator
   */
  async function startBatchDownload() {
    const items = getSelectedItems();
    if (items.length === 0) {
      alert('Please select at least one file or folder to download.');
      return;
    }

    const courseInfo = getCourseInfo();
    const zipName = `${courseInfo.code}_${courseInfo.name}_Materials.zip`.replace(/_+/g, '_');

    currentAbortController = new AbortController();

    showProgressModal(items.length, courseInfo, () => {
      if (currentAbortController) {
        currentAbortController.abort();
      }
    });

    try {
      const fetcher = async (item) => {
        updateProgressModal(
          0,
          items.length,
          `Fetching: ${item.filename}`
        );
        const data = await fetchWithRetry(item.url, 2, fetch, currentAbortController.signal);
        return { item, data, success: true };
      };

      const downloadedItems = await downloadQueue(
        items,
        3,
        fetcher,
        (current, total, item) => {
          updateProgressModal(current, total, `Downloaded: ${item.filename}`);
        }
      );

      updateProgressModal(items.length, items.length, 'Compressing into ZIP archive...', 98);

      const zip = await buildZip(downloadedItems);
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      updateProgressModal(items.length, items.length, 'Download ready!', 100);

      // Trigger download
      const blobUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(blobUrl);
      }, 2000);

      const failedCount = downloadedItems.filter(r => !r || !r.success).length;
      setTimeout(() => {
        closeProgressModal();
        if (failedCount > 0) {
          alert(`Download complete! Note: ${failedCount} of ${items.length} files could not be downloaded.`);
        }
      }, 600);

    } catch (err) {
      if (currentAbortController && currentAbortController.signal.aborted) {
        console.log('[MCV Downloader] Download aborted by user.');
      } else {
        console.error('[MCV Downloader] Batch download error:', err);
        alert(`Download failed: ${err.message}`);
      }
      closeProgressModal();
    }
  }

  /**
   * Build and mount the floating action bar
   */
  function renderFloatingBar() {
    if (document.getElementById('mcv-floating-bar-root')) {
      floatingBarEl = document.getElementById('mcv-floating-bar-root');
      return;
    }

    const bar = document.createElement('div');
    bar.id = 'mcv-floating-bar-root';
    bar.className = 'mcv-floating-bar';

    // Info section
    const info = document.createElement('div');
    info.className = 'mcv-info';

    const badge = document.createElement('span');
    badge.className = 'mcv-badge';
    badge.textContent = '0 files';

    const label = document.createElement('span');
    label.className = 'mcv-info-label';
    label.textContent = 'selected';

    info.appendChild(badge);
    info.appendChild(label);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'mcv-actions';

    const deselectBtn = document.createElement('button');
    deselectBtn.type = 'button';
    deselectBtn.className = 'mcv-btn mcv-btn-secondary mcv-btn-deselect-all';
    deselectBtn.textContent = 'Clear';
    deselectBtn.addEventListener('click', deselectAll);

    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.className = 'mcv-btn mcv-btn-outline mcv-btn-select-all';
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.addEventListener('click', selectAll);

    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'mcv-btn mcv-btn-primary mcv-btn-download';
    downloadBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download ZIP
    `;
    downloadBtn.addEventListener('click', startBatchDownload);

    actions.appendChild(deselectBtn);
    actions.appendChild(selectAllBtn);
    actions.appendChild(downloadBtn);

    bar.appendChild(info);
    bar.appendChild(actions);

    document.body.appendChild(bar);
    floatingBarEl = bar;
  }

  /**
   * Scan DOM and inject checkboxes for folders and files
   */
  function injectAllCheckboxes() {
    const materialList = document.getElementById('courseville-material-list');
    if (!materialList) return;

    // 1. Folders
    const folderContainers = materialList.querySelectorAll('.cv-course-home-folder-container');
    folderContainers.forEach(container => {
      injectFolderCheckbox(container);
      const folderName = container.getAttribute('data-mcv-folder-name') || '';
      const fileRows = container.querySelectorAll('table.cv-course-home-material-table tbody tr');
      fileRows.forEach(row => injectFileCheckbox(row, folderName));
    });

    // 2. Root files (outside folders)
    const rootRows = materialList.querySelectorAll(':scope > table.cv-course-home-material-table tbody tr');
    rootRows.forEach(row => injectFileCheckbox(row, ''));
  }

  /**
   * Initialize observer and UI
   */
  function initMCVDownloader() {
    renderFloatingBar();
    injectAllCheckboxes();

    const materialList = document.getElementById('courseville-material-list');
    if (materialList && typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => {
        injectAllCheckboxes();
      });
      observer.observe(materialList, { childList: true, subtree: true });
    }
  }

  // Auto-init in browser when DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initMCVDownloader);
    } else {
      initMCVDownloader();
    }
  }

  return {
    sanitizeName,
    getCourseInfo,
    initMCVDownloader,
    injectFolderCheckbox,
    injectFileCheckbox,
    updateFolderState,
    updateFloatingBar,
    selectAll,
    deselectAll,
    getSelectedItems,
    downloadQueue,
    fetchWithRetry,
    buildZip,
    showProgressModal,
    updateProgressModal,
    closeProgressModal,
    startBatchDownload
  };
});
