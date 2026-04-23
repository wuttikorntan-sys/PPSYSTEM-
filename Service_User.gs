/** ===== Service_User.gs ===== Admin only */

function listUsers(token) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'user.manage');
    const rows = getAll_('Users').map(function (r) {
      // never expose password
      return {
        user_id: r.user_id,
        username: r.username,
        full_name: r.full_name,
        role: r.role,
        line_user_id: r.line_user_id,
        active: r.active,
        created_at: r.created_at
      };
    });
    return ok_(rows);
  } catch (e) { return err_(e.message); }
}

function createUser(token, payload) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'user.manage');
    require_(payload && payload.username && payload.password, 'username/password required');
    require_(['Admin', 'Supervisor', 'User'].indexOf(payload.role) >= 0, 'role ไม่ถูกต้อง');
    const exist = findOne_('Users', 'username', payload.username);
    require_(!exist, 'username ซ้ำ');
    const salt = randomSalt_();
    const data = {
      user_id: uuid_(),
      username: sanitizeStr_(payload.username),
      password_hash: hashPassword_(payload.password, salt),
      salt: salt,
      full_name: sanitizeStr_(payload.full_name || ''),
      role: payload.role,
      line_user_id: sanitizeStr_(payload.line_user_id || ''),
      active: payload.active !== false,
      created_at: nowIso_()
    };
    appendRow_('Users', data);
    return ok_({ user_id: data.user_id });
  } catch (e) { return err_(e.message); }
}

function updateUser(token, user_id, patch) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'user.manage');
    const allowed = ['full_name', 'role', 'line_user_id', 'active'];
    const safe = {};
    allowed.forEach(function (k) { if (patch[k] !== undefined) safe[k] = patch[k]; });
    if (safe.role) require_(['Admin', 'Supervisor', 'User'].indexOf(safe.role) >= 0, 'role ไม่ถูกต้อง');
    updateById_('Users', 'user_id', user_id, safe);
    return ok_(true);
  } catch (e) { return err_(e.message); }
}

function resetPassword(token, user_id, newPassword) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'user.manage');
    require_(newPassword && String(newPassword).length >= 4, 'password ต้องมี 4 ตัวขึ้นไป');
    const target = findOne_('Users', 'user_id', user_id);
    require_(target, 'ไม่พบ user');
    const salt = randomSalt_();
    updateById_('Users', 'user_id', user_id, {
      password_hash: hashPassword_(newPassword, salt),
      salt: salt
    });
    return ok_(true);
  } catch (e) { return err_(e.message); }
}

function changeOwnPassword(token, oldPassword, newPassword) {
  try {
    const u = validateSession_(token);
    require_(newPassword && String(newPassword).length >= 4, 'password ใหม่ต้องมี 4 ตัวขึ้นไป');
    const calc = hashPassword_(oldPassword, u.salt);
    if (calc !== u.password_hash) return err_('รหัสเดิมไม่ถูกต้อง');
    const salt = randomSalt_();
    updateById_('Users', 'user_id', u.user_id, {
      password_hash: hashPassword_(newPassword, salt),
      salt: salt
    });
    return ok_(true);
  } catch (e) { return err_(e.message); }
}
