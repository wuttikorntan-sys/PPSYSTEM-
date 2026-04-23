/**
 * PPPLUSH — API client (fetch wrapper for Apps Script JSON endpoint)
 *
 * Uses Content-Type: text/plain to avoid CORS preflight (Apps Script can't
 * respond to OPTIONS requests).
 */
(function () {
  'use strict';

  function getUrl() {
    return (window.APP_CONFIG && window.APP_CONFIG.APPS_SCRIPT_URL) || localStorage.getItem('pp_script_url') || '';
  }

  function setUrl(url) {
    localStorage.setItem('pp_script_url', url);
    if (window.APP_CONFIG) window.APP_CONFIG.APPS_SCRIPT_URL = url;
  }

  function token() { return localStorage.getItem('pp_token') || ''; }

  async function call(fn, args) {
    const url = getUrl();
    if (!url) throw new Error('ยังไม่ได้ตั้ง Apps Script URL');
    const res = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args || [] }),
      redirect: 'follow'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch (e) { throw new Error('Invalid JSON: ' + text.slice(0, 200)); }
    if (data && data.ok === false) {
      const err = new Error(data.error || 'Error');
      err.code = data.code;
      throw err;
    }
    return data && data.ok ? data.data : data;
  }

  function tokenized(fn) {
    return function () {
      const args = Array.prototype.slice.call(arguments);
      args.unshift(token());
      return call(fn, args);
    };
  }

  window.API = {
    raw: call,
    setUrl: setUrl,
    getUrl: getUrl,
    ping: function () { return call('ping', []); },
    // Auth (no token for login)
    login: function (u, p) { return call('login', [u, p]); },
    logout: function () { return call('logout', [token()]); },
    getCurrentUser: function () { return call('getCurrentUser', [token()]); },
    // Settings
    getSettings: tokenized('getSettings'),
    updateSetting: tokenized('updateSetting'),
    // Master
    listCustomers: tokenized('listCustomers'),
    upsertCustomer: tokenized('upsertCustomer'),
    deleteCustomer: tokenized('deleteCustomer'),
    listProducts: tokenized('listProducts'),
    upsertProduct: tokenized('upsertProduct'),
    deleteProduct: tokenized('deleteProduct'),
    listMaterials: tokenized('listMaterials'),
    upsertMaterial: tokenized('upsertMaterial'),
    deleteMaterial: tokenized('deleteMaterial'),
    // Orders
    createOrder: tokenized('createOrder'),
    listOrders: tokenized('listOrders'),
    getOrder: tokenized('getOrder'),
    updateOrder: tokenized('updateOrder'),
    changeStatus: tokenized('changeStatus'),
    cancelOrder: tokenized('cancelOrder'),
    // Items
    addOrderItem: tokenized('addOrderItem'),
    updateOrderItem: tokenized('updateOrderItem'),
    removeOrderItem: tokenized('removeOrderItem'),
    // PreOrder
    listPreOrders: tokenized('listPreOrders'),
    markPreOrderReceived: tokenized('markPreOrderReceived'),
    updatePreOrder: tokenized('updatePreOrder'),
    // QC
    submitQC: tokenized('submitQC'),
    getQCByOrder: tokenized('getQCByOrder'),
    // Files
    uploadFile: tokenized('uploadFile'),
    listFiles: tokenized('listFiles'),
    deleteFile: tokenized('deleteFile'),
    // Users
    listUsers: tokenized('listUsers'),
    createUser: tokenized('createUser'),
    updateUser: tokenized('updateUser'),
    resetPassword: tokenized('resetPassword'),
    changeOwnPassword: tokenized('changeOwnPassword'),
    // Dashboard
    getDashboardStats: tokenized('getDashboardStats'),
    getTodayDue: tokenized('getTodayDue')
  };
})();
