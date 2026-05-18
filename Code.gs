/** ===== Code.gs =====
 * Web App entry: serves the embedded UI (legacy) AND a JSON API for the
 * standalone GitHub-Pages-hosted UI.
 *
 * Frontend on GitHub Pages calls:
 *   POST <SCRIPT_URL>/exec   Content-Type: text/plain
 *   body: { fn: "login", args: ["admin","admin123"] }
 *
 * text/plain avoids CORS preflight (Apps Script can't reply to OPTIONS).
 */

function doGet(e) {
  // UI lives on GitHub Pages; this endpoint is JSON-only via doPost.
  // Return a small landing page that redirects there for anyone hitting /exec directly.
  const pagesUrl = 'https://wuttikorntan-sys.github.io/PPSYSTEM-/';
  const html =
    '<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">' +
    '<meta http-equiv="refresh" content="0;url=' + pagesUrl + '">' +
    '<title>PPPLUSH</title>' +
    '<style>body{font-family:system-ui,sans-serif;background:#060606;color:#fafafa;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}a{color:#f97316;font-weight:600;}</style>' +
    '</head><body><div><h2>🎨 PPPLUSH</h2><p>กำลังพาไปยัง <a href="' + pagesUrl + '">' + pagesUrl + '</a></p></div></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('PPPLUSH')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return jsonOut_(err_('Empty body'));
    const body = JSON.parse(e.postData.contents);
    const fn = String(body.fn || '');
    const args = body.args || [];
    if (!API_REGISTRY[fn]) return jsonOut_(err_('Unknown function: ' + fn, 'NO_FN'));
    const result = API_REGISTRY[fn].apply(null, args);
    return jsonOut_(result);
  } catch (err) {
    return jsonOut_(err_(err.message));
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Whitelist of callable functions */
const API_REGISTRY = {
  ping: ping,
  // Auth
  login: login,
  logout: logout,
  getCurrentUser: getCurrentUser,
  // Settings
  getSettings: getSettings,
  updateSetting: updateSetting,
  // Master
  listCustomers: listCustomers,
  upsertCustomer: upsertCustomer,
  deleteCustomer: deleteCustomer,
  listProducts: listProducts,
  upsertProduct: upsertProduct,
  deleteProduct: deleteProduct,
  listMaterials: listMaterials,
  upsertMaterial: upsertMaterial,
  deleteMaterial: deleteMaterial,
  // Orders
  createOrder: createOrder,
  listOrders: listOrders,
  getOrder: getOrder,
  updateOrder: updateOrder,
  changeStatus: changeStatus,
  cancelOrder: cancelOrder,
  // Items
  addOrderItem: addOrderItem,
  updateOrderItem: updateOrderItem,
  removeOrderItem: removeOrderItem,
  // PreOrder
  listPreOrders: listPreOrders,
  markPreOrderReceived: markPreOrderReceived,
  updatePreOrder: updatePreOrder,
  // QC
  submitQC: submitQC,
  getQCByOrder: getQCByOrder,
  // Files
  uploadFile: uploadFile,
  listFiles: listFiles,
  deleteFile: deleteFile,
  // Users
  listUsers: listUsers,
  createUser: createUser,
  updateUser: updateUser,
  resetPassword: resetPassword,
  changeOwnPassword: changeOwnPassword,
  // Dashboard
  getDashboardStats: getDashboardStats,
  getTodayDue: getTodayDue,
  // Bundle endpoints (faster — one call instead of many)
  getDashboardBundle: getDashboardBundle,
  getOrderFormBundle: getOrderFormBundle,
  getOrderListBundle: getOrderListBundle
};

/** Health check */
function ping() {
  return ok_({ time: nowIso_(), version: 'v2' });
}
