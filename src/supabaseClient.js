import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// client กลาง — ใช้อ่าน/เขียนข้อมูลทั่วไปทั้งแอป (drugs, warehouse, dispense records, ...)
// ไม่เก็บ session ถาวรของตัวเอง (persistSession: false) เพราะ session ที่ใช้งานจริงจะถูก
// "sync" เข้ามาจาก client ของโซนที่กำลังล็อกอินอยู่ในแท็บนั้นๆ (ดูใน AuthContext.jsx)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// client แยกสำหรับ "สถานะล็อกอิน" ของแต่ละโซน — คนละ storage key ในเบราว์เซอร์
// ทำให้ล็อกอิน/ล็อกเอาท์ของหน้าจ่ายยา กับหน้า Admin Dashboard เป็นอิสระต่อกันจริงๆ
// (ล็อกอินหน้าจ่ายยา ไม่ถือว่าล็อกอิน Admin ด้วย และล็อกเอาท์จาก Admin ก็ไม่ทำให้หลุดจากหน้าจ่ายยา)
export const supabaseDispenseAuth = createClient(supabaseUrl, supabaseKey, {
  auth: { storageKey: "sb-avdc-dispense-auth" },
});

export const supabaseAdminAuth = createClient(supabaseUrl, supabaseKey, {
  auth: { storageKey: "sb-avdc-admin-auth" },
});
