import React, { useEffect, useMemo, useState } from "react";
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
  Wallet,
  CalendarRange,
  Layers,
  Pill,
  ListOrdered,
} from "lucide-react";
import { useAvdcData } from "./useAvdcData";
import { supabase } from "./supabaseClient";
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

// คำนวณช่วงวันที่ (from/to) จากปุ่มลัดที่เลือก — ใช้ร่วมกับรายงานที่อิง stock_movements (มีวันที่จริง)
// "custom" คืนค่า null ถ้ายังกรอกวันที่ไม่ครบ เพื่อไม่ให้ query ยิงออกไปแบบเดาช่วงเอง
function getDateRange(preset, customFrom, customTo) {
  const now = new Date();
  let from, to;
  if (preset === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    from = new Date(now.getFullYear(), q * 3, 1);
    to = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
  } else if (preset === "year") {
    from = new Date(now.getFullYear(), 0, 1);
    to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else {
    from = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
    to = customTo ? new Date(`${customTo}T23:59:59.999`) : null;
  }
  return { from, to };
}

const REPORT_TYPES = [
  { key: "stock", label: "คงคลังตามหน่วยงาน", desc: "ยอดคงเหลือของยาแต่ละตัว แยกตามหน่วยงาน", icon: Building2 },
  { key: "watch", label: "ยาที่ต้องติดตาม (Min/Max)", desc: "รายการต่ำกว่า Min / ใกล้ต่ำกว่า Min / เกิน Max", icon: AlertTriangle },
  { key: "expiring", label: "ยาใกล้หมดอายุ", desc: "ยาที่เหลืออายุไม่เกิน 90 วัน", icon: Clock },
  { key: "dispense_by_dept", label: "มูลค่าจ่ายยาแยกหน่วยงาน", desc: "สรุปจำนวนและมูลค่ายาที่จ่ายไป แยกตามหน่วยงาน ตามช่วงวันที่", icon: Wallet },
  { key: "dispense_by_dept_detail", label: "จ่ายยารายหน่วยงาน (รายการ)", desc: "แต่ละหน่วยงานจ่ายยาอะไรไปบ้าง พร้อมจำนวนและมูลค่าต่อรายการ", icon: Layers },
  { key: "dispense_by_drug", label: "จ่ายยาตามรายชื่อยา", desc: "ยาตัวไหนถูกจ่ายไปมาก/มูลค่าสูงสุด มองภาพรวมทุกหน่วยงาน", icon: Pill },
  { key: "dispense_detail", label: "รายละเอียดรายธุรกรรม", desc: "ประวัติการจ่ายยาทุกรายการ เรียงตามวันที่ ไว้ตรวจสอบย้อนหลัง", icon: ListOrdered },
];

// รายงานกลุ่มนี้ดึงจาก stock_movements (มีวันที่จ่ายจริง) ต่างจาก 3 รายงานแรกที่ดึงจากยอดคงคลังปัจจุบัน
const DATE_FILTERED_REPORTS = ["dispense_by_dept", "dispense_by_dept_detail", "dispense_by_drug", "dispense_detail"];

export default function ReportsPage() {
  const { loading, departments, drugRows, expiringLots, lotsByDrugDept } = useAvdcData();
  const [reportType, setReportType] = useState("stock");
  const [filterDept, setFilterDept] = useState("all");
  const [preparedBy, setPreparedBy] = useState("");

  // ---------- ตัวกรองช่วงวันที่ (ใช้เฉพาะรายงานที่อิง stock_movements) ----------
  const [datePreset, setDatePreset] = useState("month"); // month | quarter | year | custom
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const isDateFilteredReport = DATE_FILTERED_REPORTS.includes(reportType);
  const { from: dateFrom, to: dateTo } = useMemo(
    () => getDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo]
  );

  // ---------- ดึงข้อมูลการจ่ายยาดิบจาก stock_movements ตามช่วงวันที่ที่เลือก ----------
  const [dispenseRaw, setDispenseRaw] = useState([]);
  const [dispenseLoading, setDispenseLoading] = useState(false);
  const [dispenseError, setDispenseError] = useState(null);

  useEffect(() => {
    if (!isDateFilteredReport) return;
    // โหมด "กำหนดเอง" แต่ยังกรอกวันที่ไม่ครบ — รอผู้ใช้กรอกให้ครบก่อน ไม่ยิง query แบบเดาช่วง
    if (!dateFrom || !dateTo) {
      setDispenseRaw([]);
      return;
    }

    let cancelled = false;
    setDispenseLoading(true);
    setDispenseError(null);

    supabase
      .from("stock_movements")
      .select(
        "id, change_qty, unit_price, created_at, department_id, drug_id, lot, staff_name, patient_prefix, patient_name, patient_hn, departments(name), drugs(name, strength, form)"
      )
      .eq("reason", "dispense")
      .gte("created_at", dateFrom.toISOString())
      .lte("created_at", dateTo.toISOString())
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setDispenseError(error);
          setDispenseRaw([]);
        } else {
          setDispenseRaw(data || []);
        }
        setDispenseLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDateFilteredReport, dateFrom, dateTo]);

  // ---------- รายงาน 4: มูลค่าจ่ายยาแยกหน่วยงาน ----------
  const dispenseByDeptRows = useMemo(() => {
    if (reportType !== "dispense_by_dept") return [];
    const map = {};
    dispenseRaw.forEach((r) => {
      const deptName = r.departments?.name || "ไม่ระบุหน่วยงาน";
      if (filterDept !== "all" && deptName !== filterDept) return;
      if (!map[deptName]) {
        map[deptName] = { deptName, txCount: 0, totalQty: 0, totalValue: 0, missingPriceCount: 0 };
      }
      const qty = Math.abs(r.change_qty || 0);
      map[deptName].txCount += 1;
      map[deptName].totalQty += qty;
      if (r.unit_price != null) {
        map[deptName].totalValue += qty * r.unit_price;
      } else {
        map[deptName].missingPriceCount += 1;
      }
    });
    const rows = Object.values(map).sort((a, b) => b.totalValue - a.totalValue);
    const grandValue = rows.reduce((sum, r) => sum + r.totalValue, 0);
    return rows.map((r) => ({
      deptName: r.deptName,
      txCount: r.txCount,
      totalQty: r.totalQty,
      totalValue: r.totalValue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      percentOfTotal: grandValue > 0 ? `${((r.totalValue / grandValue) * 100).toFixed(1)}%` : "-",
      missingPriceCount: r.missingPriceCount > 0 ? r.missingPriceCount : "-",
    }));
  }, [dispenseRaw, reportType, filterDept]);

  // ---------- รายงาน 5: จ่ายยารายหน่วยงาน (รายการ) — กลุ่มตามหน่วยงาน แต่ละกลุ่มมีรายการยาที่จ่าย ----------
  const dispenseDetailGroups = useMemo(() => {
    if (reportType !== "dispense_by_dept_detail") return [];
    const groups = {};
    dispenseRaw.forEach((r) => {
      const deptName = r.departments?.name || "ไม่ระบุหน่วยงาน";
      if (filterDept !== "all" && deptName !== filterDept) return;
      if (!groups[deptName]) {
        groups[deptName] = { deptName, items: [], subtotalQty: 0, subtotalValue: 0, missingPriceCount: 0 };
      }
      const qty = Math.abs(r.change_qty || 0);
      const lineValue = r.unit_price != null ? qty * r.unit_price : null;
      groups[deptName].items.push({
        drugName: r.drugs?.name || "-",
        strength: r.drugs?.strength || "-",
        form: r.drugs?.form || "-",
        date: thaiDateShort(r.created_at),
        qty,
        unitPrice: r.unit_price != null ? r.unit_price.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-",
        lineValue: lineValue != null ? lineValue.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-",
        _sortDate: r.created_at,
      });
      groups[deptName].subtotalQty += qty;
      if (lineValue != null) groups[deptName].subtotalValue += lineValue;
      else groups[deptName].missingPriceCount += 1;
    });
    return Object.values(groups)
      .map((g) => ({
        ...g,
        items: g.items.sort((a, b) => new Date(b._sortDate) - new Date(a._sortDate)),
        subtotalValueText: g.subtotalValue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      }))
      .sort((a, b) => b.subtotalValue - a.subtotalValue);
  }, [dispenseRaw, reportType, filterDept]);

  // คอลัมน์รายการยา ใช้แสดงในตารางย่อยของแต่ละหน่วยงาน (รายงาน "จ่ายยารายหน่วยงาน (รายการ)")
  const detailItemColumns = [
    { key: "drugName", label: "ชื่อยา", width: "26%" },
    { key: "strength", label: "ความแรง", width: "10%" },
    { key: "form", label: "รูปแบบยา", width: "10%" },
    { key: "date", label: "วันที่จ่าย", width: "15%" },
    { key: "qty", label: "จำนวน", align: "right", width: "9%" },
    { key: "unitPrice", label: "ราคา/หน่วย (บาท)", align: "right", width: "15%" },
    { key: "lineValue", label: "มูลค่า (บาท)", align: "right", width: "15%" },
  ];

  // ---------- รายงาน 6: จ่ายยาตามรายชื่อยา (มองภาพรวมทุกหน่วยงาน) ----------
  const dispenseByDrugRows = useMemo(() => {
    if (reportType !== "dispense_by_drug") return [];
    const map = {};
    dispenseRaw.forEach((r) => {
      const deptName = r.departments?.name || "ไม่ระบุหน่วยงาน";
      if (filterDept !== "all" && deptName !== filterDept) return;
      const drugName = r.drugs?.name || "-";
      if (!map[drugName]) {
        map[drugName] = {
          drugName,
          strength: r.drugs?.strength || "-",
          form: r.drugs?.form || "-",
          txCount: 0,
          totalQty: 0,
          totalValue: 0,
          missingPriceCount: 0,
          deptSet: new Set(),
        };
      }
      const qty = Math.abs(r.change_qty || 0);
      map[drugName].txCount += 1;
      map[drugName].totalQty += qty;
      map[drugName].deptSet.add(deptName);
      if (r.unit_price != null) {
        map[drugName].totalValue += qty * r.unit_price;
      } else {
        map[drugName].missingPriceCount += 1;
      }
    });
    const rows = Object.values(map).sort((a, b) => b.totalValue - a.totalValue);
    const grandValue = rows.reduce((sum, r) => sum + r.totalValue, 0);
    return rows.map((r) => ({
      drugName: r.drugName,
      strength: r.strength,
      form: r.form,
      txCount: r.txCount,
      deptCount: r.deptSet.size,
      totalQty: r.totalQty,
      totalValue: r.totalValue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      percentOfTotal: grandValue > 0 ? `${((r.totalValue / grandValue) * 100).toFixed(1)}%` : "-",
      missingPriceCount: r.missingPriceCount > 0 ? r.missingPriceCount : "-",
    }));
  }, [dispenseRaw, reportType, filterDept]);

  // แถวรวมท้ายตาราง (subtotal) ของรายงาน "จ่ายยาตามรายชื่อยา" — คำนวณแยกจาก rows ข้างบนเพื่อเก็บผลรวมดิบไว้ก่อนแปลงเป็นข้อความ
  const dispenseByDrugTotals = useMemo(() => {
    if (reportType !== "dispense_by_drug") return null;
    let txCount = 0;
    let totalQty = 0;
    let totalValue = 0;
    const drugSet = new Set();
    dispenseRaw.forEach((r) => {
      const deptName = r.departments?.name || "ไม่ระบุหน่วยงาน";
      if (filterDept !== "all" && deptName !== filterDept) return;
      const qty = Math.abs(r.change_qty || 0);
      txCount += 1;
      totalQty += qty;
      drugSet.add(r.drugs?.name || "-");
      if (r.unit_price != null) totalValue += qty * r.unit_price;
    });
    return {
      drugCount: drugSet.size,
      txCount,
      totalQty,
      totalValueText: totalValue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };
  }, [dispenseRaw, reportType, filterDept]);

  // ---------- รายงาน 7: รายละเอียดรายธุรกรรม (flat list เรียงตามวันที่ล่าสุดก่อน — ไว้ตรวจสอบย้อนหลัง) ----------
  const dispenseDetailFlatRows = useMemo(() => {
    if (reportType !== "dispense_detail") return [];
    const rows = dispenseRaw
      .filter((r) => filterDept === "all" || r.departments?.name === filterDept)
      .map((r) => {
        const qty = Math.abs(r.change_qty || 0);
        const lineValue = r.unit_price != null ? qty * r.unit_price : null;
        const patient = [r.patient_prefix, r.patient_name].filter(Boolean).join("") || "-";
        return {
          date: thaiDateShort(r.created_at),
          deptName: r.departments?.name || "-",
          drugName: r.drugs?.name || "-",
          strength: r.drugs?.strength || "-",
          lot: r.lot || "-",
          qty,
          patient: r.patient_hn ? `${patient} (${r.patient_hn})` : patient,
          staffName: r.staff_name || "-",
          unitPrice: r.unit_price != null ? r.unit_price.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-",
          lineValue: lineValue != null ? lineValue.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-",
          _sortDate: r.created_at,
        };
      });
    return rows.sort((a, b) => new Date(b._sortDate) - new Date(a._sortDate));
  }, [dispenseRaw, reportType, filterDept]);

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
          form: d.form || "-",
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
          form: d.form || "-",
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
      form: l.form || "-",
      deptName: l.departmentName,
      lot: l.lot || "-",
      quantity: l.quantity,
      expDate: thaiDateShort(l.expDate),
      daysLeft: l.daysLeft,
    }));
  }, [expiringLots, filterDept]);

  const activeConfig = REPORT_TYPES.find((r) => r.key === reportType);
  const activeRows =
    reportType === "stock" ? stockRows :
    reportType === "watch" ? watchRows :
    reportType === "dispense_by_dept" ? dispenseByDeptRows :
    reportType === "dispense_by_dept_detail" ? dispenseDetailGroups.flatMap((g) => g.items.map((it) => ({ deptName: g.deptName, ...it }))) :
    reportType === "dispense_by_drug" ? dispenseByDrugRows :
    reportType === "dispense_detail" ? dispenseDetailFlatRows :
    expiringRows;

  const columns =
    reportType === "stock"
      ? [
          { key: "drugName", label: "ชื่อยา", width: "18%" },
          { key: "strength", label: "ความแรง", width: "8%" },
          { key: "form", label: "รูปแบบยา", width: "9%" },
          { key: "lot", label: "Lot", width: "11%" },
          { key: "expDate", label: "วันหมดอายุ", width: "11%" },
          { key: "deptName", label: "หน่วยงาน", width: "11%" },
          { key: "quantity", label: "คงเหลือ", align: "right", width: "7%" },
          { key: "min", label: "Min", align: "right", width: "6%" },
          { key: "max", label: "Max", align: "right", width: "6%" },
          { key: "status", label: "สถานะ", width: "13%" },
        ]
      : reportType === "watch"
      ? [
          { key: "drugName", label: "ชื่อยา", width: "18%" },
          { key: "strength", label: "ความแรง", width: "8%" },
          { key: "form", label: "รูปแบบยา", width: "9%" },
          { key: "lot", label: "Lot", width: "11%" },
          { key: "expDate", label: "วันหมดอายุ", width: "11%" },
          { key: "deptName", label: "หน่วยงาน", width: "11%" },
          { key: "quantity", label: "คงเหลือ", align: "right", width: "7%" },
          { key: "min", label: "Min", align: "right", width: "6%" },
          { key: "max", label: "Max", align: "right", width: "6%" },
          { key: "status", label: "สถานะ", width: "13%" },
        ]
      : reportType === "dispense_by_dept"
      ? [
          { key: "deptName", label: "หน่วยงาน", width: "22%" },
          { key: "txCount", label: "จำนวนรายการ", align: "right", width: "14%" },
          { key: "totalQty", label: "จำนวนหน่วยรวม", align: "right", width: "16%" },
          { key: "totalValue", label: "มูลค่ารวม (บาท)", align: "right", width: "20%" },
          { key: "percentOfTotal", label: "% ของยอดรวม", align: "right", width: "14%" },
          { key: "missingPriceCount", label: "รายการไม่มีราคา", align: "right", width: "14%" },
        ]
      : reportType === "dispense_by_drug"
      ? [
          { key: "drugName", label: "ชื่อยา", width: "20%" },
          { key: "strength", label: "ความแรง", width: "8%" },
          { key: "form", label: "รูปแบบยา", width: "9%" },
          { key: "txCount", label: "จำนวนรายการ", align: "right", width: "10%" },
          { key: "deptCount", label: "จ่ายกี่หน่วยงาน", align: "right", width: "10%" },
          { key: "totalQty", label: "จำนวนหน่วยรวม", align: "right", width: "13%" },
          { key: "totalValue", label: "มูลค่ารวม (บาท)", align: "right", width: "16%" },
          { key: "percentOfTotal", label: "% ของยอดรวม", align: "right", width: "14%" },
        ]
      : reportType === "dispense_detail"
      ? [
          { key: "date", label: "วันที่จ่าย", width: "10%" },
          { key: "deptName", label: "หน่วยงาน", width: "12%" },
          { key: "drugName", label: "ชื่อยา", width: "16%" },
          { key: "strength", label: "ความแรง", width: "7%" },
          { key: "lot", label: "Lot", width: "9%" },
          { key: "qty", label: "จำนวน", align: "right", width: "6%" },
          { key: "patient", label: "ผู้ป่วย (HN)", width: "13%" },
          { key: "staffName", label: "ผู้จ่าย", width: "9%" },
          { key: "unitPrice", label: "ราคา/หน่วย", align: "right", width: "9%" },
          { key: "lineValue", label: "มูลค่า (บาท)", align: "right", width: "9%" },
        ]
      : [
          { key: "drugName", label: "ชื่อยา", width: "24%" },
          { key: "strength", label: "ความแรง", width: "10%" },
          { key: "form", label: "รูปแบบยา", width: "11%" },
          { key: "lot", label: "Lot", width: "14%" },
          { key: "expDate", label: "วันหมดอายุ", width: "13%" },
          { key: "deptName", label: "หน่วยงาน", width: "13%" },
          { key: "quantity", label: "คงเหลือ", align: "right", width: "7%" },
          { key: "daysLeft", label: "เหลืออีก (วัน)", align: "right", width: "8%" },
        ];

  function exportExcel() {
    if (reportType === "dispense_by_dept_detail") {
      const wsData = [["หน่วยงาน", ...detailItemColumns.map((c) => c.label)]];
      dispenseDetailGroups.forEach((g) => {
        wsData.push([`${g.deptName} (${g.items.length} รายการ)`]);
        g.items.forEach((it) => {
          wsData.push(["", ...detailItemColumns.map((c) => it[c.key])]);
        });
        wsData.push(["", "", "", "", "รวมหน่วยงานนี้", g.subtotalQty, "", g.subtotalValueText]);
        wsData.push([]);
      });
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [{ wch: 18 }, ...detailItemColumns.map(() => ({ wch: 18 }))];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeConfig.label.slice(0, 31));
      const filename = `AVDC-${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);
      return;
    }
    const wsData = [
      columns.map((c) => c.label),
      ...activeRows.map((r) => columns.map((c) => r[c.key])),
    ];
    if (reportType === "dispense_by_drug" && dispenseByDrugTotals && activeRows.length > 0) {
      wsData.push([
        `รวมทั้งหมด (${dispenseByDrugTotals.drugCount} ชนิดยา)`,
        "",
        "",
        dispenseByDrugTotals.txCount,
        "",
        dispenseByDrugTotals.totalQty,
        dispenseByDrugTotals.totalValueText,
        "100.0%",
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = columns.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeConfig.label.slice(0, 31));
    const filename = `AVDC-${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  const isBusy = loading || (isDateFilteredReport && dispenseLoading);

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

          {/* ตัวกรองช่วงวันที่ (เฉพาะรายงานที่อิงจากประวัติการจ่ายยา) */}
          {isDateFilteredReport && (
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex-1 min-w-[220px]">
                <label className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500">
                  <CalendarRange className="h-3.5 w-3.5" /> ช่วงวันที่
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "month", label: "เดือนนี้" },
                    { key: "quarter", label: "ไตรมาสนี้" },
                    { key: "year", label: "ปีนี้" },
                    { key: "custom", label: "กำหนดเอง" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setDatePreset(opt.key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        datePreset === opt.key
                          ? "bg-[#007bff] text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {datePreset === "custom" && (
                <>
                  <div className="min-w-[150px]">
                    <label className="mb-1 block text-xs font-bold text-slate-500">ตั้งแต่วันที่</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                  <div className="min-w-[150px]">
                    <label className="mb-1 block text-xs font-bold text-slate-500">ถึงวันที่</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </>
              )}
              {dateFrom && dateTo && (
                <p className="text-xs text-slate-400">
                  แสดงข้อมูล {thaiDateShort(dateFrom)} – {thaiDateShort(dateTo)}
                </p>
              )}
              {datePreset === "custom" && (!customFrom || !customTo) && (
                <p className="text-xs font-bold text-amber-500">กรุณาเลือกวันที่เริ่มต้นและสิ้นสุดให้ครบ</p>
              )}
            </div>
          )}

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
                disabled={isBusy || activeRows.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#128a3e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-4 w-4" /> ดาวน์โหลด Excel
              </button>
              <button
                onClick={handlePrint}
                disabled={isBusy || activeRows.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-[#007bff] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0062cc] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Printer className="h-4 w-4" /> พิมพ์ / บันทึกเป็น PDF
              </button>
            </div>
          </div>

          {isBusy && (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดข้อมูล...
            </p>
          )}
          {dispenseError && (
            <p className="text-sm font-bold text-red-500">เกิดข้อผิดพลาดในการดึงข้อมูล: {dispenseError.message}</p>
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
              {isDateFilteredReport && dateFrom && dateTo && (
                <p className="text-xs text-slate-400">ช่วงวันที่: {thaiDateShort(dateFrom)} – {thaiDateShort(dateTo)}</p>
              )}
            </div>
            <div className="ml-auto text-right text-xs text-slate-400">
              <p>พิมพ์เมื่อ {nowThaiDateTime()}</p>
              {preparedBy && <p>ผู้จัดทำ: {preparedBy}</p>}
              <p>ทั้งหมด {activeRows.length} รายการ</p>
            </div>
          </div>

          {/* ตารางรายงาน */}
          {reportType === "dispense_by_dept_detail" ? (
            dispenseDetailGroups.length === 0 ? (
              <p className="border border-slate-200 px-2.5 py-6 text-center text-slate-400 rounded-xl">
                ไม่มีข้อมูลสำหรับรายงานนี้
              </p>
            ) : (
              <div className="space-y-6">
                {dispenseDetailGroups.map((g) => (
                  <div key={g.deptName} className="break-inside-avoid print:break-inside-avoid">
                    {/* หัวข้อหน่วยงาน */}
                    <div className="mb-1.5 flex items-center justify-between rounded-lg px-3 py-1.5" style={{ backgroundColor: `${NAVY}14` }}>
                      <p className="text-sm font-black" style={{ color: NAVY }}>{g.deptName}</p>
                      <p className="text-xs font-bold text-slate-500">
                        {g.items.length} รายการ · {g.subtotalQty.toLocaleString("th-TH")} หน่วย
                        {g.missingPriceCount > 0 && (
                          <span className="ml-2 text-amber-500">({g.missingPriceCount} รายการไม่มีราคา)</span>
                        )}
                      </p>
                    </div>
                    <table className="w-full border-collapse text-sm print:text-[9.5px]" style={{ tableLayout: "fixed" }}>
                      <colgroup>
                        {detailItemColumns.map((c) => (
                          <col key={c.key} style={{ width: c.width }} />
                        ))}
                      </colgroup>
                      <thead className="print:table-header-group">
                        <tr>
                          {detailItemColumns.map((c) => (
                            <th
                              key={c.key}
                              className={`border border-slate-200 bg-slate-50 px-2.5 py-2 font-bold text-slate-600 print:bg-slate-100 print:px-1.5 print:py-1 break-words ${c.align === "right" ? "text-right" : "text-left"}`}
                            >
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map((it, idx) => (
                          <tr key={idx} className="break-inside-avoid print:break-inside-avoid">
                            {detailItemColumns.map((c) => (
                              <td
                                key={c.key}
                                className={`border border-slate-200 px-2.5 py-1.5 print:px-1.5 print:py-1 break-words leading-snug ${c.align === "right" ? "text-right font-semibold" : ""}`}
                              >
                                {it[c.key]}
                              </td>
                            ))}
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold">
                          <td colSpan={4} className="border border-slate-200 px-2.5 py-1.5 text-right">รวมหน่วยงานนี้</td>
                          <td className="border border-slate-200 px-2.5 py-1.5 text-right">{g.subtotalQty.toLocaleString("th-TH")}</td>
                          <td className="border border-slate-200 px-2.5 py-1.5"></td>
                          <td className="border border-slate-200 px-2.5 py-1.5 text-right">{g.subtotalValueText}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )
          ) : (
            <table className="w-full border-collapse text-sm print:text-[9.5px]" style={{ tableLayout: "fixed" }}>
              <colgroup>
                {columns.map((c) => (
                  <col key={c.key} style={{ width: c.width }} />
                ))}
              </colgroup>
              <thead className="print:table-header-group">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={`border border-slate-200 bg-slate-50 px-2.5 py-2 font-bold text-slate-600 print:bg-slate-100 print:px-1.5 print:py-1 break-words ${c.align === "right" ? "text-right" : "text-left"}`}
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
                    <tr key={idx} className="break-inside-avoid print:break-inside-avoid">
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className={`border border-slate-200 px-2.5 py-1.5 print:px-1.5 print:py-1 break-words leading-snug ${c.align === "right" ? "text-right font-semibold" : ""}`}
                        >
                          {r[c.key]}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
                {reportType === "dispense_by_drug" && dispenseByDrugTotals && activeRows.length > 0 && (
                  <tr className="bg-slate-50 font-bold break-inside-avoid print:break-inside-avoid">
                    <td colSpan={3} className="border border-slate-200 px-2.5 py-1.5">
                      รวมทั้งหมด ({dispenseByDrugTotals.drugCount} ชนิดยา)
                    </td>
                    <td className="border border-slate-200 px-2.5 py-1.5 text-right">{dispenseByDrugTotals.txCount.toLocaleString("th-TH")}</td>
                    <td className="border border-slate-200 px-2.5 py-1.5"></td>
                    <td className="border border-slate-200 px-2.5 py-1.5 text-right">{dispenseByDrugTotals.totalQty.toLocaleString("th-TH")}</td>
                    <td className="border border-slate-200 px-2.5 py-1.5 text-right">{dispenseByDrugTotals.totalValueText}</td>
                    <td className="border border-slate-200 px-2.5 py-1.5 text-right">100.0%</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          <p className="mt-4 text-center text-[11px] text-slate-300 print:block">
            ออกโดยระบบ AVDC Dashboard — ศูนย์ Antidote และ Vital Drug โรงพยาบาลกุมภวาปี
          </p>
        </div>
      </div>

      {/* กำหนดขนาดกระดาษ/ระยะขอบตอนพิมพ์ */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { background: white !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* กันเมนูซ้าย/เมนูล่างของแอปหลุดมาในหน้าพิมพ์ เผื่อ class print:hidden ของ Sidebar ไม่ทำงาน */
          aside, nav {
            display: none !important;
          }

          #report-print-area {
            width: 100% !important;
            max-width: 100% !important;
          }

          #report-print-area table {
            table-layout: fixed !important;
            width: 100% !important;
          }

          #report-print-area th,
          #report-print-area td {
            word-break: break-word;
            overflow-wrap: break-word;
            white-space: normal;
          }

          /* ทำให้หัวตารางแสดงซ้ำทุกหน้า และหัวรายงานไม่ถูกตัดคร่อมหน้า */
          #report-print-area thead {
            display: table-header-group;
          }
          #report-print-area tfoot {
            display: table-footer-group;
          }
          #report-print-area tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          #report-print-area > div:first-child {
            page-break-after: avoid;
          }
        }
      `}</style>
    </div>
  );
}
