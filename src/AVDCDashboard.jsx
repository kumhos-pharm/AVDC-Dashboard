import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Building2,
  Boxes,
  MapPin,
  BarChart3,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Syringe,
  RefreshCw,
  Loader2,
  AlertOctagon,
  Calendar,
  Pill,
  Database,
  X,
  ListChecks,
  Clock,
  ExternalLink,
} from "lucide-react";
import { useAvdcData } from "./useAvdcData";
import avdcLogo from "./assets/avdc-logo.png";

const NAVY = "#0d2a63";
const NAVY_DEEP = "#0a1f4d";

const STATUS = {
  ok: { text: "text-slate-700", bg: "", badgeBg: "bg-[#eaf7ef]", badgeText: "text-[#16a34a]", icon: CheckCircle2, dot: "bg-[#22c55e]", label: "เพียงพอ" },
  near: { text: "text-[#d97706] font-bold", bg: "", badgeBg: "bg-[#fef6df]", badgeText: "text-[#b7860b]", icon: AlertTriangle, dot: "bg-[#f2c14e]", label: "ใกล้ต่ำกว่า Min" },
  low: { text: "text-[#dc2626] font-bold", bg: "", badgeBg: "bg-[#fdeaea]", badgeText: "text-[#dc2626]", icon: XCircle, dot: "bg-[#e5534b]", label: "ต่ำกว่า Min" },
  over: { text: "text-[#b3540c] font-bold", bg: "bg-[#fdead0]", badgeBg: "bg-[#fdead0]", badgeText: "text-[#b3540c]", icon: AlertTriangle, dot: "bg-[#f0973a]", label: "มากกว่า Max" },
  none: { text: "text-slate-300", bg: "", badgeBg: "bg-slate-100", badgeText: "text-slate-400", icon: MinusCircle, dot: "bg-slate-300", label: "ไม่มี" },
};

function statusOf(cell) {
  if (!cell) return "none";
  const { quantity, min, max } = cell;
  // ไม่มีคงเหลือเลย (0 หรือไม่มีค่า) ให้ถือเป็น "ไม่มี" (เทา) เสมอ ไม่ตีเป็น "ต่ำกว่า Min" (แดง)
  // เพราะ "ต่ำกว่า Min" ควรสื่อถึงมีของอยู่บ้างแต่ไม่พอ ไม่ใช่กรณีไม่มีของเลย
  if (!quantity || quantity <= 0) return "none";
  if (min == null) return "ok";
  if (quantity < min) return "low";
  if (min > 0 && quantity <= min * 1.2) return "near";
  if (max != null && quantity > max) return "over";
  return "ok";
}

