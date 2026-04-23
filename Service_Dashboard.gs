/** ===== Service_Dashboard.gs ===== */

function getDashboardStats(token) {
  try {
    const u = validateSession_(token);
    let orders = getAll_('Orders');
    if (!can_(u, 'order.viewAll')) {
      orders = orders.filter(function (r) { return String(r.created_by) === String(u.user_id); });
    }
    const today = todayIso_();
    const byStatus = {};
    ['DRAFT', 'WAITING_MATERIAL', 'IN_PRODUCTION', 'QC', 'READY', 'DELIVERED', 'CANCELLED'].forEach(function (s) { byStatus[s] = 0; });
    let urgent = 0, dueToday = 0, overdue = 0;
    orders.forEach(function (o) {
      const st = o.status || 'DRAFT';
      if (byStatus[st] === undefined) byStatus[st] = 0;
      byStatus[st]++;
      if (o.urgent === true || String(o.urgent).toLowerCase() === 'true') {
        if (st !== 'DELIVERED' && st !== 'CANCELLED') urgent++;
      }
      const due = fmtDate_(o.due_date, 'yyyy-MM-dd');
      if (due === today && st !== 'DELIVERED' && st !== 'CANCELLED') dueToday++;
      if (due && due < today && st !== 'DELIVERED' && st !== 'CANCELLED') overdue++;
    });
    return ok_({
      total: orders.length,
      byStatus: byStatus,
      urgent: urgent,
      dueToday: dueToday,
      overdue: overdue,
      pendingPreOrders: getAll_('PreOrderList').filter(function (p) { return p.status === 'PENDING'; }).length
    });
  } catch (e) { return err_(e.message); }
}

function getTodayDue(token) {
  try {
    const u = validateSession_(token);
    let orders = getAll_('Orders');
    if (!can_(u, 'order.viewAll')) {
      orders = orders.filter(function (r) { return String(r.created_by) === String(u.user_id); });
    }
    const today = todayIso_();
    const due = orders.filter(function (o) {
      const d = fmtDate_(o.due_date, 'yyyy-MM-dd');
      return d === today && o.status !== 'DELIVERED' && o.status !== 'CANCELLED';
    });
    const custs = getAll_('Customers');
    const cmap = {}; custs.forEach(function (c) { cmap[c.customer_id] = c; });
    return ok_(due.map(function (o) {
      return Object.assign({}, o, { customer_name: cmap[o.customer_id] ? cmap[o.customer_id].name : '' });
    }));
  } catch (e) { return err_(e.message); }
}
