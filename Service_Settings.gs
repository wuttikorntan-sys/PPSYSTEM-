/** ===== Service_Settings.gs ===== */

function getSettings(token) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'settings.view');
    const all = getAll_('Settings');
    // Mask LINE_TOKEN
    return ok_(all.map(function (r) {
      if (r.key === 'LINE_TOKEN' && r.value) {
        return { key: r.key, value: maskToken_(r.value), updated_at: r.updated_at, masked: true };
      }
      return r;
    }));
  } catch (e) {
    return err_(e.message, 'UNAUTH');
  }
}

function updateSetting(token, key, value) {
  try {
    const u = validateSession_(token);
    ensure_(u, 'settings.edit');
    require_(key, 'key required');
    const exist = findOne_('Settings', 'key', key);
    if (exist) {
      updateById_('Settings', 'key', key, { value: String(value), updated_at: nowIso_() });
    } else {
      appendRow_('Settings', { key: key, value: String(value), updated_at: nowIso_() });
    }
    return ok_(true);
  } catch (e) {
    return err_(e.message);
  }
}

function maskToken_(v) {
  const s = String(v);
  if (s.length <= 6) return '****';
  return s.slice(0, 4) + '****' + s.slice(-2);
}
