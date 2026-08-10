// printReplenish.js
// ---------------------------------------------------------------------------
// เปิดหน้าต่างใหม่แล้วพิมพ์ "ใบนำส่งเติมยา" ขนาด A4 ทันที
// ทำงานฝั่ง client ล้วนๆ ไม่ต้องมี backend/route เพิ่ม เพราะข้อมูลที่ต้องใช้
// มีอยู่ครบแล้วในมือ ณ ตอนที่ handleTransfer() เพิ่งเรียก transferStock() สำเร็จ
//
// หมายเหตุสำคัญ: "เลขที่อ้างอิง" ที่แสดงในเอกสาร เป็นเลขที่สร้างฝั่ง client
// เพื่อใช้แสดงผล/อ้างอิงตอนพิมพ์เท่านั้น "ไม่ได้บันทึกลงฐานข้อมูล" เพราะ
// transferStock() ปัจจุบันเรียกผ่าน supabase.rpc("transfer_stock", ...) และ
// ไม่ได้ return แถวที่เพิ่งสร้างกลับมา ถ้าต้องการเลขที่อ้างอิงที่ผูกกับ DB จริง
// (ไว้ค้นย้อนหลัง/ออกใบซ้ำจากฐานข้อมูล) ต้องแก้ SQL function ฝั่ง Postgres ให้
// RETURN แถวที่ insert แล้วปรับ transferStock() ให้ไม่ทิ้งค่า data
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

function genClientRef() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `RF${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * data ที่ต้องส่งเข้ามา (ทั้งหมดมีอยู่แล้วในสโคปของ handleTransfer):
 * {
 *   drugName, strength, form, lot, mfgDate, expDate,
 *   qty, unitPrice,           // unitPrice เป็น optional (best-effort fetch)
 *   fromDeptName, toDeptName,
 *   staffName,
 * }
 */
export function buildReplenishPrintHtml(data) {
  const {
    drugName, strength, form, lot, mfgDate, expDate,
    qty, unitPrice, fromDeptName, toDeptName, staffName,
  } = data;

  const refNo = genClientRef();
  const now = new Date();
  const issueDate = now.toLocaleDateString("th-TH");
  const issueTime = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  const total = unitPrice != null ? Number(qty) * Number(unitPrice) : null;
  const drugLabel = [drugName, strength, form].filter(Boolean).join(" ");

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

  <div class="section-title">รายการเวชภัณฑ์ที่นำส่งเติม</div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:32%">ชื่อเวชภัณฑ์</th>
        <th style="width:14%">Lot no.</th>
        <th style="width:14%">วันผลิต</th>
        <th style="width:14%">วันหมดอายุ</th>
        <th style="width:10%">จำนวนที่เติม</th>
        <th style="width:8%">มูลค่า/หน่วย</th>
        <th style="width:8%">มูลค่ารวม</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="name">${escapeHtml(drugLabel)}</td>
        <td>${escapeHtml(lot)}</td>
        <td>${escapeHtml(fmtDateTH(mfgDate))}</td>
        <td>${escapeHtml(fmtDateTH(expDate))}</td>
        <td>${escapeHtml(qty)}</td>
        <td>${unitPrice != null ? Number(unitPrice).toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-"}</td>
        <td>${total != null ? total.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-"}</td>
      </tr>
    </tbody>
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
 * เรียกใช้จาก handleTransfer() หลัง transferStock() สำเร็จ
 * เช่น: openReplenishPrintWindow({ drugName: lot.drug_name, ... })
 */
export function openReplenishPrintWindow(data) {
  const html = buildReplenishPrintHtml(data);
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) {
    // เบราว์เซอร์บล็อก popup — แจ้งผู้ใช้แทนการล้มเหลวเงียบๆ
    alert("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต popup สำหรับเว็บนี้แล้วลองใหม่");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  // การพิมพ์ถูก trigger ด้วย <body onload="window.print()"> ในตัว HTML เอง
  // เพื่อรอให้ font/layout เรนเดอร์เสร็จก่อน ไม่ต้อง setTimeout เดาเวลาจากฝั่งนี้
}
