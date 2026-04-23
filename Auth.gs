/** ===== Auth.gs =====
 * Username + password (SHA-256 + salt) auth, session token via Sheet.
 */

function login(username, password) {
  try {
    require_(username && password, 'กรุณากรอก username และ password');
    const u = findOne_('Users', 'username', String(username).trim());
    if (!u) return err_('username หรือ password ไม่ถูกต้อง', 'AUTH_FAIL');
    if (u.active === false || String(u.active).toLowerCase() === 'false') {
      return err_('บัญชีถูกระงับ', 'INACTIVE');
    }
    const calc = hashPassword_(password, u.salt);
    if (calc !== u.password_hash) return err_('username หรือ password ไม่ถูกต้อง', 'AUTH_FAIL');

    const ttlH = Number(getSetting_('SESSION_TTL_HOURS', 8));
    const token = uuid_().replace(/-/g, '');
    const created = new Date();
    const expires = new Date(created.getTime() + ttlH * 3600 * 1000);
    appendRow_('Sessions', {
      token: token,
      user_id: u.user_id,
      created_at: nowIso_(),
      expires_at: Utilities.formatDate(expires, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
    });
    return ok_({
      token: token,
      user: {
        user_id: u.user_id,
        username: u.username,
        full_name: u.full_name,
        role: u.role
      }
    });
  } catch (e) {
    return err_(e.message);
  }
}

function logout(token) {
  try {
    if (!token) return ok_(true);
    deleteById_('Sessions', 'token', token);
    return ok_(true);
  } catch (e) {
    return err_(e.message);
  }
}

function getCurrentUser(token) {
  try {
    const u = validateSession_(token);
    return ok_({
      user_id: u.user_id,
      username: u.username,
      full_name: u.full_name,
      role: u.role
    });
  } catch (e) {
    return err_(e.message, 'UNAUTH');
  }
}

/** Throws if invalid. Returns user object on success. */
function validateSession_(token) {
  if (!token) throw new Error('UNAUTHENTICATED');
  const s = findOne_('Sessions', 'token', token);
  if (!s) throw new Error('UNAUTHENTICATED');
  const exp = new Date(s.expires_at);
  if (isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
    deleteById_('Sessions', 'token', token);
    throw new Error('SESSION_EXPIRED');
  }
  const u = findOne_('Users', 'user_id', s.user_id);
  if (!u) throw new Error('USER_NOT_FOUND');
  if (u.active === false || String(u.active).toLowerCase() === 'false') {
    throw new Error('INACTIVE');
  }
  return u;
}

/** Cleanup expired sessions (run from Triggers.gs) */
function cleanupSessions_() {
  const all = getAll_('Sessions');
  const now = Date.now();
  let removed = 0;
  all.forEach(function (s) {
    const exp = new Date(s.expires_at);
    if (isNaN(exp.getTime()) || exp.getTime() < now) {
      deleteById_('Sessions', 'token', s.token);
      removed++;
    }
  });
  return removed;
}

/** Settings helper used here to avoid import cycles */
function getSetting_(key, def) {
  const r = findOne_('Settings', 'key', key);
  if (!r || r.value === '' || r.value === null || r.value === undefined) return def;
  return r.value;
}
