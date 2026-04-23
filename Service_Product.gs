/** ===== Service_Product.gs ===== */

function listProducts(token) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'master.view');
    return ok_(getAll_('Products'));
  } catch (e) { return err_(e.message); }
}

function upsertProduct(token, payload) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'master.edit');
    require_(payload && payload.name, 'กรุณากรอกชื่อสินค้า');
    const data = {
      product_id: payload.product_id || uuid_(),
      code: sanitizeStr_(payload.code || ''),
      name: sanitizeStr_(payload.name),
      type: payload.type === 'Automotive' ? 'Automotive' : 'Industrial',
      unit: sanitizeStr_(payload.unit || 'L'),
      default_formula: sanitizeStr_(payload.default_formula || '')
    };
    const exist = findOne_('Products', 'product_id', data.product_id);
    if (exist) {
      updateById_('Products', 'product_id', data.product_id, data);
    } else {
      appendRow_('Products', data);
    }
    return ok_(data);
  } catch (e) { return err_(e.message); }
}

function deleteProduct(token, product_id) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'master.delete');
    deleteById_('Products', 'product_id', product_id);
    return ok_(true);
  } catch (e) { return err_(e.message); }
}
