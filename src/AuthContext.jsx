import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

// บทบาทที่มีในระบบ — ใช้ค่าเดียวกันนี้ทั้งฝั่ง DB (คอลัมน์ role ในตาราง profiles) และฝั่ง UI
export const ROLES = {
  ADMIN: "admin",
  PHARMACIST: "pharmacist", // เภสัชกร
  NURSE: "nurse", // พยาบาลหน่วยงาน
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: "ผู้ดูแลระบบ",
  [ROLES.PHARMACIST]: "เภสัชกร",
  [ROLES.NURSE]: "พยาบาลหน่วยงาน",
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // แถวจากตาราง profiles (name, role, ...)
  const [loading, setLoading] = useState(true); // กำลังเช็ค session/profile ตอนโหลดแอปครั้งแรก

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) {
      console.error("โหลดข้อมูลผู้ใช้ (profiles) ไม่สำเร็จ:", error.message);
      setProfile(null);
      return;
    }
    setProfile(data);
  }, []);

  useEffect(() => {
    let mounted = true;

    // ดึง session ปัจจุบันตอนเปิดแอป (ถ้าเคยล็อกอินไว้ จะยังคง login อยู่)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });

    // ฟังการเปลี่ยนแปลงสถานะล็อกอิน (login/logout/refresh token)
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,
    signIn,
    signOut,
    refreshProfile: () => loadProfile(session?.user?.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth ต้องถูกใช้ภายใน <AuthProvider>");
  return ctx;
}
