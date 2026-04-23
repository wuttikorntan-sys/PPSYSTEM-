# PPPLUSH UI

หน้าเว็บสำหรับระบบจัดการออเดอร์สี ทำงานคู่กับ Apps Script backend

ดูคู่มือการตั้งค่าได้ที่ [../README.md](../README.md)

## Quick start

1. แก้ `js/config.js` ใส่ Apps Script Web App URL (ลงท้าย `/exec`)
2. ใน GitHub repo: **Settings → Pages → Deploy from branch → main / /docs**
3. เปิด URL ของ GitHub Pages → login ด้วย admin / admin123

## File overview

| File | Purpose |
|---|---|
| `index.html` | App shell |
| `css/styles.css` | Design system (CSS variables + components) |
| `js/config.js` | Apps Script URL + app metadata |
| `js/api.js` | fetch() wrapper for Apps Script JSON endpoint |
| `js/icons.js` | Inline SVG icon library (Lucide-style) |
| `js/utils.js` | DOM helpers, toast, modal, loader |
| `js/app.js` | SPA router + page renderers |
