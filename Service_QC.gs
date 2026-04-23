/** ===== Service_QC.gs =====
 * QC entry on the work ticket (L*a*b* + actual formula).
 */

function submitQC(token, payload) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'qc.submit');
    require_(payload && payload.order_id, 'order_id required');
    require_(payload.item_id, 'item_id required');
    const ord = findOne_('Orders', 'order_id', payload.order_id);
    require_(ord, 'ไม่พบใบงาน');
    const it = findOne_('OrderItems', 'item_id', payload.item_id);
    require_(it, 'ไม่พบ item');

    const data = {
      qc_id: uuid_(),
      order_id: payload.order_id,
      item_id: payload.item_id,
      l_value: payload.l_value !== undefined && payload.l_value !== '' ? Number(payload.l_value) : '',
      a_value: payload.a_value !== undefined && payload.a_value !== '' ? Number(payload.a_value) : '',
      b_value: payload.b_value !== undefined && payload.b_value !== '' ? Number(payload.b_value) : '',
      formula_actual: sanitizeStr_(payload.formula_actual || ''),
      pass: !!payload.pass,
      qc_by: u.user_id,
      qc_at: nowIso_(),
      remark: sanitizeStr_(payload.remark || '')
    };
    appendRow_('QCRecords', data);

    // If all required items have at least one PASS QC record, auto-bump to READY
    if (data.pass && ord.status === 'QC') {
      const items = findBy_('OrderItems', 'order_id', payload.order_id);
      const required = items.filter(function (i) { return i.qc_required !== false && String(i.qc_required).toLowerCase() !== 'false'; });
      const allQc = findBy_('QCRecords', 'order_id', payload.order_id);
      const passedItemIds = {};
      allQc.forEach(function (q) { if (q.pass) passedItemIds[q.item_id] = true; });
      const allPassed = required.every(function (i) { return passedItemIds[i.item_id]; });
      if (allPassed) {
        changeOrderStatus_(payload.order_id, 'READY', u, 'QC ผ่านครบทุกรายการ');
        safeNotifyStatus_(payload.order_id, 'QC', 'READY', 'QC ผ่านครบทุกรายการ');
      }
    }
    return ok_(data);
  } catch (e) { return err_(e.message); }
}

function getQCByOrder(token, order_id) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'qc.view');
    return ok_(findBy_('QCRecords', 'order_id', order_id));
  } catch (e) { return err_(e.message); }
}
