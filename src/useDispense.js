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
    // รวมทั้งรายการ "จ่ายยาผู้ป่วย" (dispense) และ "เติมยาหน่วยงาน" (replenish_out/replenish_in)
    // ให้แสดงในประวัติเดียวกัน — ฝั่ง UI (DispenseHistory.jsx) จะแยกดีไซน์การ์ดตาม r.reason เอง
    const { data } = await supabase
      .from("v_recent_dispenses")
      .select("*")
      .in("reason", ["dispense", "replenish_out", "replenish_in"])
      .order("created_at", { ascending: false })
      .limit(50);

    const dispenseRows = data ?? [];

    // ดึงยอดคงเหลือ "ปัจจุบัน" ของล็อตที่เคยจ่ายไป มาผูกกับประวัติแต่ละรายการ (แสดงเป็น "คงเหลือ")
    // จับคู่ด้วย lot_row_id (แม่นยำ 100% เพราะอ้าง drug_lots.id ตรง ๆ) เป็นหลัก
    // ส่วนรายการเก่าก่อนมีคอลัมน์ lot_row_id จะ fallback ไปจับคู่ด้วย department_id + drug_id + lot (ข้อความ) แทน
    if (dispenseRows.length > 0) {
      const lotRowIds = [...new Set(dispenseRows.map((r) => r.lot_row_id).filter(Boolean))];
      const departmentIds = [...new Set(dispenseRows.map((r) => r.department_id).filter(Boolean))];
      const drugIds = [...new Set(dispenseRows.map((r) => r.drug_id).filter(Boolean))];
      const rowIds = [...new Set(dispenseRows.map((r) => r.id).filter(Boolean))];

      const [byIdRes, byTextRes, deptRes, drugRes, movementRes] = await Promise.all([
        lotRowIds.length > 0
          ? supabase.from("drug_lots").select("id, quantity").in("id", lotRowIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from("drug_lots")
          .select("department_id, drug_id, lot, quantity")
          .in("department_id", departmentIds)
          .in("drug_id", drugIds),
        // ชื่อหน่วยงาน — ใช้แสดง "หน่วยงานที่เติม/หน่วยงานที่จ่าย" ในการ์ดประวัติ
        departmentIds.length > 0
          ? supabase.from("departments").select("id, name").in("id", departmentIds)
          : Promise.resolve({ data: [] }),
        // ดึง "รูปแบบยา" ตรงจากตาราง drugs ด้วย drug_id เสมอ ไม่พึ่ง view (view อาจไม่มีคอลัมน์นี้ หรือคอลัมน์ไม่ตรง
        // ทำให้ก่อนหน้านี้รูปแบบยาในประวัติดึงไม่ตรง/ไม่ขึ้นเลย)
        drugIds.length > 0
          ? supabase.from("drugs").select("id, form, strength").in("id", drugIds)
          : Promise.resolve({ data: [] }),
        // ดึง transfer_group_id ตรงจาก stock_movements ด้วย id เสมอ เผื่อ view ยังไม่มีคอลัมน์นี้
        // (สาเหตุที่ปุ่ม "ยกเลิกการเติมยา" ใช้งานไม่ได้/เป็นสีเทาค้าง เพราะ r.transfer_group_id เป็น undefined ตลอด)
        rowIds.length > 0
          ? supabase.from("stock_movements").select("id, transfer_group_id").in("id", rowIds)
          : Promise.resolve({ data: [] }),
      ]);

      const idMap = new Map();
      (byIdRes.data ?? []).forEach((l) => idMap.set(l.id, l.quantity));

      const lotMap = new Map();
      (byTextRes.data ?? []).forEach((l) => {
        lotMap.set(`${l.department_id}|${l.drug_id}|${l.lot}`, l.quantity);
      });

      const deptMap = new Map();
      (deptRes.data ?? []).forEach((d) => deptMap.set(String(d.id), d.name));

      const drugMap = new Map();
      (drugRes.data ?? []).forEach((d) => drugMap.set(String(d.id), d));

      const movementMap = new Map();
      (movementRes.data ?? []).forEach((m) => movementMap.set(m.id, m.transfer_group_id));

      dispenseRows.forEach((r) => {
        if (r.lot_row_id && idMap.has(r.lot_row_id)) {
          r.remaining_qty = idMap.get(r.lot_row_id);
        } else {
          const key = `${r.department_id}|${r.drug_id}|${r.lot}`;
          r.remaining_qty = lotMap.has(key) ? lotMap.get(key) : null;
        }
        r.department_name = deptMap.get(String(r.department_id)) || null;

        const drugInfo = drugMap.get(String(r.drug_id));
        r.drug_form = drugInfo?.form || r.drug_form || r.form || null;
        // เผื่อรายการเก่าที่บันทึกความแรงไว้ในประวัติเองแล้ว ให้ยึดค่าของประวัติก่อน ถ้าไม่มีค่อย fallback ไปที่ตัวยา
        r.strength = r.strength || drugInfo?.strength || null;

        if (movementMap.has(r.id)) {
          r.transfer_group_id = movementMap.get(r.id);
        }
      });
    }

    setRows(dispenseRows);
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

// ยกเลิกการเติมยา 1 ครั้ง — ลบทั้งแถว replenish_out (AVDC) และ replenish_in (หน่วยงานปลายทาง) พร้อมกัน
// จับคู่ด้วย transfer_group_id เท่านั้น (แม่นยำ 100%) ไม่เดาจากยา/ล็อต/เวลา
// trigger trg_reverse_stock_movement จะยิงแยกทีละแถวที่ถูกลบ ทำให้สต็อกทั้ง 2 ฝั่งถูกคืนกลับถูกต้องในคำสั่งเดียว
// รายการเก่าก่อนมีคอลัมน์นี้ (transfer_group_id เป็น null) จะไม่สามารถยกเลิกอัตโนมัติได้ ต้องกันไว้ตั้งแต่ฝั่ง UI
export async function cancelReplenish(transferGroupId) {
  if (!transferGroupId) {
    return {
      error: new Error(
        "รายการนี้บันทึกไว้ก่อนมีระบบยกเลิกอัตโนมัติ (ไม่มี transfer_group_id) กรุณาติดต่อผู้ดูแลระบบเพื่อแก้ไขสต็อกด้วยตนเอง"
      ),
    };
  }
  const { error } = await supabase
    .from("stock_movements")
    .delete()
    .eq("transfer_group_id", transferGroupId);
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
