/**
 * PPPLUSH — Frontend config
 * ใส่ Web App URL ของ Apps Script ที่ deploy แล้ว (ลงท้ายด้วย /exec)
 *
 * ขั้นตอน:
 *   1) ใน Apps Script editor: Deploy → New deployment → Web app
 *      Execute as: Me, Who has access: Anyone
 *   2) Copy URL ที่ได้ (ลงท้าย /exec) มาใส่ที่ APPS_SCRIPT_URL ด้านล่าง
 *   3) Commit + push ขึ้น GitHub → GitHub Pages จะ deploy ให้อัตโนมัติ
 *
 * ถ้าปล่อยว่าง ระบบจะให้กรอกใน UI แล้วเก็บใน localStorage
 */
window.APP_CONFIG = {
  APPS_SCRIPT_URL: '',
  APP_NAME: 'PPPLUSH',
  APP_TAGLINE: 'ระบบจัดการออเดอร์สีอุตสาหกรรม / สีรถยนต์',
  SESSION_KEY: 'pp_session_v1'
};
