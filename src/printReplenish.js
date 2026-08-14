// printReplenish.js
// ---------------------------------------------------------------------------
// เปิดหน้าต่างใหม่แล้วพิมพ์ "ใบนำส่งเติมยา" ขนาด A4 ทันที
// รองรับทั้งเติมยาทีละรายการ และเติมหลายรายการพร้อมกัน (จากตะกร้า) รวมในใบเดียว
// ทำงานฝั่ง client ล้วนๆ ไม่ต้องมี backend/route เพิ่ม
//
// ★ BREAKING CHANGE จากเวอร์ชันก่อนหน้า ★
// เดิม openReplenishPrintWindow(data) รับฟิลด์ของยาตรงๆ ที่ level บนสุด
// (data.drugName, data.lot, data.qty, ...) — ตอนนี้เปลี่ยนเป็นรับ data.items
// เป็น "อาเรย์ของรายการยา" เสมอ แม้มีรายการเดียวก็ต้องห่อเป็น items: [ {...} ]
// จุดที่เรียกใช้ทั้งหมดใน WarehousePage.jsx ถูกแก้ให้ตรงกับ signature ใหม่แล้ว
//
// data ที่ต้องส่งเข้ามา:
// {
//   items: [
//     { drugName, strength, form, lot, mfgDate, expDate, qty, unitPrice }, // unitPrice optional
//     ...
//   ],
//   fromDeptName, toDeptName, staffName,
// }
//
// หมายเหตุ: "เลขที่อ้างอิง" สร้างฝั่ง client เพื่อแสดงผลตอนพิมพ์เท่านั้น
// ไม่ได้บันทึกลงฐานข้อมูล เพราะ transferStock() เรียกผ่าน supabase.rpc()
// และไม่ได้ return แถวที่เพิ่งสร้างกลับมา
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function fmtDateTH(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH");
}

