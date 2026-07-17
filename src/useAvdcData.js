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

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const [deptRes, gridRes, drugCountRes, lastUpdatedRes] = await Promise.all([
      supabase.from("departments").select("*").order("sort_order"),
      supabase.from("v_dashboard_grid").select("*"),
      supabase.from("drugs").select("*", { count: "exact", head: true }),
      supabase.from("v_last_updated").select("last_updated").single(),
    ]);

    const firstError = deptRes.error || gridRes.error || drugCountRes.error || lastUpdatedRes.error;
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
    const total = gridRows.reduce((sum, r) => sum + (r.quantity || 0), 0);

    setDepartments(deptRows);
    setDrugRows(pivoted);
    setTotalDrugCount(drugCountRes.count ?? pivoted.length);
    setTotalQuantity(total);
    setLastUpdated(lastUpdatedRes.data?.last_updated ?? null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // อัปเดตค่าให้เป็นปัจจุบันอัตโนมัติ: ทุก 20 วิ + ทันทีที่กลับมาเปิดแท็บ/หน้าต่างนี้อีกครั้ง
  useEffect(() => {
    const interval = setInterval(() => load({ silent: true }), 20000);
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
    reload: () => load({ silent: true }),
  };
}
