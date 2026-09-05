// Lightweight DOM mock for testing extension without external dependencies

class ClassList {
  constructor(el) {
    this.el = el;
    this._classes = new Set();
  }
  add(...names) {
    names.forEach(n => this._classes.add(n));
    this.el.className = Array.from(this._classes).join(' ');
  }
  remove(...names) {
    names.forEach(n => this._classes.delete(n));
    this.el.className = Array.from(this._classes).join(' ');
  }
  contains(name) {
    return this._classes.has(name);
  }
}

class MockElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.classList = new ClassList(this);
    this._className = '';
    this.children = [];
    this.parentElement = null;
    this.attributes = {};
    this.style = {};
    this.dataset = {};
    this.textContent = '';
    this._innerHTML = '';
    this.listeners = {};
    this.checked = false;
    this.indeterminate = false;
    this.type = '';
    this.id = '';
  }

  get className() {
    return this._className || '';
  }

  set className(val) {
    this._className = String(val);
    this.attributes['class'] = this._className;
    this.classList._classes = new Set(this._className.split(/\s+/).filter(Boolean));
  }


  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = val;
    // basic text extraction
    this.textContent = val.replace(/<[^>]*>/g, '');
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
    if (name === 'id') this.id = String(val);
    if (name === 'class') {
      this.className = String(val);
      this.classList._classes = new Set(this.className.split(/\s+/).filter(Boolean));
    }
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  hasAttribute(name) {
    return name in this.attributes;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  prepend(child) {
    child.parentElement = this;
    this.children.unshift(child);
    return child;
  }

  insertBefore(child, ref) {
    child.parentElement = this;
    const idx = this.children.indexOf(ref);
    if (idx === -1) {
      this.children.push(child);
    } else {
      this.children.splice(idx, 0, child);
    }
    return child;
  }

  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) {
        this.parentElement.children.splice(idx, 1);
      }
      this.parentElement = null;
    }
  }

  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  dispatchEvent(evt) {
    evt.target = this;
    const list = this.listeners[evt.type] || [];
    for (const fn of list) {
      fn(evt);
    }
    return true;
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this, stopPropagation: () => {} });
  }

  matches(sel) {
    // Handle :checked
    if (sel.endsWith(':checked')) {
      const baseSel = sel.slice(0, -8);
      if (baseSel && !this.matches(baseSel)) return false;
      return this.checked === true;
    }

    // Handle compound tag.class (e.g. table.cv-course-home-material-table)
    if (sel.includes('.')) {
      const [tag, ...classes] = sel.split('.');
      if (tag && this.tagName.toLowerCase() !== tag.toLowerCase()) return false;
      for (const cls of classes) {
        if (!this.classList.contains(cls)) return false;
      }
      return true;
    }

    if (sel.startsWith('#')) {
      return this.id === sel.slice(1);
    }
    if (sel.includes('[')) {
      const match = sel.match(/^([a-zA-Z0-9_-]+)?\[([a-zA-Z0-9_-]+)(?:="([^"]+)")?\]$/);
      if (match) {
        const [_, tag, attr, val] = match;
        if (tag && this.tagName.toLowerCase() !== tag.toLowerCase()) return false;
        if (!(attr in this.attributes)) return false;
        if (val !== undefined && this.attributes[attr] !== val) return false;
        return true;
      }
    }
    return this.tagName.toLowerCase() === sel.toLowerCase();
  }


  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    const parts = sel.trim().split(/\s+/);
    if (parts.length === 1) {
      const results = [];
      const check = (node) => {
        for (const child of node.children) {
          if (child.matches(parts[0])) {
            results.push(child);
          }
          check(child);
        }
      };
      check(this);
      return results;
    }

    // Multi-part descendant selector (e.g. "table tbody tr")
    let currentNodes = [this];
    for (const part of parts) {
      const nextNodes = [];
      for (const node of currentNodes) {
        const check = (n) => {
          for (const child of n.children) {
            if (child.matches(part)) {
              nextNodes.push(child);
            }
            check(child);
          }
        };
        check(node);
      }
      currentNodes = nextNodes;
    }
    return currentNodes;
  }


  closest(sel) {
    let curr = this;
    while (curr) {
      if (curr.matches(sel)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }
}

class MockDocument {
  constructor() {
    this.body = new MockElement('body');
  }

  createElement(tag) {
    return new MockElement(tag);
  }

  getElementById(id) {
    const check = (node) => {
      if (node.id === id) return node;
      for (const child of node.children) {
        const found = check(child);
        if (found) return found;
      }
      return null;
    };
    return check(this.body);
  }

  querySelector(sel) {
    return this.body.querySelector(sel);
  }

  querySelectorAll(sel) {
    return this.body.querySelectorAll(sel);
  }
}

class MockMutationObserver {
  constructor(cb) {
    this.cb = cb;
  }
  observe() {}
  disconnect() {}
}

module.exports = {
  MockElement,
  MockDocument,
  MockMutationObserver
};
