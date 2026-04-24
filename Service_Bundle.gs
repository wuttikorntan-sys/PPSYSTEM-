/** ===== Service_Bundle.gs =====
 * Composite endpoints that return everything a page needs in ONE call,
 * to minimize Apps Script Web App round-trip overhead (~500ms-3s per call).
 */

/** For Dashboard page — returns stats + today due + master data counts in 1 call. */
function getDashboardBundle(token) {
  try {
    const u = validateSession_(token);

    let orders = getAll_('Orders');
    if (!can_(u, 'order.viewAll')) {
      orders = orders.filter(function (r) { return String(r.created_by) === String(u.user_id); });
    }

    const today = todayIso_();
    const byStatus = {};
    ['DRAFT', 'WAITING_MATERIAL', 'IN_PRODUCTION', 'QC', 'READY', 'DELIVERED', 'CANCELLED']
      .forEach(function (s) { byStatus[s] = 0; });
    let urgent = 0, dueToday = 0, overdue = 0;
    const dueTodayList = [];
    orders.forEach(function (o) {
      const st = o.status || 'DRAFT';
      if (byStatus[st] === undefined) byStatus[st] = 0;
      byStatus[st]++;
      const isUrg = (o.urgent === true || String(o.urgent).toLowerCase() === 'true');
      if (isUrg && st !== 'DELIVERED' && st !== 'CANCELLED') urgent++;
      const due = fmtDate_(o.due_date, 'yyyy-MM-dd');
      const live = (st !== 'DELIVERED' && st !== 'CANCELLED');
      if (due === today && live) { dueToday++; dueTodayList.push(o); }
      if (due && due < today && live) overdue++;
    });

    const custs = getAll_('Customers');
    const cmap = {}; custs.forEach(function (c) { cmap[c.customer_id] = c; });
    const dueTodayEnriched = dueTodayList.map(function (o) {
      return Object.assign({}, o, { customer_name: cmap[o.customer_id] ? cmap[o.customer_id].name : '' });
    });

    const preorders = getAll_('PreOrderList');
    const pendingPreOrders = preorders.filter(function (p) { return p.status === 'PENDING'; }).length;

    const products = getAll_('Products');

    return ok_({
      stats: {
        total: orders.length,
        byStatus: byStatus,
        urgent: urgent,
        dueToday: dueToday,
        overdue: overdue,
        pendingPreOrders: pendingPreOrders
      },
      dueToday: dueTodayEnriched,
      counts: {
        customers: custs.length,
        products: products.length,
        materials: getAll_('Materials').length
      }
    });
  } catch (e) {
    return err_(e.message);
  }
}

/** For Order Form — returns customers + products + materials in 1 call. */
function getOrderFormBundle(token) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'order.create');
    return ok_({
      customers: getAll_('Customers'),
      products: getAll_('Products'),
      materials: getAll_('Materials')
    });
  } catch (e) {
    return err_(e.message);
  }
}

/** For Order List page — returns orders + customer map in 1 call. */
function getOrderListBundle(token, filter) {
  try {
    const u = validateSession_(token);
    let rows = getAll_('Orders');
    if (!can_(u, 'order.viewAll')) {
      rows = rows.filter(function (r) { return String(r.created_by) === String(u.user_id); });
    }
    if (filter) {
      if (filter.status) rows = rows.filter(function (r) { return r.status === filter.status; });
      if (filter.urgent !== undefined) {
        const want = !!filter.urgent;
        rows = rows.filter(function (r) { return (r.urgent === true || String(r.urgent).toLowerCase() === 'true') === want; });
      }
      if (filter.due_date) rows = rows.filter(function (r) { return fmtDate_(r.due_date, 'yyyy-MM-dd') === filter.due_date; });
      if (filter.customer_id) rows = rows.filter(function (r) { return r.customer_id === filter.customer_id; });
      if (filter.q) {
        const q = String(filter.q).toLowerCase();
        rows = rows.filter(function (r) { return String(r.order_no).toLowerCase().indexOf(q) >= 0; });
      }
    }
    rows.sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
    const custs = getAll_('Customers');
    const cmap = {}; custs.forEach(function (c) { cmap[c.customer_id] = c; });
    return ok_(rows.map(function (r) {
      return Object.assign({}, r, { customer_name: cmap[r.customer_id] ? cmap[r.customer_id].name : '' });
    }));
  } catch (e) { return err_(e.message); }
}
