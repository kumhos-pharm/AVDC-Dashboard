import { Link, useLocation } from "react-router-dom";
import { Home, ListChecks, Building2, Warehouse, Users, FileText, Info, ShieldCheck } from "lucide-react";

const NAVY = "#0d2a63";

function NavItem({ icon: Icon, label, to, active }) {
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
    <button type="button" className={className}>
      <Icon className="h-5 w-5" strokeWidth={2} />
      {label}
    </button>
  );
}

// ปุ่มเมนูสำหรับแถบเมนูล่าง (มือถือ/แท็บเล็ต) — จัดวางแนวนอน ไอคอนเล็กลงให้พอดีจอแคบ
function MobileNavItem({ icon: Icon, label, to, active }) {
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
    <button type="button" className={className}>
      {content}
    </button>
  );
}

export default function Sidebar() {
  const { pathname } = useLocation();

  const navLinks = [
    { icon: Home, label: "หน้าหลัก", to: "/admin/dashboard" },
    { icon: ListChecks, label: "รายการยา", to: "/admin/drugs" },
    { icon: Building2, label: "หน่วยงาน", to: "/admin/departments" },
    { icon: Warehouse, label: "คงคลัง", to: "/admin/warehouse" },
    { icon: Users, label: "เจ้าหน้าที่", to: "/admin/staff" },
  ];

  return (
    <>
      {/* แถบเมนูด้านซ้าย — จอกว้าง (จอคอมพิวเตอร์/แท็บเล็ตแนวนอนขนาดใหญ่) */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-24 flex-col items-center gap-1.5 overflow-y-auto py-6 lg:flex"
        style={{ backgroundColor: NAVY }}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        {navLinks.map((item) => (
          <NavItem key={item.to} {...item} active={pathname === item.to} />
        ))}
        <NavItem icon={FileText} label="รายงาน" />
        <div className="mt-auto">
          <NavItem icon={Info} label="ข้อมูลเพิ่มเติม" />
        </div>
      </aside>

      {/* แถบเมนูด้านล่าง — มือถือ/แท็บเล็ต (ซ่อนบนจอกว้าง lg ขึ้นไป) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-0.5 px-1.5 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-2px_10px_rgba(0,0,0,0.15)] lg:hidden"
        style={{ backgroundColor: NAVY }}
      >
        {navLinks.map((item) => (
          <MobileNavItem key={item.to} {...item} active={pathname === item.to} />
        ))}
      </nav>
    </>
  );
}
