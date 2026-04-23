/** ===== Service_Order.gs =====
 * Order CRUD + workflow.
 * Status flow: DRAFT -> WAITING_MATERIAL -> IN_PRODUCTION -> QC -> READY -> DELIVERED (+ CANCELLED)
 */

const STATUS_FLOW = {
  DRAFT: ['WAITING_MATERIAL', 'IN_PRODUCTION', 'CANCELLED'],
  WAITING_MATERIAL: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['QC', 'CANCELLED'],
  QC: ['READY', 'IN_PRODUCTION', 'CANCELLED'],
  READY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: []
};

/**
 * createOrder(token, payload)
 * payload = {
 *   customer_id, receive_date, due_date, urgent (bool), note,
 *   items: [{product_id, qty, unit, formula_code, formula_detail, qc_required}],
 *   materials: [{item_id?, material_id, qty_needed}]   // optional
 * }
 */
function createOrder(token, payload) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'order.create');
    require_(payload && payload.customer_id, 'กรุณาเลือกลูกค้า');
    require_(payload.items && payload.items.length, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');

    const seq = countRows_('Orders') + 1;
    const orderId = uuid_();
    const orderNo = generateOrderNo_(seq);

    const urgent = !!payload.urgent;
    const leadDays = Number(getSetting_(urgent ? 'LEAD_TIME_URGENT' : 'LEAD_TIME_NORMAL', urgent ? 2 : 3));
    const receiveDate = payload.receive_date || todayIso_();
    const dueDate = payload.due_date || fmtDate_(addDays_(receiveDate, leadDays), 'yyyy-MM-dd');

    let totalQty = 0;
    payload.items.forEach(function (it) { totalQty += Number(it.qty || 0); });

    appendRow_('Orders', {
      order_id: orderId,
      order_no: orderNo,
      customer_id: payload.customer_id,
      created_by: u.user_id,
      created_at: nowIso_(),
      receive_date: receiveDate,
      due_date: dueDate,
      urgent: urgent,
      status: 'DRAFT',
      total_qty: totalQty,
      drive_folder_id: '',
      note: sanitizeStr_(payload.note || '')
    });

    // Items
    payload.items.forEach(function (it) {
      const itemId = it.item_id || uuid_();
      appendRow_('OrderItems', {
        item_id: itemId,
        order_id: orderId,
        product_id: it.product_id,
        qty: Number(it.qty || 0),
        unit: it.unit || 'L',
        formula_code: sanitizeStr_(it.formula_code || ''),
        formula_detail: sanitizeStr_(it.formula_detail || ''),
        qc_required: it.qc_required !== false
      });
    });

    // PreOrder check
    let nextStatus = 'DRAFT';
    if (payload.materials && payload.materials.length) {
      const created = buildPreOrderForOrder_(orderId, payload.materials, u.user_id);
      const hasPending = created.some(function (p) { return p.status === 'PENDING'; });
      nextStatus = hasPending ? 'WAITING_MATERIAL' : 'IN_PRODUCTION';
      changeOrderStatus_(orderId, nextStatus, u, hasPending ? 'รอวัตถุดิบ' : 'วัตถุดิบครบ');
    }

    // Initial log
    logStatus_(orderId, '', 'DRAFT', u.user_id, 'สร้างใบงาน');

    // Notify
    safeNotifyStatus_(orderId, '', nextStatus);

    return ok_({ order_id: orderId, order_no: orderNo, status: nextStatus });
  } catch (e) {
    return err_(e.message);
  }
}

function listOrders(token, filter) {
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
        rows = rows.filter(function (r) { return !!r.urgent === want; });
      }
      if (filter.due_date) rows = rows.filter(function (r) { return fmtDate_(r.due_date, 'yyyy-MM-dd') === filter.due_date; });
      if (filter.customer_id) rows = rows.filter(function (r) { return r.customer_id === filter.customer_id; });
      if (filter.q) {
        const q = String(filter.q).toLowerCase();
        rows = rows.filter(function (r) { return String(r.order_no).toLowerCase().indexOf(q) >= 0; });
      }
    }
    // sort newest first
    rows.sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
    // join customer name
    const custs = getAll_('Customers');
    const custMap = {}; custs.forEach(function (c) { custMap[c.customer_id] = c; });
    return ok_(rows.map(function (r) {
      return Object.assign({}, r, {
        customer_name: custMap[r.customer_id] ? custMap[r.customer_id].name : ''
      });
    }));
  } catch (e) { return err_(e.message); }
}

