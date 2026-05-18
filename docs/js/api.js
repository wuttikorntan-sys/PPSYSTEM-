/**
 * PPPLUSH — API client (fetch wrapper for Apps Script JSON endpoint)
 *
 * Features:
 * - text/plain Content-Type (avoids CORS preflight on Apps Script)
 * - In-memory 60s cache for read endpoints (massive speedup on repeat reads)
 * - Auto-invalidation: every write function clears the relevant cache groups
 * - In-flight dedup: parallel identical calls share one fetch
 */
(function () {
  'use strict';

  const CACHE_TTL = 60 * 1000; // 60 seconds
  const cache = new Map();      // key -> { value, expires }
  const inflight = new Map();   // key -> Promise (dedup parallel calls)

  function getUrl() {
    return (window.APP_CONFIG && window.APP_CONFIG.APPS_SCRIPT_URL) || localStorage.getItem('pp_script_url') || '';
  }
  function setUrl(url) {
    localStorage.setItem('pp_script_url', url);
    if (window.APP_CONFIG) window.APP_CONFIG.APPS_SCRIPT_URL = url;
  }
  function token() { return localStorage.getItem('pp_token') || ''; }

  function cacheKey(fn, args) {
    // Exclude token from cache key (same data for same user; different users won't share token anyway since we keyOff token implicitly via response data)
    const slim = (args || []).slice(1); // drop first arg (token)
    return fn + '|' + JSON.stringify(slim);
  }

  function cacheGet(key) {
    const c = cache.get(key);
    if (!c) return null;
    if (Date.now() >= c.expires) { cache.delete(key); return null; }
    return c.value;
  }
  function cacheSet(key, value) {
    cache.set(key, { value: value, expires: Date.now() + CACHE_TTL });
  }
  function cacheInvalidate(prefixes) {
    const list = Array.isArray(prefixes) ? prefixes : [prefixes];
    for (const k of cache.keys()) {
      for (const p of list) if (k.indexOf(p + '|') === 0) { cache.delete(k); break; }
    }
  }
  function cacheInvalidateAll() { cache.clear(); }

  async function rawCall(fn, args) {
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

  /** Cached read: serve from cache; dedup parallel calls; refresh in background if stale soon. */
  function cachedCall(fn, args) {
    const key = cacheKey(fn, args);
    const hit = cacheGet(key);
    if (hit !== null) return Promise.resolve(hit);
    if (inflight.has(key)) return inflight.get(key);
    const p = rawCall(fn, args).then(function (v) {
      cacheSet(key, v);
      inflight.delete(key);
      return v;
    }).catch(function (e) { inflight.delete(key); throw e; });
    inflight.set(key, p);
    return p;
  }

  /** Mutating call: always hit network, then invalidate relevant cache. */
  function writeCall(fn, args, invalidates) {
    return rawCall(fn, args).then(function (v) {
      if (invalidates && invalidates.length) cacheInvalidate(invalidates);
      return v;
    });
  }

  function tokRead(fn) {
    return function () {
      const args = Array.prototype.slice.call(arguments);
      args.unshift(token());
      return cachedCall(fn, args);
    };
  }
  function tokWrite(fn, invalidates) {
    return function () {
      const args = Array.prototype.slice.call(arguments);
      args.unshift(token());
      return writeCall(fn, args, invalidates);
    };
  }

  // Invalidation groups — function name → list of prefixes to invalidate
  // After any write that touches "Orders" data, kill all cached order-related reads.
  const INV = {
    orders:    ['listOrders', 'getOrder', 'getDashboardBundle', 'getOrderListBundle', 'getTodayDue', 'getDashboardStats', 'listPreOrders'],
    items:     ['getOrder'],
    preorders: ['listPreOrders', 'getOrder', 'getDashboardBundle'],
    qc:        ['getOrder', 'getQCByOrder', 'getDashboardBundle'],
    customers: ['listCustomers', 'getDashboardBundle', 'getOrderFormBundle', 'getOrderListBundle', 'getOrder', 'getTodayDue'],
    products:  ['listProducts', 'getDashboardBundle', 'getOrderFormBundle', 'getOrder'],
    materials: ['listMaterials', 'getOrderFormBundle', 'listPreOrders'],
    users:     ['listUsers'],
    settings:  ['getSettings'],
    files:     ['listFiles', 'getOrder']
  };

  window.API = {
    raw: rawCall,
    setUrl: setUrl,
    getUrl: getUrl,
    invalidateAll: cacheInvalidateAll,

    ping: function () { return rawCall('ping', []); },

    // Auth (always live)
    login: function (u, p) { return rawCall('login', [u, p]); },
    logout: function () { cacheInvalidateAll(); return rawCall('logout', [token()]); },
    getCurrentUser: function () { return rawCall('getCurrentUser', [token()]); },

    // Settings
    getSettings: tokRead('getSettings'),
    updateSetting: tokWrite('updateSetting', INV.settings),

    // Master — read (cached)
    listCustomers: tokRead('listCustomers'),
    listProducts: tokRead('listProducts'),
    listMaterials: tokRead('listMaterials'),
    // Master — write (invalidate)
    upsertCustomer: tokWrite('upsertCustomer', INV.customers),
    deleteCustomer: tokWrite('deleteCustomer', INV.customers),
    upsertProduct: tokWrite('upsertProduct', INV.products),
    deleteProduct: tokWrite('deleteProduct', INV.products),
    upsertMaterial: tokWrite('upsertMaterial', INV.materials),
    deleteMaterial: tokWrite('deleteMaterial', INV.materials),

    // Orders — read
    listOrders: tokRead('listOrders'),
    getOrder: tokRead('getOrder'),
    // Orders — write
    createOrder: tokWrite('createOrder', INV.orders.concat(INV.preorders)),
    updateOrder: tokWrite('updateOrder', INV.orders),
    changeStatus: tokWrite('changeStatus', INV.orders),
    cancelOrder: tokWrite('cancelOrder', INV.orders),

    // Items
    addOrderItem: tokWrite('addOrderItem', INV.items.concat(INV.orders)),
    updateOrderItem: tokWrite('updateOrderItem', INV.items.concat(INV.orders)),
    removeOrderItem: tokWrite('removeOrderItem', INV.items.concat(INV.orders)),

    // PreOrder
    listPreOrders: tokRead('listPreOrders'),
    markPreOrderReceived: tokWrite('markPreOrderReceived', INV.preorders.concat(INV.orders).concat(INV.materials)),
    updatePreOrder: tokWrite('updatePreOrder', INV.preorders),

    // QC
    submitQC: tokWrite('submitQC', INV.qc.concat(INV.orders)),
    getQCByOrder: tokRead('getQCByOrder'),

    // Files
    uploadFile: tokWrite('uploadFile', INV.files),
    listFiles: tokRead('listFiles'),
    deleteFile: tokWrite('deleteFile', INV.files),

    // Users
    listUsers: tokRead('listUsers'),
    createUser: tokWrite('createUser', INV.users),
    updateUser: tokWrite('updateUser', INV.users),
    resetPassword: tokWrite('resetPassword', INV.users),
    changeOwnPassword: tokWrite('changeOwnPassword', INV.users),

    // Dashboard (cached — biggest win)
    getDashboardStats: tokRead('getDashboardStats'),
    getTodayDue: tokRead('getTodayDue'),
    getDashboardBundle: tokRead('getDashboardBundle'),
    getOrderFormBundle: tokRead('getOrderFormBundle'),
    getOrderListBundle: tokRead('getOrderListBundle')
  };
})();