function fmtMoney(n) {
  return Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function genClientRef() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `RF${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function buildReplenishPrintHtml(data) {
  const { items, fromDeptName, toDeptName, staffName } = data;

  const refNo = genClientRef();
  const now = new Date();
  const issueDate = now.toLocaleDateString("th-TH");
  const issueTime = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  const rows = items.map((it) => {
    const total = it.unitPrice != null ? Number(it.qty) * Number(it.unitPrice) : null;
    const drugLabel = [it.drugName, it.strength, it.form].filter(Boolean).join(" ");
    return { ...it, total, drugLabel };
  });

  const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const allHavePrice = rows.every((r) => r.total != null);
  const totalValue = allHavePrice ? rows.reduce((s, r) => s + r.total, 0) : null;

  const rowsHtml = rows
    .map(
      (r) => `
      <tr>
        <td class="name">${escapeHtml(r.drugLabel)}</td>
        <td>${escapeHtml(r.lot)}</td>
        <td>${escapeHtml(fmtDateTH(r.mfgDate))}</td>
        <td>${escapeHtml(fmtDateTH(r.expDate))}</td>
        <td>${escapeHtml(r.qty)}</td>
        <td>${r.unitPrice != null ? fmtMoney(r.unitPrice) : "-"}</td>
        <td>${r.total != null ? fmtMoney(r.total) : "-"}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>ใบนำส่งเติมยา ${escapeHtml(refNo)}</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: "TH Sarabun New", "Sarabun", "Leelawadee UI", sans-serif;
    color: #111; font-size: 16px;
  }
  @page { size: A4; margin: 14mm; }
  .doc-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .doc-header h1 { font-size: 21px; margin: 0 0 2px; }
  .doc-header h2 { font-size: 16px; margin: 0 0 6px; font-weight: normal; }
  .doc-header h3 { font-size: 18px; margin: 0; }
  table.info { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  table.info td { border: 1px solid #000; padding: 5px 9px; }
  table.info td.label { background: #f2f2f2; font-weight: bold; width: 22%; }
  table.info td.value { width: 28%; }
  .section-title { font-weight: bold; font-size: 17px; margin: 10px 0 6px; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  table.items th, table.items td { border: 1px solid #000; padding: 6px 8px; font-size: 14px; text-align: center; }
  table.items thead th { background: #d9d9d9; font-weight: bold; }
  table.items td.name { text-align: left; }
  table.items tfoot td { background: #f2f2f2; font-weight: bold; }
  table.items tfoot td.total-label { text-align: right; }
  table.signatures { width: 100%; border-collapse: collapse; margin-top: 26px; }
  table.signatures td { width: 33.33%; text-align: center; vertical-align: top; padding: 0 10px; font-size: 15px; }
  .sig-line { margin-top: 42px; }
  .sig-role { font-weight: bold; margin-top: 4px; }
  .sig-sub { color: #666; font-size: 13px; }
  .footer-note { margin-top: 18px; font-size: 11px; color: #666; font-style: italic; }
</style>
</head>
<body onload="window.focus(); window.print();">

  <div class="doc-header">
    <h1>โรงพยาบาลกุมภวาปี</h1>
    <h2>ศูนย์ Antidote &amp; Vital Drug Center (AVDC) — กลุ่มงานเภสัชกรรม</h2>
    <h3>ใบนำส่งเติมยา</h3>
  </div>

  <table class="info">
    <tr>
      <td class="label">เลขที่อ้างอิง</td>
      <td class="value">${escapeHtml(refNo)}</td>
      <td class="label">วันที่ / เวลา</td>
      <td class="value">${escapeHtml(issueDate)} ${escapeHtml(issueTime)}</td>
    </tr>
    <tr>
      <td class="label">หน่วยงานที่จ่าย (ต้นทาง)</td>
      <td class="value">${escapeHtml(fromDeptName)}</td>
      <td class="label">หน่วยงานที่รับ (ปลายทาง)</td>
      <td class="value">${escapeHtml(toDeptName)}</td>
    </tr>
  </table>

  <div class="section-title">รายการเวชภัณฑ์ที่นำส่งเติม (${rows.length} รายการ)</div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:30%">ชื่อเวชภัณฑ์</th>
        <th style="width:14%">Lot no.</th>
        <th style="width:12%">วันผลิต</th>
        <th style="width:12%">วันหมดอายุ</th>
        <th style="width:10%">จำนวนที่เติม</th>
        <th style="width:11%">มูลค่า/หน่วย</th>
        <th style="width:11%">มูลค่ารวม</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="total-label">รวมทั้งหมด ${rows.length} รายการ</td>
        <td>${totalQty}</td>
        <td></td>
        <td>${totalValue != null ? fmtMoney(totalValue) : "-"}</td>
      </tr>
    </tfoot>
  </table>

  <table class="signatures">
    <tr>
      <td>
        <div class="sig-line">ลงชื่อ ..............................................</div>
        <div>(${escapeHtml(staffName || "")})</div>
        <div class="sig-role">ผู้จัดเตรียม/ผู้เติมยา</div>
        <div class="sig-sub">เจ้าหน้าที่คลังยา</div>
      </td>
      <td>
        <div class="sig-line">ลงชื่อ ..............................................</div>
        <div>(ภก.ชัยวัฒน์ กลางวาปี)</div>
        <div class="sig-role">ผู้ตรวจสอบ/อนุมัติจ่าย</div>
        <div class="sig-sub">หัวหน้าคลังยาใหญ่</div>
      </td>
      <td>
        <div class="sig-line">ลงชื่อ ..............................................</div>
        <div>(..............................................)</div>
        <div class="sig-role">ผู้รับ (หน่วยงานปลายทาง)</div>
        <div class="sig-sub">&nbsp;</div>
      </td>
    </tr>
  </table>

  <div class="footer-note">จัดพิมพ์จากระบบ AVDC — โรงพยาบาลกุมภวาปี &nbsp;|&nbsp; เลขที่อ้างอิงนี้สร้างขณะพิมพ์ ไม่ได้บันทึกในฐานข้อมูล</div>

</body>
</html>`;
}

/**
 * เรียกใช้หลัง transferStock() สำเร็จ (ทีละรายการ หรือหลายรายการจากตะกร้า)
 * ตัวอย่าง: openReplenishPrintWindow({ items: [...], fromDeptName, toDeptName, staffName })
 */
export function openReplenishPrintWindow(data) {
  const html = buildReplenishPrintHtml(data);
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) {
    alert("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต popup สำหรับเว็บนี้แล้วลองใหม่");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  // การพิมพ์ถูก trigger ด้วย <body onload="window.print()"> ในตัว HTML เอง
}
