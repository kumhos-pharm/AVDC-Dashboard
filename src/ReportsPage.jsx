import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  FileText,
  Download,
  Printer,
  Building2,
  AlertTriangle,
  Clock,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import { useAvdcData } from "./useAvdcData";
import avdcLogo from "./assets/avdc-logo.png";

const NAVY = "#0d2a63";

const STATUS_LABEL = {
  low: "ต่ำกว่า Min",
  near: "ใกล้ต่ำกว่า Min",
  over: "เกินกว่า Max",
  ok: "เพียงพอ",
  none: "ไม่มีคงเหลือ",
};

function statusOf(cell) {
  if (!cell) return "none";
  const { quantity, min, max } = cell;
  if (!quantity || quantity <= 0) return "none";
  if (min == null) return "ok";
  if (quantity < min) return "low";
  if (min > 0 && quantity <= min * 1.2) return "near";
  if (max != null && quantity > max) return "over";
  return "ok";
}

function thaiDateShort(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  const buddhistYear = d.getFullYear() + 543;
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${buddhistYear}`;
}

function nowThaiDateTime() {
  const d = new Date();
  const buddhistYear = d.getFullYear() + 543;
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const time = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  return `${d.getDate()} ${months[d.getMonth()]} ${buddhistYear} เวลา ${time} น.`;
}

const REPORT_TYPES = [
  { key: "stock", label: "คงคลังตามหน่วยงาน", desc: "ยอดคงเหลือของยาแต่ละตัว แยกตามหน่วยงาน", icon: Building2 },
  { key: "watch", label: "ยาที่ต้องติดตาม (Min/Max)", desc: "รายการต่ำกว่า Min / ใกล้ต่ำกว่า Min / เกิน Max", icon: AlertTriangle },
  { key: "expiring", label: "ยาใกล้หมดอายุ", desc: "ยาที่เหลืออายุไม่เกิน 90 วัน", icon: Clock },
];

export default function ReportsPage() {
  const { loading, departments, drugRows, expiringLots, lotsByDrugDept } = useAvdcData();
  const [reportType, setReportType] = useState("stock");
  const [filterDept, setFilterDept] = useState("all");
  const [preparedBy, setPreparedBy] = useState("");

  // ---------- รายงาน 1: คงคลังตามหน่วยงาน ----------
  const stockRows = useMemo(() => {
    const rows = [];
    drugRows.forEach((d) => {
      Object.entries(d.byDept).forEach(([deptName, cell]) => {
        if (filterDept !== "all" && deptName !== filterDept) return;
        if (!cell || !cell.quantity) return;
        // ดึงรายการ Lot ของยาตัวนี้ในหน่วยงานนี้ (เรียงตามวันหมดอายุใกล้สุดก่อน)
        const lots = lotsByDrugDept[`${d.name}||${deptName}`] || [];
        const lotText = lots.length ? lots.map((l) => l.lot || "-").join(", ") : "-";
        const expText = lots.length
          ? thaiDateShort(lots[0].expDate) + (lots.length > 1 ? ` (+${lots.length - 1} ล็อต)` : "")
          : "-";
        rows.push({
          drugName: d.name,
          strength: d.strength || "-",
          lot: lotText,
          expDate: expText,
          deptName,
          quantity: cell.quantity,
          min: cell.min ?? "-",
          max: cell.max ?? "-",
          status: STATUS_LABEL[statusOf(cell)],
        });
      });
    });
    return rows.sort((a, b) => a.drugName.localeCompare(b.drugName, "th") || a.deptName.localeCompare(b.deptName, "th"));
  }, [drugRows, filterDept, lotsByDrugDept]);

  // ---------- รายงาน 2: ยาที่ต้องติดตาม (Min/Max) ----------
  const watchRows = useMemo(() => {
    const rows = [];
    drugRows.forEach((d) => {
      Object.entries(d.byDept).forEach(([deptName, cell]) => {
        if (filterDept !== "all" && deptName !== filterDept) return;
        const status = statusOf(cell);
        if (status === "ok" || status === "none") return;
        // ดึงรายการ Lot ของยาตัวนี้ในหน่วยงานนี้ (เรียงตามวันหมดอายุใกล้สุดก่อน)
        const lots = lotsByDrugDept[`${d.name}||${deptName}`] || [];
        const lotText = lots.length ? lots.map((l) => l.lot || "-").join(", ") : "-";
        const expText = lots.length
          ? thaiDateShort(lots[0].expDate) + (lots.length > 1 ? ` (+${lots.length - 1} ล็อต)` : "")
          : "-";
        rows.push({
          drugName: d.name,
          strength: d.strength || "-",
          lot: lotText,
          expDate: expText,
          deptName,
          quantity: cell?.quantity ?? 0,
          min: cell?.min ?? "-",
          max: cell?.max ?? "-",
          status: STATUS_LABEL[status],
          statusKey: status,
        });
      });
    });
    const order = { low: 0, near: 1, over: 2 };
    return rows.sort((a, b) => order[a.statusKey] - order[b.statusKey] || a.drugName.localeCompare(b.drugName, "th"));
  }, [drugRows, filterDept, lotsByDrugDept]);

  // ---------- รายงาน 3: ยาใกล้หมดอายุ ----------
  const expiringRows = useMemo(() => {
    const rows = filterDept === "all" ? expiringLots : expiringLots.filter((l) => l.departmentName === filterDept);
    return rows.map((l) => ({
      drugName: l.drugName,
      strength: l.strength || "-",
      deptName: l.departmentName,
      lot: l.lot || "-",
      quantity: l.quantity,
      expDate: thaiDateShort(l.expDate),
      daysLeft: l.daysLeft,
    }));
  }, [expiringLots, filterDept]);

  const activeConfig = REPORT_TYPES.find((r) => r.key === reportType);
  const activeRows = reportType === "stock" ? stockRows : reportType === "watch" ? watchRows : expiringRows;

  const columns =
    reportType === "stock"
      ? [
          { key: "drugName", label: "ชื่อยา" },
          { key: "strength", label: "ความแรง" },
          { key: "lot", label: "Lot" },
          { key: "expDate", label: "วันหมดอายุ" },
          { key: "deptName", label: "หน่วยงาน" },
          { key: "quantity", label: "คงเหลือ", align: "right" },
          { key: "min", label: "Min", align: "right" },
          { key: "max", label: "Max", align: "right" },
          { key: "status", label: "สถานะ" },
        ]
      : reportType === "watch"
      ? [
          { key: "drugName", label: "ชื่อยา" },
          { key: "strength", label: "ความแรง" },
          { key: "lot", label: "Lot" },
          { key: "expDate", label: "วันหมดอายุ" },
          { key: "deptName", label: "หน่วยงาน" },
          { key: "quantity", label: "คงเหลือ", align: "right" },
          { key: "min", label: "Min", align: "right" },
          { key: "max", label: "Max", align: "right" },
          { key: "status", label: "สถานะ" },
        ]
      : [
          { key: "drugName", label: "ชื่อยา" },
          { key: "strength", label: "ความแรง" },
          { key: "lot", label: "Lot" },
          { key: "expDate", label: "วันหมดอายุ" },
          { key: "deptName", label: "หน่วยงาน" },
          { key: "quantity", label: "คงเหลือ", align: "right" },
          { key: "daysLeft", label: "เหลืออีก (วัน)", align: "right" },
        ];

  function exportExcel() {
    const wsData = [
      columns.map((c) => c.label),
      ...activeRows.map((r) => columns.map((c) => r[c.key])),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = columns.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeConfig.label.slice(0, 31));
    const filename = `AVDC-${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#eef1f6] font-['Kanit'] text-slate-800">
      <div className="mx-auto max-w-[1100px] p-4 md:p-6">
        {/* ================= ส่วนควบคุม (ไม่พิมพ์ออกมา) ================= */}
        <div className="print:hidden space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0d2a63]/10">
              <FileText className="h-6 w-6" style={{ color: NAVY }} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black" style={{ color: NAVY }}>รายงาน</h1>
              <p className="text-xs md:text-sm text-slate-400">สร้างรายงานสรุปสำหรับพิมพ์หรือส่งออกเป็นไฟล์ Excel</p>
            </div>
          </div>

          {/* เลือกประเภทรายงาน */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {REPORT_TYPES.map((rt) => {
              const Icon = rt.icon;
              const active = reportType === rt.key;
              return (
                <button
                  key={rt.key}
                  onClick={() => setReportType(rt.key)}
                  className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
                    active ? "border-[#007bff] bg-[#eaf1fd] shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[#007bff] text-white" : "bg-slate-100 text-slate-400"}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-bold ${active ? "text-[#007bff]" : "text-slate-700"}`}>{rt.label}</span>
                    <span className="block text-xs text-slate-400">{rt.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* ตัวกรอง + ผู้จัดทำ + ปุ่ม export */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500">
                <SlidersHorizontal className="h-3.5 w-3.5" /> หน่วยงาน
              </label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white"
              >
                <option value="all">ทุกหน่วยงาน</option>
                {departments.map((dep) => (
                  <option key={dep.id} value={dep.name}>{dep.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 block text-xs font-bold text-slate-500">ผู้จัดทำรายงาน (ไม่บังคับ)</label>
              <input
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="พิมพ์ชื่อผู้จัดทำ"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportExcel}
                disabled={loading || activeRows.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#128a3e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-4 w-4" /> ดาวน์โหลด Excel
              </button>
              <button
                onClick={handlePrint}
                disabled={loading || activeRows.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-[#007bff] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0062cc] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Printer className="h-4 w-4" /> พิมพ์ / บันทึกเป็น PDF
              </button>
            </div>
          </div>

          {loading && (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดข้อมูล...
            </p>
          )}
        </div>

        {/* ================= พื้นที่รายงาน (ส่วนนี้จะถูกพิมพ์ / อยู่ในไฟล์ Excel) ================= */}
        <div id="report-print-area" className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:mt-0 print:rounded-none print:border-none print:shadow-none print:p-0">
          {/* หัวรายงานแบบหัวจดหมาย */}
          <div className="mb-4 flex items-center gap-3 border-b-2 pb-3" style={{ borderColor: NAVY }}>
            <img src={avdcLogo} alt="AVDC Logo" className="h-14 w-14 object-contain" />
            <div className="min-w-0">
              <p className="text-base font-black" style={{ color: NAVY }}>
                ศูนย์ Antidote และ Vital Drug โรงพยาบาลกุมภวาปี
              </p>
              <p className="text-sm font-bold text-slate-600">{activeConfig.label}</p>
              {filterDept !== "all" && <p className="text-xs text-slate-400">เฉพาะหน่วยงาน: {filterDept}</p>}
            </div>
            <div className="ml-auto text-right text-xs text-slate-400">
              <p>พิมพ์เมื่อ {nowThaiDateTime()}</p>
              {preparedBy && <p>ผู้จัดทำ: {preparedBy}</p>}
              <p>ทั้งหมด {activeRows.length} รายการ</p>
            </div>
          </div>

          {/* ตารางรายงาน */}
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`border border-slate-200 bg-slate-50 px-2.5 py-2 font-bold text-slate-600 print:bg-slate-100 ${c.align === "right" ? "text-right" : "text-left"}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="border border-slate-200 px-2.5 py-6 text-center text-slate-400">
                    ไม่มีข้อมูลสำหรับรายงานนี้
                  </td>
                </tr>
              ) : (
                activeRows.map((r, idx) => (
                  <tr key={idx} className="break-inside-avoid">
                    {columns.map((c) => (
                      <td key={c.key} className={`border border-slate-200 px-2.5 py-1.5 ${c.align === "right" ? "text-right font-semibold" : ""}`}>
                        {r[c.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <p className="mt-4 text-center text-[11px] text-slate-300 print:block">
            ออกโดยระบบ AVDC Dashboard — ศูนย์ Antidote และ Vital Drug โรงพยาบาลกุมภวาปี
          </p>
        </div>
      </div>

      {/* กำหนดขนาดกระดาษ/ระยะขอบตอนพิมพ์ */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
