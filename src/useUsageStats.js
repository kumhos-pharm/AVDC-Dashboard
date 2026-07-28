import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

// จำนวนเดือนย้อนหลังที่ดึงมาใช้แสดงกราฟแนวโน้ม (พอสำหรับดูรายสัปดาห์/รายเดือนได้ชัดเจน)
const MONTHS_BACK = 6;

// ดึงประวัติ "การจ่ายยาให้ผู้ป่วย" (reason = dispense) ย้อนหลัง MONTHS_BACK เดือน
// ใช้ reason = dispense เท่านั้น (ไม่รวม replenish/receive/adjust) เพราะสะท้อน "การใช้ยาจริง"
// ส่วนการรวมยอดตามช่วงเวลา/รายชื่อยา/หน่วยงาน จะไปทำที่ฝั่ง UI (UsageInsights.jsx) เพื่อสลับมุมมองได้ไว ไม่ต้องยิง query ใหม่ทุกครั้ง
export function useUsageStats() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]); // [{ createdAt, qty, drugName, deptName }]

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const since = new Date();
    since.setMonth(since.getMonth() - MONTHS_BACK);
    since.setHours(0, 0, 0, 0);

    const { data, error: err } = await supabase
      .from("stock_movements")
      .select("created_at, change_qty, drug_id, department_id")
      .eq("reason", "dispense")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });

    if (err) {
      setError(err);
      setLoading(false);
      return;
    }

    const moveRows = data ?? [];
    const drugIds = [...new Set(moveRows.map((r) => r.drug_id).filter(Boolean))];
    const deptIds = [...new Set(moveRows.map((r) => r.department_id).filter(Boolean))];

    const [drugRes, deptRes] = await Promise.all([
      drugIds.length > 0
        ? supabase.from("drugs").select("id, name").in("id", drugIds)
        : Promise.resolve({ data: [] }),
      deptIds.length > 0
        ? supabase.from("departments").select("id, name").in("id", deptIds)
        : Promise.resolve({ data: [] }),
    ]);

    const drugMap = new Map((drugRes.data ?? []).map((d) => [d.id, d.name]));
    const deptMap = new Map((deptRes.data ?? []).map((d) => [d.id, d.name]));

    const enriched = moveRows.map((r) => ({
      createdAt: r.created_at,
      // change_qty ของรายการจ่ายยาเป็นค่าลบเสมอ (ยอดออก) แปลงเป็นค่าบวกไว้ใช้รวมยอดแสดงกราฟ
      qty: Math.abs(r.change_qty || 0),
      drugName: drugMap.get(r.drug_id) || "ไม่ทราบชื่อยา",
      deptName: deptMap.get(r.department_id) || "ไม่ทราบหน่วยงาน",
    }));

    setRows(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, error, reload: load };
}
