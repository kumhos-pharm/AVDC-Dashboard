import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, ListChecks, Building2, Warehouse, Users, FileText, ShieldCheck, UserCog, LogOut } from "lucide-react";
import Swal from "sweetalert2";
import { useAuth, ROLES, ROLE_LABELS } from "./AuthContext";

const NAVY = "#0d2a63";

// เมนูทั้งหมดในระบบ พร้อมระบุว่าบทบาทใดเห็นเมนูนี้ได้บ้าง (roles: undefined = ทุกบทบาทเห็นได้)
const ALL_NAV_LINKS = [
  { icon: Home, label: "หน้าหลัก", to: "/admin/dashboard", roles: [ROLES.ADMIN, ROLES.PHARMACIST, ROLES.NURSE] },
  { icon: ListChecks, label: "รายการยา", to: "/admin/drugs", roles: [ROLES.ADMIN, ROLES.PHARMACIST] },
  { icon: Building2, label: "หน่วยงาน", to: "/admin/departments", roles: [ROLES.ADMIN] },
  { icon: Warehouse, label: "คงคลัง", to: "/admin/warehouse", roles: [ROLES.ADMIN, ROLES.PHARMACIST] },
  { icon: Users, label: "เจ้าหน้าที่", to: "/admin/staff", roles: [ROLES.ADMIN] },
  { icon: FileText, label: "รายงาน", to: "/admin/reports", roles: [ROLES.ADMIN, ROLES.PHARMACIST] },
  { icon: UserCog, label: "ผู้ใช้งาน", to: "/admin/users", roles: [ROLES.ADMIN] },
];

function NavItem({ icon: Icon, label, to, active, onClick }) {
  const className = `flex w-full flex-col items-center gap-1 rounded-xl px-2 py-3 text-center text-[10px] leading-tight transition-colors ${
    active ? "bg-white text-[#0d2a63] shadow-sm" : "text-blue-100/80 hover:bg-white/10 hover:text-white"
  }`;

  if (to) {
    return (
      <Link to={to} className={className}>
        <Icon className="h-5 w-5" strokeWidth={2} />
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      <Icon className="h-5 w-5" strokeWidth={2} />
      {label}
    </button>
  );
}

// ปุ่มเมนูสำหรับแถบเมนูล่าง (มือถือ/แท็บเล็ต) — จัดวางแนวนอน ไอคอนเล็กลงให้พอดีจอแคบ
function MobileNavItem({ icon: Icon, label, to, active, onClick }) {
  const className = `flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-center text-[9.5px] leading-tight transition-colors ${
    active ? "text-white" : "text-blue-100/70"
  }`;

  const content = (
    <>
      <span className={`flex h-8 w-10 items-center justify-center rounded-lg ${active ? "bg-white/15" : ""}`}>
        <Icon className="h-4.5 w-4.5" strokeWidth={2} />
      </span>
      <span className="truncate max-w-[52px]">{label}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();

  // แสดงเฉพาะเมนูที่ตรงกับบทบาทของผู้ใช้ที่ล็อกอินอยู่
  const navLinks = ALL_NAV_LINKS.filter((item) => !item.roles || (role && item.roles.includes(role)));

  async function handleLogout() {
    const result = await Swal.fire({
      icon: "question",
      title: "ออกจากระบบ?",
      text: "ต้องการออกจากระบบจัดการ AVDC Dashboard ใช่หรือไม่",
      showCancelButton: true,
      confirmButtonText: "ออกจากระบบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    await signOut();
    // แก้บั๊ก: เดิม navigate ไป "/login" (หน้า login โซนจ่ายยา) ทั้งที่ Sidebar นี้อยู่ในโซน Admin
    // ต้องกลับไป "/admin/login" ถึงจะถูกโซน
    navigate("/admin/login", { replace: true });

    Swal.fire({
      icon: "success",
      title: "ออกจากระบบแล้ว",
      timer: 1200,
      showConfirmButton: false,
    });
  }

  return (
    <>
      {/* แถบเมนูด้านซ้าย — จอกว้าง (จอคอมพิวเตอร์/แท็บเล็ตแนวนอนขนาดใหญ่) */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-24 flex-col items-center gap-1.5 overflow-y-auto py-6 lg:flex print:hidden"
        style={{ backgroundColor: NAVY }}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        {navLinks.map((item) => (
          <NavItem key={item.to} {...item} active={pathname === item.to} />
        ))}
        <div className="mt-auto flex flex-col items-center gap-1.5">
          {profile && (
            <div className="mb-1 flex w-20 flex-col items-center gap-0.5 rounded-xl bg-white/10 px-1.5 py-2 text-center">
              <span className="w-full truncate text-[9.5px] font-semibold text-white">{profile.full_name || profile.email}</span>
              <span className="text-[9px] text-blue-100/70">{ROLE_LABELS[role] || "ไม่มีสิทธิ์"}</span>
            </div>
          )}
          <NavItem icon={LogOut} label="ออกจากระบบ" onClick={handleLogout} />
        </div>
      </aside>

      {/* แถบเมนูด้านล่าง — มือถือ/แท็บเล็ต (ซ่อนบนจอกว้าง lg ขึ้นไป และซ่อนตอนพิมพ์) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-0.5 px-1.5 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-2px_10px_rgba(0,0,0,0.15)] lg:hidden print:hidden"
        style={{ backgroundColor: NAVY }}
      >
        {navLinks.map((item) => (
          <MobileNavItem key={item.to} {...item} active={pathname === item.to} />
        ))}
        <MobileNavItem icon={LogOut} label="ออกจากระบบ" active={false} onClick={handleLogout} />
      </nav>
    </>
  );
}
