import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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
  "/": "ระบบบันทึกจ่ายยา Antidote & Vital Drug",
  "/dispense": "ระบบบันทึกจ่ายยา Antidote & Vital Drug",
  "/admin/dashboard": "AVDC DASHBOARD",
  "/admin/warehouse": "คลังยา | AVDC",
  "/admin/drugs": "รายการยา | AVDC",
  "/admin/staff": "เจ้าหน้าที่ | AVDC",
  "/admin/departments": "หน่วยงาน | AVDC",
  "/admin/reports": "รายงาน | AVDC",
  "/admin/users": "ผู้ใช้งานระบบ | AVDC",
  "/login": "เข้าสู่ระบบบันทึกจ่ายยา | AVDC",
  "/admin/login": "เข้าสู่ระบบจัดการ | AVDC",
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <PageTitle />
        <Routes>
          {/* ตัดหน้าเลือกออก: เข้า root ก็เห็นหน้าบันทึกจ่ายยาทันที (ไม่ redirect เปลี่ยน URL) */}
          {/* ต้องล็อกอินก่อนถึงจะบันทึก/แก้ไขรายการจ่ายยาได้ (ไม่จำกัดบทบาท ล็อกอินแล้วเข้าได้ทุกบทบาท) — ใช้หน้า login แยกของโซนนี้ */}
          <Route
            path="/"
            element={
              <ProtectedRoute loginPath="/login">
                <DispensePage />
              </ProtectedRoute>
            }
          />
          {/* คงพาธนี้ไว้เผื่อมีคนแชร์/บุ๊คมาร์คลิงก์เดิม */}
          <Route
            path="/dispense"
            element={
              <ProtectedRoute loginPath="/login">
                <DispensePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={
              <LoginPage
                title="ระบบบันทึกจ่ายยา AVDC"
                subtitle="สำหรับเจ้าหน้าที่บันทึกจ่ายยา Antidote & Vital Drug"
                defaultRedirect="/dispense"
              />
            }
          />
          <Route
            path="/admin/login"
            element={
              <LoginPage
                title="ระบบจัดการ AVDC Dashboard"
                subtitle="กลุ่มงานเภสัชกรรม รพ.กุมภวาปี"
                defaultRedirect="/admin/dashboard"
              />
            }
          />

          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES_DASHBOARD} loginPath="/admin/login">
                <AdminShell>
                  <AVDCDashboard />
                </AdminShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/warehouse"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES_PHARMACIST} loginPath="/admin/login">
                <AdminShell>
                  <WarehousePage />
                </AdminShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/drugs"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES_PHARMACIST} loginPath="/admin/login">
                <AdminShell>
                  <DrugsPage />
                </AdminShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/staff"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES_ALL} loginPath="/admin/login">
                <AdminShell>
                  <StaffPage />
                </AdminShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/departments"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES_ALL} loginPath="/admin/login">
                <AdminShell>
                  <DepartmentsPage />
                </AdminShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES_PHARMACIST} loginPath="/admin/login">
                <AdminShell>
                  <ReportsPage />
                </AdminShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES_ALL} loginPath="/admin/login">
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
