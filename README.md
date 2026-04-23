# PPPLUSH — ระบบจัดการออเดอร์สีอุตสาหกรรม / สีรถยนต์

**สถาปัตยกรรม:**
- **Backend (API):** Google Apps Script + Google Sheets — deploy เป็น Web App ที่ตอบ JSON
- **Frontend (UI):** Static HTML/CSS/JS — deploy บน GitHub Pages เรียก Apps Script ผ่าน `fetch()`
- **Storage:** Google Sheets (database) + Google Drive (ไฟล์แนบ)
- **Notify:** LINE Notify — แจ้งทุกครั้งสถานะเปลี่ยน + Daily summary 08:00

---

## โครงสร้างไฟล์

```
PPPLUSHSYSTEM/
├── docs/                     ⭐ Frontend (GitHub Pages serves from here)
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── config.js         ← ใส่ Apps Script URL ที่นี่
│       ├── api.js            fetch wrapper
│       ├── icons.js          SVG icons
│       ├── utils.js          DOM helpers
│       └── app.js            router + page renderers
│
├── *.gs                      Apps Script backend (push ผ่าน clasp)
│   ├── Code.gs               doGet (legacy UI) + doPost (JSON API)
│   ├── Auth.gs               login/session
│   ├── Lib_*.gs              utilities, sheet I/O, permissions
│   ├── Service_*.gs          business logic per domain
│   ├── LineNotify.gs
│   └── Triggers.gs
│
├── *.html                    Embedded UI (legacy, fallback)
├── appsscript.json           Apps Script manifest
├── .clasp.json               clasp config
└── README.md
```

---

## การติดตั้ง — Backend (Apps Script)

### 1. ติดตั้ง clasp และ login
```bash
npm install -g @google/clasp
clasp login
```

### 2. เปิด Apps Script API
ไปที่ https://script.google.com/home/usersettings → เปิด **Google Apps Script API**

### 3. Push code
```bash
cd "c:/Users/ISABANLUE/Desktop/PPPLUSHSYSTEM"
clasp push
```
> ถ้า `Push Failed`: `clasp push --force` หรือลบไฟล์ใน editor ที่ไม่ใช้แล้ว push ใหม่

### 4. รัน setup ใน Apps Script editor
```bash
clasp open
```
แล้วรันฟังก์ชันนี้ตามลำดับ (เลือกฟังก์ชันบน toolbar แล้ว Run):
1. `setupSheets()` — สร้าง 13 tabs + admin user (admin / admin123) + seed Settings
2. `installTriggers()` — ติดตั้ง trigger 08:00 daily report + cleanup sessions

### 5. Deploy เป็น Web App
ใน editor: **Deploy → New deployment → Web app**
- Execute as: **Me**
- Who has access: **Anyone**

Copy URL ที่ได้ (ลงท้าย `/exec`) เก็บไว้

---

## การติดตั้ง — Frontend (GitHub Pages)

### 1. ใส่ Apps Script URL
แก้ไข `docs/js/config.js`:
```js
window.APP_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/XXXXX/exec',
  ...
};
```
> ถ้าปล่อยว่าง ระบบจะให้กรอกใน UI หน้าแรกแล้วเก็บใน localStorage

### 2. Push ขึ้น GitHub
```bash
cd "c:/Users/ISABANLUE/Desktop/PPPLUSHSYSTEM"
git init
git add .
git commit -m "Initial commit — PPPLUSH order system"
git branch -M main
git remote add origin https://github.com/wuttikorntan-sys/PPSYSTEM-.git
git push -u origin main
```

### 3. เปิด GitHub Pages
1. ไปที่ repo: https://github.com/wuttikorntan-sys/PPSYSTEM-
2. **Settings → Pages**
3. Source: **Deploy from a branch**
4. Branch: **main**, Folder: **/docs**
5. Save → รอ ~1 นาที

URL จะเป็น: `https://wuttikorntan-sys.github.io/PPSYSTEM-/`

### 4. Login
- Username: `admin`
- Password: `admin123`
- **เปลี่ยนรหัสทันทีหลัง login** (Settings → Users)

