import React, { useState, useEffect } from "react";
import DispenseForm from "./DispenseForm";
import DispenseHistory from "./DispenseHistory";
import { RefreshCw, Calendar, Pill, Database } from "lucide-react";
import avdcLogo from "./assets/avdc-logo.png";

export default function DispensePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState("");

  // แถวจากประวัติที่กำลังถูกแก้ไขอยู่ (null = ไม่ได้แก้ไข, ฟอร์มอยู่ในโหมดจ่ายยาใหม่ตามปกติ)
  const [editingRow, setEditingRow] = useState(null);

  // ฟังก์ชันจัดฟอร์แมตวันเวลาภาษาไทยให้สวยงามและเป็นปัจจุบันจริง
  const updateDateTime = () => {
    const now = new Date();
    const days = [
      "วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"
    ];
    const months = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    
    const dayName = days[now.getDay()];
    const date = now.getDate();
    const monthName = months[now.getMonth()];
    const thaiYear = now.getFullYear() + 543;
    
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    setCurrentDateTime(`${dayName}ที่ ${date} ${monthName} ${thaiYear} | ${timeStr} น.`);
  };

  // อัปเดตเวลาครั้งแรก และทุกๆ 1 วินาทีเพื่อให้เวลาเดินตลอด (หรืออัปเดตเมื่อกด Refresh)
  useEffect(() => {
    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, [refreshKey]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="min-h-screen w-full bg-[#eef1f6] p-4 font-['Kanit'] md:p-6 flex flex-col justify-between">
      
      {/* ส่วนเนื้อหาหลักด้านบน */}
      <div className="mx-auto w-full max-w-[1600px] space-y-4 flex-grow">
        
        {/* ================= ส่วน Header ดีไซน์ใหม่ใส่โลโก้ AVDC ================= */}
        <div className="relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between rounded-2xl bg-gradient-to-br from-[#eaf4ff] via-white to-[#f1faf5] p-4 md:p-5 shadow-[0_6px_24px_-8px_rgba(15,23,42,0.12)] gap-4 border border-white">

          {/* แถบสีบางๆ ด้านล่าง เชื่อมโทนฟ้า (สีหลักของระบบ) กับเขียว (สีของประวัติ) ให้เป็นเอกลักษณ์เดียวกันทั้งหน้า */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-[#007bff] via-[#4a9bd1] to-[#198754]" />

          {/* ฝั่งซ้าย: โลโก้ใหม่ + ชื่อระบบตามสั่ง */}
          <div className="flex items-center gap-4 pl-1">
            {/* กล่องใส่โลโก้ AVDC */}
            <div className="h-38 w-38 flex-shrink-0 bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
          
  <img
  src={avdcLogo}
  alt="AVDC Logo"
  className="h-full w-full object-contain"
/>

            </div>
            
            {/* ข้อความชื่อระบบ */}
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-[#0056b3] tracking-tight leading-tight">
                ระบบบันทึกจ่ายยา Antidote & Vital Drug 
              </h1>
              <p className="text-sm md:text-base font-bold text-slate-600 mt-0.5">
                กลุ่มงานเภสัชกรรม รพ.กุมภวาปี
              </p>
            </div>
          </div>

          {/* ฝั่งขวา: แสดง วันที่ และ เวลาปัจจุบัน (Real-time) */}
          <div className="flex items-center gap-3 rounded-xl bg-white/70 backdrop-blur-sm border border-white p-3 self-stretch md:self-auto justify-between md:justify-start shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-[#007bff]">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">
                  วันที่และเวลาอัปเดตล่าสุด
                </span>
                <span className="block text-xs md:text-sm font-extrabold text-slate-700">
                  {currentDateTime}
                </span>
              </div>
            </div>
            
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`p-2 rounded-lg bg-slate-100/80 text-slate-500 border border-slate-200/80 hover:bg-slate-200 hover:text-slate-700 active:scale-95 transition-all ml-2 ${
                isRefreshing ? "animate-spin text-blue-500" : ""
              }`}
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

        </div>


        {/* ================= ส่วนฟอร์มและประวัติ (Workspace) ================= */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
          {/* ฟอร์มจ่ายยา */}
          <div className="lg:col-span-5 xl:col-span-5">
            <DispenseForm
              editingRow={editingRow}
              onCancelEdit={() => setEditingRow(null)}
              onSaved={() => {
                setEditingRow(null);
                setRefreshKey((k) => k + 1);
              }}
            />
          </div>

          {/* ประวัติการจ่ายยา */}
          <div className="lg:col-span-7 xl:col-span-7">
            <DispenseHistory
              refreshKey={refreshKey}
              editingId={editingRow?.id}
              onEditRequest={(row) => setEditingRow(row)}
            />
          </div>
        </div>

      </div>

      {/* ================= ส่วน Footer ดีไซน์ใหม่ สมดุลและเรียบหรูอยู่ตรงกลาง ================= */}
      <footer className="relative w-full mt-12 py-6">
        {/* แถบสีบางๆ ด้านบน footer แบบเดียวกับที่ขอบล่างของหัว ให้เข้าธีมเดียวกันทั้งหน้า */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#007bff] via-[#4a9bd1] to-[#198754]" />
        <div className="mx-auto max-w-[1600px] px-4 flex flex-col items-center justify-center gap-3 text-center">
          
          {/* บรรทัดบน: กลุ่มงานและระบบ */}
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-white shadow-xs border border-slate-200 text-blue-600">
              <Pill className="h-4 w-4" />
            </div>
            <span className="font-bold text-slate-700 text-sm">
              กลุ่มงานเภสัชกรรม รพ.กุมภวาปี
            </span>
            
          </div>

          {/* บรรทัดล่าง: เครดิตผู้พัฒนา และสถานะฐานข้อมูล */}
          <div className="flex items-center justify-center gap-3 text-xs text-slate-400 flex-wrap">
            <span className="text-slate-500 font-semibold">© 2026 ระบบบันทึกจ่ายยา Antidote</span>
            <span className="h-3.5 w-px bg-slate-300">|</span>
            <span className="text-slate-500 font-semibold">พัฒนาโดย สายัญ ธุนันทา</span>
            <span className="h-3.5 w-px bg-slate-300"></span>
            
            
          </div>

        </div>
      </footer>

    </div>
  );
}