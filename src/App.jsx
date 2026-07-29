import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { PenSquare, LayoutDashboard } from "lucide-react";
import avdcLogo from "./assets/avdc-logo.png";
import DispensePage from "./DispensePage";
import AVDCDashboard from "./AVDCDashboard";
import WarehousePage from "./WarehousePage";
import StaffPage from "./StaffPage";
import DrugsPage from "./DrugsPage";
import DepartmentsPage from "./DepartmentsPage";
import ReportsPage from "./ReportsPage";
import UsersPage from "./UsersPage";
import Sidebar from "./Sidebar";
import { AuthProvider, ROLES } from "./AuthContext";
import LoginPage from "./LoginPage";
import ProtectedRoute from "./ProtectedRoute";

// ตารางสิทธิ์: หน้าไหนในโซน /admin เปิดให้บทบาทใดบ้าง (undefined = แค่ล็อกอินก็เข้าได้ ไม่จำกัดบทบาท)
const ADMIN_ROLES_ALL = [ROLES.ADMIN];
const ADMIN_ROLES_PHARMACIST = [ROLES.ADMIN, ROLES.PHARMACIST];
const ADMIN_ROLES_DASHBOARD = [ROLES.ADMIN, ROLES.PHARMACIST, ROLES.NURSE];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// ชื่อที่จะไปแสดงบนแท็บเบราว์เซอร์ (document.title) ของแต่ละหน้า
const PAGE_TITLES = {
  "/": "AVDC — ระบบ Antidote & Vital Drug",
  "/dispense": "ระบบบันทึกจ่ายยา Antidote & Vital Drug",
  "/admin/dashboard": "AVDC DASHBOARD",
  "/admin/warehouse": "คลังยา | AVDC",
  "/admin/drugs": "รายการยา | AVDC",
  "/admin/staff": "เจ้าหน้าที่ | AVDC",
  "/admin/departments": "หน่วยงาน | AVDC",
  "/admin/reports": "รายงาน | AVDC",
  "/admin/users": "ผู้ใช้งานระบบ | AVDC",
  "/login": "เข้าสู่ระบบ | AVDC DASHBOARD",
};

function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = PAGE_TITLES[pathname] || "AVDC — ระบบ Antidote & Vital Drug";
  }, [pathname]);
  return null;
}

function AdminShell({ children }) {
  return (
    <div className="min-h-screen w-full bg-[#eef1f6]">
      <Sidebar />
      <div className="min-w-0 pb-20 lg:pb-0 lg:pl-24">{children}</div>
    </div>
  );
}

function Landing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#eef1f6] p-6 text-center">
      <img src={avdcLogo} alt="AVDC Logo" className="h-24 w-24 rounded-2xl object-contain" />
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
        หน้า "ระบบจัดการ (Admin)" ต้องเข้าสู่ระบบก่อนใช้งาน และจะแสดงเฉพาะเมนูที่ตรงกับสิทธิ์ของผู้ใช้แต่ละคน
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <PageTitle />
        <Routes>
          <Route path="/" element={<Landing />} />
          {/* หน้าบันทึกจ่ายยา — ยังไม่กำหนดสิทธิ์ ใช้งานได้โดยไม่ต้องล็อกอิน */}
          <Route path="/dispense" element={<DispensePage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES_DASHBOARD}>
                <AdminShell>
                  <AVDCDashboard />
                </AdminShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/warehouse"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES_PHARMACIST}>
                <AdminShell>
                  <WarehousePage />
                </AdminShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/drugs"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES_PHARMACIST}>
                <AdminShell>
                  <DrugsPage />
                </AdminShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/staff"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES_ALL}>
                <AdminShell>
                  <StaffPage />
                </AdminShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/departments"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES_ALL}>
                <AdminShell>
                  <DepartmentsPage />
                </AdminShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES_PHARMACIST}>
                <AdminShell>
                  <ReportsPage />
                </AdminShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES_ALL}>
                <AdminShell>
                  <UsersPage />
                </AdminShell>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
