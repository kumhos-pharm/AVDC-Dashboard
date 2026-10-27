import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { LogIn, Loader2, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import Swal from "sweetalert2";
import avdcLogo from "./assets/avdc-logo-dark.png";
import { useAuth } from "./AuthContext";

const BLUE = "#2f8fdc";
const USERNAME_DOMAIN = "avdc.local";

export default function LoginPage({
  title = "ระบบบันทึกจ่ายยา AVDC",
  subtitle = "สำหรับเจ้าหน้าที่บันทึกจ่ายยา Antidote & Vital Drug",
  subtitle2 = "กลุ่มงานเภสัชกรรม รพ.กุมภวาปี",
  tagline = "",
  defaultRedirect = "/admin/dashboard",
  usernameMode = false,
}) {
  const { session, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!authLoading && session) {
    const redirectTo = location.state?.from?.pathname || defaultRedirect;
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim() || !password) {
      const msg = "กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบ";
      if (usernameMode) {
        Swal.fire({ icon: "warning", title: "กรอกข้อมูลไม่ครบ", text: msg, confirmButtonColor: BLUE });
      } else {
        setErrorMsg(msg);
      }
      return;
    }

    const typed = email.trim();
    const loginEmail = typed.includes("@") ? typed : `${typed}@${USERNAME_DOMAIN}`;

    setSubmitting(true);
    const { error } = await signIn(loginEmail, password);
    setSubmitting(false);

    if (error) {
      const friendlyMsg =
        error.message === "Invalid login credentials"
          ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
          : "เข้าสู่ระบบไม่สำเร็จ: " + error.message;
      if (usernameMode) {
        Swal.fire({ icon: "error", title: "เข้าสู่ระบบไม่สำเร็จ", text: friendlyMsg, confirmButtonText: "ลองอีกครั้ง", confirmButtonColor: BLUE });
      } else {
        setErrorMsg(friendlyMsg);
      }
      return;
    }

    const redirectTo = location.state?.from?.pathname || defaultRedirect;
    if (usernameMode) {
      Swal.fire({ icon: "success", title: "เข้าสู่ระบบสำเร็จ", timer: 1200, showConfirmButton: false })
        .then(() => navigate(redirectTo, { replace: true }));
    } else {
      navigate(redirectTo, { replace: true });
    }
  }

  const features = [
    "บันทึกการจ่ายยาได้รวดเร็ว ตัดสต็อกอัตโนมัติ",
    "ติดตามสต็อกยาทุกหน่วยงาน แบบ Real-time",
    "ออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน",
  ];

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 font-['Kanit']"
      style={{
        backgroundColor: "#071a42",
        backgroundImage:
          "radial-gradient(circle at 18% 20%, rgba(47,143,220,.35), transparent 45%), radial-gradient(circle at 85% 85%, rgba(74,222,128,.18), transparent 40%)",
      }}
    >
      {/* card หลัก */}
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl shadow-2xl flex flex-col md:flex-row min-h-[520px]">

        {/* ===== ฝั่งซ้าย: แบนเนอร์ ===== */}
        <div
          className="flex flex-col items-center justify-center gap-6 px-10 py-12 md:w-[46%] relative overflow-hidden"
          style={{
            backgroundColor: "#071a42",
            backgroundImage:
              "radial-gradient(circle at 20% 15%, rgba(47,143,220,.3), transparent 50%), radial-gradient(circle at 80% 85%, rgba(74,222,128,.15), transparent 45%)",
          }}
        >
          {/* วงกลมประดับพื้นหลัง */}
          <div
            className="pointer-events-none absolute"
            style={{
              width: 300, height: 300, borderRadius: "50%",
              border: "40px solid rgba(47,143,220,0.07)",
              bottom: -90, right: -90,
            }}
          />
          <div
            className="pointer-events-none absolute"
            style={{
              width: 180, height: 180, borderRadius: "50%",
              border: "28px solid rgba(74,222,128,0.07)",
              top: -50, left: 40,
            }}
          />

          {/* โลโก้ */}
          <img
            src={avdcLogo}
            alt="AVDC Logo"
            className="relative z-10"
            style={{
              width: 160,
              height: 160,
              objectFit: "contain",
              filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.45))",
            }}
          />

          {/* ชื่อระบบ */}
          <div className="relative z-10 text-center">
            <h1 className="text-2xl font-bold text-white leading-snug">{title}</h1>
            {subtitle && <p className="mt-1 text-sm font-medium" style={{ color: "#9db4de" }}>{subtitle}</p>}
            {subtitle2 && <p className="text-sm font-medium" style={{ color: "#9db4de" }}>{subtitle2}</p>}
          </div>

          {/* เส้นแบ่ง */}
          <div className="relative z-10 w-full" style={{ height: 1, background: "rgba(255,255,255,0.1)" }} />

          {/* Feature list */}
          <ul className="relative z-10 flex flex-col gap-3 w-full">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className="flex-shrink-0 flex items-center justify-center rounded-full"
                  style={{
                    width: 24, height: 24,
                    background: "rgba(74,222,128,0.18)",
                    border: "1px solid rgba(74,222,128,0.4)",
                  }}
                >
                  <CheckCircle2 className="text-green-400" style={{ width: 13, height: 13 }} />
                </span>
                <span className="text-sm" style={{ color: "#c8d8f0" }}>{f}</span>
              </li>
            ))}
          </ul>

          {/* เครดิต */}
          <p className="relative z-10 text-xs" style={{ color: "rgba(157,180,222,0.55)" }}>
            พัฒนาโดย สายัญ ธุนันทา · © 2026
          </p>
        </div>

        {/* ===== ฝั่งขวา: ฟอร์ม ===== */}
        <div className="flex flex-col justify-center px-10 py-12 bg-white md:flex-1">
          <h2 className="text-2xl font-bold mb-1" style={{ color: "#0d2a63" }}>เข้าสู่ระบบ</h2>
          <p className="text-sm mb-8" style={{ color: "#64748b" }}>กรุณากรอกชื่อผู้ใช้และรหัสผ่าน</p>

          {/* error inline (admin mode) */}
          {!usernameMode && errorMsg && (
            <div className="mb-5 flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
              <AlertCircle style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-0">
            {/* ชื่อผู้ใช้ */}
            <label className="text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>ชื่อผู้ใช้</label>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ชื่อผู้ใช้"
              className="mb-4 w-full rounded-xl px-4 py-3 text-sm outline-none transition"
              style={{
                border: "1.5px solid #e2e8f0",
                background: "#f8fafc",
                color: "#1e293b",
              }}
              onFocus={(e) => { e.target.style.borderColor = BLUE; e.target.style.background = "#fff"; }}
              onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; }}
            />

            {/* รหัสผ่าน */}
            <label className="text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>รหัสผ่าน</label>
            <div className="relative mb-2">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 pr-11 text-sm outline-none transition"
                style={{
                  border: "1.5px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#1e293b",
                }}
                onFocus={(e) => { e.target.style.borderColor = BLUE; e.target.style.background = "#fff"; }}
                onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "#94a3b8" }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
              </button>
            </div>

            {/* ปุ่ม login */}
            <button
              type="submit"
              disabled={submitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: BLUE }}
              onMouseEnter={(e) => !submitting && (e.currentTarget.style.backgroundColor = "#2278c4")}
              onMouseLeave={(e) => !submitting && (e.currentTarget.style.backgroundColor = BLUE)}
            >
              {submitting ? <Loader2 className="animate-spin" style={{ width: 18, height: 18 }} /> : <LogIn style={{ width: 18, height: 18 }} />}
              {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs" style={{ color: "#94a3b8" }}>
            ออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน 10 นาที
          </p>

          <p className="mt-5 text-center text-sm" style={{ color: "#94a3b8" }}>
            ยังไม่มีบัญชีผู้ใช้?{" "}
            <span className="font-semibold" style={{ color: "#374151" }}>
              ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าใช้งาน
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
