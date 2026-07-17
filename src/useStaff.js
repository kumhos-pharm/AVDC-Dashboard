import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

export function useStaffList() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("staff").select("*").order("name");
    setStaff(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { staff, loading, reload };
}

export async function addStaff(name, role) {
  const { data, error } = await supabase.from("staff").insert({ name, role }).select().single();
  return { data, error };
}

export async function updateStaff(id, fields) {
  const { error } = await supabase.from("staff").update(fields).eq("id", id);
  return { error };
}

export async function deleteStaff(id) {
  const { error } = await supabase.from("staff").delete().eq("id", id);
  return { error };
}