### 5. ตั้งค่า LINE Notify
1. ขอ token จาก https://notify-bot.line.me/my/
2. Login เป็น Admin → ไป **ตั้งค่า** → กรอก `LINE_TOKEN`
3. ทดสอบ: ใน Apps Script editor รัน `testLineNotify()`

---

## Workflow ใบงาน

```
DRAFT ──┬──► IN_PRODUCTION ──► QC ──► READY ──► DELIVERED
        └──► WAITING_MATERIAL ──► IN_PRODUCTION ──► ...
              (เมื่อ Pre-Order ทุกตัว = RECEIVED → auto-advance)
```
- ทุก state เปลี่ยนเป็น `CANCELLED` ได้
- QC pass ครบทุก item ที่ qc_required → auto-advance เป็น `READY`
- LINE Notify ส่งทุกครั้งสถานะเปลี่ยน + Daily summary 08:00

---

## Roles

| Role | สิทธิ์ |
|---|---|
| **Admin** | ทุกอย่าง — จัดการผู้ใช้, ตั้งค่าระบบ, master data, ทุก order |
| **Supervisor** | เปลี่ยนสถานะ + QC + Pre-Order + แก้ทุก order + master data |
| **User** | สร้าง order, แก้/ลบ order ของตัวเองเฉพาะ DRAFT, ดู order ของตัวเอง |

---

## ขั้นตอนแก้ไข + Deploy

**แก้ Backend (.gs):**
```bash
clasp push
# แล้ว Apps Script editor: Deploy → Manage deployments → ✏️ → New version → Deploy
# (URL เดิมยังใช้ได้)
```

**แก้ Frontend (docs/):**
```bash
git add docs/
git commit -m "update UI"
git push
# GitHub Pages auto-deploy ใน ~1 นาที
```

---

## Troubleshooting

### หน้าว่างหลังเข้า GitHub Pages
- F12 → Console ดู error
- เช็คว่า `docs/js/config.js` ใส่ APPS_SCRIPT_URL แล้ว
- ถ้า error CORS: ตรวจว่า deploy Apps Script เป็น "Anyone" (ไม่ใช่ Anyone within workspace)

### Apps Script URL เปลี่ยนเองหลัง deploy
- ใช้ **Update deployment เดิม** (✏️ → New version) แทนการ New deployment ใหม่ — URL จะคงเดิม

### เข้า Pages แล้วเจอ "ไม่ได้ตั้ง Apps Script URL"
- กรอกใน UI ที่หน้าแรก จะเก็บใน localStorage
- หรือแก้ `docs/js/config.js` แล้ว commit/push

### LINE Notify ไม่ส่ง
- เช็คว่า `LINE_TOKEN` ถูกใส่ใน Settings tab
- ดู `Notifications` tab ใน Sheet — ถ้าสถานะ `FAIL:401` = token ผิด
- LINE Notify ถูก sunset แล้ว สำหรับโปรเจกต์ใหม่ ใช้ LINE Messaging API แทน (โครง `LineNotify.gs` ออกแบบให้สลับ endpoint ง่าย)

---

## Acceptance Test

1. ✅ Login admin → ใส่ LINE_TOKEN
2. ✅ สร้าง Customer + Product + Material
3. ✅ สร้าง Order (Urgent, 2 items + 2 materials) — `due_date` ต้องเป็น receive_date+2
4. ✅ ถ้าวัตถุดิบไม่พอ → status = `WAITING_MATERIAL` + มี Pre-Order ขึ้น
5. ✅ Mark Pre-Order RECEIVED ครบ → status auto = `IN_PRODUCTION`
6. ✅ เปลี่ยนเป็น QC → กรอก L*a*b* + pass=true ครบ → auto = `READY`
7. ✅ LINE มีข้อความทุกครั้งสถานะเปลี่ยน
8. ✅ รัน `onDailyReport()` manual → ข้อความสรุปงาน due วันนี้
9. ✅ Login User → เห็นเฉพาะ order ของตัวเอง
10. ✅ Upload ไฟล์ → ขึ้นใน Drive folder `PPPLUSH_FILES/Orders/{order_no}/`
