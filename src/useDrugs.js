import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

export function useDrugList() {
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("drugs").select("*").order("name");
    setDrugs(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { drugs, loading, reload };
}

export async function addDrug(name, strength, form) {
  const { data, error } = await supabase
    .from("drugs")
    .insert({ name: name.trim(), strength: strength?.trim() || null, form: form?.trim() || null })
    .select()
    .single();
  return { data, error };
}

export async function updateDrug(id, fields) {
  const { error } = await supabase.from("drugs").update(fields).eq("id", id);
  return { error };
}

export async function deleteDrug(id) {
  const { error } = await supabase.from("drugs").delete().eq("id", id);
  return { error };
}

// ใช้ตอน "รับยาเข้าคลัง": ถ้าพิมพ์ชื่อยาที่ยังไม่มีในระบบ ให้สร้างยาใหม่อัตโนมัติ
// ถ้ามีอยู่แล้วแต่ยังไม่เคยระบุความแรง/รูปแบบยา ให้เติมข้อมูลให้ครบ
export async function findOrCreateDrug({ name, strength, form }) {
  const trimmed = name.trim();
  const { data: existing } = await supabase
    .from("drugs")
    .select("*")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const fields = {};
    if (strength?.trim() && !existing.strength) fields.strength = strength.trim();
    if (form?.trim() && !existing.form) fields.form = form.trim();
    if (Object.keys(fields).length > 0) {
      await updateDrug(existing.id, fields);
    }
    return { id: existing.id, error: null };
  }

  const { data, error } = await addDrug(trimmed, strength, form);
  return { id: data?.id, error };
}
