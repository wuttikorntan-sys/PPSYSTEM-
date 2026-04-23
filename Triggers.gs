/** ===== Triggers.gs =====
 * Run installTriggers() once from editor (as admin) to register:
 *   - daily 08:00 -> onDailyReport
 *   - daily 02:00 -> cleanupSessionsTrigger (Sessions cleanup)
 */

function installTriggers() {
  const existing = ScriptApp.getProjectTriggers();
  existing.forEach(function (t) {
    const fn = t.getHandlerFunction();
    if (fn === 'onDailyReport' || fn === 'cleanupSessionsTrigger') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('onDailyReport')
    .timeBased()
    .atHour(8)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone(TZ)
    .create();

  ScriptApp.newTrigger('cleanupSessionsTrigger')
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .inTimezone(TZ)
    .create();

  return 'Triggers installed';
}

function uninstallTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  return 'All triggers removed';
}

function cleanupSessionsTrigger() {
  return cleanupSessions_();
}
