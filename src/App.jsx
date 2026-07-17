import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { PenSquare, LayoutDashboard, ShieldCheck } from "lucide-react";
import DispensePage from "./DispensePage";
import AVDCDashboard from "./AVDCDashboard";
import WarehousePage from "./WarehousePage";
import StaffPage from "./StaffPage";
import DrugsPage from "./DrugsPage";
import DepartmentsPage from "./DepartmentsPage";
import Sidebar from "./Sidebar";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AdminShell({ children }) {
  return (
    <div className="min-h-screen w-full bg-[#eef1f6]">
      <Sidebar />
      <div className="min-w-0 lg:pl-24">{children}</div>
    </div>
  );
}

function Landing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#eef1f6] p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0d2a63]">
        <ShieldCheck className="h-8 w-8 text-white" />
      </div>
      <h1 className="text-xl font-bold text-[#0d2a63]">AVDC — ระบบ Antidote &amp; Vital Drug</h1>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link to="/dispense" className="flex items-center gap-2 rounded-xl bg-[#2f8fdc] px-6 py-3 font-semibold text-white shadow-sm hover:bg-[#2a7ec2]">
          <PenSquare className="h-4 w-4" /> หน้าบันทึกจ่ายยา
        </Link>
        <Link to="/admin/dashboard" className="flex items-center gap-2 rounded-xl bg-[#0d2a63] px-6 py-3 font-semibold text-white shadow-sm hover:bg-[#0a1f4d]">
          <LayoutDashboard className="h-4 w-4" /> ระบบจัดการ (Admin)
        </Link>
      </div>
      <p className="max-w-md text-xs text-slate-400">
        หมายเหตุ: ตอนนี้ยังไม่มีระบบล็อกอินแยกสิทธิ์ — การแยกลิงก์นี้เป็นเพียงการแยก URL เท่านั้น
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dispense" element={<DispensePage />} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminShell>
              <AVDCDashboard />
            </AdminShell>
          }
        />
        <Route
          path="/admin/warehouse"
          element={
            <AdminShell>
              <WarehousePage />
            </AdminShell>
          }
        />
        <Route
          path="/admin/drugs"
          element={
            <AdminShell>
              <DrugsPage />
            </AdminShell>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <AdminShell>
              <StaffPage />
            </AdminShell>
          }
        />
        <Route
          path="/admin/departments"
          element={
            <AdminShell>
              <DepartmentsPage />
            </AdminShell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
