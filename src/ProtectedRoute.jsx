import { Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth, ROLE_LABELS } from "./AuthContext";

/**
 * ครอบ route ที่ต้องล็อกอินก่อนถึงจะเข้าได้
 * - allowedRoles: array ของ role ที่อนุญาต เช่น ["admin", "pharmacist"]
 *   ถ้าไม่ระบุ (undefined) = แค่ต้องล็อกอิน ไม่จำกัดบทบาท
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#eef1f6]">
        <Loader2 className="h-6 w-6 animate-spin text-[#0d2a63]" />
      </div>
    );
  }

  // ยังไม่ล็อกอิน -> เด้งไปหน้า login พร้อมจำหน้าที่ตั้งใจจะเข้าไว้ (redirect กลับมาหลังล็อกอินสำเร็จ)
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const role = profile?.role;

  // ล็อกอินแล้วแต่ยังไม่มีบทบาท (ยังไม่ได้ถูก admin กำหนดสิทธิ์) หรือบทบาทไม่อยู่ในสิทธิ์ที่อนุญาตของหน้านี้
  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-[#eef1f6] p-6 text-center">
        <ShieldAlert className="h-10 w-10 text-red-400" />
        <h1 className="text-lg font-bold text-[#0d2a63]">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
        <p className="max-w-sm text-sm text-slate-500">
          {role
            ? `บัญชีของคุณมีสิทธิ์ "${ROLE_LABELS[role] || role}" ซึ่งไม่สามารถเข้าถึงหน้านี้ได้`
            : "บัญชีของคุณยังไม่ได้รับการกำหนดสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ"}
        </p>
        <a href="/admin/dashboard" className="mt-2 rounded-xl bg-[#0d2a63] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0a1f4d]">
          กลับไปหน้าหลัก
        </a>
      </div>
    );
  }

  return children;
}
