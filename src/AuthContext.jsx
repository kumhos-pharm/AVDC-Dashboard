import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import Swal from "sweetalert2";

// ระยะเวลาไม่มีการใช้งานสูงสุด (มิลลิวินาที) ก่อน logout อัตโนมัติ
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 นาที
// แจ้งเตือนล่วงหน้าก่อน logout (มิลลิวินาที)
const WARN_BEFORE_MS = 60 * 1000; // เตือนก่อน 1 นาที

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

  // ref เก็บ timer สำหรับ auto logout และ warning
  const idleTimerRef = useRef(null);
  const warnTimerRef = useRef(null);
  // ref เก็บ signOut function เพื่อให้ event listener เรียกได้โดยไม่ต้อง re-bind
  const signOutRef = useRef(null);
  // ref ป้องกันการแสดง warning popup ซ้ำซ้อน
  const warnShownRef = useRef(false);

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

  const signOut = useCallback(async () => {
    await authClient.auth.signOut();
  }, [authClient]);

  // อัปเดต ref ทุกครั้งที่ signOut เปลี่ยน (กันปัญหา stale closure ใน event listener)
  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

  // ล้าง timer ทั้งหมด
  const clearIdleTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    idleTimerRef.current = null;
    warnTimerRef.current = null;
  }, []);

  // เริ่ม/reset timer นับ idle ใหม่ทุกครั้งที่มี activity
  const resetIdleTimer = useCallback(() => {
    clearIdleTimers();
    warnShownRef.current = false;

    // ตั้ง timer เตือนล่วงหน้า 1 นาที ก่อน logout
    warnTimerRef.current = setTimeout(() => {
      if (warnShownRef.current) return;
      warnShownRef.current = true;
      Swal.fire({
        icon: "warning",
        title: "ใกล้หมดเวลาใช้งาน",
        text: "ไม่มีการใช้งานนานเกินไป ระบบจะออกจากระบบอัตโนมัติใน 1 นาที",
        timer: WARN_BEFORE_MS,
        timerProgressBar: true,
        showConfirmButton: true,
        confirmButtonText: "ยังใช้งานอยู่",
        confirmButtonColor: "#2f8fdc",
        customClass: { popup: "font-['Kanit']" },
      }).then((result) => {
        // ถ้ากดปุ่ม "ยังใช้งานอยู่" ให้ reset timer ใหม่
        if (result.isConfirmed) {
          resetIdleTimer();
        }
      });
    }, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);

    // ตั้ง timer logout จริง
    idleTimerRef.current = setTimeout(async () => {
      Swal.close(); // ปิด warning popup ถ้ายังเปิดอยู่
      await signOutRef.current?.();
      Swal.fire({
        icon: "info",
        title: "ออกจากระบบอัตโนมัติ",
        text: "ไม่มีการใช้งานนานเกิน 15 นาที ระบบได้ออกจากระบบให้อัตโนมัติแล้ว",
        confirmButtonText: "เข้าสู่ระบบอีกครั้ง",
        confirmButtonColor: "#2f8fdc",
        customClass: { popup: "font-['Kanit']" },
      });
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimers]);

  // ผูก/ถอด event listener ตาม session (ถ้า login อยู่ให้จับ activity, ถ้า logout แล้วหยุดจับ)
  useEffect(() => {
    if (!session) {
      clearIdleTimers();
      return;
    }

    const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

    const handleActivity = () => resetIdleTimer();

    // เริ่มจับ activity และตั้ง timer ครั้งแรก
    EVENTS.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));
    resetIdleTimer();

    return () => {
      EVENTS.forEach((ev) => window.removeEventListener(ev, handleActivity));
      clearIdleTimers();
    };
  }, [session, resetIdleTimer, clearIdleTimers]);

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