// =========================================================================
// SVG โลโก้ทางการ AVDC (ดั้งเดิม)
// =========================================================================
function OfficialAVDCLogo({ className = "h-20 w-20" }) {
  return (
    <svg className={className} viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 5 L90 25 V65 C90 85 70 105 50 110 C30 105 10 85 10 65 V25 L50 5 Z" fill="#0d2a63" stroke="#0d2a63" strokeWidth="2" />
      <g clipPath="url(#shield-clip)">
        <path d="M50 12 L83 28.5 V62 C83 78 68 94 50 98 C32 94 17 78 17 62 V28.5 L50 12 Z" fill="white" />
        <path d="M17 28.5 V57 H50 V12 Z" fill="#1e824c" />
        <path d="M50 12 V57 H83 V28.5 Z" fill="#20509e" />
        <path d="M17 57 V62 C17 78 32 94 50 98 V57 H17 Z" fill="#1b4f72" />
        <path d="M50 57 V98 C68 94 83 78 83 62 V57 H50 Z" fill="#cb2424" />
      </g>
      <path d="M50 12 L83 28.5 V62 C83 78 68 94 50 98 C32 94 17 78 17 62 V28.5 L50 12 Z" fill="none" stroke="white" strokeWidth="2.5" />
      <text x="50" y="40" fill="white" fontSize="17" fontWeight="900" textAnchor="middle" fontFamily="Kanit, sans-serif">AVDC</text>
      <path d="M26 65 H34 L38 52 L44 76 L48 60 L52 68 H74" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="34" cy="65" r="3.5" fill="#38bdf8" stroke="white" strokeWidth="1" />
      <path id="sub-curve" d="M 12 95 Q 50 122 88 95" fill="none" />
      <text fill="#0d2a63" fontSize="5.8" fontWeight="bold" fontFamily="Kanit, sans-serif">
        <textPath href="#sub-curve" startOffset="50%" textAnchor="middle">
          Antidote &amp; Vital Drug Center
        </textPath>
      </text>
      <defs>
        <clipPath id="shield-clip">
          <path d="M50 12 L83 28.5 V62 C83 78 68 94 50 98 C32 94 17 78 17 62 V28.5 L50 12 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}

// =========================================================================
// Component การ์ดสรุปยอด (พร้อมระบบป้องกันข้อความตกหล่น)
// =========================================================================
function SummaryCard({ customIcon, label, value, unit, borderColor, bg, isLast, onClick }) {
  const clickable = typeof onClick === "function";
  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick(e);
        }
      }}
      className={`flex items-center gap-3 rounded-2xl border-2 p-3 shadow-sm bg-white font-['Kanit'] w-full min-w-0 transition ${
        clickable ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0" : ""
      }`}
      style={{ borderColor: borderColor, backgroundColor: bg }}
    >
      <div className="shrink-0">{customIcon}</div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold text-slate-500 leading-tight block mb-0.5 truncate">{label}</span>
        {isLast ? (
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
            <span className="text-2xl md:text-3xl font-black text-slate-800 leading-none whitespace-nowrap">
              {value}
            </span>
            {unit && (
              <span className="text-xs font-bold text-slate-400 leading-tight">
                {unit}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
            <span className="text-2xl md:text-3xl font-black text-slate-800 leading-none whitespace-nowrap">{value}</span>
            {unit && <span className="text-xs font-bold text-slate-400 leading-tight">{unit}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// Modal แสดงรายละเอียดเมื่อคลิกการ์ดสรุปยอด (ดึงข้อมูลจริงจาก useAvdcData)
// =========================================================================
function DetailModal({ open, onClose, title, subtitle, icon, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 font-['Kanit']"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon}
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-800 truncate">{title}</h3>
              {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.badgeBg} ${s.badgeText} font-['Kanit']`}>
      <Icon className="h-3.5 w-3.5" /> {s.label}
    </span>
  );
}

function formatThaiDateTime(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    const buddhistYear = d.getFullYear() + 543;
    const months = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    const time = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    return `${d.getDate()} ${months[d.getMonth()]} ${buddhistYear}\n${time} น.`;
  } catch {
    return iso;
  }
}

export default function AVDCDashboard() {
  const { loading, refreshing, error, departments, drugRows, totalDrugCount, totalQuantity, lastUpdated, expiringLots, lotsByDrugDept, reload } = useAvdcData();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeModal, setActiveModal] = useState(null); // "drugs" | "depts" | "qty" | "expiring" | "watch" | null
  const [watchStatus, setWatchStatus] = useState(null); // "low" | "near" | "over" — ใช้ตอนเปิด popup รายการที่ต้องติดตาม
  const [cellDetail, setCellDetail] = useState(null); // { drugName, deptName, deptId, cell } — ใช้ตอนคลิกยอดคงเหลือในตารางหลัก (แสดง popup แทนการเปลี่ยนหน้าไปคลังยา)

  // ไปหน้าคลังยา พร้อมค้นหาชื่อยา/หน่วยงานที่ต้องการให้ทันที (ใช้ตอนคลิกยอดที่ต่ำกว่า Min ในตาราง)
  function goToWarehouse({ drugName, departmentId } = {}) {
    const params = new URLSearchParams();
    if (drugName) params.set("q", drugName);
    if (departmentId != null) params.set("dept", String(departmentId));
    const qs = params.toString();
    navigate(`/admin/warehouse${qs ? `?${qs}` : ""}`);
  }

  const homeDept = departments.find((d) => d.is_home);
  const warehouseDept = departments.find((d) => d.name === "คลังยา");

  // รายการยาทั้งหมด พร้อมยอดคงเหลือรวมทุกหน่วยงาน (สำหรับการ์ด "รายการ Antidote")
  const drugTotals = useMemo(
    () =>
      drugRows
        .map((d) => ({
          name: d.name,
          total: Object.values(d.byDept).reduce((sum, c) => sum + (c?.quantity || 0), 0),
          deptCount: Object.values(d.byDept).filter((c) => c && c.quantity > 0).length,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "th")),
    [drugRows]
  );

  // สรุปยอดคงเหลือ + จำนวนรายการยา แยกตามหน่วยงาน (สำหรับการ์ด "หน่วยงานที่มียา" และ "จำนวนยาคงเหลือ")
  const deptTotals = useMemo(
    () =>
      departments
        .map((dep) => ({
          ...dep,
          total: drugRows.reduce((sum, d) => sum + (d.byDept[dep.name]?.quantity || 0), 0),
          itemCount: drugRows.filter((d) => d.byDept[dep.name] && d.byDept[dep.name].quantity > 0).length,
        }))
        .sort((a, b) => b.total - a.total),
    [departments, drugRows]
  );

  const filteredDrugs = useMemo(() => {
    if (!query.trim()) return drugRows;
    return drugRows.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase()));
  }, [query, drugRows]);

  const summaryRows = useMemo(
    () =>
      drugRows
        .map((d) => ({
          name: d.name,
          home: d.byDept[homeDept?.name],
          warehouse: d.byDept[warehouseDept?.name],
        }))
        .filter((r) => r.home || r.warehouse),
    [drugRows, homeDept, warehouseDept]
  );

  const watchlist = useMemo(() => {
    const items = [];
    drugRows.forEach((d) => {
      Object.entries(d.byDept).forEach(([deptName, cell]) => {
        const status = statusOf(cell);
        if (status !== "ok" && status !== "none") {
          items.push({
            drugName: d.name,
            deptName,
            status,
            quantity: cell?.quantity ?? null,
            min: cell?.min ?? null,
            max: cell?.max ?? null,
            lots: lotsByDrugDept[`${d.name}||${deptName}`] || [],
          });
        }
      });
    });
    return items;
  }, [drugRows, lotsByDrugDept]);

  const watchCounts = {
    low: watchlist.filter((w) => w.status === "low").length,
    near: watchlist.filter((w) => w.status === "near").length,
    over: watchlist.filter((w) => w.status === "over").length,
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] w-full items-center justify-center gap-2 bg-[#eef1f6] text-slate-500 font-['Kanit']">
        <Loader2 className="h-5 w-5 animate-spin" /> กำลังโหลดข้อมูล...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-2 bg-[#eef1f6] p-6 text-center text-slate-500 font-['Kanit']">
        <AlertOctagon className="h-8 w-8 text-red-400" />
        <p className="font-bold text-red-500">ดึงข้อมูลไม่สำเร็จ</p>
        <p className="max-w-md text-xs text-slate-400">{error.message || "โปรดตรวจสอบสิทธิ์ในการเชื่อมต่อ"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#eef1f6] font-['Kanit'] text-slate-800 antialiased">
      <div className="mx-auto max-w-[1460px] p-4 md:p-5">
        
        {/* ========================================================================= */}
        {/* 1. ส่วนบนสุด (Header Area) รองรับ Responsive Grid */}
        {/* ========================================================================= */}
        <div className="mb-4">
          
          {/* ส่วนหัว และ การ์ดข้อมูล 4 ใบ */}
          <div className="rounded-2xl bg-white p-4 md:p-5 border border-slate-100 shadow-sm flex flex-col justify-between gap-4 min-w-0">
            
            {/* โลโก้, ชื่อศูนย์ และ แถบอัปเดตล่าสุด */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="shrink-0">
                  <img src={avdcLogo} alt="AVDC Logo" className="h-20 w-20 md:h-24 md:w-24 object-contain" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: NAVY }}>
                    AVDC DASHBOARD
                  </h1>
                  <p className="text-lg md:text-xl font-bold leading-normal truncate">
                    <span className="text-[#16a34a]">Antidote</span> &amp; <span className="text-[#dc2626]">Vital Drug</span>{" "}
                    <span className="text-slate-700">Center</span>
                  </p>
                  <p className="text-xs md:text-sm font-semibold text-slate-400 truncate">ศูนย์ Antidote และ Vital Drug โรงพยาบาลกุมภวาปี</p>
                </div>
              </div>

              {/* กล่องอัปเดตข้อมูล */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm self-start sm:self-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d2a63]/5 text-[#0d2a63]">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <div className="font-bold text-slate-400 text-[10.5px] mb-0.5">อัปเดตล่าสุด</div>
                  <div className="font-extrabold text-slate-700 text-xs md:text-sm whitespace-pre-line">
                    {formatThaiDateTime(lastUpdated)}
                  </div>
                </div>
                <button
                  onClick={() => reload()}
                  disabled={refreshing}
                  className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-60 shadow-sm"
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* การ์ดสรุปทั้ง 4 ใบ (Top Summary Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <SummaryCard 
                customIcon={<MedicineBottleIcon />} 
                label="รายการ Antidote / Vital Drug" 
                value={totalDrugCount} 
                unit="รายการ" 
                borderColor="#c8ebd3"
                bg="#eaf7ef"
                onClick={() => setActiveModal("drugs")}
              />
              <SummaryCard 
                customIcon={<HospitalBuildingIcon />} 
                label="หน่วยงานที่มียา" 
                value={departments.length} 
                unit="หน่วยงาน" 
                borderColor="#fcebc4"
                bg="#fef6df"
                onClick={() => setActiveModal("depts")}
              />
              <SummaryCard 
                customIcon={<MedicineBoxIcon />} 
                label="จำนวนยาคงเหลือรวม" 
                value={totalQuantity.toLocaleString()} 
                unit="หน่วย" 
                borderColor="#e3dbfc"
                bg="#f1eefc"
                onClick={() => setActiveModal("qty")}
              />
              <SummaryCard 
                customIcon={<ExpiringSoonIcon />} 
                label="ยาใกล้หมดอายุ (90 วัน)" 
                value={expiringLots.length} 
                unit="ล็อต" 
                borderColor="#fbd7d0"
                bg="#fff1ee"
                isLast={true}
                onClick={() => setActiveModal("expiring")}
              />
            </div>

          </div>

        </div>

        {/* ========================================================================= */}
        {/* 2. ส่วนข้อมูลอื่นๆ ตาราง และไซด์บาร์ */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          
          {/* ฝั่งซ้าย: ตารางข้อมูลยา */}
          <main className="space-y-4 min-w-0">
            
            {/* ตารางหลัก: ยาในแต่ละหน่วยงาน */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-700">
                  <MapPin className="h-4 w-4 shrink-0" style={{ color: NAVY }} />
                  ยา Antidote &amp; Vital Drug ที่มีในหน่วยงาน (แสดงเฉพาะคงเหลือ)
                </h2>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ค้นหา Antidote / Vital Drug..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-3.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl">
                <table className="w-full min-w-[1180px] border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-white p-2 text-left align-bottom font-bold text-slate-600 border-b border-slate-100">
                        Antidote / Vital Drug
                      </th>
                      {departments.map((dep) => {
                        const isHome = dep.id === homeDept?.id;
                        return (
                          <th 
                            key={dep.id} 
                            className={`p-2 text-center align-bottom font-bold border-b border-slate-100 min-w-[72px] ${
                              isHome ? "bg-[#0d2a63] text-white rounded-t-lg" : "text-slate-600"
                            }`}
                          >
                            <div className="text-xs truncate">{dep.name}</div>
                            <div className={`text-[10.5px] font-semibold ${isHome ? "text-blue-100" : "text-slate-400"}`}>
                              คงเหลือ
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrugs.map((row) => (
                      <tr key={row.name} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-white p-2.5 font-bold text-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                          <span className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#eaf1fb] text-[#20509e]">
                              <Syringe className="h-3 w-3" />
                            </span>
                            {row.name}
                          </span>
                        </td>
                        {departments.map((dep) => {
                          const cell = row.byDept[dep.name];
                          const status = statusOf(cell);
                          const isHome = dep.id === homeDept?.id;
                          const st = STATUS[status];
                          const hasStock = cell && cell.quantity > 0;

                          return (
                            <td key={dep.id} className={`p-1.5 text-center ${isHome ? "bg-[#eaf7ef]/70" : ""}`}>
                              {hasStock ? (
                                <button
                                  onClick={() => setCellDetail({ drugName: row.name, deptName: dep.name, deptId: dep.id, cell })}
                                  className={`mx-auto flex h-8 w-[60px] items-center justify-center rounded-md font-extrabold transition hover:ring-2 hover:ring-offset-1 ${st.text} ${st.bg}`}
                                  title={`ดูรายละเอียด: ${row.name} (${dep.name})`}
                                >
                                  {cell.quantity}
                                </button>
                              ) : (
                                <div className="mx-auto flex h-8 w-[60px] items-center justify-center rounded-md font-extrabold text-slate-300">
                                  -
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* คำอธิบายด้านล่างตาราง */}
              <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="font-bold text-slate-400">หมายเหตุ: แสดงเฉพาะ "คงเหลือ" (หน่วย: ขวด/หลอด/ชุด)</span>
                {Object.entries(STATUS).filter(([k]) => k !== "none").map(([key, s]) => (
                  <span key={key} className="flex items-center gap-1.5 font-semibold">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${s.dot}`} /> {s.label}
                  </span>
                ))}
              </div>
            </div>

            {/* ตารางเปรียบเทียบ Min/Max */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm min-w-0">
                <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
                  <BarChart3 className="h-4 w-4 shrink-0" style={{ color: NAVY }} />
                  <span className="truncate">สถานะคงคลัง (ศูนย์ AVDC และ คลังยา)</span>
                </h2>
                <div className="overflow-x-auto rounded-xl">
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr>
                        <th rowSpan={2} className="border-b border-slate-200 p-2 text-left font-bold text-slate-600">Antidote / Vital Drug</th>
                        <th colSpan={4} className="border-b border-slate-200 bg-[#eef6ff] p-2 text-center font-bold text-[#1e589e]">ศูนย์ AVDC (Phar-OPD)</th>
                        <th colSpan={4} className="border-b border-slate-200 bg-[#eaf7ef] p-2 text-center font-bold text-[#1b723a]">คลังยา</th>
                      </tr>
                      <tr className="text-xs text-slate-400">
                        <th className="p-1 text-center border-b border-slate-100">Min</th>
                        <th className="p-1 text-center border-b border-slate-100">Max</th>
                        <th className="p-1 text-center border-b border-slate-100">คงเหลือ</th>
                        <th className="p-1 text-center border-b border-slate-100">สถานะ</th>
                        <th className="p-1 text-center border-b border-slate-100">Min</th>
                        <th className="p-1 text-center border-b border-slate-100">Max</th>
                        <th className="p-1 text-center border-b border-slate-100">คงเหลือ</th>
                        <th className="p-1 text-center border-b border-slate-100">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((s) => {
                        const homeStatus = statusOf(s.home);
                        const whStatus = statusOf(s.warehouse);
                        const homeNeedsAttention = homeStatus === "low" || homeStatus === "near" || homeStatus === "over";
                        const whNeedsAttention = whStatus === "low" || whStatus === "near" || whStatus === "over";
                        return (
                          <tr key={s.name} className="border-t border-slate-100 hover:bg-slate-50/50">
                            <td className="p-2 font-bold text-slate-700">{s.name}</td>
                            <td className="p-1 text-center text-slate-500 font-semibold">{s.home?.min ?? "-"}</td>
                            <td className="p-1 text-center text-slate-500 font-semibold">{s.home?.max ?? "-"}</td>
                            <td className={`p-1 text-center font-extrabold ${STATUS[homeStatus].text}`}>{s.home && s.home.quantity !== 0 ? s.home.quantity : "-"}</td>
                            <td className="p-1 text-center">
                              {homeNeedsAttention ? (
                                <button onClick={() => goToWarehouse({ drugName: s.name, departmentId: homeDept?.id })} className="transition hover:opacity-75" title="ไปหน้าคลังยา">
                                  <StatusBadge status={homeStatus} />
                                </button>
                              ) : (
                                <StatusBadge status={homeStatus} />
                              )}
                            </td>
                            <td className="p-1 text-center text-slate-500 font-semibold">{s.warehouse?.min ?? "-"}</td>
                            <td className="p-1 text-center text-slate-500 font-semibold">{s.warehouse?.max ?? "-"}</td>
                            <td className={`p-1 text-center font-extrabold ${STATUS[whStatus].text}`}>{s.warehouse && s.warehouse.quantity !== 0 ? s.warehouse.quantity : "-"}</td>
                            <td className="p-1 text-center">
                              {whNeedsAttention ? (
                                <button onClick={() => goToWarehouse({ drugName: s.name, departmentId: warehouseDept?.id })} className="transition hover:opacity-75" title="ไปหน้าคลังยา">
                                  <StatusBadge status={whStatus} />
                                </button>
                              ) : (
                                <StatusBadge status={whStatus} />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* การ์ดรายการติดตามด่วน */}
              <div className="rounded-2xl border border-red-100 bg-[#fff5f5] p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="mb-3 text-sm font-black text-red-700 tracking-wide uppercase">รายการที่ต้องติดตาม</h3>
                  <div className="space-y-2.5">
                    <button
                      onClick={() => { setWatchStatus("low"); setActiveModal("watch"); }}
                      className="flex w-full items-center justify-between rounded-xl bg-white/90 px-3 py-2 text-sm border border-red-100 transition hover:bg-white hover:shadow-sm"
                      title="คลิกเพื่อดูรายการ"
                    >
                      <span className="flex items-center gap-1.5 font-bold text-[#dc2626]">
                        <ArrowDownCircle className="h-4 w-4" /> ต่ำกว่า Min
                      </span>
                      <span className="font-extrabold text-slate-700">{watchCounts.low} รายการ</span>
                    </button>
                    <button
                      onClick={() => { setWatchStatus("near"); setActiveModal("watch"); }}
                      className="flex w-full items-center justify-between rounded-xl bg-white/90 px-3 py-2 text-sm border border-amber-100 transition hover:bg-white hover:shadow-sm"
                      title="คลิกเพื่อดูรายการ"
                    >
                      <span className="flex items-center gap-1.5 font-bold text-amber-600">
                        <AlertTriangle className="h-4 w-4" /> ใกล้ต่ำกว่า Min
                      </span>
                      <span className="font-extrabold text-slate-700">{watchCounts.near} รายการ</span>
                    </button>
                    <button
                      onClick={() => { setWatchStatus("over"); setActiveModal("watch"); }}
                      className="flex w-full items-center justify-between rounded-xl bg-white/90 px-3 py-2 text-sm border border-orange-100 transition hover:bg-white hover:shadow-sm"
                      title="คลิกเพื่อดูรายการ"
                    >
                      <span className="flex items-center gap-1.5 font-bold text-[#b3540c]">
                        <ArrowUpCircle className="h-4 w-4" /> เกิน Max
                      </span>
                      <span className="font-extrabold text-slate-700">{watchCounts.over} รายการ</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="rounded-xl bg-red-600 py-2.5 text-center text-base font-black text-white">
                    รวม {watchCounts.low + watchCounts.near + watchCounts.over} รายการ
                  </div>
                </div>
              </div>

            </div>
          </main>

          {/* ฝั่งขวาด้านล่าง: เมนูปีกนกช่วยเหลือ */}
          <aside className="flex flex-col gap-4">

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-bold text-slate-600">คำแนะนำการแปลผล (คงเหลือ)</p>
              <div className="space-y-2.5 text-sm">
                {Object.entries(STATUS).map(([key, s]) => {
                  const Icon = s.icon;
                  let desc = "";
                  if (key === "ok") desc = "คงเหลืออยู่ในช่วง Min - Max";
                  if (key === "near") desc = "คงเหลือ ≤ 20% เหนือ Min";
                  if (key === "low") desc = "คงเหลือต่ำกว่า Min";
                  if (key === "over") desc = "คงเหลือมากกว่า Max";
                  if (key === "none") desc = "ไม่มีสำรองในหน่วยงานนี้";
                  return (
                    <div key={key} className="flex items-start gap-2.5 font-['Kanit']">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.badgeText}`} />
                      <div>
                        <span className={`font-bold ${s.badgeText}`}>{s.label}</span>
                        <p className="text-xs text-slate-500 mt-0.5 leading-snug">{desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-[#eef6ff] p-4 shadow-sm">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-[#20509e]">
                <Lightbulb className="h-4.5 w-4.5" /> ไม่พบยาในหน่วยงานของท่าน?
              </p>
              <p className="text-sm text-slate-600">โปรดติดต่อ ศูนย์ AVDC (Phar-OPD)</p>
              <p className="text-base font-bold text-slate-800 mt-1">โทร. 042-33440 , 042-334412-3 ต่อ xxxx</p>
              <p className="text-base font-bold text-slate-800 mt-1">มือถือ 000-0000000</p>
            </div>

          </aside>

        </div>

      </div>

      {/* ================= Modal: รายการ Antidote / Vital Drug ================= */}
      <DetailModal
        open={activeModal === "drugs"}
        onClose={() => setActiveModal(null)}
        title="รายการ Antidote / Vital Drug"
        subtitle={`ทั้งหมด ${totalDrugCount} รายการ`}
        icon={<MedicineBottleIcon className="h-8 w-8 shrink-0" />}
      >
        <div className="mb-3 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="พิมพ์ชื่อยาเพื่อค้นหา..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-3.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
          />
        </div>
        <div className="space-y-1.5">
          {drugTotals
            .filter((d) => !query.trim() || d.name.toLowerCase().includes(query.trim().toLowerCase()))
            .map((d) => (
              <div key={d.name} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50">
                <span className="flex items-center gap-2 font-semibold text-slate-700">
                  <Syringe className="h-3.5 w-3.5 text-[#20509e]" /> {d.name}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-400">{d.deptCount} หน่วยงาน</span>
                  <span className="font-black text-slate-800">{d.total.toLocaleString()} หน่วย</span>
                </span>
              </div>
            ))}
          {drugTotals.filter((d) => !query.trim() || d.name.toLowerCase().includes(query.trim().toLowerCase())).length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">ไม่พบรายการยาที่ตรงกับคำค้นหา</p>
          )}
        </div>
      </DetailModal>

      {/* ================= Modal: หน่วยงานที่มียา ================= */}
      <DetailModal
        open={activeModal === "depts"}
        onClose={() => setActiveModal(null)}
        title="หน่วยงานที่มียา Antidote / Vital Drug"
        subtitle={`ทั้งหมด ${departments.length} หน่วยงาน`}
        icon={<HospitalBuildingIcon className="h-8 w-8 shrink-0" />}
      >
        <div className="space-y-1.5">
          {deptTotals.map((dep) => (
            <div key={dep.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50">
              <span className="flex items-center gap-2 font-semibold text-slate-700 min-w-0">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-[#e2931a]" />
                <span className="truncate">{dep.name}</span>
                {dep.is_home && (
                  <span className="shrink-0 rounded-full bg-[#eaf1fb] px-2.5 py-1 text-sm font-bold text-[#20509e]">ศูนย์ AVDC</span>
                )}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-slate-400">{dep.itemCount} รายการ</span>
                <span className="font-black text-slate-800">{dep.total.toLocaleString()} หน่วย</span>
              </span>
            </div>
          ))}
          {deptTotals.length === 0 && <p className="py-6 text-center text-sm text-slate-400">ไม่พบข้อมูลหน่วยงาน</p>}
        </div>
      </DetailModal>

      {/* ================= Modal: จำนวนยาคงเหลือรวม ================= */}
      <DetailModal
        open={activeModal === "qty"}
        onClose={() => setActiveModal(null)}
        title="จำนวนยาคงเหลือรวม แยกตามหน่วยงาน"
        subtitle={`รวมทั้งหมด ${totalQuantity.toLocaleString()} หน่วย`}
        icon={<MedicineBoxIcon className="h-8 w-8 shrink-0" />}
      >
        <div className="space-y-2">
          {deptTotals.map((dep) => {
            const pct = totalQuantity > 0 ? Math.round((dep.total / totalQuantity) * 100) : 0;
            return (
              <div key={dep.id} className="rounded-xl border border-slate-100 px-3 py-2.5 text-sm">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700 min-w-0 truncate">
                    <ListChecks className="h-3.5 w-3.5 shrink-0 text-[#5e3edc]" /> {dep.name}
                  </span>
                  <span className="font-black text-slate-800 shrink-0">{dep.total.toLocaleString()} หน่วย ({pct}%)</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#7c5cf0]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {deptTotals.length === 0 && <p className="py-6 text-center text-sm text-slate-400">ไม่พบข้อมูลคงเหลือ</p>}
        </div>
      </DetailModal>

      {/* ================= Modal: ยาใกล้หมดอายุ ================= */}
      <DetailModal
        open={activeModal === "expiring"}
        onClose={() => setActiveModal(null)}
        title="ยาใกล้หมดอายุ (ภายใน 90 วัน)"
        subtitle={`ทั้งหมด ${expiringLots.length} ล็อต`}
        icon={<ExpiringSoonIcon className="h-8 w-8 shrink-0" />}
      >
        <div className="space-y-1.5">
          {expiringLots.map((lot, idx) => {
            const expired = lot.daysLeft < 0;
            return (
              <button
                key={`${lot.drugName}-${lot.lot}-${idx}`}
                onClick={() => {
                  setActiveModal(null);
                  goToWarehouse({ drugName: lot.drugName });
                }}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
                title="คลิกเพื่อไปหน้าคลังยา"
              >
                <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700">
                  <Syringe className="h-3.5 w-3.5 shrink-0 text-[#dc6b4f]" />
                  <span className="min-w-0">
                    <span className="block truncate">{lot.drugName} <span className="font-normal text-slate-400">(Lot {lot.lot})</span></span>
                    <span className="block text-sm font-normal text-slate-400">{lot.departmentName} • คงเหลือ {lot.quantity.toLocaleString()}</span>
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-slate-500">{formatThaiDateTime(lot.expDate).split("\n")[0]}</span>
                  <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${expired ? "bg-red-100 text-red-600" : "bg-orange-50 text-[#dc6b4f]"}`}>
                    {expired ? `หมดอายุแล้ว ${Math.abs(lot.daysLeft)} วัน` : `เหลือ ${lot.daysLeft} วัน`}
                  </span>
                </span>
              </button>
            );
          })}
          {expiringLots.length === 0 && <p className="py-6 text-center text-sm text-slate-400">ไม่มียาใกล้หมดอายุภายใน 90 วัน</p>}
        </div>
        {expiringLots.length > 0 && (
          <button
            onClick={() => {
              setActiveModal(null);
              goToWarehouse();
            }}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#dc6b4f] py-2.5 text-sm font-bold text-white hover:bg-[#c65a3f]"
          >
            <ExternalLink className="h-3.5 w-3.5" /> ไปหน้าคลังยาเพื่อจัดการ
          </button>
        )}
      </DetailModal>

      {/* ================= Modal: รายการที่ต้องติดตาม (ต่ำกว่า Min / ใกล้ต่ำกว่า Min / เกิน Max) ================= */}
      <DetailModal
        open={activeModal === "watch"}
        onClose={() => setActiveModal(null)}
        title={
          watchStatus === "low"
            ? "รายการต่ำกว่า Min"
            : watchStatus === "near"
            ? "รายการใกล้ต่ำกว่า Min"
            : "รายการเกิน Max"
        }
        subtitle={`ทั้งหมด ${watchCounts[watchStatus] ?? 0} รายการ`}
        icon={
          watchStatus === "over" ? (
            <ArrowUpCircle className="h-8 w-8 shrink-0 text-[#b3540c]" />
          ) : watchStatus === "near" ? (
            <AlertTriangle className="h-8 w-8 shrink-0 text-amber-500" />
          ) : (
            <ArrowDownCircle className="h-8 w-8 shrink-0 text-[#dc2626]" />
          )
        }
      >
        <div className="space-y-1.5">
          {watchlist
            .filter((w) => w.status === watchStatus)
            .map((w, idx) => (
              <div key={`${w.drugName}-${w.deptName}-${idx}`} className="rounded-xl border border-slate-100 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700">
                    <Syringe className="h-3.5 w-3.5 shrink-0 text-[#20509e]" />
                    <span className="min-w-0">
                      <span className="block truncate">{w.drugName}</span>
                      <span className="block text-sm font-normal text-slate-400">{w.deptName}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="font-black text-slate-800">{w.quantity ?? "-"} หน่วย</span>
                    <span className="text-sm text-slate-400">Min {w.min ?? "-"} / Max {w.max ?? "-"}</span>
                  </span>
                </div>
                {w.lots.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-dashed border-slate-100 pt-2">
                    {w.lots.map((lot, li) => (
                      <div key={`${lot.lot}-${li}`} className="flex items-center justify-between gap-2 text-sm text-slate-500">
                        <span className="truncate">Lot {lot.lot || "-"}</span>
                        <span className="shrink-0 flex items-center gap-1.5">
                          <span>หมดอายุ {lot.expDate ? formatThaiDateTime(lot.expDate).split("\n")[0] : "-"}</span>
                          <span className="font-semibold text-slate-600">{lot.quantity?.toLocaleString?.() ?? lot.quantity} หน่วย</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          {watchCounts[watchStatus] === 0 && <p className="py-6 text-center text-sm text-slate-400">ไม่มีรายการในกลุ่มนี้</p>}
        </div>
      </DetailModal>

      {/* ================= Modal: รายละเอียดยอดคงเหลือ (คลิกจากตารางหลัก แทนการเปลี่ยนหน้าไปคลังยา) ================= */}
      <DetailModal
        open={!!cellDetail}
        onClose={() => setCellDetail(null)}
        title={cellDetail?.drugName}
        subtitle={cellDetail?.deptName}
        icon={<Syringe className="h-8 w-8 shrink-0 text-[#20509e]" />}
      >
        {cellDetail && (() => {
          const { cell, drugName, deptName, deptId } = cellDetail;
          const lots = lotsByDrugDept[`${drugName}||${deptName}`] || [];
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="text-sm font-semibold text-slate-500">Min {cell?.min ?? "-"} / Max {cell?.max ?? "-"}</span>
                <span className="text-lg font-black text-slate-800">{cell?.quantity ?? 0} หน่วย</span>
              </div>
              <div className="space-y-1.5">
                {lots.map((lot, idx) => {
                  const expired = lot.expDate && new Date(lot.expDate).getTime() < Date.now();
                  return (
                    <div key={`${lot.lot}-${idx}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm">
                      <span className="truncate font-semibold text-slate-700">Lot {lot.lot || "-"}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-slate-400">หมดอายุ {lot.expDate ? formatThaiDateTime(lot.expDate).split("\n")[0] : "-"}</span>
                        <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${expired ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"}`}>
                          {lot.quantity?.toLocaleString?.() ?? lot.quantity} หน่วย
                        </span>
                      </span>
                    </div>
                  );
                })}
                {lots.length === 0 && <p className="py-4 text-center text-sm text-slate-400">ไม่มีข้อมูล lot แยกย่อยสำหรับรายการนี้</p>}
              </div>
              <button
                onClick={() => {
                  setCellDetail(null);
                  goToWarehouse({ drugName, departmentId: deptId });
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50"
              >
                <ExternalLink className="h-3.5 w-3.5" /> ไปหน้าคลังยาเพื่อจัดการ
              </button>
            </div>
          );
        })()}
      </DetailModal>

      <footer className="w-full mt-8 py-6 border-t border-slate-200">
        <div className="mx-auto max-w-[1460px] px-4 flex flex-col items-center justify-center gap-3 text-center">

          {/* บรรทัดบน: กลุ่มงานและระบบ */}
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-white shadow-xs border border-slate-200 text-blue-600">
              <Pill className="h-4 w-4" />
            </div>
            <span className="font-bold text-slate-700 text-sm">
              กลุ่มงานเภสัชกรรม รพ.กุมภวาปี
            </span>
          </div>

          {/* บรรทัดล่าง: เครดิตผู้พัฒนา และสถานะฐานข้อมูล */}
          <div className="flex items-center justify-center gap-3 text-sm text-slate-400 flex-wrap">
            <span>© 2026 ระบบบันทึกจ่ายยา Antidote</span>
            <span className="h-3.5 w-px bg-slate-300"></span>
            <span className="text-slate-500 font-semibold">พัฒนาโดย สายัญ ธุนันทา</span>
            <span className="h-3.5 w-px bg-slate-300"></span>

            {/* Supabase Badge */}
            <div className="flex items-center gap-1 rounded-full bg-emerald-50/50 border border-emerald-100/85 px-2.5 py-1 font-bold text-[#10b981] text-sm">
              <Database className="h-2.5 w-2.5" />
              <span>Supabase Connected</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}

// =========================================================================
// ไอคอนส่วนประกอบการ์ดสถิติ (SVG)
// =========================================================================
function MedicineBottleIcon({ className = "h-11 w-11 text-[#16a34a]" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="22" y="6" width="20" height="6" rx="2" fill="#16a34a" />
      <rect x="14" y="16" width="36" height="42" rx="6" fill="#eaf7ef" stroke="#16a34a" strokeWidth="4" />
      <line x1="20" y1="28" x2="34" y2="28" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" />
      <line x1="20" y1="38" x2="30" y2="38" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" />
      <line x1="20" y1="48" x2="26" y2="48" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" />
      <circle cx="44" cy="46" r="10" fill="#16a34a" />
      <path d="M39 46 L42.5 49.5 L49 42.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HospitalBuildingIcon({ className = "h-11 w-11 text-[#e2931a]" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="18" y="8" width="28" height="48" rx="4" fill="#fef6df" stroke="#e2931a" strokeWidth="4" />
      <rect x="24" y="16" width="6" height="6" rx="1" fill="#e2931a" />
      <rect x="34" y="16" width="6" height="6" rx="1" fill="#e2931a" />
      <rect x="24" y="28" width="6" height="6" rx="1" fill="#e2931a" />
      <rect x="34" y="28" width="6" height="6" rx="1" fill="#e2931a" />
      <rect x="24" y="40" width="6" height="6" rx="1" fill="#e2931a" />
      <rect x="34" y="40" width="6" height="6" rx="1" fill="#e2931a" />
    </svg>
  );
}

function MedicineBoxIcon({ className = "h-11 w-11 text-[#7c5cf0]" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 6 L56 18 V46 L32 58 L8 46 V18 Z" fill="#f1eefc" stroke="#5e3edc" strokeWidth="4" strokeLinejoin="round" />
      <path d="M8 18 L32 30 L56 18" stroke="#5e3edc" strokeWidth="4" strokeLinejoin="round" />
      <path d="M32 30 V58" stroke="#5e3edc" strokeWidth="4" />
      <rect x="24" y="34" width="16" height="12" rx="2" fill="#5e3edc" transform="skewY(-10)" />
    </svg>
  );
}

function ExpiringSoonIcon({ className = "h-11 w-11 text-[#dc6b4f]" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="34" r="22" fill="#fff1ee" stroke="#dc6b4f" strokeWidth="4" />
      <path d="M32 22 V34 L40 40" stroke="#dc6b4f" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="26" y="4" width="12" height="6" rx="2" fill="#dc6b4f" />
    </svg>
  );
}