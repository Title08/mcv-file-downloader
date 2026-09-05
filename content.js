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
   * Retrieves Course Title & Code from DOM
   */
  function getCourseInfo() {
    let code = '';
    let name = '';

    // Check header or breadcrumbs
    const headerEl = document.querySelector('.cv-course-home-title, h1, .cv-course-title');
    if (headerEl) {
      const text = headerEl.textContent.trim();
      const codeMatch = text.match(/\b\d{7}\b/);
      if (codeMatch) code = codeMatch[0];
      name = text.replace(code, '').replace(/[\(\)\|]/g, '').trim();
    }

    if (!code) {
      // Try URL parameters
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
    cbWrapper.className = 'mcv-checkbox-wrapper';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'mcv-checkbox mcv-folder-checkbox';
    checkbox.title = `Select folder: ${folderName}`;

    // Prevent folder toggle when clicking checkbox
    const stopProp = (e) => {
      if (e.stopPropagation) e.stopPropagation();
    };
    checkbox.addEventListener('click', stopProp);

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
   * Injects checkbox into a single file row
   */
  function injectFileCheckbox(row, folderName = '') {
    if (row.getAttribute('data-mcv-injected') === 'true') return;

    // Find thumbnail cell or first td
    const targetCell = row.querySelector('td[data-col="thumbnail"]') || row.children[0];
    if (!targetCell) return;

    // Extract title & download link
    const titleCell = row.querySelector('td[data-col="title"]') || row;
    const filename = titleCell.textContent.trim();

    const linkEl = row.querySelector('td[data-col="action"] a[href]') || row.querySelector('a[href]');
    const downloadUrl = linkEl ? linkEl.getAttribute('href') : '';

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
    targetCell.prepend(cbWrapper);
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
        if (!cleanTitle.endsWith('.' + ext)) {
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
    downloadBtn.addEventListener('click', () => {
      if (typeof handleDownloadZip === 'function') {
        handleDownloadZip();
      }
    });

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

  // Placeholder for download handler (implemented in Task 4)
  function handleDownloadZip() {
    if (typeof MCVDownloader.startBatchDownload === 'function') {
      MCVDownloader.startBatchDownload();
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
    getSelectedItems
  };
});
