/** ===== Lib_Sheet.gs =====
 * Generic sheet I/O. Treats first row as headers.
 * Use SHEET_ID from script properties (or fallback to bound spreadsheet).
 */

const SHEET_ID = '1JWXzrkgW_Mb5YU8HnCva_ySCp_2QMT-hejThDZR3Aw8';

function ss_() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}

function getHeaders_(sheetName) {
  const sh = sheet_(sheetName);
  if (sh.getLastRow() === 0) return [];
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

function rowToObj_(headers, row) {
  const o = {};
  for (let i = 0; i < headers.length; i++) {
    o[headers[i]] = row[i];
  }
  return o;
}

function objToRow_(headers, obj) {
  return headers.map(function (h) {
    const v = obj[h];
    return (v === undefined || v === null) ? '' : v;
  });
}

function getAll_(sheetName) {
  const sh = sheet_(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const headers = getHeaders_(sheetName);
  const values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (r) { return rowToObj_(headers, r); });
}

function findBy_(sheetName, key, value) {
  const all = getAll_(sheetName);
  return all.filter(function (r) { return String(r[key]) === String(value); });
}

function findOne_(sheetName, key, value) {
  const list = findBy_(sheetName, key, value);
  return list.length ? list[0] : null;
}

function appendRow_(sheetName, obj) {
  const sh = sheet_(sheetName);
  const headers = getHeaders_(sheetName);
  const row = objToRow_(headers, obj);
  sh.appendRow(row);
  return obj;
}

function updateById_(sheetName, idColumn, idValue, patch) {
  const sh = sheet_(sheetName);
  const headers = getHeaders_(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  const idIdx = headers.indexOf(idColumn);
  if (idIdx < 0) throw new Error('ID column not found: ' + idColumn);
  const data = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(idValue)) {
      const merged = rowToObj_(headers, data[i]);
      Object.keys(patch).forEach(function (k) { merged[k] = patch[k]; });
      const newRow = objToRow_(headers, merged);
      sh.getRange(i + 2, 1, 1, headers.length).setValues([newRow]);
      return merged;
    }
  }
  return null;
}

function deleteById_(sheetName, idColumn, idValue) {
  const sh = sheet_(sheetName);
  const headers = getHeaders_(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return false;
  const idIdx = headers.indexOf(idColumn);
  if (idIdx < 0) throw new Error('ID column not found: ' + idColumn);
  const data = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(idValue)) {
      sh.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function countRows_(sheetName) {
  const sh = sheet_(sheetName);
  return Math.max(0, sh.getLastRow() - 1);
}

/** ===== Schema definition + setup ===== */

const SCHEMA = {
  Users: ['user_id', 'username', 'password_hash', 'salt', 'full_name', 'role', 'line_user_id', 'active', 'created_at'],
  Sessions: ['token', 'user_id', 'created_at', 'expires_at'],
  Customers: ['customer_id', 'name', 'contact_person', 'phone', 'address', 'note'],
  Products: ['product_id', 'code', 'name', 'type', 'unit', 'default_formula'],
  Materials: ['material_id', 'code', 'name', 'unit', 'stock_qty', 'reorder_point'],
  Orders: ['order_id', 'order_no', 'customer_id', 'created_by', 'created_at', 'receive_date', 'due_date', 'urgent', 'status', 'total_qty', 'drive_folder_id', 'note'],
  OrderItems: ['item_id', 'order_id', 'product_id', 'qty', 'unit', 'formula_code', 'formula_detail', 'qc_required'],
  PreOrderList: ['preorder_id', 'order_id', 'item_id', 'material_id', 'qty_needed', 'qty_available', 'status', 'supplier', 'eta', 'updated_by'],
  QCRecords: ['qc_id', 'order_id', 'item_id', 'l_value', 'a_value', 'b_value', 'formula_actual', 'pass', 'qc_by', 'qc_at', 'remark'],
  StatusLog: ['log_id', 'order_id', 'from_status', 'to_status', 'changed_by', 'changed_at', 'remark'],
  Attachments: ['file_id', 'order_id', 'drive_file_id', 'file_name', 'mime_type', 'uploaded_by', 'uploaded_at'],
  Settings: ['key', 'value', 'updated_at'],
  Notifications: ['notify_id', 'order_id', 'type', 'message', 'sent_at', 'status']
};

/**
 * Run ONCE from the Apps Script editor to bootstrap.
 * Creates all tabs with headers, seeds default Settings, and a default admin user.
 */
function setupSheets() {
  const ss = ss_();
  Object.keys(SCHEMA).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SCHEMA[name];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f0f0f0');
  });

  // Remove default 'Sheet1' if empty
  const def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(def);
  }

  // Seed Settings
  const settings = [
    ['LINE_TOKEN', '', nowIso_()],
    ['LEAD_TIME_NORMAL', '3', nowIso_()],
    ['LEAD_TIME_URGENT', '2', nowIso_()],
    ['COMPANY_NAME', 'PPPLUSH', nowIso_()],
    ['DRIVE_ROOT_ID', '', nowIso_()],
    ['SESSION_TTL_HOURS', '8', nowIso_()]
  ];
  const settingSh = sheet_('Settings');
  settings.forEach(function (row) {
    const exist = findOne_('Settings', 'key', row[0]);
    if (!exist) settingSh.appendRow(row);
  });

  // Seed default admin user (admin / admin123)
  const adminExist = findOne_('Users', 'username', 'admin');
  if (!adminExist) {
    const salt = randomSalt_();
    appendRow_('Users', {
      user_id: uuid_(),
      username: 'admin',
      password_hash: hashPassword_('admin123', salt),
      salt: salt,
      full_name: 'System Administrator',
      role: 'Admin',
      line_user_id: '',
      active: true,
      created_at: nowIso_()
    });
  }

  return 'Setup complete. Default admin = admin / admin123 (change immediately!)';
}
