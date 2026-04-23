/** ===== Service_Material.gs =====
 * Materials master + auto-generate PreOrder rows when stock < needed.
 */

function listMaterials(token) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'master.view');
    return ok_(getAll_('Materials'));
  } catch (e) { return err_(e.message); }
}

function upsertMaterial(token, payload) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'master.edit');
    require_(payload && payload.name, 'กรุณากรอกชื่อวัตถุดิบ');
    const data = {
      material_id: payload.material_id || uuid_(),
      code: sanitizeStr_(payload.code || ''),
      name: sanitizeStr_(payload.name),
      unit: sanitizeStr_(payload.unit || 'L'),
      stock_qty: Number(payload.stock_qty || 0),
      reorder_point: Number(payload.reorder_point || 0)
    };
    const exist = findOne_('Materials', 'material_id', data.material_id);
    if (exist) {
      updateById_('Materials', 'material_id', data.material_id, data);
    } else {
      appendRow_('Materials', data);
    }
    return ok_(data);
  } catch (e) { return err_(e.message); }
}

function deleteMaterial(token, material_id) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'master.delete');
    deleteById_('Materials', 'material_id', material_id);
    return ok_(true);
  } catch (e) { return err_(e.message); }
}

/**
 * Build/refresh PreOrder rows for an order.
 * For each OrderItem the user can specify required materials (via items[i].materials = [{material_id, qty}])
 * If not provided, the function only checks materials already linked to the order.
 */
function buildPreOrderForOrder_(orderId, materialReqs, userId) {
  // materialReqs: [{ item_id, material_id, qty_needed }, ...]
  if (!materialReqs || !materialReqs.length) return [];
  const created = [];
  materialReqs.forEach(function (req) {
    const mat = findOne_('Materials', 'material_id', req.material_id);
    const stock = mat ? Number(mat.stock_qty || 0) : 0;
    const needed = Number(req.qty_needed || 0);
    const status = (stock >= needed) ? 'RECEIVED' : 'PENDING';
    const row = {
      preorder_id: uuid_(),
      order_id: orderId,
      item_id: req.item_id || '',
      material_id: req.material_id,
      qty_needed: needed,
      qty_available: stock,
      status: status,
      supplier: '',
      eta: '',
      updated_by: userId || ''
    };
    appendRow_('PreOrderList', row);
    created.push(row);
  });
  return created;
}

function listPreOrders(token, filter) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'preorder.view');
    let rows = getAll_('PreOrderList');
    if (filter && filter.status) rows = rows.filter(function (r) { return r.status === filter.status; });
    if (filter && filter.order_id) rows = rows.filter(function (r) { return r.order_id === filter.order_id; });
    // join material/order info
    const mats = getAll_('Materials');
    const orders = getAll_('Orders');
    const matMap = {}; mats.forEach(function (m) { matMap[m.material_id] = m; });
    const ordMap = {}; orders.forEach(function (o) { ordMap[o.order_id] = o; });
    return ok_(rows.map(function (r) {
      return Object.assign({}, r, {
        material: matMap[r.material_id] || null,
        order_no: ordMap[r.order_id] ? ordMap[r.order_id].order_no : ''
      });
    }));
  } catch (e) { return err_(e.message); }
}

function markPreOrderReceived(token, preorder_id, qty_available) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'preorder.manage');
    const row = findOne_('PreOrderList', 'preorder_id', preorder_id);
    require_(row, 'PreOrder ไม่พบ');
    const newQty = qty_available !== undefined ? Number(qty_available) : Number(row.qty_needed);
    updateById_('PreOrderList', 'preorder_id', preorder_id, {
      status: 'RECEIVED',
      qty_available: newQty,
      updated_by: u.user_id
    });
    // Reduce material stock by qty_needed (it was used)
    const mat = findOne_('Materials', 'material_id', row.material_id);
    if (mat) {
      const newStock = Number(mat.stock_qty || 0) + (newQty - Number(row.qty_available || 0));
      updateById_('Materials', 'material_id', row.material_id, { stock_qty: newStock });
    }
    // If all preorders for this order are RECEIVED, auto-bump order status
    const remaining = findBy_('PreOrderList', 'order_id', row.order_id)
      .filter(function (p) { return p.status !== 'RECEIVED'; });
    if (remaining.length === 0) {
      const ord = findOne_('Orders', 'order_id', row.order_id);
      if (ord && ord.status === 'WAITING_MATERIAL') {
        changeOrderStatus_(ord.order_id, 'IN_PRODUCTION', u, 'วัตถุดิบครบ — เริ่มผลิต');
      }
    }
    return ok_(true);
  } catch (e) { return err_(e.message); }
}

function updatePreOrder(token, preorder_id, patch) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'preorder.manage');
    const allowed = ['supplier', 'eta', 'status', 'qty_available'];
    const safe = {};
    allowed.forEach(function (k) { if (patch[k] !== undefined) safe[k] = patch[k]; });
    safe.updated_by = u.user_id;
    updateById_('PreOrderList', 'preorder_id', preorder_id, safe);
    return ok_(true);
  } catch (e) { return err_(e.message); }
}
