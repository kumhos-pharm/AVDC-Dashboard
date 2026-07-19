import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

export function useWarehouseLots(departmentId, searchTerm) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("v_warehouse_lots").select("*");
    if (departmentId) query = query.eq("department_id", departmentId);
    const { data } = await query;
    // ตัดรายการ Lot ที่ยอดคงเหลือเท่ากับ 0 ทิ้ง (ของเก่า/ซ้ำซ้อนที่ไม่มีสต็อกจริงแล้ว)
    // แต่ "ไม่" ซ่อนยอดติดลบ เพราะยอดติดลบคือรายการที่ข้อมูลผิดพลาดและต้องแก้ไข
    // ถ้าซ่อนไปด้วยจะทำให้แก้ไขผ่านหน้านี้ไม่ได้เลย
    setRows((data ?? []).filter((r) => (r.quantity ?? 0) !== 0));
    setLoading(false);
  }, [departmentId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const term = (searchTerm || "").trim().toLowerCase();
  const filtered = term
    ? rows.filter((r) => r.drug_name.toLowerCase().includes(term) || (r.lot || "").toLowerCase().includes(term))
    : rows;

  return { rows: filtered, loading, reload };
}

// รับยาเข้าคลัง (change_qty ต้องเป็นค่าบวก)
export async function receiveStock(payload) {
  const { error } = await supabase.from("stock_movements").insert({ ...payload, reason: "receive" });
  return { error };
}

// ปรับยอดคงเหลือของ lot (แก้ไข) — บันทึกเป็นส่วนต่าง (movement) เพื่อให้ยอดคงเหลือใหม่ตรงตามที่ระบุ
export async function adjustStockQty({ drugId, departmentId, lot, mfgDate, expDate, diffQty, staffName }) {
  if (!diffQty) return { error: null };
  const { error } = await supabase.from("stock_movements").insert({
    drug_id: drugId,
    department_id: departmentId,
    lot,
    mfg_date: mfgDate || null,
    exp_date: expDate || null,
    change_qty: diffQty,
    reason: "adjust",
    staff_name: staffName || null,
  });
  return { error };
}

// แก้ไขรายละเอียด lot แบบยกชุด (Lot No., จำนวน, วันผลิต, วันหมดอายุ)
// อัปเดต "drug_lots" ตรงๆ ด้วย id ของแถวนั้น เพราะ v_warehouse_lots อ่านค่าจาก drug_lots โดยตรง
// (ไม่ได้คำนวณ/รวมยอดจาก stock_movements) ถ้าไปแก้ผ่าน stock_movements อย่างเดียว
// ตัวเลขจำนวนอาจถูกต้อง (ถ้ามี trigger คอยรวมยอดให้) แต่วันผลิต/วันหมดอายุจะไม่อัปเดตตาม
// จึงต้อง update แถวใน drug_lots ตรงๆ ให้ชัวร์ แล้วค่อยบันทึกส่วนต่างลง stock_movements ไว้เป็น audit log
export async function updateLotDetails({
  lotId,
  drugId,
  departmentId,
  oldLot,
  oldMfgDate,
  oldExpDate,
  oldQty,
  newLot,
  newMfgDate,
  newExpDate,
  newQty,
  staffName,
}) {
  if (lotId != null) {
    const { error: updateErr } = await supabase
      .from("drug_lots")
      .update({
        lot: newLot,
        quantity: newQty,
        mfg_date: newMfgDate || null,
        exp_date: newExpDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lotId);
    if (updateErr) return { error: updateErr };
  }

  // บันทึก audit log ของการแก้ไขไว้ใน stock_movements (ส่วนต่างของจำนวน) — ไม่กระทบยอดที่แสดงผล
  // เพราะยอดที่แสดงผลอ่านจาก drug_lots ที่อัปเดตไปแล้วด้านบนโดยตรง
  const diffQty = Number(newQty) - Number(oldQty || 0);
  if (diffQty !== 0) {
    await supabase.from("stock_movements").insert({
      drug_id: drugId,
      department_id: departmentId,
      lot: newLot,
      mfg_date: newMfgDate || null,
      exp_date: newExpDate || null,
      change_qty: diffQty,
      reason: "adjust",
      staff_name: staffName || null,
    });
  }

  return { error: null };
}

// อัปเดตค่า Min / Max ของยาแต่ละตัว ในแต่ละหน่วยงาน (ตาราง drug_targets)
export async function updateMinMax({ departmentId, drugId, min, max }) {
  const { error } = await supabase.from("drug_targets").upsert(
    {
      department_id: departmentId,
      drug_id: drugId,
      min_qty: min === "" || min == null ? null : Number(min),
      max_qty: max === "" || max == null ? null : Number(max),
    },
    { onConflict: "department_id,drug_id" }
  );
  return { error };
}

// ลบ lot ออกจากคลัง — หักยอดคงเหลือทั้งหมดของ lot นั้นให้เป็น 0
export async function removeStockLot({ drugId, departmentId, lot, mfgDate, expDate, quantity, staffName }) {
  const { error } = await supabase.from("stock_movements").insert({
    drug_id: drugId,
    department_id: departmentId,
    lot,
    mfg_date: mfgDate || null,
    exp_date: expDate || null,
    change_qty: -quantity,
    reason: "remove",
    staff_name: staffName || null,
  });
  return { error };
}

// ยอด min/max ของยาแต่ละตัว "ในคลังยา" (ใช้ view เดียวกับแดชบอร์ดหลัก)
export function useWarehouseMinMax(departmentName = "คลังยา") {
  const [map, setMap] = useState({});

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("v_dashboard_grid")
      .select("drug_name, department_name, min_qty, max_qty")
      .eq("department_name", departmentName);
    const m = {};
    (data ?? []).forEach((r) => {
      m[r.drug_name] = { min: r.min_qty, max: r.max_qty };
    });
    setMap(m);
  }, [departmentName]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { map, reload };
}

