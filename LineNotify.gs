/** ===== LineNotify.gs =====
 * LINE Notify integration. Token stored in Settings.LINE_TOKEN.
 * NOTE: As of Apr 2025, LINE Notify has been sunset. If you need to keep using it,
 *       use existing tokens. For new setups consider switching to LINE Messaging API.
 *       The sendLine_() function is written so you can swap endpoint later.
 */

const LINE_NOTIFY_URL = 'https://notify-api.line.me/api/notify';

function sendLine_(message) {
  const token = getSetting_('LINE_TOKEN', '');
  if (!token) return false;
  try {
    const resp = UrlFetchApp.fetch(LINE_NOTIFY_URL, {
      method: 'post',
      headers: { Authorization: 'Bearer ' + token },
      payload: { message: String(message) },
      muteHttpExceptions: true
    });
    const code = resp.getResponseCode();
    logNotify_('LINE', '', message, code >= 200 && code < 300 ? 'SENT' : 'FAIL:' + code);
    return code >= 200 && code < 300;
  } catch (e) {
    logNotify_('LINE', '', message, 'ERROR:' + e.message);
    return false;
  }
}

function logNotify_(type, order_id, message, status) {
  try {
    appendRow_('Notifications', {
      notify_id: uuid_(),
      order_id: order_id || '',
      type: type,
      message: String(message).slice(0, 500),
      sent_at: nowIso_(),
      status: status
    });
  } catch (e) {}
}

/** Fired by Service_Order.changeStatus */
function notifyStatusChange_(order_id, fromStatus, toStatus, remark) {
  const ord = findOne_('Orders', 'order_id', order_id);
  if (!ord) return;
  const cust = findOne_('Customers', 'customer_id', ord.customer_id);
  const msg = [
    '',
    '📋 ' + ord.order_no + (ord.urgent ? ' [URGENT]' : ''),
    '👤 ' + (cust ? cust.name : '-'),
    '🔄 ' + (fromStatus || '-') + ' → ' + toStatus,
    '📅 ส่ง: ' + fmtDate_(ord.due_date, 'yyyy-MM-dd'),
    remark ? '📝 ' + remark : ''
  ].filter(Boolean).join('\n');
  sendLine_(msg);
  logNotify_('STATUS', order_id, msg, 'LOGGED');
}

/** Time-driven trigger handler (08:00 daily) */
function onDailyReport() {
  const today = todayIso_();
  const orders = getAll_('Orders');
  const custs = getAll_('Customers');
  const cmap = {}; custs.forEach(function (c) { cmap[c.customer_id] = c; });

  const dueToday = orders.filter(function (o) {
    const d = fmtDate_(o.due_date, 'yyyy-MM-dd');
    return d === today && o.status !== 'DELIVERED' && o.status !== 'CANCELLED';
  });
  const overdue = orders.filter(function (o) {
    const d = fmtDate_(o.due_date, 'yyyy-MM-dd');
    return d && d < today && o.status !== 'DELIVERED' && o.status !== 'CANCELLED';
  });

  const lines = ['', '📅 Daily Report — ' + today];
  lines.push('📌 งานต้องส่งวันนี้: ' + dueToday.length + ' ใบ');
  dueToday.slice(0, 20).forEach(function (o) {
    lines.push('  • ' + o.order_no + ' | ' + (cmap[o.customer_id] ? cmap[o.customer_id].name : '-') + ' | ' + o.status + (o.urgent ? ' ⚡' : ''));
  });
  if (overdue.length) {
    lines.push('');
    lines.push('⚠️ งานเลย deadline: ' + overdue.length + ' ใบ');
    overdue.slice(0, 10).forEach(function (o) {
      lines.push('  • ' + o.order_no + ' | ' + (cmap[o.customer_id] ? cmap[o.customer_id].name : '-') + ' | ' + fmtDate_(o.due_date, 'yyyy-MM-dd'));
    });
  }
  sendLine_(lines.join('\n'));
}

/** Manual test from editor */
function testLineNotify() {
  return sendLine_('PPPLUSH — ทดสอบ LINE Notify ' + nowIso_());
}
