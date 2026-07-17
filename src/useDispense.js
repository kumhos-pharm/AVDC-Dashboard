import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

// รายชื่อยา + หน่วยงาน สำหรับ dropdown ในฟอร์ม
export function useDrugsAndDepartments() {
  const [drugs, setDrugs] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    supabase.from("drugs").select("*").order("name").then(({ data }) => setDrugs(data ?? []));
    supabase.from("departments").select("*").order("sort_order").then(({ data }) => setDepartments(data ?? []));
  }, []);

  return { drugs, departments };
}

// ค้นหา "ล็อตยาที่จ่ายได้จริง" ของหน่วยงานที่เลือก เรียงหมดอายุก่อน (FEFO)
// ต้องมี departmentId ก่อนถึงจะค้นหาได้ เพราะสต็อกแยกเก็บตามหน่วยงาน
export function useDrugLotSearch(departmentId, query) {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!departmentId || !query.trim()) {
      setLots([]);
      return;
    }
    setLoading(true);
    supabase
      .from("v_dispensable_lots")
      .select("*")
      .eq("department_id", departmentId)
      .ilike("drug_name", `%${query.trim()}%`)
      .order("exp_date", { ascending: true, nullsFirst: false })
      .limit(15)
      .then(({ data }) => {
        if (active) {
          setLots(data ?? []);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [departmentId, query]);

  return { lots, loading };
}

// ประวัติการจ่ายล่าสุด พร้อมค้นหาด้วย HN / ชื่อผู้ป่วย / ชื่อยา
export function useDispenseHistory(searchTerm) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("v_recent_dispenses")
      .select("*")
      .eq("reason", "dispense")
      .order("created_at", { ascending: false })
      .limit(50);
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const term = (searchTerm || "").trim().toLowerCase();
  const filtered = term
    ? rows.filter((r) =>
        [r.patient_name, r.patient_hn, r.drug_name].some((v) => (v || "").toLowerCase().includes(term))
      )
    : rows;

  return { rows: filtered, loading, reload };
}

// บันทึกรายการจ่ายยา 1 ครั้ง — change_qty ต้องเป็นค่าลบเสมอ (จ่ายออก)
export async function submitDispense(payload) {
  const { error } = await supabase.from("stock_movements").insert({
    ...payload,
    reason: "dispense",
  });
  if (error) return { error };

  // แดชบอร์ด (v_dashboard_grid) จะแสดงยาของหน่วยงานหนึ่ง ๆ ได้ก็ต่อเมื่อมีแถว drug_targets
  // (department_id, drug_id) อยู่แล้วเท่านั้น — ถ้าหน่วยงานนี้ไม่เคยมียานี้ในรายการเป้าหมายมาก่อน
  // การจ่ายยาจะบันทึกสำเร็จ แต่จะไม่ขึ้นในแดชบอร์ดเลย จึงต้องสร้างแถวเปล่าให้อัตโนมัติ
  if (payload?.department_id && payload?.drug_id) {
    const { data: existing } = await supabase
      .from("drug_targets")
      .select("id")
      .eq("department_id", payload.department_id)
      .eq("drug_id", payload.drug_id)
      .maybeSingle();

    if (!existing) {
      await supabase.from("drug_targets").insert({
        department_id: payload.department_id,
        drug_id: payload.drug_id,
        min_qty: null,
        max_qty: null,
      });
    }
  }

  return { error: null };
}

// ลบรายการ (trigger จะคืนยอดสต็อกให้อัตโนมัติ)
export async function deleteDispense(id) {
  const { error } = await supabase.from("stock_movements").delete().eq("id", id);
  return { error };
}

// แก้ไขรายการที่จ่ายไปแล้ว
// หมายเหตุ: ไม่ใช้ .update() ตรง ๆ เพราะสต็อกถูกปรับผ่าน trigger ตอน insert/delete เท่านั้น
// (ไม่มี trigger สำหรับ update) จึงต้อง "insert รายการใหม่ก่อน แล้วค่อยลบรายการเดิม"
// ลำดับนี้เลือกเพราะถ้า insert ล้มเหลว รายการเดิมจะยังอยู่ครบ ไม่มีข้อมูลหาย
export async function updateDispense(id, payload) {
  const { error: insertError } = await supabase.from("stock_movements").insert({
    ...payload,
    reason: "dispense",
  });
  if (insertError) return { error: insertError };

  const { error: deleteError } = await supabase.from("stock_movements").delete().eq("id", id);
  if (deleteError) {
    // insert รายการใหม่สำเร็จแล้ว แต่ลบรายการเดิมไม่สำเร็จ -> จะมี 2 รายการซ้อนกันชั่วคราว
    // ต้องแจ้งผู้ใช้ให้รู้ชัดเจน เพื่อให้เข้ามาลบรายการเก่าด้วยตนเองภายหลัง
    return {
      error: new Error(
        "บันทึกรายการที่แก้ไขสำเร็จ แต่ลบรายการเดิมไม่สำเร็จ กรุณาลบรายการเก่าด้วยตนเอง: " +
          deleteError.message
      ),
    };
  }
  return { error: null };
}
