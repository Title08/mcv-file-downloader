const path = require('path');
const fs = require('fs');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Load JSZip
const JSZip = require('../lib/jszip.min.js');

// Load content script module
const MCV = require('../content.js');

async function testSanitizeName() {
  const dirty = 'Lecture 1: Intro / Overview * 2026? <Test> | "Quotes"';
  const clean = MCV.sanitizeName(dirty);
  assert(!/[\\/:*?"<>|]/.test(clean), `Clean name must not contain invalid chars: ${clean}`);
  assert(clean.includes('Intro _ Overview'), 'Characters should be replaced cleanly');
  console.log('  ✔ sanitizeName passed');
}

async function testDownloadQueueConcurrency() {
  let activeCount = 0;
  let maxActiveObserved = 0;

  const mockTasks = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    url: `https://fake.url/file${i + 1}.pdf`,
    filename: `file${i + 1}.pdf`,
    folder: 'TestFolder'
  }));

  const mockFetcher = async (item) => {
    activeCount++;
    maxActiveObserved = Math.max(maxActiveObserved, activeCount);
    // simulate network latency
    await new Promise(res => setTimeout(res, 20));
    activeCount--;
    return {
      item,
      data: Buffer.from(`Content of ${item.filename}`),
      success: true
    };
  };

  const progressUpdates = [];
  const results = await MCV.downloadQueue(mockTasks, 3, mockFetcher, (current, total, item) => {
    progressUpdates.push({ current, total, item });
  });

  assert(results.length === 8, 'All 8 tasks should complete');
  assert(maxActiveObserved <= 3, `Max active concurrency should be <= 3, got ${maxActiveObserved}`);
  assert(progressUpdates.length === 8, 'Progress callback should be called for each task');
  console.log('  ✔ downloadQueue concurrency passed (max active:', maxActiveObserved, ')');
}

async function testFetchWithRetry() {
  let attempts = 0;
  const mockFetchFlaky = async () => {
    attempts++;
    if (attempts < 2) {
      throw new Error('Network timeout');
    }
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(8)
    };
  };

  const res = await MCV.fetchWithRetry('https://fake.url/flaky.pdf', 2, mockFetchFlaky);
  assert(attempts === 2, `Should have retried once, total attempts: ${attempts}`);
  assert(res !== null, 'Should succeed on second attempt');
  console.log('  ✔ fetchWithRetry passed');
}

async function testZipArchiveCreation() {
  const mockDownloadedItems = [
    {
      item: { filename: 'slides1.pdf', folder: 'Lecture Slides' },
      data: Buffer.from('PDF 1 Content'),
      success: true
    },
    {
      item: { filename: 'syllabus.pdf', folder: '' },
      data: Buffer.from('Syllabus Content'),
      success: true
    }
  ];

  const zip = await MCV.buildZip(mockDownloadedItems, JSZip);
  const filesInZip = Object.keys(zip.files);

  assert(filesInZip.some(f => f.includes('Lecture Slides/slides1.pdf')), 'Should contain nested folder file');
  assert(filesInZip.some(f => f === 'syllabus.pdf'), 'Should contain root file');
  console.log('  ✔ buildZip archive passed (files in zip:', filesInZip.filter(f => !f.endsWith('/')).join(', '), ')');
}

async function runAll() {
  console.log('Running downloader engine tests...');
  await testSanitizeName();
  await testDownloadQueueConcurrency();
  await testFetchWithRetry();
  await testZipArchiveCreation();
  console.log('✅ All downloader engine tests passed!');
}

runAll().catch(err => {
  console.error('❌ Downloader test failed:', err);
  process.exit(1);
});
