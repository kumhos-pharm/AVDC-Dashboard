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

/**
 * AuthProvider ของแต่ละ "โซน" (หน้าจ่ายยา / Admin)
 * - authClient: client ของโซนนั้น (เก็บ session แยก storage key กันคนละโซน) ใช้ตอน signIn/signOut
 * - เมื่อ session ของโซนเปลี่ยน จะ sync token เข้า client กลาง (supabase) เพื่อให้ query ข้อมูล
 *   (ตาราง profiles, drugs, dispense_records ฯลฯ) ใช้สิทธิ์ของผู้ใช้ที่ล็อกอินอยู่ในโซนนี้ได้ถูกต้อง
 */
export function AuthProvider({ children, authClient }) {
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

  // sync session ของโซนนี้เข้า client กลางที่ใช้ query ข้อมูลทั่วแอป (มีผลแค่ในแท็บ/หน้าปัจจุบันเท่านั้น
  // ไม่กระทบ storage ของโซนอื่น เพราะ client กลางไม่ persist session ของตัวเอง)
  const syncSharedClient = useCallback(async (nextSession) => {
    if (nextSession) {
      await supabase.auth.setSession({
        access_token: nextSession.access_token,
        refresh_token: nextSession.refresh_token,
      });
    } else {
      await supabase.auth.signOut({ scope: "local" });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // ดึง session ปัจจุบันตอนเปิดแอป (ถ้าเคยล็อกอินไว้ในโซนนี้ จะยังคง login อยู่)
    authClient.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      await syncSharedClient(session);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });

    // ฟังการเปลี่ยนแปลงสถานะล็อกอิน (login/logout/refresh token) เฉพาะของโซนนี้
    const { data: listener } = authClient.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setSession(session);
      await syncSharedClient(session);
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
  }, [authClient, loadProfile, syncSharedClient]);

  const signIn = useCallback(
    async (email, password) => {
      const { data, error } = await authClient.auth.signInWithPassword({ email, password });
      return { data, error };
    },
    [authClient]
  );

  const signOut = useCallback(async () => {
    await authClient.auth.signOut();
  }, [authClient]);

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
