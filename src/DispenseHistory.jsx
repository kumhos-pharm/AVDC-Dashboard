import React, { useState } from "react";
import { History, Search, Pencil, Trash2, User, ChevronLeft, ChevronRight, ArrowRightLeft, RotateCcw } from "lucide-react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import { useDispenseHistory, deleteDispense, cancelReplenish } from "./useDispense";

// แปลงวันที่เป็น พ.ศ. และรูปแบบย่อตามภาพ (เช่น 9 ก.ค. 2569)
function formatThaiDate(iso) {
  if (!iso) return { date: "-", time: "-" };
  const d = new Date(iso);
  const buddhistYear = d.getFullYear() + 543;
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const time = `${d.getHours()}:${minutes}`;
  
  return { 
    date: `${d.getDate()} ${months[d.getMonth()]} ${buddhistYear}`, 
    time: `${time} น.` 
  };
}

// แปลง Exp Date เป็น DD-MM-YYYY ในระบบปี พ.ศ.
function formatExpDate(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const buddhistYear = d.getFullYear() + 543;
  return `${day}-${month}-${buddhistYear}`;
}

// อ่านยอดคงเหลือของล็อตนี้ (มาจาก useDispenseHistory ที่ผูก remaining_qty ให้แต่ละแถวแล้ว)
function remainingQty(r) {
  return r.remaining_qty === null || r.remaining_qty === undefined ? null : r.remaining_qty;
}

// ดึงหน่วยนับที่ถูกต้องจาก "รูปแบบยา" (เช่น "ซอง (Powder)" -> "ซอง") แทนคอลัมน์ unit ของ drugs
// เพราะ unit ไม่เคยถูกตั้งค่าจากหน้า UI ไหนเลย (ไม่มีช่องกรอก unit ในฟอร์มรับยา/แก้ไขยา) ทำให้ค่าเดิม
// ในฐานข้อมูลเป็นค่า default ทั่วไปที่ไม่ตรงกับรูปแบบยาจริงของแต่ละรายการ (เช่น ยาผงในซอง แต่ unit ดันเป็น "ขวด")
function unitFromForm(form) {
  if (!form) return null;
  const idx = form.indexOf(" (");
  return (idx > 0 ? form.slice(0, idx) : form).trim() || null;
}

function displayUnit(r) {
  return unitFromForm(r.drug_form) || r.unit || "หน่วย";
}

const ITEMS_PER_PAGE = 5;

// ตั้งค่าธีมสีของ SweetAlert ให้เข้ากับฟอนต์/โทนสีของระบบ
const swalBase = {
  confirmButtonColor: "#007bff",
  cancelButtonColor: "#94a3b8",
  customClass: { popup: "font-['Kanit']" },
};

