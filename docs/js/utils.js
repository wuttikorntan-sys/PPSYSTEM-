/**
 * PPPLUSH — DOM utilities, formatters, toast, modal, loader
 */
(function () {
  'use strict';

  /* DOM */
  window.$ = function (sel, root) { return (root || document).querySelector(sel); };
  window.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  window.el = function (tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') n.className = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
        else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2).toLowerCase(), v);
        else n.setAttribute(k, v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      if (typeof c === 'string' || typeof c === 'number') n.appendChild(document.createTextNode(String(c)));
      else n.appendChild(c);
    });
    return n;
  };

  window.esc = function (s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  };

  window.fmtDate = function (d, withTime) {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      const Y = dt.getFullYear();
      const M = ('0' + (dt.getMonth() + 1)).slice(-2);
      const D = ('0' + dt.getDate()).slice(-2);
      if (!withTime) return Y + '-' + M + '-' + D;
      const H = ('0' + dt.getHours()).slice(-2);
      const m = ('0' + dt.getMinutes()).slice(-2);
      return Y + '-' + M + '-' + D + ' ' + H + ':' + m;
    } catch (e) { return String(d); }
  };

  window.todayIso = function () {
    const d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  };

  window.isUrgent = function (v) { return v === true || String(v).toLowerCase() === 'true'; };
  window.isTrue = function (v) { return v === true || String(v).toLowerCase() === 'true'; };

  window.debounce = function (fn, ms) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  };

  window.initials = function (name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  /* Toast */
  window.toast = function (message, kind) {
    const c = $('#toasts');
    const t = el('div', { class: 'toast ' + (kind || 'info') }, [
      el('div', { class: 'toast-icon', html: icon(kind === 'success' ? 'check-circle' : kind === 'error' ? 'alert' : 'bell') }),
      el('div', { class: 'flex-1' }, [String(message)])
    ]);
    c.appendChild(t);
    setTimeout(function () {
      t.style.opacity = '0';
      t.style.transform = 'translateX(20px)';
      t.style.transition = 'all 200ms';
      setTimeout(function () { t.remove(); }, 200);
    }, 3500);
  };

  /* Loader */
  window.showLoader = function () { $('#loader').classList.remove('hidden'); };
  window.hideLoader = function () { $('#loader').classList.add('hidden'); };
  window.withLoader = async function (p) { showLoader(); try { return await p; } finally { hideLoader(); } };

  /* Modal */
  window.modal = function (opts) {
    const backdrop = el('div', { class: 'modal-backdrop' });
    const m = el('div', { class: 'modal ' + (opts.size === 'lg' ? 'modal-lg' : '') }, [
      el('div', { class: 'modal-header' }, [
        el('div', { class: 'modal-title' }, [opts.title || '']),
        el('button', { class: 'icon-btn', onClick: function () { backdrop.remove(); }, html: icon('x') })
      ]),
      el('div', { class: 'modal-body' }, [opts.body || '']),
      opts.actions ? el('div', { class: 'modal-footer' }, opts.actions.map(function (a) {
        return el('button', {
          class: 'btn ' + (a.class || 'btn-secondary'),
          onClick: async function () {
            try {
              const r = a.onClick && await a.onClick();
              if (r !== false) backdrop.remove();
            } catch (e) { toast(e.message, 'error'); }
          }
        }, [a.label]);
      })) : null
    ]);
    backdrop.appendChild(m);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) backdrop.remove(); });
    $('#modals').appendChild(backdrop);
    return backdrop;
  };

  window.confirmModal = function (title, message, onConfirm, opts) {
    opts = opts || {};
    return modal({
      title: title,
      body: el('p', { class: 'text-muted' }, [message]),
      actions: [
        { label: 'ยกเลิก', class: 'btn-secondary' },
        { label: opts.confirmLabel || 'ยืนยัน', class: opts.danger ? 'btn-danger' : 'btn-primary', onClick: onConfirm }
      ]
    });
  };

  /* Empty state */
  window.emptyState = function (title, text, iconName) {
    return el('div', { class: 'empty' }, [
      el('div', { class: 'empty-icon', html: icon(iconName || 'package', { size: 28 }) }),
      el('div', { class: 'empty-title' }, [title || 'ไม่มีข้อมูล']),
      text ? el('div', { class: 'empty-text' }, [text]) : null
    ]);
  };

  /* Animated count-up for stat values. Triggered on element insertion. */
  window.countUp = function (target, finalValue, duration) {
    const end = Number(finalValue) || 0;
    if (end === 0) { target.textContent = '0'; return; }
    const dur = duration || 800;
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(end * eased);
      target.textContent = v.toLocaleString('en-US');
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  /* Mouse-tracking radial highlight on buttons (sets --rx/--ry CSS vars) */
  document.addEventListener('mousemove', function (e) {
    const t = e.target.closest('.btn');
    if (!t) return;
    const rect = t.getBoundingClientRect();
    t.style.setProperty('--rx', ((e.clientX - rect.left) / rect.width * 100) + '%');
    t.style.setProperty('--ry', ((e.clientY - rect.top) / rect.height * 100) + '%');
  });

  /* Ripple effect on button click */
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.btn');
    if (!btn || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    const r = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    r.style.cssText =
      'position:absolute;border-radius:50%;background:rgba(255,255,255,0.5);' +
      'pointer-events:none;width:' + size + 'px;height:' + size + 'px;' +
      'left:' + (e.clientX - rect.left - size / 2) + 'px;' +
      'top:' + (e.clientY - rect.top - size / 2) + 'px;' +
      'transform:scale(0);opacity:1;' +
      'animation:rippleAnim 600ms cubic-bezier(0.4,0,0.2,1) forwards;';
    btn.appendChild(r);
    setTimeout(function () { r.remove(); }, 650);
  });

  /* Inject ripple keyframe (only once) */
  if (!document.getElementById('pp-ripple-style')) {
    const s = document.createElement('style');
    s.id = 'pp-ripple-style';
    s.textContent = '@keyframes rippleAnim { to { transform: scale(2.5); opacity: 0; } }';
    document.head.appendChild(s);
  }
})();
