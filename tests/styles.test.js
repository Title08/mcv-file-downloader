const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function testStyles() {
  const cssPath = path.join(__dirname, '../styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  const requiredClasses = [
    '.mcv-checkbox',
    '.mcv-folder-checkbox',
    '.mcv-file-checkbox',
    '.mcv-floating-bar',
    '.mcv-badge',
    '.mcv-btn',
    '.mcv-btn-primary',
    '.mcv-progress-modal',
    '.mcv-progress-bar',
    '.mcv-progress-fill'
  ];

  for (const cls of requiredClasses) {
    assert(css.includes(cls), `Missing required CSS selector: ${cls}`);
  }

  console.log('✅ Styles validation passed!');
}

try {
  testStyles();
} catch (err) {
  console.error('❌ Styles validation failed:', err.message);
  process.exit(1);
}
