/**
 * PPPLUSH — App router + state + page renderers
 */
(function () {
  'use strict';

  const AppState = window.AppState = {
    token: localStorage.getItem('pp_token') || '',
    user: JSON.parse(localStorage.getItem('pp_user') || 'null'),
    sidebarOpen: false
  };

  function saveSession(token, user) {
    AppState.token = token; AppState.user = user;
    if (token) localStorage.setItem('pp_token', token);
    else localStorage.removeItem('pp_token');
    if (user) localStorage.setItem('pp_user', JSON.stringify(user));
    else localStorage.removeItem('pp_user');
  }
  function clearSession() { saveSession('', null); }

  const role = function () { return AppState.user && AppState.user.role; };
  const isAdmin = function () { return role() === 'Admin'; };
  const isSupervisorPlus = function () { return role() === 'Admin' || role() === 'Supervisor'; };

  /* ====================================================================
     Routing
     ==================================================================== */
  function currentHash() { return location.hash || '#/dashboard'; }
  function navigate(h) { location.hash = h; }

  function getRoutes() {
    return [
      { match: /^#?\/?dashboard\/?$/, render: renderDashboard, title: 'Dashboard' },
      { match: /^#?\/?orders\/new\/?$/, render: renderOrderForm, title: 'สร้างใบงาน' },
      { match: /^#?\/?orders\/([^/]+)\/qc\/?$/, render: renderQC, title: 'QC' },
      { match: /^#?\/?orders\/([^/]+)\/?$/, render: renderOrderDetail, title: 'รายละเอียดใบงาน' },
      { match: /^#?\/?orders\/?$/, render: renderOrderList, title: 'ใบงาน' },
      { match: /^#?\/?preorders\/?$/, render: renderPreOrderList, title: 'Pre-Order' },
      { match: /^#?\/?customers\/?$/, render: renderCustomers, title: 'ลูกค้า' },
      { match: /^#?\/?products\/?$/, render: renderProducts, title: 'สินค้า / สี' },
      { match: /^#?\/?materials\/?$/, render: renderMaterials, title: 'วัตถุดิบ' },
      { match: /^#?\/?users\/?$/, render: renderUsers, title: 'ผู้ใช้', role: ['Admin'] },
      { match: /^#?\/?settings\/?$/, render: renderSettings, title: 'ตั้งค่า', role: ['Admin'] }
    ];
  }

  async function route() {
    // Setup required?
    if (!API.getUrl()) return renderSetup();
    // Not logged in
    if (!AppState.token || !AppState.user) return renderLogin();

    renderShell();

    const h = currentHash();
    const routes = getRoutes();
    for (let i = 0; i < routes.length; i++) {
      const m = h.match(routes[i].match);
      if (m) {
        if (routes[i].role && routes[i].role.indexOf(role()) < 0) {
          toast('สิทธิ์ไม่เพียงพอ', 'error');
          return navigate('#/dashboard');
        }
        setPageTitle(routes[i].title);
        highlightNav(h);
        const view = $('#view');
        view.innerHTML = '';
        try { await routes[i].render.apply(null, m.slice(1)); }
        catch (e) { console.error(e); showError(e); }
        return;
      }
    }
    navigate('#/dashboard');
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    if (AppState.token) {
      try {
        const u = await withLoader(API.getCurrentUser());
        AppState.user = u;
        localStorage.setItem('pp_user', JSON.stringify(u));
      } catch (e) {
        clearSession();
      }
    }
    if (!location.hash || location.hash === '#') location.hash = '#/dashboard';
    route();
  }

  function showError(e) {
    $('#view').appendChild(el('div', { class: 'card' }, [
      el('h3', {}, ['เกิดข้อผิดพลาด']),
      el('p', { class: 'text-muted' }, [e.message || String(e)])
    ]));
  }

  function setPageTitle(t) {
    const tb = $('.topbar .page-title');
    if (tb) tb.textContent = t || '';
    document.title = (t ? t + ' — ' : '') + window.APP_CONFIG.APP_NAME;
  }

  function highlightNav(h) {
    $$('#sidebar-nav .nav-item').forEach(function (a) { a.classList.remove('active'); });
    const base = h.split('/').slice(0, 2).join('/');
    const match = $$('#sidebar-nav .nav-item').find(function (a) {
      return a.getAttribute('data-base') === base || h.indexOf(a.getAttribute('data-base')) === 0;
    });
    if (match) match.classList.add('active');
  }

  /* ====================================================================
     Setup screen (first run — ask for Apps Script URL)
     ==================================================================== */
  function renderSetup() {
    const app = $('#app');
    app.innerHTML = '';
    const page = el('div', { class: 'login-page' });
    const card = el('div', { class: 'login-card', style: { maxWidth: '520px' } });
    card.innerHTML =
      '<div class="login-logo">⚙️</div>' +
      '<div class="login-title">ตั้งค่าระบบ</div>' +
      '<div class="login-subtitle">กรอก URL ของ Apps Script Web App (ลงท้ายด้วย /exec)</div>' +
      '<form id="setup-form">' +
        '<div class="field">' +
          '<label class="field-label">Apps Script Web App URL</label>' +
          '<input class="field-input" name="url" placeholder="https://script.google.com/macros/s/XXXX/exec" required>' +
          '<div class="field-help">หาได้จาก Apps Script editor → Deploy → Manage deployments</div>' +
        '</div>' +
        '<button class="btn btn-primary btn-lg btn-block" type="submit">ทดสอบเชื่อมต่อ &amp; บันทึก</button>' +
      '</form>';
    page.appendChild(card);
    app.appendChild(page);
    $('#setup-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const url = e.target.url.value.trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
        toast('URL ไม่ถูกต้อง ต้องลงท้ายด้วย /exec', 'error');
        return;
      }
      API.setUrl(url);
      try {
        await withLoader(API.ping());
        toast('เชื่อมต่อสำเร็จ', 'success');
        route();
      } catch (err) {
        toast('เชื่อมต่อไม่สำเร็จ: ' + err.message, 'error');
        localStorage.removeItem('pp_script_url');
      }
    });
  }

  /* ====================================================================
     Login
     ==================================================================== */
  function renderLogin() {
    const app = $('#app');
    app.innerHTML = '';
    const page = el('div', { class: 'login-page' });
    const card = el('div', { class: 'login-card' });
    card.innerHTML =
      '<div class="login-logo">🎨</div>' +
      '<div class="login-title">' + esc(window.APP_CONFIG.APP_NAME) + '</div>' +
      '<div class="login-subtitle">' + esc(window.APP_CONFIG.APP_TAGLINE) + '</div>' +
      '<form id="login-form">' +
        '<div class="field">' +
          '<label class="field-label">Username</label>' +
          '<div class="input-icon">' + icon('user') + '<input class="field-input" name="username" autofocus required></div>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field-label">Password</label>' +
          '<div class="input-icon">' + icon('lock') + '<input class="field-input" name="password" type="password" required></div>' +
        '</div>' +
        '<button class="btn btn-primary btn-lg btn-block" type="submit">เข้าสู่ระบบ</button>' +
      '</form>' +
      '<div class="text-center text-sm text-muted mt-6">' +
        '<a href="#" id="change-url">เปลี่ยน Apps Script URL</a>' +
      '</div>';
    page.appendChild(card);
    app.appendChild(page);

    $('#login-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const f = e.target;
      try {
        const res = await withLoader(API.login(f.username.value.trim(), f.password.value));
        saveSession(res.token, res.user);
        toast('ยินดีต้อนรับ ' + res.user.full_name, 'success');
        navigate('#/dashboard');
      } catch (err) {
        toast(err.message || 'เข้าระบบไม่สำเร็จ', 'error');
      }
    });
    $('#change-url').addEventListener('click', function (e) {
      e.preventDefault();
      localStorage.removeItem('pp_script_url');
      if (window.APP_CONFIG) window.APP_CONFIG.APPS_SCRIPT_URL = '';
      route();
    });
  }

  async function doLogout() {
    try { await API.logout(); } catch (e) {}
    clearSession();
    navigate('#/dashboard');
    route();
  }

  /* ====================================================================
     Shell (sidebar + topbar)
     ==================================================================== */
  function renderShell() {
    const app = $('#app');
    if ($('#sidebar', app) && $('#view', app)) return; // already rendered
    app.innerHTML = '';

    const navGroups = [
      {
        label: 'หลัก',
        items: [
          { href: '#/dashboard', icon: 'home', label: 'หน้าหลัก' },
          { href: '#/orders', icon: 'orders', label: 'ใบงาน' },
          { href: '#/orders/new', icon: 'plus', label: 'สร้างใบงาน' },
          { href: '#/preorders', icon: 'package', label: 'Pre-Order' }
        ]
      },
      {
        label: 'ข้อมูลหลัก',
        items: [
          { href: '#/customers', icon: 'building', label: 'ลูกค้า' },
          { href: '#/products', icon: 'palette', label: 'สินค้า / สี' },
          { href: '#/materials', icon: 'flask', label: 'วัตถุดิบ' }
        ]
      }
    ];
    if (isAdmin()) {
      navGroups.push({
        label: 'ระบบ',
        items: [
          { href: '#/users', icon: 'users', label: 'ผู้ใช้' },
          { href: '#/settings', icon: 'settings', label: 'ตั้งค่า' }
        ]
      });
    }

    const navHtml = navGroups.map(function (g) {
      return '<div class="sidebar-nav-section">' + esc(g.label) + '</div>' +
        g.items.map(function (it) {
          return '<a class="nav-item" href="' + esc(it.href) + '" data-base="' + esc(it.href) + '">' +
            icon(it.icon) + '<span>' + esc(it.label) + '</span></a>';
        }).join('');
    }).join('');

    const u = AppState.user;
    app.innerHTML =
      '<div class="sidebar" id="sidebar">' +
        '<div class="sidebar-brand">' +
          '<div class="logo">PP</div>' +
          '<div><div class="brand-text">' + esc(window.APP_CONFIG.APP_NAME) + '</div>' +
          '<div class="brand-tagline">Order System</div></div>' +
        '</div>' +
        '<div class="sidebar-nav" id="sidebar-nav">' + navHtml + '</div>' +
        '<div class="sidebar-footer">' +
          '<div class="user-card">' +
            '<div class="user-avatar">' + esc(initials(u.full_name || u.username)) + '</div>' +
            '<div class="user-info">' +
              '<div class="user-name">' + esc(u.full_name || u.username) + '</div>' +
              '<div class="user-role">' + esc(u.role) + '</div>' +
            '</div>' +
            '<button class="icon-btn" title="ออกจากระบบ" id="btn-logout">' + icon('logout') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="main">' +
        '<div class="topbar">' +
          '<button class="icon-btn menu-btn" id="btn-menu">' + icon('menu') + '</button>' +
          '<div class="page-title"></div>' +
          '<div class="topbar-actions">' +
            '<button class="icon-btn" id="btn-refresh" title="รีเฟรช">' + icon('refresh') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="content" id="view"></div>' +
      '</div>';

    $('#btn-logout').addEventListener('click', doLogout);
    $('#btn-menu').addEventListener('click', function () {
      $('#sidebar').classList.toggle('open');
      if ($('#sidebar').classList.contains('open')) {
        const bd = el('div', { class: 'sidebar-backdrop', onClick: function () { $('#sidebar').classList.remove('open'); bd.remove(); } });
        document.body.appendChild(bd);
      }
    });
    $('#btn-refresh').addEventListener('click', route);
    // collapse mobile sidebar on route change
    $$('#sidebar-nav .nav-item').forEach(function (a) {
      a.addEventListener('click', function () { $('#sidebar').classList.remove('open'); $$('.sidebar-backdrop').forEach(function (b) { b.remove(); }); });
    });
  }

  /* ====================================================================
     Dashboard
     ==================================================================== */
  async function renderDashboard() {
    const v = $('#view');
    v.appendChild(el('div', { class: 'page-head' }, [
      el('div', {}, [
        el('h1', {}, ['ภาพรวม']),
        el('div', { class: 'page-subtitle' }, ['สรุปสถานะออเดอร์และงานเร่งด่วน'])
      ]),
      el('a', { class: 'btn btn-primary', href: '#/orders/new', html: icon('plus') + '<span>สร้างใบงาน</span>' })
    ]));

    const [stats, dueToday] = await Promise.all([API.getDashboardStats(), API.getTodayDue()]);

    v.appendChild(statsGrid([
      { label: 'ทั้งหมด', value: stats.total, icon: 'orders', kind: '' },
      { label: 'งานด่วน', value: stats.urgent, icon: 'flame', kind: 'warn' },
      { label: 'ส่งวันนี้', value: stats.dueToday, icon: 'clock', kind: 'info' },
      { label: 'เลยกำหนด', value: stats.overdue, icon: 'alert', kind: 'danger' },
      { label: 'Pre-Order ค้าง', value: stats.pendingPreOrders, icon: 'package', kind: 'warn' }
    ]));

    // By status
    const statusCard = el('div', { class: 'card' });
    statusCard.appendChild(el('div', { class: 'card-header' }, [
      el('div', {}, [el('div', { class: 'card-title' }, ['สถานะงาน'])])
    ]));
    const statusGrid = el('div', { class: 'stats-grid' });
    Object.keys(stats.byStatus).forEach(function (k) {
      statusGrid.appendChild(el('div', { class: 'stat-tile' }, [
        el('div', { class: 'stat-icon', html: icon(statusIcon(k), { size: 20 }) }),
        el('div', { class: 'stat-content' }, [
          el('div', { class: 'stat-value' }, [String(stats.byStatus[k])]),
          el('div', { class: 'stat-label' }, [k])
        ])
      ]));
    });
    statusCard.appendChild(statusGrid);
    v.appendChild(statusCard);

    // Due today
    const dueCard = el('div', { class: 'card' });
    dueCard.appendChild(el('div', { class: 'card-header' }, [
      el('div', {}, [el('div', { class: 'card-title' }, ['งานต้องส่งวันนี้'])]),
      el('a', { class: 'btn btn-ghost btn-sm', href: '#/orders' }, ['ดูทั้งหมด', el('span', { html: icon('arrow-right', { size: 14 }) })])
    ]));
    if (!dueToday.length) dueCard.appendChild(emptyState('ไม่มีงานต้องส่งวันนี้', '', 'check-circle'));
    else dueCard.appendChild(orderTable(dueToday));
    v.appendChild(dueCard);
  }

  function statusIcon(s) {
    return {
      'DRAFT': 'edit',
      'WAITING_MATERIAL': 'package',
      'IN_PRODUCTION': 'flask',
      'QC': 'beaker',
      'READY': 'check-circle',
      'DELIVERED': 'truck',
      'CANCELLED': 'x'
    }[s] || 'orders';
  }

  function statsGrid(tiles) {
    const g = el('div', { class: 'stats-grid' });
    tiles.forEach(function (t) {
      g.appendChild(el('div', { class: 'stat-tile ' + (t.kind || '') }, [
        el('div', { class: 'stat-icon', html: icon(t.icon, { size: 20 }) }),
        el('div', { class: 'stat-content' }, [
          el('div', { class: 'stat-value' }, [String(t.value)]),
          el('div', { class: 'stat-label' }, [t.label])
        ])
      ]));
    });
    return g;
  }

  /* ====================================================================
     Order List
     ==================================================================== */
  async function renderOrderList() {
    const v = $('#view');
    v.appendChild(el('div', { class: 'page-head' }, [
      el('div', {}, [el('h1', {}, ['ใบงานทั้งหมด']), el('div', { class: 'page-subtitle' }, ['จัดการและติดตามใบงาน'])]),
      el('a', { class: 'btn btn-primary', href: '#/orders/new', html: icon('plus') + '<span>สร้างใบงาน</span>' })
    ]));

    const toolbar = el('div', { class: 'toolbar' });
    toolbar.innerHTML =
      '<div class="input-icon">' + icon('search') + '<input class="field-input" id="q" placeholder="ค้นหาเลขใบงาน..."></div>' +
      '<select class="field-select" id="fstatus">' +
        '<option value="">ทุกสถานะ</option>' +
        ['DRAFT','WAITING_MATERIAL','IN_PRODUCTION','QC','READY','DELIVERED','CANCELLED']
          .map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('') +
      '</select>';
    v.appendChild(toolbar);

    const card = el('div', { class: 'card', style: { padding: '0' } });
    v.appendChild(card);

    async function reload() {
      const filter = { q: $('#q').value, status: $('#fstatus').value };
      const rows = await withLoader(API.listOrders(filter));
      card.innerHTML = '';
      if (!rows.length) card.appendChild(emptyState('ยังไม่มีใบงาน', 'คลิก "สร้างใบงาน" เพื่อเริ่มต้น', 'orders'));
      else card.appendChild(orderTable(rows));
    }
    $('#q').addEventListener('input', debounce(reload, 300));
    $('#fstatus').addEventListener('change', reload);
    reload();
  }

  function orderTable(rows) {
    const w = el('div', { class: 'table-wrapper' });
    const scroll = el('div', { class: 'table-scroll' });
    const t = el('table', { class: 'table' });
    t.innerHTML =
      '<thead><tr>' +
        '<th>เลขที่</th><th>ลูกค้า</th><th>สถานะ</th><th>วันรับ</th><th>วันส่ง</th><th>รวม</th><th></th>' +
      '</tr></thead>';
    const tbody = el('tbody');
    rows.forEach(function (o) {
      const tr = el('tr');
      tr.innerHTML =
        '<td><a href="#/orders/' + esc(o.order_id) + '">' + esc(o.order_no || '') + '</a> ' +
          (isUrgent(o.urgent) ? '<span class="chip chip-urgent">ด่วน</span>' : '') + '</td>' +
        '<td>' + esc(o.customer_name || '-') + '</td>' +
        '<td><span class="chip chip-' + esc(o.status) + '">' + esc(o.status) + '</span></td>' +
        '<td>' + esc(fmtDate(o.receive_date)) + '</td>' +
        '<td>' + esc(fmtDate(o.due_date)) + '</td>' +
        '<td>' + String(o.total_qty || 0) + '</td>' +
        '<td class="row-actions"><a class="btn btn-ghost btn-sm" href="#/orders/' + esc(o.order_id) + '">ดู</a></td>';
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    scroll.appendChild(t);
    w.appendChild(scroll);
    return w;
  }

  /* ====================================================================
     Order Form
     ==================================================================== */
  async function renderOrderForm() {
    const v = $('#view');
    v.innerHTML = '<div class="card"><div class="spinner"></div> กำลังโหลด...</div>';
    const [customers, products, materials] = await Promise.all([API.listCustomers(), API.listProducts(), API.listMaterials()]);
    v.innerHTML = '';

    v.appendChild(el('div', { class: 'page-head' }, [
      el('div', {}, [el('h1', {}, ['สร้างใบงานใหม่']), el('div', { class: 'page-subtitle' }, ['กรอกข้อมูลออเดอร์ลูกค้า'])]),
      el('a', { class: 'btn btn-secondary', href: '#/orders', html: icon('arrow-left') + '<span>กลับ</span>' })
    ]));

    const card = el('div', { class: 'card' });
    card.innerHTML =
      '<form id="order-form">' +
        '<h3 class="card-title mb-4">ข้อมูลทั่วไป</h3>' +
        '<div class="field-row">' +
          '<div class="field"><label class="field-label">ลูกค้า <span class="required">*</span></label>' +
            '<select class="field-select" name="customer_id" required>' +
              '<option value="">-- เลือกลูกค้า --</option>' +
              customers.map(function (c) { return '<option value="' + esc(c.customer_id) + '">' + esc(c.name) + '</option>'; }).join('') +
            '</select></div>' +
          '<div class="field"><label class="field-label">ประเภทงาน</label>' +
            '<div class="field-inline"><input type="checkbox" name="urgent" id="urgent"><label for="urgent">งานด่วน (Urgent — Lead 2 วัน)</label></div></div>' +
        '</div>' +
        '<div class="field-row">' +
          '<div class="field"><label class="field-label">วันรับงาน</label><input type="date" class="field-input" name="receive_date" value="' + todayIso() + '" required></div>' +
          '<div class="field"><label class="field-label">วันส่ง <span class="text-muted text-sm">(เว้นว่าง = คำนวณอัตโนมัติ)</span></label><input type="date" class="field-input" name="due_date"></div>' +
        '</div>' +
        '<div class="field"><label class="field-label">หมายเหตุ</label><textarea class="field-textarea" name="note"></textarea></div>' +
        '<h3 class="card-title mb-4 mt-6">รายการสินค้า</h3>' +
        '<div id="items"></div>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="add-item">' + icon('plus', { size: 14 }) + ' เพิ่มรายการ</button>' +
        '<h3 class="card-title mb-4 mt-6">วัตถุดิบที่ต้องใช้</h3>' +
        '<p class="text-muted text-sm mb-3">เพิ่มวัตถุดิบที่ต้องใช้สำหรับงานนี้ ระบบจะสร้าง Pre-Order อัตโนมัติถ้าสต็อกไม่พอ</p>' +
        '<div id="mats"></div>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="add-mat">' + icon('plus', { size: 14 }) + ' เพิ่มวัตถุดิบ</button>' +
        '<div class="mt-6 flex gap-2" style="justify-content:flex-end;">' +
          '<a href="#/orders" class="btn btn-secondary">ยกเลิก</a>' +
          '<button class="btn btn-primary" type="submit">' + icon('check', { size: 16 }) + ' บันทึกใบงาน</button>' +
        '</div>' +
      '</form>';
    v.appendChild(card);

    function productOpts() {
      return '<option value="">-- เลือกสินค้า --</option>' +
        products.map(function (p) {
          return '<option value="' + esc(p.product_id) + '" data-formula="' + esc(p.default_formula || '') + '">' + esc(p.name) + '</option>';
        }).join('');
    }
    function materialOpts() {
      return '<option value="">-- เลือกวัตถุดิบ --</option>' +
        materials.map(function (m) {
          return '<option value="' + esc(m.material_id) + '">' + esc(m.name) + ' (สต็อก: ' + (m.stock_qty || 0) + ' ' + esc(m.unit || '') + ')</option>';
        }).join('');
    }

    function addItem() {
      const row = el('div', { class: 'item-card' });
      row.innerHTML =
        '<div class="field-row" style="grid-template-columns:2fr 1fr 1fr;">' +
          '<div class="field"><label class="field-label">สินค้า</label><select class="field-select" data-k="product_id">' + productOpts() + '</select></div>' +
          '<div class="field"><label class="field-label">จำนวน</label><input class="field-input" type="number" step="0.01" data-k="qty" value="1"></div>' +
          '<div class="field"><label class="field-label">หน่วย</label><input class="field-input" data-k="unit" value="L"></div>' +
        '</div>' +
        '<div class="field-row">' +
          '<div class="field"><label class="field-label">สูตร</label><input class="field-input" data-k="formula_code" placeholder="เช่น RAL 9005"></div>' +
          '<div class="field"><label class="field-label">QC</label><select class="field-select" data-k="qc_required"><option value="true">ต้อง QC</option><option value="false">ไม่ต้อง</option></select></div>' +
        '</div>' +
        '<button type="button" class="icon-btn remove-btn" title="ลบ" onclick="this.parentNode.remove()">' + icon('trash') + '</button>';
      row.querySelector('select[data-k="product_id"]').addEventListener('change', function (e) {
        const f = e.target.options[e.target.selectedIndex].getAttribute('data-formula');
        if (f) row.querySelector('input[data-k="formula_code"]').value = f;
      });
      $('#items').appendChild(row);
    }
    function addMat() {
      const row = el('div', { class: 'item-card' });
      row.innerHTML =
        '<div class="field-row" style="grid-template-columns:3fr 1fr;">' +
          '<div class="field"><label class="field-label">วัตถุดิบ</label><select class="field-select" data-k="material_id">' + materialOpts() + '</select></div>' +
          '<div class="field"><label class="field-label">จำนวน</label><input class="field-input" type="number" step="0.01" data-k="qty_needed" value="1"></div>' +
        '</div>' +
        '<button type="button" class="icon-btn remove-btn" title="ลบ" onclick="this.parentNode.remove()">' + icon('trash') + '</button>';
      $('#mats').appendChild(row);
    }
    $('#add-item').addEventListener('click', addItem);
    $('#add-mat').addEventListener('click', addMat);
    addItem();

    $('#order-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const f = e.target;
      const items = $$('#items .item-card').map(function (r) {
        return {
          product_id: r.querySelector('select[data-k="product_id"]').value,
          qty: r.querySelector('input[data-k="qty"]').value,
          unit: r.querySelector('input[data-k="unit"]').value,
          formula_code: r.querySelector('input[data-k="formula_code"]').value,
          qc_required: r.querySelector('select[data-k="qc_required"]').value === 'true'
        };
      }).filter(function (i) { return i.product_id; });
      const mats = $$('#mats .item-card').map(function (r) {
        return {
          material_id: r.querySelector('select[data-k="material_id"]').value,
          qty_needed: r.querySelector('input[data-k="qty_needed"]').value
        };
      }).filter(function (m) { return m.material_id; });
      if (!items.length) { toast('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ', 'error'); return; }

      try {
        const res = await withLoader(API.createOrder({
          customer_id: f.customer_id.value,
          receive_date: f.receive_date.value,
          due_date: f.due_date.value,
          urgent: f.urgent.checked,
          note: f.note.value,
          items: items,
          materials: mats
        }));
        toast('สร้างใบงาน ' + res.order_no + ' สำเร็จ', 'success');
        navigate('#/orders/' + res.order_id);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ====================================================================
     Order Detail
     ==================================================================== */
  async function renderOrderDetail(orderId) {
    const v = $('#view');
    v.innerHTML = '<div class="card"><div class="spinner"></div> กำลังโหลด...</div>';
    const d = await withLoader(API.getOrder(orderId));
    v.innerHTML = '';
    const o = d.order;

    v.appendChild(el('div', { class: 'page-head' }, [
      el('div', {}, [
        el('h1', {}, [o.order_no + (isUrgent(o.urgent) ? ' ⚡' : '')]),
        el('div', { class: 'page-subtitle' }, ['สร้างเมื่อ ' + fmtDate(o.created_at, true)])
      ]),
      el('div', { class: 'flex gap-2' }, [
        el('a', { class: 'btn btn-secondary', href: '#/orders', html: icon('arrow-left') + '<span>กลับ</span>' }),
        isSupervisorPlus() ? el('a', { class: 'btn btn-secondary', href: '#/orders/' + orderId + '/qc', html: icon('beaker') + '<span>QC</span>' }) : null,
        isSupervisorPlus() ? el('button', { class: 'btn btn-primary', onClick: function () { showStatusModal(o, function () { renderOrderDetail(orderId); }); }, html: icon('refresh') + '<span>เปลี่ยนสถานะ</span>' }) : null
      ].filter(Boolean))
    ]));

    // Info card
    const info = el('div', { class: 'card' });
    info.appendChild(el('div', { class: 'card-header' }, [el('div', { class: 'card-title' }, ['ข้อมูลใบงาน'])]));
    const grid = el('div', { class: 'detail-grid' });
    [
      { label: 'สถานะ', value: '<span class="chip chip-' + esc(o.status) + '">' + esc(o.status) + '</span>', html: true },
      { label: 'ลูกค้า', value: (d.customer ? d.customer.name : '-') },
      { label: 'ติดต่อ', value: d.customer ? ((d.customer.contact_person || '') + ' ' + (d.customer.phone || '')) : '-' },
      { label: 'วันรับงาน', value: fmtDate(o.receive_date) },
      { label: 'วันส่ง', value: fmtDate(o.due_date) },
      { label: 'รวม', value: (o.total_qty || 0) }
    ].forEach(function (item) {
      const d_ = el('div', { class: 'detail-item' }, [el('div', { class: 'label' }, [item.label])]);
      const val = el('div', { class: 'value' });
      if (item.html) val.innerHTML = item.value; else val.textContent = item.value;
      d_.appendChild(val);
      grid.appendChild(d_);
    });
    info.appendChild(grid);
    if (o.note) info.appendChild(el('div', { class: 'mt-4' }, [el('div', { class: 'label', style: { fontSize: '12px', color: 'var(--text-muted)' } }, ['หมายเหตุ']), el('div', {}, [o.note])]));
    v.appendChild(info);

    // Items
    const itemsCard = el('div', { class: 'card' });
    itemsCard.appendChild(el('div', { class: 'card-header' }, [el('div', { class: 'card-title' }, ['รายการสินค้า'])]));
    const itemT = el('table', { class: 'table' });
    itemT.innerHTML = '<thead><tr><th>สินค้า</th><th>จำนวน</th><th>หน่วย</th><th>สูตร</th><th>QC</th></tr></thead>';
    const ib = el('tbody');
    d.items.forEach(function (it) {
      const tr = el('tr');
      tr.innerHTML =
        '<td>' + esc(it.product ? it.product.name : '-') + '</td>' +
        '<td>' + esc(it.qty) + '</td>' +
        '<td>' + esc(it.unit) + '</td>' +
        '<td>' + esc(it.formula_code || '-') + '</td>' +
        '<td>' + (isTrue(it.qc_required) === false && String(it.qc_required).toLowerCase() === 'false' ? '-' : '✓') + '</td>';
      ib.appendChild(tr);
    });
    itemT.appendChild(ib);
    itemsCard.appendChild(el('div', { class: 'table-scroll' }, [itemT]));
    v.appendChild(itemsCard);

    // PreOrders
    if (d.preorders && d.preorders.length) {
      const poCard = el('div', { class: 'card' });
      poCard.appendChild(el('div', { class: 'card-header' }, [el('div', { class: 'card-title' }, ['Pre-Order วัตถุดิบ'])]));
      const poT = el('table', { class: 'table' });
      poT.innerHTML = '<thead><tr><th>วัตถุดิบ</th><th>ต้องใช้</th><th>มี</th><th>สถานะ</th><th>Supplier</th><th>ETA</th><th></th></tr></thead>';
      const pob = el('tbody');
      d.preorders.forEach(function (p) {
        const tr = el('tr');
        tr.innerHTML =
          '<td>' + esc(p.material_id) + '</td>' +
          '<td>' + (p.qty_needed || 0) + '</td>' +
          '<td>' + (p.qty_available || 0) + '</td>' +
          '<td><span class="chip chip-' + esc(p.status) + '">' + esc(p.status) + '</span></td>' +
          '<td>' + esc(p.supplier || '-') + '</td>' +
          '<td>' + esc(p.eta || '-') + '</td>' +
          '<td class="row-actions"></td>';
        const act = tr.lastChild;
        if (isSupervisorPlus() && p.status !== 'RECEIVED') {
          act.appendChild(el('button', {
            class: 'btn btn-success btn-sm',
            onClick: async function () { try { await withLoader(API.markPreOrderReceived(p.preorder_id)); toast('รับแล้ว', 'success'); renderOrderDetail(orderId); } catch (e) { toast(e.message, 'error'); } },
            html: icon('check', { size: 14 }) + '<span>รับแล้ว</span>'
          }));
        }
        pob.appendChild(tr);
      });
      poT.appendChild(pob);
      poCard.appendChild(el('div', { class: 'table-scroll' }, [poT]));
      v.appendChild(poCard);
    }

    // QC records
    if (d.qc && d.qc.length) {
      const qcCard = el('div', { class: 'card' });
      qcCard.appendChild(el('div', { class: 'card-header' }, [el('div', { class: 'card-title' }, ['บันทึก QC'])]));
      const qcT = el('table', { class: 'table' });
      qcT.innerHTML = '<thead><tr><th>เวลา</th><th>L*</th><th>a*</th><th>b*</th><th>สูตรจริง</th><th>ผ่าน</th><th>หมายเหตุ</th></tr></thead>';
      const qcb = el('tbody');
      d.qc.forEach(function (q) {
        const tr = el('tr');
        tr.innerHTML =
          '<td>' + esc(fmtDate(q.qc_at, true)) + '</td>' +
          '<td>' + esc(q.l_value) + '</td>' +
          '<td>' + esc(q.a_value) + '</td>' +
          '<td>' + esc(q.b_value) + '</td>' +
          '<td>' + esc(q.formula_actual || '-') + '</td>' +
          '<td>' + (isTrue(q.pass) ? '<span class="chip chip-READY">ผ่าน</span>' : '<span class="chip chip-CANCELLED">ไม่ผ่าน</span>') + '</td>' +
          '<td>' + esc(q.remark || '-') + '</td>';
        qcb.appendChild(tr);
      });
      qcT.appendChild(qcb);
      qcCard.appendChild(el('div', { class: 'table-scroll' }, [qcT]));
      v.appendChild(qcCard);
    }

    // Files
    const fileCard = el('div', { class: 'card' });
    fileCard.appendChild(el('div', { class: 'card-header' }, [el('div', { class: 'card-title' }, ['ไฟล์แนบ'])]));
    const fileList = el('div', { class: 'file-list' });
    (d.files || []).forEach(function (f) {
      fileList.appendChild(el('div', { class: 'file-item' }, [
        el('div', { class: 'file-icon', html: icon('paperclip', { size: 16 }) }),
        el('div', { class: 'file-name' }, [
          el('a', { href: 'https://drive.google.com/file/d/' + f.drive_file_id + '/view', target: '_blank' }, [f.file_name]),
          el('div', { class: 'file-meta' }, [fmtDate(f.uploaded_at, true)])
        ])
      ]));
    });
    if (!d.files || !d.files.length) fileList.appendChild(el('div', { class: 'text-muted text-sm' }, ['ยังไม่มีไฟล์แนบ']));
    fileCard.appendChild(fileList);

    const uploadLabel = el('label', { class: 'upload-zone' }, [
      el('div', { html: icon('upload', { size: 24 }) }),
      el('div', { class: 'mt-2' }, ['คลิกเพื่อเลือกไฟล์ หรือลากวาง']),
      el('div', { class: 'text-sm' }, ['สูงสุด 10MB'])
    ]);
    const fileInput = el('input', { type: 'file', onChange: async function (e) {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 10 * 1024 * 1024) { toast('ไฟล์ใหญ่เกิน 10MB', 'error'); return; }
      const reader = new FileReader();
      reader.onload = async function () {
        try {
          await withLoader(API.uploadFile(orderId, reader.result, f.name, f.type));
          toast('อัปโหลดสำเร็จ', 'success');
          renderOrderDetail(orderId);
        } catch (err) { toast(err.message, 'error'); }
      };
      reader.readAsDataURL(f);
    }});
    uploadLabel.appendChild(fileInput);
    fileCard.appendChild(uploadLabel);
    v.appendChild(fileCard);

    // Status log
    const logCard = el('div', { class: 'card' });
    logCard.appendChild(el('div', { class: 'card-header' }, [el('div', { class: 'card-title' }, ['ประวัติการเปลี่ยนสถานะ'])]));
    const tl = el('ul', { class: 'timeline' });
    (d.logs || []).forEach(function (l) {
      const li = el('li');
      li.innerHTML =
        '<div class="time">' + esc(fmtDate(l.changed_at, true)) + '</div>' +
        '<div class="content"><span class="chip chip-' + esc(l.from_status || 'DRAFT') + '">' + esc(l.from_status || '-') + '</span> → <span class="chip chip-' + esc(l.to_status) + '">' + esc(l.to_status) + '</span>' +
        (l.remark ? ' <span class="text-muted text-sm"> — ' + esc(l.remark) + '</span>' : '') + '</div>';
      tl.appendChild(li);
    });
    logCard.appendChild(tl);
    v.appendChild(logCard);
  }

  function showStatusModal(o, onDone) {
    const transitions = {
      DRAFT: ['WAITING_MATERIAL', 'IN_PRODUCTION', 'CANCELLED'],
      WAITING_MATERIAL: ['IN_PRODUCTION', 'CANCELLED'],
      IN_PRODUCTION: ['QC', 'CANCELLED'],
      QC: ['READY', 'IN_PRODUCTION', 'CANCELLED'],
      READY: ['DELIVERED', 'CANCELLED']
    };
    const allowed = transitions[o.status] || [];
    if (!allowed.length) { toast('ไม่สามารถเปลี่ยนสถานะจาก ' + o.status + ' ได้', 'error'); return; }

    const body = el('div');
    body.innerHTML =
      '<div class="field"><label class="field-label">สถานะใหม่</label><select class="field-select" id="ns">' +
        allowed.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label class="field-label">หมายเหตุ</label><textarea class="field-textarea" id="rmk" placeholder="เช่น วัตถุดิบมาครบแล้ว"></textarea></div>';

    modal({
      title: 'เปลี่ยนสถานะใบงาน',
      body: body,
      actions: [
        { label: 'ยกเลิก' },
        { label: 'บันทึก', class: 'btn-primary', onClick: async function () {
          try {
            await withLoader(API.changeStatus(o.order_id, body.querySelector('#ns').value, body.querySelector('#rmk').value));
            toast('เปลี่ยนสถานะสำเร็จ', 'success');
            onDone && onDone();
          } catch (e) { toast(e.message, 'error'); return false; }
        } }
      ]
    });
  }

  /* ====================================================================
     QC Entry
     ==================================================================== */
  async function renderQC(orderId) {
    if (!isSupervisorPlus()) { toast('สิทธิ์ไม่เพียงพอ', 'error'); navigate('#/orders/' + orderId); return; }
    const v = $('#view');
    v.innerHTML = '<div class="card"><div class="spinner"></div> กำลังโหลด...</div>';
    const d = await withLoader(API.getOrder(orderId));
    v.innerHTML = '';

    v.appendChild(el('div', { class: 'page-head' }, [
      el('div', {}, [el('h1', {}, ['QC — ' + d.order.order_no]), el('div', { class: 'page-subtitle' }, ['กรอกค่าสีจริง (L*a*b*) และสูตรที่ใช้จริงของแต่ละรายการ'])]),
      el('a', { class: 'btn btn-secondary', href: '#/orders/' + orderId, html: icon('arrow-left') + '<span>กลับ</span>' })
    ]));

    d.items.forEach(function (it) {
      const card = el('div', { class: 'card' });
      card.innerHTML =
        '<div class="card-header"><div><div class="card-title">' + esc(it.product ? it.product.name : '-') + '</div><div class="card-subtitle">สูตรที่ระบุ: ' + esc(it.formula_code || '-') + ' · จำนวน ' + esc(it.qty) + ' ' + esc(it.unit) + '</div></div></div>' +
        '<form>' +
          '<div class="field-row-3">' +
            '<div class="field"><label class="field-label">L*</label><input class="field-input" name="l" type="number" step="0.01"></div>' +
            '<div class="field"><label class="field-label">a*</label><input class="field-input" name="a" type="number" step="0.01"></div>' +
            '<div class="field"><label class="field-label">b*</label><input class="field-input" name="b" type="number" step="0.01"></div>' +
          '</div>' +
          '<div class="field"><label class="field-label">สูตรที่ใช้จริง</label><input class="field-input" name="actual" placeholder="ระบุสูตรจริง"></div>' +
          '<div class="field"><label class="field-label">หมายเหตุ</label><textarea class="field-textarea" name="rmk"></textarea></div>' +
          '<div class="flex gap-2" style="justify-content:flex-end;">' +
            '<button type="button" class="btn btn-danger" data-pass="0">' + icon('x', { size: 16 }) + ' บันทึก (ไม่ผ่าน)</button>' +
            '<button type="button" class="btn btn-success" data-pass="1">' + icon('check', { size: 16 }) + ' บันทึก (ผ่าน)</button>' +
          '</div>' +
        '</form>';
      const form = card.querySelector('form');
      form.querySelectorAll('button[data-pass]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const pass = btn.getAttribute('data-pass') === '1';
          try {
            await withLoader(API.submitQC({
              order_id: orderId, item_id: it.item_id,
              l_value: form.l.value, a_value: form.a.value, b_value: form.b.value,
              formula_actual: form.actual.value, remark: form.rmk.value, pass: pass
            }));
            toast('บันทึก QC สำเร็จ', 'success');
            renderQC(orderId);
          } catch (err) { toast(err.message, 'error'); }
        });
      });
      v.appendChild(card);
    });

    if (d.qc && d.qc.length) {
      const histCard = el('div', { class: 'card' });
      histCard.appendChild(el('div', { class: 'card-header' }, [el('div', { class: 'card-title' }, ['ประวัติ QC ของใบงานนี้'])]));
      const t = el('table', { class: 'table' });
      t.innerHTML = '<thead><tr><th>เวลา</th><th>L*</th><th>a*</th><th>b*</th><th>สูตรจริง</th><th>ผ่าน</th><th>หมายเหตุ</th></tr></thead>';
      const tb = el('tbody');
      d.qc.forEach(function (q) {
        tb.innerHTML +=
          '<tr><td>' + esc(fmtDate(q.qc_at, true)) + '</td><td>' + esc(q.l_value) + '</td><td>' + esc(q.a_value) + '</td><td>' + esc(q.b_value) + '</td><td>' + esc(q.formula_actual || '-') + '</td>' +
          '<td>' + (isTrue(q.pass) ? '<span class="chip chip-READY">ผ่าน</span>' : '<span class="chip chip-CANCELLED">ไม่ผ่าน</span>') + '</td><td>' + esc(q.remark || '-') + '</td></tr>';
      });
      t.appendChild(tb);
      histCard.appendChild(el('div', { class: 'table-scroll' }, [t]));
      v.appendChild(histCard);
    }
  }

  /* ====================================================================
     PreOrder List
     ==================================================================== */
  async function renderPreOrderList() {
    const v = $('#view');
    v.appendChild(el('div', { class: 'page-head' }, [
      el('div', {}, [el('h1', {}, ['Pre-Order วัตถุดิบ']), el('div', { class: 'page-subtitle' }, ['วัตถุดิบที่ต้องสั่งเพิ่ม เพื่อเริ่มผลิต'])])
    ]));
    const toolbar = el('div', { class: 'toolbar' });
    toolbar.innerHTML =
      '<select class="field-select" id="pof">' +
        '<option value="">ทุกสถานะ</option>' +
        ['PENDING', 'ORDERED', 'RECEIVED'].map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('') +
      '</select>';
    v.appendChild(toolbar);
    const card = el('div', { class: 'card', style: { padding: '0' } });
    v.appendChild(card);

    async function reload() {
      const rows = await withLoader(API.listPreOrders({ status: $('#pof').value }));
      card.innerHTML = '';
      if (!rows.length) { card.appendChild(emptyState('ไม่มีรายการ Pre-Order', '', 'package')); return; }
      const w = el('div', { class: 'table-wrapper' });
      const sc = el('div', { class: 'table-scroll' });
      const t = el('table', { class: 'table' });
      t.innerHTML = '<thead><tr><th>ใบงาน</th><th>วัตถุดิบ</th><th>ต้องใช้</th><th>มี</th><th>สถานะ</th><th>Supplier</th><th>ETA</th><th></th></tr></thead>';
      const tb = el('tbody');
      rows.forEach(function (r) {
        const tr = el('tr');
        tr.innerHTML =
          '<td><a href="#/orders/' + esc(r.order_id) + '">' + esc(r.order_no || '') + '</a></td>' +
          '<td>' + esc(r.material ? r.material.name : r.material_id) + '</td>' +
          '<td>' + (r.qty_needed || 0) + '</td>' +
          '<td>' + (r.qty_available || 0) + '</td>' +
          '<td><span class="chip chip-' + esc(r.status) + '">' + esc(r.status) + '</span></td>' +
          '<td><input class="field-input" style="min-width:120px" value="' + esc(r.supplier || '') + '" data-k="supplier" data-id="' + esc(r.preorder_id) + '"></td>' +
          '<td><input class="field-input" type="date" value="' + esc(r.eta || '') + '" data-k="eta" data-id="' + esc(r.preorder_id) + '"></td>' +
          '<td class="row-actions"></td>';
        const act = tr.lastChild;
        if (isSupervisorPlus() && r.status !== 'RECEIVED') {
          act.appendChild(el('button', { class: 'btn btn-success btn-sm', onClick: async function () {
            try { await withLoader(API.markPreOrderReceived(r.preorder_id)); toast('รับแล้ว', 'success'); reload(); }
            catch (e) { toast(e.message, 'error'); }
          }, html: icon('check', { size: 14 }) + '<span>รับแล้ว</span>' }));
        }
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      sc.appendChild(t); w.appendChild(sc); card.appendChild(w);

      $$('input[data-k]', card).forEach(function (inp) {
        inp.addEventListener('change', async function () {
          const patch = {}; patch[inp.getAttribute('data-k')] = inp.value;
          try { await API.updatePreOrder(inp.getAttribute('data-id'), patch); toast('บันทึก', 'success'); }
          catch (e) { toast(e.message, 'error'); }
        });
      });
    }
    $('#pof').addEventListener('change', reload);
    reload();
  }

  /* ====================================================================
     Master pages (Customer / Product / Material) — shared renderer
     ==================================================================== */
  function masterPage(opts) {
    return async function () {
      const v = $('#view');
      v.appendChild(el('div', { class: 'page-head' }, [
        el('div', {}, [el('h1', {}, [opts.title]), el('div', { class: 'page-subtitle' }, [opts.subtitle || ''])]),
        isSupervisorPlus() ? el('button', { class: 'btn btn-primary', onClick: function () { opts.editor(null, reload); }, html: icon('plus') + '<span>เพิ่มใหม่</span>' }) : null
      ]));
      const card = el('div', { class: 'card', style: { padding: '0' } });
      v.appendChild(card);

      async function reload() {
        const rows = await withLoader(opts.list());
        card.innerHTML = '';
        if (!rows.length) { card.appendChild(emptyState('ยังไม่มีข้อมูล', 'คลิก "เพิ่มใหม่" เพื่อเริ่มต้น', opts.icon || 'package')); return; }
        const w = el('div', { class: 'table-wrapper' });
        const sc = el('div', { class: 'table-scroll' });
        const t = el('table', { class: 'table' });
        t.innerHTML = '<thead><tr>' + opts.cols.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') + '<th></th></tr></thead>';
        const tb = el('tbody');
        rows.forEach(function (r) {
          const tr = el('tr');
          tr.innerHTML = opts.cols.map(function (c) {
            const val = r[c.key];
            if (c.format) return '<td>' + c.format(val, r) + '</td>';
            return '<td>' + esc(val == null ? '' : val) + '</td>';
          }).join('');
          const act = el('td', { class: 'row-actions' });
          if (isSupervisorPlus()) act.appendChild(el('button', { class: 'btn btn-ghost btn-sm', onClick: function () { opts.editor(r, reload); }, html: icon('edit', { size: 14 }) }));
          if (isAdmin() && opts.del) {
            act.appendChild(el('button', { class: 'btn btn-ghost btn-sm', onClick: function () {
              confirmModal('ยืนยันการลบ', 'ต้องการลบรายการนี้ใช่หรือไม่?', async function () {
                try { await opts.del(r[opts.idKey]); toast('ลบแล้ว', 'success'); reload(); } catch (e) { toast(e.message, 'error'); return false; }
              }, { danger: true });
            }, html: icon('trash', { size: 14 }) }));
          }
          tr.appendChild(act);
          tb.appendChild(tr);
        });
        t.appendChild(tb);
        sc.appendChild(t); w.appendChild(sc); card.appendChild(w);
      }
      reload();
    };
  }

  const renderCustomers = masterPage({
    title: 'ลูกค้า',
    subtitle: 'ข้อมูลลูกค้าสำหรับออกใบงาน',
    icon: 'building',
    list: function () { return API.listCustomers(); },
    del: function (id) { return API.deleteCustomer(id); },
    idKey: 'customer_id',
    cols: [
      { key: 'name', label: 'ชื่อ' },
      { key: 'contact_person', label: 'ผู้ติดต่อ' },
      { key: 'phone', label: 'โทร' },
      { key: 'address', label: 'ที่อยู่' }
    ],
    editor: function (row, reload) {
      const body = el('div');
      body.innerHTML =
        '<div class="field"><label class="field-label">ชื่อ <span class="required">*</span></label><input class="field-input" id="f_name" value="' + esc(row ? row.name : '') + '"></div>' +
        '<div class="field-row">' +
          '<div class="field"><label class="field-label">ผู้ติดต่อ</label><input class="field-input" id="f_cp" value="' + esc(row ? row.contact_person : '') + '"></div>' +
          '<div class="field"><label class="field-label">โทร</label><input class="field-input" id="f_ph" value="' + esc(row ? row.phone : '') + '"></div>' +
        '</div>' +
        '<div class="field"><label class="field-label">ที่อยู่</label><textarea class="field-textarea" id="f_ad">' + esc(row ? row.address : '') + '</textarea></div>' +
        '<div class="field"><label class="field-label">หมายเหตุ</label><textarea class="field-textarea" id="f_nt">' + esc(row ? row.note : '') + '</textarea></div>';
      modal({
        title: row ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้า',
        body: body,
        actions: [
          { label: 'ยกเลิก' },
          { label: 'บันทึก', class: 'btn-primary', onClick: async function () {
            try {
              await withLoader(API.upsertCustomer({
                customer_id: row ? row.customer_id : null,
                name: body.querySelector('#f_name').value,
                contact_person: body.querySelector('#f_cp').value,
                phone: body.querySelector('#f_ph').value,
                address: body.querySelector('#f_ad').value,
                note: body.querySelector('#f_nt').value
              }));
              toast('บันทึก', 'success'); reload();
            } catch (e) { toast(e.message, 'error'); return false; }
          } }
        ]
      });
    }
  });

  const renderProducts = masterPage({
    title: 'สินค้า / สี',
    subtitle: 'สีอุตสาหกรรมและสีรถยนต์',
    icon: 'palette',
    list: function () { return API.listProducts(); },
    del: function (id) { return API.deleteProduct(id); },
    idKey: 'product_id',
    cols: [
      { key: 'code', label: 'รหัส' },
      { key: 'name', label: 'ชื่อ' },
      { key: 'type', label: 'ประเภท' },
      { key: 'unit', label: 'หน่วย' },
      { key: 'default_formula', label: 'สูตรเริ่มต้น' }
    ],
    editor: function (row, reload) {
      const body = el('div');
      body.innerHTML =
        '<div class="field-row">' +
          '<div class="field"><label class="field-label">รหัส</label><input class="field-input" id="f_code" value="' + esc(row ? row.code : '') + '"></div>' +
          '<div class="field"><label class="field-label">หน่วย</label><input class="field-input" id="f_unit" value="' + esc(row ? row.unit : 'L') + '"></div>' +
        '</div>' +
        '<div class="field"><label class="field-label">ชื่อ <span class="required">*</span></label><input class="field-input" id="f_name" value="' + esc(row ? row.name : '') + '"></div>' +
        '<div class="field"><label class="field-label">ประเภท</label><select class="field-select" id="f_type">' +
          '<option value="Industrial"' + (row && row.type === 'Industrial' ? ' selected' : '') + '>สีอุตสาหกรรม</option>' +
          '<option value="Automotive"' + (row && row.type === 'Automotive' ? ' selected' : '') + '>สีรถยนต์</option>' +
        '</select></div>' +
        '<div class="field"><label class="field-label">สูตรเริ่มต้น</label><input class="field-input" id="f_form" value="' + esc(row ? row.default_formula : '') + '"></div>';
      modal({
        title: row ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า',
        body: body,
        actions: [
          { label: 'ยกเลิก' },
          { label: 'บันทึก', class: 'btn-primary', onClick: async function () {
            try {
              await withLoader(API.upsertProduct({
                product_id: row ? row.product_id : null,
                code: body.querySelector('#f_code').value,
                name: body.querySelector('#f_name').value,
                type: body.querySelector('#f_type').value,
                unit: body.querySelector('#f_unit').value,
                default_formula: body.querySelector('#f_form').value
              }));
              toast('บันทึก', 'success'); reload();
            } catch (e) { toast(e.message, 'error'); return false; }
          } }
        ]
      });
    }
  });

  const renderMaterials = masterPage({
    title: 'วัตถุดิบ',
    subtitle: 'สต็อกวัตถุดิบที่ใช้ในการผลิต',
    icon: 'flask',
    list: function () { return API.listMaterials(); },
    del: function (id) { return API.deleteMaterial(id); },
    idKey: 'material_id',
    cols: [
      { key: 'code', label: 'รหัส' },
      { key: 'name', label: 'ชื่อ' },
      { key: 'unit', label: 'หน่วย' },
      { key: 'stock_qty', label: 'สต็อก' },
      { key: 'reorder_point', label: 'จุดสั่งซื้อ' }
    ],
    editor: function (row, reload) {
      const body = el('div');
      body.innerHTML =
        '<div class="field-row">' +
          '<div class="field"><label class="field-label">รหัส</label><input class="field-input" id="f_code" value="' + esc(row ? row.code : '') + '"></div>' +
          '<div class="field"><label class="field-label">หน่วย</label><input class="field-input" id="f_unit" value="' + esc(row ? row.unit : 'L') + '"></div>' +
        '</div>' +
        '<div class="field"><label class="field-label">ชื่อ <span class="required">*</span></label><input class="field-input" id="f_name" value="' + esc(row ? row.name : '') + '"></div>' +
        '<div class="field-row">' +
          '<div class="field"><label class="field-label">สต็อก</label><input class="field-input" id="f_stock" type="number" step="0.01" value="' + esc(row ? row.stock_qty : 0) + '"></div>' +
          '<div class="field"><label class="field-label">จุดสั่งซื้อ</label><input class="field-input" id="f_rop" type="number" step="0.01" value="' + esc(row ? row.reorder_point : 0) + '"></div>' +
        '</div>';
      modal({
        title: row ? 'แก้ไขวัตถุดิบ' : 'เพิ่มวัตถุดิบ',
        body: body,
        actions: [
          { label: 'ยกเลิก' },
          { label: 'บันทึก', class: 'btn-primary', onClick: async function () {
            try {
              await withLoader(API.upsertMaterial({
                material_id: row ? row.material_id : null,
                code: body.querySelector('#f_code').value,
                name: body.querySelector('#f_name').value,
                unit: body.querySelector('#f_unit').value,
                stock_qty: body.querySelector('#f_stock').value,
                reorder_point: body.querySelector('#f_rop').value
              }));
              toast('บันทึก', 'success'); reload();
            } catch (e) { toast(e.message, 'error'); return false; }
          } }
        ]
      });
    }
  });

  /* ====================================================================
     Users (Admin)
     ==================================================================== */
  async function renderUsers() {
    const v = $('#view');
    v.appendChild(el('div', { class: 'page-head' }, [
      el('div', {}, [el('h1', {}, ['ผู้ใช้']), el('div', { class: 'page-subtitle' }, ['จัดการบัญชีและสิทธิ์'])]),
      el('button', { class: 'btn btn-primary', onClick: function () { userEditor(null, reload); }, html: icon('plus') + '<span>เพิ่มผู้ใช้</span>' })
    ]));
    const card = el('div', { class: 'card', style: { padding: '0' } });
    v.appendChild(card);

    async function reload() {
      const rows = await withLoader(API.listUsers());
      card.innerHTML = '';
      const w = el('div', { class: 'table-wrapper' });
      const sc = el('div', { class: 'table-scroll' });
      const t = el('table', { class: 'table' });
      t.innerHTML = '<thead><tr><th>Username</th><th>ชื่อ-สกุล</th><th>Role</th><th>LINE ID</th><th>สถานะ</th><th></th></tr></thead>';
      const tb = el('tbody');
      rows.forEach(function (r) {
        const active = !(r.active === false || String(r.active).toLowerCase() === 'false');
        const tr = el('tr');
        tr.innerHTML =
          '<td>' + esc(r.username) + '</td>' +
          '<td>' + esc(r.full_name) + '</td>' +
          '<td><span class="chip chip-' + esc(r.role) + '">' + esc(r.role) + '</span></td>' +
          '<td>' + esc(r.line_user_id || '-') + '</td>' +
          '<td>' + (active ? '<span class="chip chip-READY">Active</span>' : '<span class="chip chip-CANCELLED">Inactive</span>') + '</td>' +
          '<td class="row-actions"></td>';
        const act = tr.lastChild;
        act.appendChild(el('button', { class: 'btn btn-ghost btn-sm', onClick: function () { userEditor(r, reload); }, html: icon('edit', { size: 14 }) }));
        act.appendChild(el('button', { class: 'btn btn-ghost btn-sm', onClick: function () { resetPwd(r); }, html: icon('lock', { size: 14 }) }));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      sc.appendChild(t); w.appendChild(sc); card.appendChild(w);
    }
    reload();
  }

  function userEditor(row, reload) {
    const body = el('div');
    body.innerHTML =
      '<div class="field-row">' +
        '<div class="field"><label class="field-label">Username <span class="required">*</span></label><input class="field-input" id="u_un" value="' + esc(row ? row.username : '') + '"' + (row ? ' disabled' : '') + '></div>' +
        (row ? '' : '<div class="field"><label class="field-label">Password <span class="required">*</span></label><input class="field-input" id="u_pw" type="password"></div>') +
      '</div>' +
      '<div class="field"><label class="field-label">ชื่อ-สกุล</label><input class="field-input" id="u_fn" value="' + esc(row ? row.full_name : '') + '"></div>' +
      '<div class="field-row">' +
        '<div class="field"><label class="field-label">Role</label><select class="field-select" id="u_role">' +
          ['Admin', 'Supervisor', 'User'].map(function (r) { return '<option value="' + r + '"' + (row && row.role === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field"><label class="field-label">LINE User ID</label><input class="field-input" id="u_li" value="' + esc(row ? row.line_user_id : '') + '"></div>' +
      '</div>' +
      (row ? '<div class="field field-inline"><input type="checkbox" id="u_act"' + (row.active === false || String(row.active).toLowerCase() === 'false' ? '' : ' checked') + '><label for="u_act">Active</label></div>' : '');
    modal({
      title: row ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้',
      body: body,
      actions: [
        { label: 'ยกเลิก' },
        { label: 'บันทึก', class: 'btn-primary', onClick: async function () {
          try {
            if (row) {
              await withLoader(API.updateUser(row.user_id, {
                full_name: body.querySelector('#u_fn').value,
                role: body.querySelector('#u_role').value,
                line_user_id: body.querySelector('#u_li').value,
                active: body.querySelector('#u_act').checked
              }));
            } else {
              await withLoader(API.createUser({
                username: body.querySelector('#u_un').value,
                password: body.querySelector('#u_pw').value,
                full_name: body.querySelector('#u_fn').value,
                role: body.querySelector('#u_role').value,
                line_user_id: body.querySelector('#u_li').value
              }));
            }
            toast('บันทึก', 'success'); reload();
          } catch (e) { toast(e.message, 'error'); return false; }
        } }
      ]
    });
  }

  function resetPwd(row) {
    const body = el('div');
    body.innerHTML = '<div class="field"><label class="field-label">Password ใหม่ (อย่างน้อย 4 ตัว)</label><input class="field-input" id="np" type="password"></div>';
    modal({
      title: 'Reset Password — ' + row.username,
      body: body,
      actions: [
        { label: 'ยกเลิก' },
        { label: 'รีเซ็ต', class: 'btn-danger', onClick: async function () {
          try { await withLoader(API.resetPassword(row.user_id, body.querySelector('#np').value)); toast('Reset แล้ว', 'success'); }
          catch (e) { toast(e.message, 'error'); return false; }
        } }
      ]
    });
  }

  /* ====================================================================
     Settings (Admin)
     ==================================================================== */
  async function renderSettings() {
    const v = $('#view');
    const rows = await withLoader(API.getSettings());

    v.appendChild(el('div', { class: 'page-head' }, [
      el('div', {}, [el('h1', {}, ['ตั้งค่าระบบ']), el('div', { class: 'page-subtitle' }, ['Lead time, LINE Token, ฯลฯ'])])
    ]));

    const card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'card-header' }, [el('div', { class: 'card-title' }, ['ค่าระบบ'])]));
    rows.forEach(function (r) {
      const f = el('div', { class: 'field-row', style: { gridTemplateColumns: '1fr auto', alignItems: 'end' } });
      f.innerHTML =
        '<div class="field" style="margin-bottom:0;">' +
          '<label class="field-label">' + esc(r.key) + (r.masked ? ' <span class="text-muted text-sm">(ซ่อนอยู่ — กรอกใหม่เพื่อแก้)</span>' : '') + '</label>' +
          '<input class="field-input" id="s_' + esc(r.key) + '" value="' + esc(r.masked ? '' : r.value) + '" placeholder="' + esc(r.masked ? r.value : '') + '">' +
        '</div>' +
        '<button class="btn btn-primary btn-sm" data-k="' + esc(r.key) + '">บันทึก</button>';
      card.appendChild(f);
    });
    v.appendChild(card);

    const frontendCard = el('div', { class: 'card' });
    frontendCard.innerHTML =
      '<div class="card-header"><div class="card-title">Frontend — Apps Script URL</div></div>' +
      '<div class="field"><label class="field-label">URL ปัจจุบัน</label><input class="field-input" id="su_url" value="' + esc(API.getUrl()) + '"></div>' +
      '<div class="flex gap-2"><button class="btn btn-primary" id="btn-save-url">บันทึก URL</button>' +
      '<button class="btn btn-secondary" id="btn-test-url">ทดสอบเชื่อมต่อ</button></div>';
    v.appendChild(frontendCard);

    $$('button[data-k]', card).forEach(function (b) {
      b.addEventListener('click', async function () {
        const k = b.getAttribute('data-k');
        const val = $('#s_' + k).value;
        try { await withLoader(API.updateSetting(k, val)); toast('บันทึก', 'success'); renderSettings(); $('#view').innerHTML = ''; renderSettings(); }
        catch (e) { toast(e.message, 'error'); }
      });
    });
    $('#btn-save-url').addEventListener('click', function () {
      API.setUrl($('#su_url').value.trim());
      toast('บันทึก URL แล้ว', 'success');
    });
    $('#btn-test-url').addEventListener('click', async function () {
      try { const r = await withLoader(API.ping()); toast('เชื่อมต่อสำเร็จ — ' + r.version, 'success'); }
      catch (e) { toast('เชื่อมต่อไม่สำเร็จ: ' + e.message, 'error'); }
    });
  }

})();
