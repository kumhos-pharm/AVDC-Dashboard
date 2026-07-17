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

export default function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-24 flex-col items-center gap-1.5 overflow-y-auto py-6 lg:flex"
      style={{ backgroundColor: NAVY }}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
        <ShieldCheck className="h-6 w-6 text-white" />
      </div>
      <NavItem icon={Home} label="หน้าหลัก" to="/admin/dashboard" active={pathname === "/admin/dashboard"} />
      <NavItem icon={ListChecks} label="รายการยา" to="/admin/drugs" active={pathname === "/admin/drugs"} />
      <NavItem icon={Building2} label="หน่วยงาน" to="/admin/departments" active={pathname === "/admin/departments"} />
      <NavItem icon={Warehouse} label="สถานะคงคลัง" to="/admin/warehouse" active={pathname === "/admin/warehouse"} />
      <NavItem icon={Users} label="เจ้าหน้าที่" to="/admin/staff" active={pathname === "/admin/staff"} />
      <NavItem icon={FileText} label="รายงาน" />
      <div className="mt-auto">
        <NavItem icon={Info} label="ข้อมูลเพิ่มเติม" />
      </div>
    </aside>
  );
}
