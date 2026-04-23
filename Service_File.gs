/** ===== Service_File.gs =====
 * Upload attachments to Drive: ROOT/Orders/{order_no}/
 */

function uploadFile(token, order_id, base64DataUrl, fileName, mimeType) {
  try {
    const u = validateSession_(token);
    const ord = findOne_('Orders', 'order_id', order_id);
    require_(ord, 'ไม่พบใบงาน');
    if (isOwner_(u, ord)) {
      ensure_(u, 'file.uploadOwn');
    } else {
      ensure_(u, 'file.uploadAny');
    }
    require_(base64DataUrl, 'ไม่พบไฟล์');
    require_(fileName, 'fileName required');

    // Strip data URL prefix if present
    let b64 = String(base64DataUrl);
    const comma = b64.indexOf(',');
    if (comma > -1 && b64.indexOf('base64') > -1) b64 = b64.slice(comma + 1);
    const bytes = Utilities.base64Decode(b64);
    const mime = mimeType || 'application/octet-stream';
    const blob = Utilities.newBlob(bytes, mime, fileName);

    // Folder structure
    const root = getOrCreateRoot_();
    const ordersFolder = getOrCreateChild_(root, 'Orders');
    let orderFolder;
    if (ord.drive_folder_id) {
      try { orderFolder = DriveApp.getFolderById(ord.drive_folder_id); } catch (e) { orderFolder = null; }
    }
    if (!orderFolder) {
      orderFolder = getOrCreateChild_(ordersFolder, ord.order_no);
      updateById_('Orders', 'order_id', order_id, { drive_folder_id: orderFolder.getId() });
    }
    const file = orderFolder.createFile(blob);

    appendRow_('Attachments', {
      file_id: uuid_(),
      order_id: order_id,
      drive_file_id: file.getId(),
      file_name: file.getName(),
      mime_type: mime,
      uploaded_by: u.user_id,
      uploaded_at: nowIso_()
    });
    return ok_({
      drive_file_id: file.getId(),
      url: file.getUrl(),
      name: file.getName()
    });
  } catch (e) { return err_(e.message); }
}

function listFiles(token, order_id) {
  try {
    const u = validateSession_(token);
    const ord = findOne_('Orders', 'order_id', order_id);
    require_(ord, 'ไม่พบใบงาน');
    if (!can_(u, 'order.viewAll') && !isOwner_(u, ord)) throw new Error('FORBIDDEN');
    const rows = findBy_('Attachments', 'order_id', order_id);
    const enriched = rows.map(function (r) {
      let url = '';
      try { url = DriveApp.getFileById(r.drive_file_id).getUrl(); } catch (e) {}
      return Object.assign({}, r, { url: url });
    });
    return ok_(enriched);
  } catch (e) { return err_(e.message); }
}

function deleteFile(token, file_id) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'file.delete');
    const row = findOne_('Attachments', 'file_id', file_id);
    require_(row, 'ไม่พบไฟล์');
    try { DriveApp.getFileById(row.drive_file_id).setTrashed(true); } catch (e) {}
    deleteById_('Attachments', 'file_id', file_id);
    return ok_(true);
  } catch (e) { return err_(e.message); }
}

function getOrCreateRoot_() {
  const rootId = getSetting_('DRIVE_ROOT_ID', '');
  if (rootId) {
    try { return DriveApp.getFolderById(rootId); } catch (e) {}
  }
  // create new root in user's My Drive
  const folder = DriveApp.createFolder('PPPLUSH_FILES');
  const exist = findOne_('Settings', 'key', 'DRIVE_ROOT_ID');
  if (exist) updateById_('Settings', 'key', 'DRIVE_ROOT_ID', { value: folder.getId(), updated_at: nowIso_() });
  else appendRow_('Settings', { key: 'DRIVE_ROOT_ID', value: folder.getId(), updated_at: nowIso_() });
  return folder;
}

function getOrCreateChild_(parent, name) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}
