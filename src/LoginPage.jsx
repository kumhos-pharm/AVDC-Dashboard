import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { LogIn, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import avdcLogo from "./assets/avdc-logo.png";
import { useAuth } from "./AuthContext";

const NAVY = "#0d2a63";

export default function LoginPage() {
  const { session, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ถ้าล็อกอินอยู่แล้ว ไม่ต้องมาหน้านี้ซ้ำ — เด้งกลับไปหน้าที่ตั้งใจจะเข้าตั้งแต่แรก (หรือ dashboard)
  if (!authLoading && session) {
    const redirectTo = location.state?.from?.pathname || "/admin/dashboard";
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim() || !password) {
      setErrorMsg("กรุณากรอกอีเมลและรหัสผ่านให้ครบ");
      return;
    }

    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);

    if (error) {
      setErrorMsg(
        error.message === "Invalid login credentials"
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : "เข้าสู่ระบบไม่สำเร็จ: " + error.message
      );
      return;
    }

    const redirectTo = location.state?.from?.pathname || "/admin/dashboard";
    navigate(redirectTo, { replace: true });
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#eef1f6] p-6">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <img src={avdcLogo} alt="AVDC Logo" className="h-28 w-28 rounded-2xl object-contain" />
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
            ระบบจัดการ AVDC
          </h1>
          <p className="text-sm text-slate-400">เข้าสู่ระบบสำหรับเจ้าหน้าที่</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200/70 bg-white p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]"
        >
          {errorMsg && (
            <div className="mb-5 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <label className="mb-2 block text-sm font-semibold text-slate-600">อีเมล</label>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@hospital.go.th"
            className="mb-5 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-base outline-none focus:border-[#2f8fdc] focus:bg-white focus:ring-4 focus:ring-blue-50"
          />

          <label className="mb-2 block text-sm font-semibold text-slate-600">รหัสผ่าน</label>
          <div className="relative mb-6">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 pr-11 text-base outline-none focus:border-[#2f8fdc] focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2f8fdc] px-4 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#2a7ec2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
            {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          ยังไม่มีบัญชีผู้ใช้? ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าใช้งาน
        </p>
      </div>
    </div>
  );
}
