/** ===== Service_OrderItem.gs ===== */

function addOrderItem(token, order_id, item) {
  try {
    const u = validateSession_(token);
    const ord = findOne_('Orders', 'order_id', order_id);
    require_(ord, 'ไม่พบใบงาน');
    if (isOwner_(u, ord) && ord.status === 'DRAFT') {
      ensure_(u, 'order.editOwnDraft');
    } else {
      ensure_(u, 'order.editAny');
    }
    require_(item && item.product_id, 'product_id required');
    const data = {
      item_id: item.item_id || uuid_(),
      order_id: order_id,
      product_id: item.product_id,
      qty: Number(item.qty || 0),
      unit: item.unit || 'L',
      formula_code: sanitizeStr_(item.formula_code || ''),
      formula_detail: sanitizeStr_(item.formula_detail || ''),
      qc_required: item.qc_required !== false
    };
    appendRow_('OrderItems', data);
    recomputeOrderTotal_(order_id);
    return ok_(data);
  } catch (e) { return err_(e.message); }
}

function updateOrderItem(token, item_id, patch) {
  try {
    const u = validateSession_(token);
    const it = findOne_('OrderItems', 'item_id', item_id);
    require_(it, 'ไม่พบ item');
    const ord = findOne_('Orders', 'order_id', it.order_id);
    if (isOwner_(u, ord) && ord.status === 'DRAFT') {
      ensure_(u, 'order.editOwnDraft');
    } else {
      ensure_(u, 'order.editAny');
    }
    const allowed = ['qty', 'unit', 'formula_code', 'formula_detail', 'qc_required'];
    const safe = {};
    allowed.forEach(function (k) { if (patch[k] !== undefined) safe[k] = patch[k]; });
    updateById_('OrderItems', 'item_id', item_id, safe);
    recomputeOrderTotal_(it.order_id);
    return ok_(true);
  } catch (e) { return err_(e.message); }
}

function removeOrderItem(token, item_id) {
  try {
    const u = validateSession_(token);
    const it = findOne_('OrderItems', 'item_id', item_id);
    require_(it, 'ไม่พบ item');
    const ord = findOne_('Orders', 'order_id', it.order_id);
    if (isOwner_(u, ord) && ord.status === 'DRAFT') {
      ensure_(u, 'order.editOwnDraft');
    } else {
      ensure_(u, 'order.editAny');
    }
    deleteById_('OrderItems', 'item_id', item_id);
    recomputeOrderTotal_(it.order_id);
    return ok_(true);
  } catch (e) { return err_(e.message); }
}

function recomputeOrderTotal_(order_id) {
  const items = findBy_('OrderItems', 'order_id', order_id);
  const total = items.reduce(function (s, it) { return s + Number(it.qty || 0); }, 0);
  updateById_('Orders', 'order_id', order_id, { total_qty: total });
}