function getOrder(token, order_id) {
  try {
    const u = validateSession_(token);
    const ord = findOne_('Orders', 'order_id', order_id);
    require_(ord, 'ไม่พบใบงาน');
    if (!can_(u, 'order.viewAll') && !isOwner_(u, ord)) throw new Error('FORBIDDEN');
    const items = findBy_('OrderItems', 'order_id', order_id);
    const products = getAll_('Products');
    const pMap = {}; products.forEach(function (p) { pMap[p.product_id] = p; });
    const enrichedItems = items.map(function (it) {
      return Object.assign({}, it, { product: pMap[it.product_id] || null });
    });
    const cust = findOne_('Customers', 'customer_id', ord.customer_id);
    const preorders = findBy_('PreOrderList', 'order_id', order_id);
    const qc = findBy_('QCRecords', 'order_id', order_id);
    const logs = findBy_('StatusLog', 'order_id', order_id)
      .sort(function (a, b) { return String(a.changed_at).localeCompare(String(b.changed_at)); });
    const files = findBy_('Attachments', 'order_id', order_id);
    return ok_({
      order: ord,
      customer: cust,
      items: enrichedItems,
      preorders: preorders,
      qc: qc,
      logs: logs,
      files: files
    });
  } catch (e) { return err_(e.message); }
}

function updateOrder(token, order_id, patch) {
  try {
    const u = validateSession_(token);
    const ord = findOne_('Orders', 'order_id', order_id);
    require_(ord, 'ไม่พบใบงาน');
    if (isOwner_(u, ord) && ord.status === 'DRAFT') {
      ensure_(u, 'order.editOwnDraft');
    } else {
      ensure_(u, 'order.editAny');
    }
    const allowed = ['receive_date', 'due_date', 'urgent', 'note', 'customer_id'];
    const safe = {};
    allowed.forEach(function (k) { if (patch[k] !== undefined) safe[k] = patch[k]; });
    updateById_('Orders', 'order_id', order_id, safe);
    return ok_(true);
  } catch (e) { return err_(e.message); }
}

function changeStatus(token, order_id, newStatus, remark) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'order.changeStatus');
    require_(isValidStatus_(newStatus), 'สถานะไม่ถูกต้อง');
    const ord = findOne_('Orders', 'order_id', order_id);
    require_(ord, 'ไม่พบใบงาน');
    const allowed = STATUS_FLOW[ord.status] || [];
    require_(allowed.indexOf(newStatus) >= 0, 'เปลี่ยนสถานะจาก ' + ord.status + ' ไป ' + newStatus + ' ไม่ได้');
    changeOrderStatus_(order_id, newStatus, u, remark);
    safeNotifyStatus_(order_id, ord.status, newStatus, remark);
    return ok_({ status: newStatus });
  } catch (e) { return err_(e.message); }
}

/** Internal: change status without permission check (used by automatic transitions) */
function changeOrderStatus_(order_id, newStatus, user, remark) {
  const ord = findOne_('Orders', 'order_id', order_id);
  if (!ord) return;
  updateById_('Orders', 'order_id', order_id, { status: newStatus });
  logStatus_(order_id, ord.status, newStatus, user.user_id, remark || '');
}

function logStatus_(order_id, fromStatus, toStatus, user_id, remark) {
  appendRow_('StatusLog', {
    log_id: uuid_(),
    order_id: order_id,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: user_id,
    changed_at: nowIso_(),
    remark: remark || ''
  });
}

function cancelOrder(token, order_id, remark) {
  try {
    const u = validateSession_(token);
    const ord = findOne_('Orders', 'order_id', order_id);
    require_(ord, 'ไม่พบใบงาน');
    if (isOwner_(u, ord) && ord.status === 'DRAFT') {
      ensure_(u, 'order.cancelOwnDraft');
    } else {
      ensure_(u, 'order.cancelAny');
    }
    changeOrderStatus_(order_id, 'CANCELLED', u, remark || 'ยกเลิก');
    safeNotifyStatus_(order_id, ord.status, 'CANCELLED', remark);
    return ok_(true);
  } catch (e) { return err_(e.message); }
}

function safeNotifyStatus_(order_id, from, to, remark) {
  try {
    if (typeof notifyStatusChange_ === 'function') notifyStatusChange_(order_id, from, to, remark);
  } catch (e) {
    // notifications must never break business logic
  }
}