// เติมยาจากคลังไปหน่วยงานปลายทาง (เรียก function ฝั่ง Postgres ที่ทำ 2 movement แบบ atomic)
export async function transferStock({ drugId, lot, fromDepartmentId, toDepartmentId, qty, mfgDate, expDate, staffName }) {
  const { error } = await supabase.rpc("transfer_stock", {
    p_drug_id: drugId,
    p_lot: lot,
    p_from_department_id: fromDepartmentId,
    p_to_department_id: toDepartmentId,
    p_qty: qty,
    p_mfg_date: mfgDate || null,
    p_exp_date: expDate || null,
    p_staff_name: staffName || null,
  });
  if (error) return { error };

  // แดชบอร์ด (v_dashboard_grid) จะแสดงยาของหน่วยงานหนึ่ง ๆ ได้ก็ต่อเมื่อมีแถว drug_targets
  // (department_id, drug_id) อยู่แล้วเท่านั้น — ถ้าหน่วยงานปลายทางไม่เคยมียานี้มาก่อน
  // สต็อกจะถูกโอนสำเร็จ แต่จะไม่ขึ้นในแดชบอร์ดเลย จึงต้องสร้างแถวเปล่า (min/max = null) ให้อัตโนมัติ
  const { data: existing } = await supabase
    .from("drug_targets")
    .select("id")
    .eq("department_id", toDepartmentId)
    .eq("drug_id", drugId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("drug_targets").insert({
      department_id: toDepartmentId,
      drug_id: drugId,
      min_qty: null,
      max_qty: null,
    });
  }

  return { error: null };
}

// คืนยาทั้งล็อตจากหน่วยงาน กลับเข้า "คลังยา" — ใช้ตอนเติมยาผิด/เกิน แล้วต้องการยกเลิก
// ต่างจาก removeStockLot ตรงที่ removeStockLot คือ "ตัดจำหน่าย" (ใช้ไปแล้ว/หมดอายุ/ชำรุด) ยอดจะหายไปจากระบบถาวร
// ส่วนอันนี้คือ "คืนของ" ยอดจะกลับไปบวกที่คลังยาเหมือนเดิม ไม่หายไปไหน
export async function returnLotToWarehouse({ drugId, lot, departmentId, warehouseDepartmentId, qty, mfgDate, expDate, staffName }) {
  return transferStock({
    drugId,
    lot,
    fromDepartmentId: departmentId,
    toDepartmentId: warehouseDepartmentId,
    qty,
    mfgDate,
    expDate,
    staffName,
  });
}
