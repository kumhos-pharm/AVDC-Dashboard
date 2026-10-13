import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// ดึงชื่อ-นามสกุลของผู้ใช้ที่ login อยู่จากตาราง profiles (full_name)
// ใช้วิธีเดียวกับหน้าคลังยา (WarehousePage) เพื่อให้ชื่อผู้บันทึกตรงกันทุกหน้า
export function useCurrentStaffName() {
  const [staffName, setStaffName] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function fetchName() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (!cancelled && data?.full_name) setStaffName(data.full_name);
    }
    fetchName();
    return () => {
      cancelled = true;
    };
  }, []);
  return staffName;
}
