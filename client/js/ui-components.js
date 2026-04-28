// ═══════════════════════════════════════════
// RestoSuite — Custom UI components
//
// Replaces native form controls with styled, accessible vanilla-JS
// components matching the design system (navy / orange / cream, 6px
// inputs, Outfit body, no heavy shadows).
//
// Usage:
//   - Auto-enhance any element with `data-ui="custom"` (or "toggle" for
//     a switch-style checkbox). The MutationObserver picks up nodes
//     added later, so views can keep rendering plain HTML.
//   - Manual: UI.select(el), UI.numberInput(el), …
//
// All enhancers are idempotent — calling them twice on the same node
// is a no-op. The original <select>/<input> stays in the DOM and
// continues to drive form submission and `change` events, so existing
// view code (`document.getElementById('po-supplier').value`) keeps
// working unchanged.
// ═══════════════════════════════════════════
(function () {
  'use strict';

  const ENHANCED = '__uiEnhanced';

  function uid(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 9);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ─────────────────────────────────────────────────────────────────
  // Custom Select
  // ─────────────────────────────────────────────────────────────────
  function enhanceSelect(sel) {
    if (!(sel instanceof HTMLSelectElement) || sel[ENHANCED]) return;
    sel[ENHANCED] = true;

    const wrap = document.createElement('div');
    wrap.className = 'ui-select';
    if (sel.disabled) wrap.classList.add('is-disabled');
    if (sel.classList.contains('form-control--error')) wrap.classList.add('is-error');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'ui-select__trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    if (sel.disabled) trigger.disabled = true;
    if (sel.id) {
      const lbl = document.querySelector(`label[for="${sel.id}"]`);
      if (lbl) trigger.setAttribute('aria-labelledby', lbl.id || (lbl.id = uid('ui-lbl')));
    }
    if (sel.getAttribute('aria-label')) trigger.setAttribute('aria-label', sel.getAttribute('aria-label'));
    if (sel.required) trigger.setAttribute('aria-required', 'true');

    const valueEl = document.createElement('span');
    valueEl.className = 'ui-select__value';
    const chevron = document.createElement('span');
    chevron.className = 'ui-select__chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    trigger.appendChild(valueEl);
    trigger.appendChild(chevron);

    const dropdown = document.createElement('div');
    dropdown.className = 'ui-select__dropdown';
    dropdown.setAttribute('role', 'listbox');
    const listId = uid('ui-list');
    dropdown.id = listId;
    trigger.setAttribute('aria-controls', listId);

    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(trigger);
    wrap.appendChild(dropdown);
    wrap.appendChild(sel);
    sel.classList.add('ui-select__native');

    function rebuild() {
      dropdown.innerHTML = '';
      Array.from(sel.children).forEach(child => {
        if (child.tagName === 'OPTGROUP') {
          const grp = document.createElement('div');
          grp.className = 'ui-select__group';
          grp.textContent = child.label;
          dropdown.appendChild(grp);
          Array.from(child.children).forEach(opt => addOption(opt, true));
        } else if (child.tagName === 'OPTION') {
          addOption(child, false);
        }
      });
      syncValue();
    }

    function addOption(opt, indented) {
      const item = document.createElement('div');
      item.className = 'ui-select__option';
      if (indented) item.classList.add('ui-select__option--indented');
      if (opt.disabled) item.classList.add('is-disabled');
      item.setAttribute('role', 'option');
      item.setAttribute('data-value', opt.value);
      item.textContent = opt.textContent;
      if (opt.disabled) item.setAttribute('aria-disabled', 'true');
      dropdown.appendChild(item);
    }

    function syncValue() {
      const opt = sel.options[sel.selectedIndex];
      const text = opt ? opt.textContent : '';
      const isPlaceholder = !opt || opt.value === '';
      valueEl.textContent = text || sel.getAttribute('data-placeholder') || ' ';
      valueEl.classList.toggle('is-placeholder', isPlaceholder);
      dropdown.querySelectorAll('.ui-select__option').forEach(item => {
        const match = item.getAttribute('data-value') === sel.value;
        item.classList.toggle('is-selected', match);
        if (match) item.setAttribute('aria-selected', 'true');
        else item.removeAttribute('aria-selected');
      });
    }

    let isOpen = false;
    let highlightIdx = -1;
    let typeBuffer = '';
    let typeTimer = null;

    function options() {
      return Array.from(dropdown.querySelectorAll('.ui-select__option:not(.is-disabled)'));
    }

    function setHighlight(i) {
      const opts = options();
      if (!opts.length) return;
      highlightIdx = (i + opts.length) % opts.length;
      opts.forEach((o, idx) => o.classList.toggle('is-active', idx === highlightIdx));
      const target = opts[highlightIdx];
      if (target) {
        const r = target.getBoundingClientRect();
        const dr = dropdown.getBoundingClientRect();
        if (r.bottom > dr.bottom) target.scrollIntoView({ block: 'end' });
        else if (r.top < dr.top) target.scrollIntoView({ block: 'start' });
      }
    }

    function open() {
      if (isOpen || sel.disabled) return;
      isOpen = true;
      wrap.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      // position dropdown above if no room below
      const r = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      wrap.classList.toggle('is-drop-up', spaceBelow < 200 && spaceAbove > spaceBelow);
      const opts = options();
      const sel0 = opts.findIndex(o => o.classList.contains('is-selected'));
      setHighlight(sel0 >= 0 ? sel0 : 0);
      document.addEventListener('mousedown', onDocClick, true);
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      wrap.classList.remove('is-open', 'is-drop-up');
      trigger.setAttribute('aria-expanded', 'false');
      options().forEach(o => o.classList.remove('is-active'));
      document.removeEventListener('mousedown', onDocClick, true);
    }

    function onDocClick(e) {
      if (!wrap.contains(e.target)) close();
    }

    function selectByValue(v) {
      if (sel.value === v) { close(); return; }
      sel.value = v;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      syncValue();
      close();
      trigger.focus();
    }

    trigger.addEventListener('click', () => { isOpen ? close() : open(); });
    trigger.addEventListener('keydown', (e) => {
      if (sel.disabled) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) open();
        else setHighlight(highlightIdx + (e.key === 'ArrowDown' ? 1 : -1));
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (!isOpen) {
          e.preventDefault();
          open();
        } else {
          e.preventDefault();
          const opts = options();
          if (opts[highlightIdx]) selectByValue(opts[highlightIdx].getAttribute('data-value'));
        }
      } else if (e.key === 'Escape') {
        if (isOpen) { e.preventDefault(); close(); }
      } else if (e.key === 'Tab') {
        close();
      } else if (e.key === 'Home') {
        if (isOpen) { e.preventDefault(); setHighlight(0); }
      } else if (e.key === 'End') {
        if (isOpen) { e.preventDefault(); setHighlight(options().length - 1); }
      } else if (e.key.length === 1) {
        // type-to-search
        typeBuffer += e.key.toLowerCase();
        if (typeTimer) clearTimeout(typeTimer);
        typeTimer = setTimeout(() => { typeBuffer = ''; }, 600);
        const opts = options();
        const start = isOpen ? highlightIdx + 1 : 0;
        for (let i = 0; i < opts.length; i++) {
          const idx = (start + i) % opts.length;
          if (opts[idx].textContent.toLowerCase().startsWith(typeBuffer)) {
            if (!isOpen) open();
            setHighlight(idx);
            break;
          }
        }
      }
    });

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.ui-select__option');
      if (!item || item.classList.contains('is-disabled')) return;
      selectByValue(item.getAttribute('data-value'));
    });
    dropdown.addEventListener('mousemove', (e) => {
      const item = e.target.closest('.ui-select__option');
      if (!item) return;
      const idx = options().indexOf(item);
      if (idx >= 0 && idx !== highlightIdx) setHighlight(idx);
    });

    // React to programmatic changes (.value = …, options replaced)
    sel.addEventListener('change', syncValue);
    const mo = new MutationObserver(rebuild);
    mo.observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'value'] });

    rebuild();
  }

  // ─────────────────────────────────────────────────────────────────
  // Custom Number Input (with -/+ buttons)
  // ─────────────────────────────────────────────────────────────────
  function enhanceNumber(input) {
    if (!(input instanceof HTMLInputElement) || input[ENHANCED]) return;
    if (input.type !== 'number') return;
    input[ENHANCED] = true;

    const wrap = document.createElement('div');
    wrap.className = 'ui-number';
    if (input.disabled) wrap.classList.add('is-disabled');

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'ui-number__btn ui-number__btn--minus';
    minus.setAttribute('aria-label', 'Diminuer');
    minus.tabIndex = -1;
    minus.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'ui-number__btn ui-number__btn--plus';
    plus.setAttribute('aria-label', 'Augmenter');
    plus.tabIndex = -1;
    plus.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(minus);
    wrap.appendChild(input);
    wrap.appendChild(plus);
    input.classList.add('ui-number__input');

    function step(dir) {
      if (input.disabled || input.readOnly) return;
      const stepVal = parseFloat(input.step) || 1;
      const min = input.min !== '' ? parseFloat(input.min) : -Infinity;
      const max = input.max !== '' ? parseFloat(input.max) : Infinity;
      const cur = parseFloat(input.value);
      const base = isNaN(cur) ? (input.min !== '' ? parseFloat(input.min) : 0) : cur;
      let next = base + dir * stepVal;
      // Round to step precision to avoid 0.1 + 0.2 = 0.30000000000000004
      const decimals = (String(stepVal).split('.')[1] || '').length;
      if (decimals) next = parseFloat(next.toFixed(decimals));
      next = Math.min(max, Math.max(min, next));
      input.value = next;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    minus.addEventListener('click', () => step(-1));
    plus.addEventListener('click', () => step(+1));
    minus.addEventListener('contextmenu', (e) => e.preventDefault());
    plus.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ─────────────────────────────────────────────────────────────────
  // Text input — adds focus/error class hooks + optional floating label
  // ─────────────────────────────────────────────────────────────────
  function enhanceTextInput(input) {
    if (!(input instanceof HTMLInputElement) || input[ENHANCED]) return;
    const t = input.type;
    if (t !== 'text' && t !== 'email' && t !== 'tel' && t !== 'url' && t !== 'search' && t !== 'password') return;
    input[ENHANCED] = true;
    input.classList.add('ui-input');

    // Floating label: opt-in via data-float-label OR a wrapping .ui-field--float
    const floatField = input.closest('.ui-field--float');
    if (input.hasAttribute('data-float-label') || floatField) {
      let field = floatField;
      if (!field) {
        field = document.createElement('label');
        field.className = 'ui-field ui-field--float';
        const text = input.getAttribute('data-float-label') || input.placeholder || '';
        input.removeAttribute('data-float-label');
        input.parentNode.insertBefore(field, input);
        field.appendChild(input);
        const span = document.createElement('span');
        span.className = 'ui-field__label';
        span.textContent = text;
        field.appendChild(span);
        if (!input.placeholder) input.placeholder = ' ';
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Textarea — auto-grow if data-autogrow
  // ─────────────────────────────────────────────────────────────────
  function enhanceTextarea(ta) {
    if (!(ta instanceof HTMLTextAreaElement) || ta[ENHANCED]) return;
    ta[ENHANCED] = true;
    ta.classList.add('ui-textarea');

    if (ta.hasAttribute('data-autogrow')) {
      const grow = () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight + 2, 400) + 'px';
      };
      ta.addEventListener('input', grow);
      // run after layout
      requestAnimationFrame(grow);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Custom Checkbox / Radio
  // ─────────────────────────────────────────────────────────────────
  function enhanceCheckOrRadio(input) {
    if (!(input instanceof HTMLInputElement) || input[ENHANCED]) return;
    if (input.type !== 'checkbox' && input.type !== 'radio') return;
    input[ENHANCED] = true;

    const isToggle = input.getAttribute('data-ui') === 'toggle';
    if (isToggle) {
      // Switch / toggle styling
      input.classList.add('ui-switch__input');
      const wrap = ensureWrap(input, 'label', 'ui-switch');
      const slider = document.createElement('span');
      slider.className = 'ui-switch__slider';
      slider.setAttribute('aria-hidden', 'true');
      input.after(slider);
      // If label text follows, give it the correct class
      const next = slider.nextSibling;
      if (next && next.nodeType === 3 && next.textContent.trim()) {
        const span = document.createElement('span');
        span.className = 'ui-switch__label';
        span.textContent = next.textContent.trim();
        next.parentNode.replaceChild(span, next);
      }
      return;
    }

    const cls = input.type === 'checkbox' ? 'ui-checkbox' : 'ui-radio';
    input.classList.add(cls + '__input');
    const wrap = ensureWrap(input, 'label', cls);
    const mark = document.createElement('span');
    mark.className = cls + '__mark';
    mark.setAttribute('aria-hidden', 'true');
    if (input.type === 'checkbox') {
      mark.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    }
    input.after(mark);

    // If a bare text node follows, wrap it as a label span
    const next = mark.nextSibling;
    if (next && next.nodeType === 3 && next.textContent.trim()) {
      const span = document.createElement('span');
      span.className = cls + '__label';
      span.textContent = next.textContent.trim();
      next.parentNode.replaceChild(span, next);
    }
  }

  // If the input is already inside a <label>, reuse it; otherwise wrap it.
  function ensureWrap(input, tag, cls) {
    const parentLabel = input.closest('label');
    if (parentLabel && !parentLabel.classList.contains('ui-field') && !parentLabel.classList.contains('ui-field--float')) {
      parentLabel.classList.add(cls);
      return parentLabel;
    }
    const wrap = document.createElement(tag);
    wrap.className = cls;
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    return wrap;
  }

  // ─────────────────────────────────────────────────────────────────
  // Auto-enhance scanner
  // ─────────────────────────────────────────────────────────────────
  function enhance(node) {
    if (!node || !(node instanceof HTMLElement)) return;
    // Direct hits
    if (node.matches && node.matches('[data-ui]')) dispatch(node);
    // Descendants
    if (node.querySelectorAll) {
      node.querySelectorAll('[data-ui]').forEach(dispatch);
    }
  }

  function dispatch(el) {
    const kind = el.getAttribute('data-ui');
    if (el.tagName === 'SELECT') return enhanceSelect(el);
    if (el.tagName === 'TEXTAREA') return enhanceTextarea(el);
    if (el.tagName === 'INPUT') {
      const t = el.type;
      if (t === 'number') return enhanceNumber(el);
      if (t === 'checkbox' || t === 'radio') return enhanceCheckOrRadio(el);
      return enhanceTextInput(el);
    }
  }

  // Public API
  const UI = {
    enhance: (root) => enhance(root || document.body),
    select: enhanceSelect,
    numberInput: enhanceNumber,
    textInput: enhanceTextInput,
    textarea: enhanceTextarea,
    checkbox: enhanceCheckOrRadio,
    radio: enhanceCheckOrRadio,
    toggle: enhanceCheckOrRadio,
  };
  window.UI = UI;

  // Initial sweep + observe future inserts
  function boot() {
    enhance(document.body);
    if (typeof MutationObserver === 'undefined') return;
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes && m.addedNodes.forEach((n) => {
          if (n instanceof HTMLElement) enhance(n);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
