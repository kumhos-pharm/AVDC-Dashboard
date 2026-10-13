import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { LogIn, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import Swal from "sweetalert2";
import avdcLogo from "./assets/avdc-logo-dark.png"; // โลโก้พื้นโปร่งใส ปรับโทนให้อ่านชัดบนพื้นเข้ม
import { useAuth } from "./AuthContext";

const BLUE = "#2f8fdc";

// domain ภายในที่ใช้ต่อท้ายชื่อผู้ใช้ของหน้าจ่ายยา เพื่อให้ Supabase Auth (ซึ่งบังคับรูปแบบอีเมล) ใช้งานได้
// โดยที่พนักงานไม่ต้องพิมพ์ @... เอง — แอดมินต้องสร้างบัญชีใน Supabase เป็นอีเมลรูปแบบ "ชื่อผู้ใช้@avdc.local"
const USERNAME_DOMAIN = "avdc.local";

export default function LoginPage({
  title = "ระบบจัดการ AVDC Dashboard",
  subtitle = "กลุ่มงานเภสัชกรรม รพ.กุมภวาปี",
  subtitle2 = "", // บรรทัดที่ 2 (เสริม) ใต้ subtitle — เว้นว่างไว้ถ้าไม่ต้องการ
  tagline = "เข้าสู่ระบบสำหรับเจ้าหน้าที่", // ข้อความคั่นเล็กๆ ใต้หัวเรื่อง — ส่ง "" หรือ null เพื่อซ่อน
  defaultRedirect = "/admin/dashboard",
  usernameMode = false, // true = แสดงป๊อปอัพ SweetAlert (หน้าจ่ายยา) / false = แสดงข้อความแจ้งเตือนในฟอร์ม (หน้าแอดมิน) — ทั้งสองโหมดกรอก "ชื่อผู้ใช้"
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
      const msg = "กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบ";
      if (usernameMode) {
        Swal.fire({ icon: "warning", title: "กรอกข้อมูลไม่ครบ", text: msg, confirmButtonColor: BLUE });
      } else {
        setErrorMsg(msg);
      }
      return;
    }

    // usernameMode: ผู้ใช้พิมพ์แค่ชื่อผู้ใช้ (เช่น "pla01") เราเติม @avdc.local ต่อท้ายเองก่อนส่งไป Supabase
    // (ต้องตรงกับอีเมลที่แอดมินสร้างบัญชีไว้ใน Supabase Dashboard เช่น "pla01@avdc.local")
    // ทุกโซนกรอกเป็น "ชื่อผู้ใช้" แล้วเติม @avdc.local ให้เอง แต่ถ้าพิมพ์อีเมลเต็ม (มี @) จะใช้ตามที่พิมพ์
    // เพื่อให้บัญชีเดิมที่สร้างด้วยอีเมลจริงยังเข้าสู่ระบบได้
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

      // หน้าจ่ายยา (usernameMode) ใช้ SweetAlert2 แจ้งเตือนแบบป๊อปอัพ ให้เจ้าหน้าที่หน้างานเห็นชัดเจนขึ้น
      if (usernameMode) {
        Swal.fire({
          icon: "error",
          title: "เข้าสู่ระบบไม่สำเร็จ",
          text: friendlyMsg,
          confirmButtonText: "ลองอีกครั้ง",
          confirmButtonColor: BLUE,
        });
      } else {
        setErrorMsg(friendlyMsg);
      }
      return;
    }

    const redirectTo = location.state?.from?.pathname || defaultRedirect;

    if (usernameMode) {
      // แจ้งเตือนสั้นๆ ว่าล็อกอินสำเร็จ แล้วค่อยพาไปหน้าจ่ายยา (ปิดเองอัตโนมัติ ไม่ต้องกดตกลง)
      Swal.fire({
        icon: "success",
        title: "เข้าสู่ระบบสำเร็จ",
        timer: 1200,
        showConfirmButton: false,
      }).then(() => navigate(redirectTo, { replace: true }));
    } else {
      navigate(redirectTo, { replace: true });
    }
  }

  const inputCls =
    "w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 text-base text-white outline-none placeholder:text-slate-400 focus:border-[#2f8fdc] focus:bg-white/15 focus:ring-4 focus:ring-[#2f8fdc]/25";

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center p-6"
      style={{
        backgroundColor: "#071a42",
        backgroundImage:
          "radial-gradient(circle at 18% 20%, rgba(47,143,220,.35), transparent 45%), radial-gradient(circle at 85% 85%, rgba(74,222,128,.18), transparent 40%)",
      }}
    >
      <div className="w-full max-w-md">
        {/* โลโก้ + ชื่อระบบ + หน่วยงาน อยู่กึ่งกลาง */}
        <div className="mb-8 flex flex-col items-center gap-1 text-center text-white">
          <img
            src={avdcLogo}
            alt="AVDC Logo"
            className="mb-4 h-36 w-36 object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)] sm:h-40 sm:w-40"
          />
          <h1 className="text-2xl font-bold leading-snug sm:text-3xl">{title}</h1>
          <p className="text-sm font-medium text-[#9db4de]">{subtitle}</p>
          {subtitle2 && <p className="text-sm font-medium text-[#9db4de]">{subtitle2}</p>}
          {tagline && (
            <div className="mt-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#8aa0cc]">
              <span className="h-px w-6 bg-white/25" />
              {tagline}
              <span className="h-px w-6 bg-white/25" />
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/15 bg-white/[0.07] p-8 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-md"
        >
          {!usernameMode && errorMsg && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <label className="mb-2 block text-sm font-semibold text-slate-200">ชื่อผู้ใช้</label>
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder=""
            className={`mb-5 ${inputCls}`}
          />

          <label className="mb-2 block text-sm font-semibold text-slate-200">รหัสผ่าน</label>
          <div className="relative mb-2">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${inputCls} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-white"
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

          <p className="mt-5 text-center text-xs text-[#8aa0cc]">ออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน 10 นาที</p>
        </form>

        <p className="mt-6 text-center text-sm text-[#8aa0cc]">
          ยังไม่มีบัญชีผู้ใช้? <span className="font-medium text-slate-300">ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าใช้งาน</span>
        </p>
      </div>
    </div>
  );
}