// props:
// - refreshKey: เปลี่ยนค่าเพื่อสั่งให้โหลดประวัติใหม่ (เช่น หลังจ่ายยา/แก้ไขสำเร็จ)
// - onEditRequest: เรียกพร้อมแถวที่จะแก้ไข เพื่อส่งข้อมูลไปแสดงในฟอร์ม "บันทึกการจ่ายยา" แทนการเปิด popup
// - editingId: id ของรายการที่กำลังถูกแก้ไขอยู่ (ใช้ไฮไลต์การ์ดที่กำลังแก้ไข, ไม่บังคับ)
export default function DispenseHistory({ refreshKey, onEditRequest, editingId }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { rows, loading, reload } = useDispenseHistory(search);

  React.useEffect(() => {
    reload();
  }, [refreshKey]);

  // กลับไปหน้า 1 ทุกครั้งที่ค้นหาใหม่ หรือรีเฟรชข้อมูล
  React.useEffect(() => {
    setPage(1);
  }, [search, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = rows.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  async function handleDelete(r) {
    const result = await Swal.fire({
      ...swalBase,
      icon: "warning",
      title: "ลบรายการนี้ใช่ไหม?",
      html: `รายการจ่ายยา <b>${r.drug_name || ""}</b> ของ <b>${r.patient_name || "-"}</b><br/>ยอดคงเหลือจะถูกคืนกลับอัตโนมัติ`,
      showCancelButton: true,
      confirmButtonText: "ลบเลย",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc2626",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    const { error } = await deleteDispense(r.id);

    if (error) {
      Swal.fire({ ...swalBase, icon: "error", title: "ลบไม่สำเร็จ", text: error.message });
      return;
    }

    Swal.fire({ ...swalBase, icon: "success", title: "ลบรายการแล้ว", timer: 1500, showConfirmButton: false });
    reload();
  }

  // ยกเลิกการเติมยา 1 ครั้ง — ลบทั้งแถว "ตัดออกจาก AVDC" และ "รับเข้าที่หน่วยงานปลายทาง" พร้อมกันในคลิกเดียว
  async function handleCancelReplenish(r) {
    if (!r.transfer_group_id) {
      Swal.fire({
        ...swalBase,
        icon: "info",
        title: "ยกเลิกอัตโนมัติไม่ได้",
        text: "รายการนี้บันทึกไว้ก่อนมีระบบยกเลิกอัตโนมัติ กรุณาติดต่อผู้ดูแลระบบเพื่อแก้ไขสต็อกด้วยตนเอง",
      });
      return;
    }

    const isReplenishIn = r.reason === "replenish_in";
    const result = await Swal.fire({
      ...swalBase,
      icon: "warning",
      title: "ยกเลิกการเติมยานี้ใช่ไหม?",
      html: `<b>${r.drug_name || ""}</b> (Lot ${r.lot || "-"}) จำนวน ${Math.abs(r.change_qty)} ${displayUnit(r)}<br/>
             ${isReplenishIn ? "จะถูกดึงคืน" : "จะถูกยกเลิก"} ทั้ง 2 ฝั่ง (ต้นทาง AVDC และปลายทาง) พร้อมกัน<br/>
             ยอดสต็อกทั้ง 2 หน่วยงานจะถูกคืนกลับอัตโนมัติ`,
      showCancelButton: true,
      confirmButtonText: "ยกเลิกการเติมยา",
      cancelButtonText: "ปิด",
      confirmButtonColor: "#dc2626",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    const { error } = await cancelReplenish(r.transfer_group_id);

    if (error) {
      Swal.fire({ ...swalBase, icon: "error", title: "ยกเลิกไม่สำเร็จ", text: error.message });
      return;
    }

    Swal.fire({ ...swalBase, icon: "success", title: "ยกเลิกการเติมยาแล้ว", timer: 1500, showConfirmButton: false });
    reload();
  }

  return (
    <div className="rounded-2xl border-2 border-[#198754]/40 bg-white p-5 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] font-['Kanit'] relative">
      {/* ส่วนหัวข้อประวัติ */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#198754]">
          <History className="h-5 w-5" /> ประวัติบันทึกล่าสุด
        </h2>
        <span className="rounded bg-[#198754] px-2.5 py-0.5 text-sm text-white font-medium">
          เรียงล่าสุด
        </span>
      </div>

      {/* ช่องค้นหา */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาด้วย HN, ชื่อผู้ป่วย หรือ ชื่อยา..."
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-[#007bff] focus:outline-none focus:ring-2 focus:ring-[#007bff]"
        />
      </div>

      {/* รายการประวัติ (Card list) */}
      <div className="max-h-[580px] space-y-3 overflow-y-auto pr-1">
        {loading && <p className="py-6 text-center text-sm text-slate-400">กำลังโหลด...</p>}
        {!loading && rows.length === 0 && <p className="py-6 text-center text-sm text-slate-400">ยังไม่มีประวัติการจ่ายยา</p>}

        {pagedRows.map((r) => {
          const { date, time } = formatThaiDate(r.created_at);
          const isReplenish = r.reason === "replenish_out" || r.reason === "replenish_in";
          const isReplenishIn = r.reason === "replenish_in";
          return (
            <div
              key={r.id}
              className={`relative flex gap-4 rounded-xl border p-4 shadow-sm transition-all ${
                editingId === r.id
                  ? "border-amber-400 bg-amber-50/50 ring-1 ring-amber-300"
                  : isReplenish
                  ? "border-blue-200 bg-blue-50/30 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5"
                  : "border-slate-200 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5"
              }`}
            >
              
              {/* ด้านซ้าย: วันที่และเวลาที่บันทึก */}
              <div className={`flex flex-col items-center justify-start border-r pr-4 min-w-[90px] text-center ${isReplenish ? "border-blue-100" : "border-slate-200"}`}>
                <span className={`flex items-center gap-1.5 text-sm font-bold ${isReplenish ? "text-[#2f8fdc]" : "text-[#198754]"}`}>
                  <span className={`h-2 w-2 rounded-full ${isReplenish ? "bg-[#2f8fdc]" : "bg-[#198754]"}`} />
                  {date.split(' ')[0]} {date.split(' ')[1]}
                </span>
                <span className={`text-sm font-bold ${isReplenish ? "text-[#2f8fdc]" : "text-[#198754]"}`}>{date.split(' ')[2]}</span>
                <span className="mt-1 text-[12px] text-slate-500 flex items-center gap-1 justify-center">
                  🕒 {time}
                </span>
              </div>

              {/* ด้านขวา: ข้อมูลการจ่ายยา / เติมยาหน่วยงาน */}
              <div className="flex-1 space-y-1.5">

                {isReplenish ? (
                  /* แถวที่ 1 (โหมดเติมยาหน่วยงาน): แสดงทิศทางการเติม แทนข้อมูลผู้ป่วย */
                  /* pr เผื่อพื้นที่ให้ปุ่ม "ยกเลิกการเติมยา" ที่ลอยอยู่มุมขวาบน ไม่ให้ทับข้อความ */
                  <div className="flex flex-wrap items-center gap-1.5 pr-32 text-sm">
                    <ArrowRightLeft className="h-4 w-4 text-[#2f8fdc]" />
                    <span className="font-bold text-slate-800">{r.note || (isReplenishIn ? "รับเติมยา" : "เติมยาหน่วยงาน")}</span>
                    <span className="rounded-full bg-[#2f8fdc] px-2 py-0.5 text-[11px] font-bold text-white">
                      เติมยาหน่วยงาน
                    </span>
                    {r.department_name && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        🏥 {r.department_name}
                      </span>
                    )}
                  </div>
                ) : (
                  /* แถวที่ 1: ชื่อผู้ป่วย และ HN */
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <User className="h-4 w-4 text-slate-500" />
                    <span className="font-bold text-slate-800">
                      {r.patient_prefix}{r.patient_name || "-"}
                    </span>
                    <span className="rounded-full bg-slate-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      HN: {r.patient_hn || "-"}
                    </span>
                  </div>
                )}

                {/* แถวที่ 2: ชื่อยา + ความแรงของยา + รูปแบบยา (เด่นสุดเป็นสีน้ำเงินตามภาพ) */}
                <div className="text-sm font-extrabold text-[#1d68a4] flex flex-wrap items-center gap-1">
                  🔗 {r.drug_name}
                  {r.strength && (
                    <span className="text-sm font-bold text-[#4a9bd1]">({r.strength})</span>
                  )}
                  {r.drug_form && (
                    <span className="rounded-full bg-[#eaf4fb] px-2 py-0.5 text-[11px] font-semibold text-[#1d68a4]">
                      {r.drug_form}
                    </span>
                  )}
                </div>

                {/* แถวที่ 3: รายละเอียด Lot, จำนวน และ วันหมดอายุ */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span>
                    Lot: <span className="font-semibold text-slate-700">{r.lot || "-"}</span>
                  </span>
                  <span>
                    {isReplenish ? (isReplenishIn ? "รับเข้า" : "จ่ายออก") : "จ่าย"}:{" "}
                    <span className={`font-bold ${isReplenishIn ? "text-emerald-600" : "text-red-600"}`}>
                      {isReplenishIn ? "+" : ""}{Math.abs(r.change_qty)}
                    </span>{" "}
                    <span className="text-slate-500">{displayUnit(r)}</span>
                  {!isReplenish && (
                    <span>
                      คงเหลือ:{" "}
                      <span className="font-bold text-emerald-600">
                        {remainingQty(r) !== null ? remainingQty(r) : "-"}
                      </span>{" "}
                      <span className="text-slate-500">{displayUnit(r)}</span>
                    </span>
                  )}
                  <span className="ml-auto text-[12px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">
                    Exp: {formatExpDate(r.exp_date)}
                  </span>
                </div>

                {/* แถวที่ 4: ผู้บันทึก/ผู้จ่าย */}
                <div className="pt-1 border-t border-dashed border-slate-100 text-[12px] text-slate-500 flex items-center gap-1.5">
                  <span className="opacity-75">👤 {isReplenish ? "ผู้บันทึก:" : "ผู้จ่าย:"}</span>
                  <span className="font-medium text-slate-700">{r.staff_name || "ไม่ระบุ"}</span>
                </div>
              </div>

              {/* ปุ่ม Action ที่มุมขวาบน */}
              {!isReplenish ? (
                <div className="absolute right-3 top-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onEditRequest && onEditRequest(r)}
                    className="rounded border border-amber-300 p-1 text-amber-500 hover:bg-amber-50"
                    title="แก้ไข (ไปแสดงในฟอร์มด้านข้าง)"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r)}
                    className="rounded border border-red-300 p-1 text-red-500 hover:bg-red-50"
                    title="ลบ"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                // การเติมยา 1 ครั้ง = 2 แถว (ตัดออกจาก AVDC + รับเข้าปลายทาง) จับคู่กันด้วย transfer_group_id
                // กดปุ่มนี้ครั้งเดียวจะลบทั้งคู่พร้อมกัน ไม่ต้องเดาจับคู่จากยา/ล็อต/เวลา
                <div className="absolute right-3 top-3">
                  <button
                    type="button"
                    onClick={() => handleCancelReplenish(r)}
                    disabled={!r.transfer_group_id}
                    className="flex items-center gap-1 rounded border border-red-300 px-1.5 py-1 text-[11px] font-semibold text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    title={
                      r.transfer_group_id
                        ? "ยกเลิกการเติมยา (ลบทั้ง 2 ฝั่งพร้อมกัน คืนสต็อกทั้งต้นทาง-ปลายทาง)"
                        : "รายการเก่าก่อนมีระบบยกเลิกอัตโนมัติ ไม่สามารถยกเลิกจากปุ่มนี้ได้"
                    }
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> ยกเลิกการเติมยา
                  </button>
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* ส่วน Pagination */}
      {!loading && rows.length > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-500">
          <span>
            แสดงหน้า <span className="font-bold text-slate-700">{currentPage}</span> จากทั้งหมด{" "}
            <span className="font-bold text-slate-700">{totalPages}</span> หน้า
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> ก่อนหน้า
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              ถัดไป <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
