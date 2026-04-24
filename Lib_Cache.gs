/** ===== Lib_Cache.gs =====
 * Wrapper around Apps Script CacheService for fast sheet reads.
 * Default TTL = 5 min. Invalidated explicitly on writes via cacheInvalidate_().
 *
 * CacheService limit: each value max 100KB. We chunk if larger.
 */

const CACHE_TTL = 300; // 5 minutes
const CACHE_MAX_VALUE = 99 * 1024; // 99KB safety margin (limit is 100KB)

function cache_() { return CacheService.getScriptCache(); }

function cacheGet_(key) {
  try {
    const c = cache_();
    const meta = c.get(key);
    if (!meta) return null;
    if (meta.charAt(0) === '{') {
      const m = JSON.parse(meta);
      if (m.chunks) {
        const keys = [];
        for (let i = 0; i < m.chunks; i++) keys.push(key + ':' + i);
        const parts = c.getAll(keys);
        let combined = '';
        for (let i = 0; i < m.chunks; i++) {
          if (!parts[key + ':' + i]) return null; // cache evicted partially
          combined += parts[key + ':' + i];
        }
        return JSON.parse(combined);
      }
    }
    return JSON.parse(meta);
  } catch (e) {
    return null;
  }
}

function cacheSet_(key, value, ttl) {
  try {
    const c = cache_();
    const json = JSON.stringify(value);
    if (json.length <= CACHE_MAX_VALUE) {
      c.put(key, json, ttl || CACHE_TTL);
      return;
    }
    // chunk it
    const chunks = Math.ceil(json.length / CACHE_MAX_VALUE);
    const map = {};
    for (let i = 0; i < chunks; i++) {
      map[key + ':' + i] = json.slice(i * CACHE_MAX_VALUE, (i + 1) * CACHE_MAX_VALUE);
    }
    c.putAll(map, ttl || CACHE_TTL);
    c.put(key, JSON.stringify({ chunks: chunks }), ttl || CACHE_TTL);
  } catch (e) {
    // Cache failures should never break the request
  }
}

function cacheDel_(key) {
  try {
    const c = cache_();
    const meta = c.get(key);
    if (meta && meta.charAt(0) === '{') {
      const m = JSON.parse(meta);
      if (m.chunks) {
        const keys = [];
        for (let i = 0; i < m.chunks; i++) keys.push(key + ':' + i);
        c.removeAll(keys);
      }
    }
    c.remove(key);
  } catch (e) {}
}

/** Invalidate cache for a specific sheet name. Call after every write. */
function cacheInvalidate_(sheetName) {
  cacheDel_('all:' + sheetName);
}

/** Invalidate all cached sheets. Use after bulk operations. */
function cacheInvalidateAll_() {
  Object.keys(SCHEMA).forEach(function (name) { cacheInvalidate_(name); });
}
