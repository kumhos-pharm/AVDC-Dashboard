import React, { useMemo, useState } from "react";
import { ListChecks, Search } from "lucide-react";
import { useDrugList } from "./useDrugs";

const NAVY = "#0d2a63";

export default function DrugsPage() {
  const { drugs, loading } = useDrugList();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return drugs;
    return drugs.filter((d) => d.name.toLowerCase().includes(term));
  }, [search, drugs]);

  return (
    <div className="min-h-screen w-full bg-[#eef1f6] p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: NAVY }}>
            <ListChecks className="h-5.5 w-5.5" />
          </span>
          <div>
            <h1 className="text-xl font-bold" style={{ color: NAVY }}>รายการยา</h1>
            <p className="text-xs text-slate-400">
              รายชื่อยา ความแรง และรูปแบบยาในระบบ (ดูอย่างเดียว — เพิ่ม/แก้ไข/ลบยาได้ที่เมนู "คลังยา")
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
          <div className="border-b border-slate-100 p-6 pb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อยา..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#2f8fdc] focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-xs text-slate-500">
                    <th className="px-6 py-3 text-left font-semibold">ชื่อยา</th>
                    <th className="px-3 py-3 text-left font-semibold">ความแรง</th>
                    <th className="px-3 py-3 text-left font-semibold">รูปแบบยา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-3.5 font-semibold text-slate-700">{d.name}</td>
                      <td className="px-3 py-3.5 text-slate-500">{d.strength || <span className="text-slate-300">ยังไม่ระบุ</span>}</td>
                      <td className="px-3 py-3.5 text-slate-500">{d.form || <span className="text-slate-300">ยังไม่ระบุ</span>}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-10 text-center text-sm text-slate-400">ไม่พบยาที่ค้นหา</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
