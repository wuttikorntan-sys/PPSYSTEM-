/** ===== Service_Customer.gs ===== */

function listCustomers(token) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'master.view');
    return ok_(getAll_('Customers'));
  } catch (e) { return err_(e.message); }
}

function upsertCustomer(token, payload) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'master.edit');
    require_(payload && payload.name, 'กรุณากรอกชื่อลูกค้า');
    const data = {
      customer_id: payload.customer_id || uuid_(),
      name: sanitizeStr_(payload.name),
      contact_person: sanitizeStr_(payload.contact_person || ''),
      phone: sanitizeStr_(payload.phone || ''),
      address: sanitizeStr_(payload.address || ''),
      note: sanitizeStr_(payload.note || '')
    };
    const exist = findOne_('Customers', 'customer_id', data.customer_id);
    if (exist) {
      updateById_('Customers', 'customer_id', data.customer_id, data);
    } else {
      appendRow_('Customers', data);
    }
    return ok_(data);
  } catch (e) { return err_(e.message); }
}

function deleteCustomer(token, customer_id) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'master.delete');
    deleteById_('Customers', 'customer_id', customer_id);
    return ok_(true);
  } catch (e) { return err_(e.message); }
}
