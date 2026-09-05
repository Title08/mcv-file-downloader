const { MockDocument, MockElement, MockMutationObserver } = require('./dom-mock');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function buildMockCoursePage() {
  const doc = new MockDocument();

  // section#courseville-material-list
  const section = doc.createElement('section');
  section.setAttribute('id', 'courseville-material-list');
  doc.body.appendChild(section);

  // Folder 1: "Lecture Slides"
  const folder = doc.createElement('div');
  folder.setAttribute('class', 'cv-course-home-folder-container');
  section.appendChild(folder);

  const folderBtn = doc.createElement('button');
  folderBtn.setAttribute('class', 'cv-course-home-folder-control');
  const folderTitle = doc.createElement('span');
  folderTitle.textContent = 'Lecture Slides';
  folderBtn.appendChild(folderTitle);
  folder.appendChild(folderBtn);

  const folderTable = doc.createElement('table');
  folderTable.setAttribute('class', 'cv-course-home-material-table');
  const tbody = doc.createElement('tbody');
  folderTable.appendChild(tbody);
  folder.appendChild(folderTable);

  // Add 2 file rows to folder
  for (let i = 1; i <= 2; i++) {
    const tr = doc.createElement('tr');
    const tdThumb = doc.createElement('td');
    tdThumb.setAttribute('data-col', 'thumbnail');
    const tdTitle = doc.createElement('td');
    tdTitle.setAttribute('data-col', 'title');
    tdTitle.textContent = `Week ${i}.pdf`;
    const tdAction = doc.createElement('td');
    tdAction.setAttribute('data-col', 'action');
    const a = doc.createElement('a');
    a.setAttribute('href', `https://s3.aws.com/file_week${i}.pdf`);
    tdAction.appendChild(a);

    tr.appendChild(tdThumb);
    tr.appendChild(tdTitle);
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  }

  return { doc, section, folder, tbody };
}

function runSelectionTests() {
  const { doc, folder, tbody } = buildMockCoursePage();
  global.document = doc;
  global.window = {
    document: doc,
    MutationObserver: MockMutationObserver,
    addEventListener: () => {}
  };

  // Load content script module
  const MCV = require('../content.js');
  if (!MCV.initMCVDownloader) {
    throw new Error('MCV.initMCVDownloader is not exported');
  }

  MCV.initMCVDownloader();

  // Check folder checkbox exists
  const folderCb = folder.querySelector('.mcv-folder-checkbox');
  assert(folderCb !== null, 'Folder checkbox must be injected');

  // Check file checkboxes exist
  const fileCbs = tbody.querySelectorAll('.mcv-file-checkbox');
  assert(fileCbs.length === 2, `Expected 2 file checkboxes, got ${fileCbs.length}`);

  // Check floating bar exists
  const floatingBar = doc.querySelector('.mcv-floating-bar');
  assert(floatingBar !== null, 'Floating bar must be mounted');
  assert(!floatingBar.classList.contains('mcv-visible'), 'Floating bar initially hidden');

  // Test 1: Check folder checkbox -> should check all files
  folderCb.checked = true;
  folderCb.dispatchEvent({ type: 'change', target: folderCb });

  assert(fileCbs[0].checked === true, 'File 1 must be checked when folder checked');
  assert(fileCbs[1].checked === true, 'File 2 must be checked when folder checked');
  assert(floatingBar.classList.contains('mcv-visible'), 'Floating bar must be visible');
  
  const badge = floatingBar.querySelector('.mcv-badge');
  assert(badge.textContent.includes('2'), 'Badge must show 2 files selected');

  // Test 2: Uncheck one file -> folder checkbox becomes indeterminate
  fileCbs[0].checked = false;
  fileCbs[0].dispatchEvent({ type: 'change', target: fileCbs[0] });

  assert(folderCb.indeterminate === true, 'Folder checkbox must be indeterminate');
  assert(folderCb.checked === false, 'Folder checkbox must not be fully checked');
  assert(badge.textContent.includes('1'), 'Badge must show 1 file selected');

  // Test 3: Uncheck remaining file -> folder unchecked, floating bar hidden
  fileCbs[1].checked = false;
  fileCbs[1].dispatchEvent({ type: 'change', target: fileCbs[1] });

  assert(folderCb.indeterminate === false, 'Folder checkbox must not be indeterminate');
  assert(folderCb.checked === false, 'Folder checkbox must be unchecked');
  assert(!floatingBar.classList.contains('mcv-visible'), 'Floating bar must be hidden when 0 selected');

  // Test 4: "Select All" button in floating bar
  const selectAllBtn = floatingBar.querySelector('.mcv-btn-select-all');
  assert(selectAllBtn !== null, 'Select all button must exist');
  selectAllBtn.click();

  assert(fileCbs[0].checked === true, 'All files checked on Select All');
  assert(fileCbs[1].checked === true, 'All files checked on Select All');
  assert(folderCb.checked === true, 'Folder checked on Select All');

  // Test 5: "Deselect All" button
  const deselectAllBtn = floatingBar.querySelector('.mcv-btn-deselect-all');
  assert(deselectAllBtn !== null, 'Deselect all button must exist');
  deselectAllBtn.click();

  assert(fileCbs[0].checked === false, 'All files unchecked on Deselect All');
  assert(fileCbs[1].checked === false, 'All files unchecked on Deselect All');
  assert(folderCb.checked === false, 'Folder unchecked on Deselect All');

  console.log('✅ Selection and tri-state hierarchy tests passed!');
}

try {
  runSelectionTests();
} catch (err) {
  console.error('❌ Selection test failed:', err.message);
  process.exit(1);
}
