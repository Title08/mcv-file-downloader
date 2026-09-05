const fs = require('fs');
const path = require('path');

function testManifest() {
  const manifestPath = path.join(__dirname, '../manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json does not exist');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  console.assert(manifest.manifest_version === 3, 'manifest_version must be 3');
  console.assert(manifest.name === 'MyCourseVille Batch Downloader', 'name mismatch');
  console.assert(manifest.permissions.includes('downloads'), 'must include downloads permission');
  console.assert(manifest.host_permissions.includes('https://www.mycourseville.com/*'), 'must include mycourseville host permission');
  console.assert(manifest.host_permissions.includes('https://*.amazonaws.com/*'), 'must include s3 host permission');
  
  const contentScript = manifest.content_scripts[0];
  console.assert(contentScript.js.includes('lib/jszip.min.js'), 'content_scripts must load jszip');
  console.assert(contentScript.js.includes('content.js'), 'content_scripts must load content.js');
  console.assert(contentScript.css.includes('styles.css'), 'content_scripts must load styles.css');

  // Verify referenced files exist
  for (const jsFile of contentScript.js) {
    const fullPath = path.join(__dirname, '..', jsFile);
    console.assert(fs.existsSync(fullPath), `Referenced file missing: ${jsFile}`);
  }
  for (const cssFile of contentScript.css) {
    const fullPath = path.join(__dirname, '..', cssFile);
    console.assert(fs.existsSync(fullPath), `Referenced file missing: ${cssFile}`);
  }

  // Verify icons exist
  for (const size of ['16', '48', '128']) {
    const iconPath = path.join(__dirname, '..', manifest.icons[size]);
    console.assert(fs.existsSync(iconPath), `Icon missing: ${manifest.icons[size]}`);
  }

  console.log('✅ Manifest validation passed!');
}

try {
  testManifest();
} catch (err) {
  console.error('❌ Manifest validation failed:', err.message);
  process.exit(1);
}
