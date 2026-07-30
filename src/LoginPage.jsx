import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { LogIn, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import avdcLogo from "./assets/avdc-logo.png";
import { useAuth } from "./AuthContext";

const NAVY = "#0d2a63";
const BLUE = "#2f8fdc";

// domain ภายในที่ใช้ต่อท้ายชื่อผู้ใช้ของหน้าจ่ายยา เพื่อให้ Supabase Auth (ซึ่งบังคับรูปแบบอีเมล) ใช้งานได้
// โดยที่พนักงานไม่ต้องพิมพ์ @... เอง — แอดมินต้องสร้างบัญชีใน Supabase เป็นอีเมลรูปแบบ "ชื่อผู้ใช้@avdc.local"
const USERNAME_DOMAIN = "avdc.local";

export default function LoginPage({
  title = "ระบบจัดการ AVDC Dashboard",
  subtitle = "กลุ่มงานเภสัชกรรม รพ.กุมภวาปี",
  defaultRedirect = "/admin/dashboard",
  usernameMode = false, // true = ให้กรอกแค่ "ชื่อผู้ใช้" ไม่ต้องมี @... (ใช้กับหน้า login ของหน้าจ่ายยา)
}) {
  const { session, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ถ้าล็อกอินอยู่แล้ว ไม่ต้องมาหน้านี้ซ้ำ — เด้งกลับไปหน้าที่ตั้งใจจะเข้าตั้งแต่แรก (หรือปลายทางเริ่มต้นของโซนนี้)
  if (!authLoading && session) {
    const redirectTo = location.state?.from?.pathname || defaultRedirect;
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim() || !password) {
      setErrorMsg(usernameMode ? "กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบ" : "กรุณากรอกอีเมลและรหัสผ่านให้ครบ");
      return;
    }

    // usernameMode: ผู้ใช้พิมพ์แค่ชื่อผู้ใช้ (เช่น "pla01") เราเติม @avdc.local ต่อท้ายเองก่อนส่งไป Supabase
    // (ต้องตรงกับอีเมลที่แอดมินสร้างบัญชีไว้ใน Supabase Dashboard เช่น "pla01@avdc.local")
    const loginEmail = usernameMode ? `${email.trim()}@${USERNAME_DOMAIN}` : email.trim();

    setSubmitting(true);
    const { error } = await signIn(loginEmail, password);
    setSubmitting(false);

    if (error) {
      setErrorMsg(
        error.message === "Invalid login credentials"
          ? usernameMode
            ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
            : "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : "เข้าสู่ระบบไม่สำเร็จ: " + error.message
      );
      return;
    }

    const redirectTo = location.state?.from?.pathname || defaultRedirect;
    navigate(redirectTo, { replace: true });
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#eef1f6] p-6">
      <div className="w-full max-w-md">
        {/* โลโก้ + ชื่อระบบ + หน่วยงาน — จัดลำดับความสำคัญของตัวอักษรใหม่ให้อ่านง่ายเป็นขั้นบันได */}
        <div className="mb-10 flex flex-col items-center gap-1 text-center">
          <img src={avdcLogo} alt="AVDC Logo" className="mb-4 h-24 w-24 rounded-2xl object-contain shadow-sm" />
          <h1 className="text-2xl font-bold leading-snug" style={{ color: NAVY }}>
            {title}
          </h1>
          <p className="text-sm font-medium text-slate-500">{subtitle}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <span className="h-px w-6 bg-slate-300" />
            เข้าสู่ระบบสำหรับเจ้าหน้าที่
            <span className="h-px w-6 bg-slate-300" />
          </div>
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

          <label className="mb-2 block text-sm font-semibold text-slate-600">
            {usernameMode ? "ชื่อผู้ใช้" : "อีเมล"}
          </label>
          <input
            type={usernameMode ? "text" : "email"}
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={usernameMode ? "เช่น pla01" : "name@hospital.go.th"}
            className="mb-5 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#2f8fdc] focus:bg-white focus:ring-4 focus:ring-blue-50"
          />

          <label className="mb-2 block text-sm font-semibold text-slate-600">รหัสผ่าน</label>
          <div className="relative mb-2">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 pr-11 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#2f8fdc] focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: BLUE }}
            onMouseEnter={(e) => !submitting && (e.currentTarget.style.backgroundColor = "#2a7ec2")}
            onMouseLeave={(e) => !submitting && (e.currentTarget.style.backgroundColor = BLUE)}
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
            {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          ยังไม่มีบัญชีผู้ใช้? <span className="font-medium text-slate-500">ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าใช้งาน</span>
        </p>
      </div>
    </div>
  );
}
