/** ===== Lib_Permission.gs =====
 * Role-based access control. canDo(user, action, resource).
 * resource is optional (used for ownership checks).
 */

const ROLES = {
  ADMIN: 'Admin',
  SUPERVISOR: 'Supervisor',
  USER: 'User'
};

const PERMISSIONS = {
  // Order
  'order.create': ['Admin', 'Supervisor', 'User'],
  'order.viewAll': ['Admin', 'Supervisor'],
  'order.viewOwn': ['Admin', 'Supervisor', 'User'],
  'order.editAny': ['Admin', 'Supervisor'],
  'order.editOwnDraft': ['Admin', 'Supervisor', 'User'],
  'order.changeStatus': ['Admin', 'Supervisor'],
  'order.cancelAny': ['Admin', 'Supervisor'],
  'order.cancelOwnDraft': ['Admin', 'Supervisor', 'User'],
  // QC
  'qc.submit': ['Admin', 'Supervisor'],
  'qc.view': ['Admin', 'Supervisor', 'User'],
  // PreOrder
  'preorder.manage': ['Admin', 'Supervisor'],
  'preorder.view': ['Admin', 'Supervisor', 'User'],
  // Master
  'master.view': ['Admin', 'Supervisor', 'User'],
  'master.edit': ['Admin', 'Supervisor'],
  'master.delete': ['Admin'],
  // User Mgmt
  'user.manage': ['Admin'],
  // Settings
  'settings.view': ['Admin'],
  'settings.edit': ['Admin'],
  // File
  'file.uploadAny': ['Admin', 'Supervisor'],
  'file.uploadOwn': ['Admin', 'Supervisor', 'User'],
  'file.delete': ['Admin', 'Supervisor'],
  // Dashboard
  'dashboard.viewFull': ['Admin', 'Supervisor'],
  'dashboard.viewScoped': ['Admin', 'Supervisor', 'User']
};

function can_(user, action) {
  if (!user || !user.role) return false;
  const allowed = PERMISSIONS[action];
  if (!allowed) return false;
  return allowed.indexOf(user.role) >= 0;
}

function ensure_(user, action) {
  if (!can_(user, action)) throw new Error('FORBIDDEN: ' + action);
}

function isOwner_(user, order) {
  if (!user || !order) return false;
  return String(order.created_by) === String(user.user_id);
}

/** Helper: caller must own OR have action permission */
function ensureOwnerOr_(user, order, action) {
  if (isOwner_(user, order)) return;
  ensure_(user, action);
}
