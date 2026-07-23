import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

// Fetches live data from the fresh Supabase project (v_dashboard_grid, departments,
// drugs, v_last_updated) and pivots it into the shape AVDCDashboard.jsx needs.
export function useAvdcData() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [departments, setDepartments] = useState([]); // ordered list, home first
  const [drugRows, setDrugRows] = useState([]);        // [{ name, byDept: { [deptName]: {quantity,min,max} } }]
  const [totalDrugCount, setTotalDrugCount] = useState(0);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expiringLots, setExpiringLots] = useState([]); // ยาที่ใกล้หมดอายุเท่านั้น (คงเหลือ > 0 และเหลืออายุ 0-90 วัน ไม่รวมที่หมดอายุไปแล้ว)
  const [lotsByDrugDept, setLotsByDrugDept] = useState({}); // { "ชื่อยา||หน่วยงาน": [{lot, expDate, quantity}] } เรียงตามวันหมดอายุ ใช้แสดงใน popup รายการที่ต้องติดตาม

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const [deptRes, gridRes, drugCountRes, lastUpdatedRes, lotsRes] = await Promise.all([
      supabase.from("departments").select("*").order("sort_order"),
      supabase.from("v_dashboard_grid").select("*"),
      supabase.from("drugs").select("*", { count: "exact", head: true }),
      supabase.from("v_last_updated").select("last_updated").single(),
      supabase.from("v_warehouse_lots").select("drug_name, lot, exp_date, quantity, department_id"),
    ]);

    const firstError = deptRes.error || gridRes.error || drugCountRes.error || lastUpdatedRes.error || lotsRes.error;
    if (firstError) {
      setError(firstError);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const deptRows = deptRes.data ?? [];
    const gridRows = gridRes.data ?? [];

    // Pivot: drug_name -> { department_name: { quantity, min, max } }
    const byDrugMap = {};
    const order = [];
    gridRows.forEach((r) => {
      if (!byDrugMap[r.drug_name]) {
        byDrugMap[r.drug_name] = {};
        order.push(r.drug_name);
      }
      byDrugMap[r.drug_name][r.department_name] = {
        quantity: r.quantity,
        min: r.min_qty,
        max: r.max_qty,
      };
    });

    const pivoted = order.map((name) => ({ name, byDept: byDrugMap[name] }));

    // ถ้าหน่วยงานไหนไม่ได้ตั้ง Min/Max ของยาตัวนั้นไว้เอง ให้ใช้ค่า Min/Max ที่ตั้งไว้ที่ "คลังยา"
    // (ค่ากลางของยาตัวนั้น) เป็นค่า default แทน ไม่ต้องให้แต่ละหน่วยงานตั้งซ้ำทุกที่
    const WAREHOUSE_DEPT_NAME = "คลังยา";
    pivoted.forEach((drug) => {
      const warehouseCell = drug.byDept[WAREHOUSE_DEPT_NAME];
      if (!warehouseCell) return;
      Object.entries(drug.byDept).forEach(([deptName, cell]) => {
        if (deptName === WAREHOUSE_DEPT_NAME || !cell) return;
        if (cell.min == null) cell.min = warehouseCell.min;
        if (cell.max == null) cell.max = warehouseCell.max;
      });
    });

    const total = gridRows.reduce((sum, r) => sum + (r.quantity || 0), 0);

    // ยาใกล้หมดอายุ: เหลืออายุระหว่าง 0-90 วันเท่านั้น (ไม่รวมที่หมดอายุไปแล้ว) และต้องมีคงเหลือ > 0
    const deptNameById = {};
    deptRows.forEach((d) => {
      deptNameById[d.id] = d.name;
    });
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const expiring = (lotsRes.data ?? [])
      .filter((l) => {
        if ((l.quantity ?? 0) <= 0 || !l.exp_date) return false;
        const msLeft = new Date(l.exp_date).getTime() - now;
        return msLeft >= 0 && msLeft < NINETY_DAYS_MS;
      })
      .map((l) => ({
        drugName: l.drug_name,
        lot: l.lot,
        expDate: l.exp_date,
        quantity: l.quantity,
        departmentName: deptNameById[l.department_id] || "-",
        daysLeft: Math.ceil((new Date(l.exp_date).getTime() - now) / (24 * 60 * 60 * 1000)),
      }))
      .sort((a, b) => new Date(a.expDate) - new Date(b.expDate));

    // จัดกลุ่ม Lot ตามคู่ "ชื่อยา||หน่วยงาน" (เฉพาะที่ยังมีคงเหลือ) เรียงตามวันหมดอายุใกล้สุดก่อน — ใช้แสดงใน popup รายการที่ต้องติดตาม
    const lotsMap = {};
    (lotsRes.data ?? [])
      .filter((l) => (l.quantity ?? 0) > 0)
      .forEach((l) => {
        const key = `${l.drug_name}||${deptNameById[l.department_id] || "-"}`;
        if (!lotsMap[key]) lotsMap[key] = [];
        lotsMap[key].push({ lot: l.lot, expDate: l.exp_date, quantity: l.quantity });
      });
    Object.values(lotsMap).forEach((arr) =>
      arr.sort((a, b) => new Date(a.expDate || 0) - new Date(b.expDate || 0))
    );

    setDepartments(deptRows);
    setDrugRows(pivoted);
    setTotalDrugCount(drugCountRes.count ?? pivoted.length);
    setTotalQuantity(total);
    setLastUpdated(lastUpdatedRes.data?.last_updated ?? null);
    setExpiringLots(expiring);
    setLotsByDrugDept(lotsMap);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // อัปเดตค่าให้เป็นปัจจุบันอัตโนมัติ: ทุก 5 นาที (เหมาะกับจอ TV/มอนิเตอร์ส่วนกลางที่เปิดค้างไว้)
  // + รีเฟรชทันทีที่กลับมาเปิดแท็บ/หน้าต่างนี้อีกครั้ง (ครอบคลุมกรณีเปิดแท็บทิ้งไว้นาน ๆ แล้วกลับมาดู)
  useEffect(() => {
    const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
    const interval = setInterval(() => load({ silent: true }), REFRESH_INTERVAL_MS);
    function onVisible() {
      if (document.visibilityState === "visible") load({ silent: true });
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  return {
    loading,
    refreshing,
    error,
    departments,
    drugRows,
    totalDrugCount,
    totalQuantity,
    lastUpdated,
    expiringLots,
    lotsByDrugDept,
    reload: () => load({ silent: true }),
  };
}
