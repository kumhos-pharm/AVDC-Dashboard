import React, { useMemo, useState } from "react";
import { ListChecks, Search, Trash2, Loader2 } from "lucide-react";
import { useDrugList, deleteDrug } from "./useDrugs";
import { alertSuccess, alertError, confirmAction } from "./alert";

const NAVY = "#0d2a63";

export default function DrugsPage() {
  const { drugs, loading, reload } = useDrugList();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return drugs;
    return drugs.filter((d) => d.name.toLowerCase().includes(term));
  }, [search, drugs]);

  async function handleDelete(drug) {
    const ok = await confirmAction({
      title: "ยืนยันลบยานี้ออกจากระบบ?",
      text: `"${drug.name}" จะถูกลบออกจากระบบถาวร จะไม่แสดงในหน้าแดชบอร์ดหรือรายการยาอีกต่อไป — ใช้เมื่อไม่มีการใช้ยานี้แล้วเท่านั้น (ถ้ายานี้ยังมีสต็อกค้างอยู่ในคลังยา ระบบจะลบไม่สำเร็จ ให้ไปเคลียร์สต็อกที่หน้า "คลังยา" ก่อน)`,
      confirmText: "ลบเลย",
      danger: true,
    });
    if (!ok) return;
    setDeletingId(drug.id);
    const { error } = await deleteDrug(drug.id);
    setDeletingId(null);
    if (error) {
      alertError(
        error.message?.includes("foreign key") || error.code === "23503"
          ? `ลบไม่สำเร็จ: "${drug.name}" ยังมีสต็อก/ประวัติค้างอยู่ในคลังยา กรุณาเคลียร์สต็อกให้หมดที่หน้า "คลังยา" ก่อน แล้วค่อยลบที่นี่`
          : error.message
      );
      return;
    }
    alertSuccess(`ลบ "${drug.name}" ออกจากระบบเรียบร้อยแล้ว`);
    reload();
  }

  return (
    <div className="min-h-screen w-full bg-[#eef1f6] p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-[1680px]">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: NAVY }}>
            <ListChecks className="h-5.5 w-5.5" />
          </span>
          <div>
            <h1 className="text-xl font-bold" style={{ color: NAVY }}>รายการยา</h1>
            <p className="text-xs text-slate-400">
              รายชื่อยา ความแรง และรูปแบบยาในระบบ (เพิ่ม/แก้ไขได้ที่เมนู "คลังยา" — ลบยาที่เลิกใช้แล้วได้ที่นี่)
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
                    <th className="px-3 py-3 text-center font-semibold">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-3.5 font-semibold text-slate-700">{d.name}</td>
                      <td className="px-3 py-3.5 text-slate-500">{d.strength || <span className="text-slate-300">ยังไม่ระบุ</span>}</td>
                      <td className="px-3 py-3.5 text-slate-500">{d.form || <span className="text-slate-300">ยังไม่ระบุ</span>}</td>
                      <td className="px-3 py-3.5 text-center">
                        <button
                          onClick={() => handleDelete(d)}
                          disabled={deletingId === d.id}
                          title="ลบยานี้ออกจากระบบถาวร"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                        >
                          {deletingId === d.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-sm text-slate-400">ไม่พบยาที่ค้นหา</td>
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
