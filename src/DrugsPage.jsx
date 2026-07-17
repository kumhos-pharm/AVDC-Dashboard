import React, { useMemo, useState } from "react";
import { ListChecks, Plus, Trash2, Pencil, Check, X, Search, PackagePlus } from "lucide-react";
import { useDrugList, addDrug, updateDrug, deleteDrug } from "./useDrugs";
import { alertSuccess, alertError, confirmAction } from "./alert";

const NAVY = "#0d2a63";

const FORM_OPTIONS = [
  { value: "", label: "เลือกรูปแบบยา" },
  { value: "ยาฉีด (Ampoule)", label: "ยาฉีด (Ampoule)" },
  { value: "ยาฉีด (Vial)", label: "ยาฉีด (Vial)" },
  { value: "ซอง (Powder)", label: "ซอง (Powder)" },
 { value: "ขวด", label: "ขวด" },
];

export default function DrugsPage() {
  const { drugs, loading, reload } = useDrugList();
  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [form, setForm] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editStrength, setEditStrength] = useState("");
  const [editForm, setEditForm] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return drugs;
    return drugs.filter((d) => d.name.toLowerCase().includes(term));
  }, [search, drugs]);

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("กรุณาระบุชื่อยา");
    setSaving(true);
    const { error: err } = await addDrug(name, strength, form);
    setSaving(false);
    if (err) {
      setError(err.message);
      alertError(err.message);
      return;
    }
    alertSuccess(`เพิ่มยา "${name.trim()}" เข้าระบบเรียบร้อยแล้ว`);
    setName("");
    setStrength("");
    setForm("");
    reload();
  }

  function startEdit(d) {
    setEditingId(d.id);
    setEditName(d.name);
    setEditStrength(d.strength || "");
    setEditForm(d.form || "");
  }

  async function saveEdit(id) {
    if (!editName.trim()) return;
    const { error: err } = await updateDrug(id, {
      name: editName.trim(),
      strength: editStrength.trim() || null,
      form: editForm.trim() || null,
    });
    if (err) {
      alertError(err.message);
      return;
    }
    alertSuccess(`บันทึกการแก้ไข "${editName.trim()}" เรียบร้อยแล้ว`);
    setEditingId(null);
    reload();
  }

  async function handleDelete(id, drugName) {
    const ok = await confirmAction({
      title: "ยืนยันลบยานี้?",
      text: `"${drugName}" จะถูกลบออกจากรายการยาทั้งหมด (จะไม่กระทบยอดคงคลังที่มีอยู่แล้ว)`,
      confirmText: "ลบเลย",
      danger: true,
    });
    if (!ok) return;
    const { error: err } = await deleteDrug(id);
    if (err) {
      alertError(err.message);
      return;
    }
    alertSuccess(`ลบ "${drugName}" ออกจากรายการยาเรียบร้อยแล้ว`);
    reload();
  }

  return (
    <div className="min-h-screen w-full bg-[#eef1f6] p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: NAVY }}>
            <ListChecks className="h-5.5 w-5.5" />
          </span>
          <div>
            <h1 className="text-xl font-bold" style={{ color: NAVY }}>รายการยา</h1>
            <p className="text-xs text-slate-400">จัดการรายชื่อยา ความแรง และรูปแบบยาในระบบ</p>
          </div>
        </div>

        <form
          onSubmit={handleAdd}
          className="relative mb-6 overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]"
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-600" />
          <h2 className="mb-5 flex items-center gap-2.5 text-lg font-bold text-emerald-600">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
              <PackagePlus className="h-5 w-5" />
            </span>
            เพิ่มยาใหม่เข้าระบบ
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">ชื่อยา *</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="พิมพ์ชื่อยา..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">ความแรง</label>
              <input
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="เช่น 500 mg"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">รูปแบบยา</label>
              <select
                value={form}
                onChange={(e) => setForm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              >
                {FORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-200 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> บันทึกเพิ่มยาใหม่
          </button>
        </form>

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
                    <th className="px-6 py-3 text-right font-semibold">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80">
                      {editingId === d.id ? (
                        <td colSpan={4} className="px-6 py-3">
                          <div className="flex flex-1 flex-wrap items-center gap-2">
                            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="min-w-[160px] flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" placeholder="ชื่อยา" />
                            <input value={editStrength} onChange={(e) => setEditStrength(e.target.value)} placeholder="ความแรง" className="w-32 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" />
                            <select value={editForm} onChange={(e) => setEditForm(e.target.value)} className="w-44 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm">
                              {FORM_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <button onClick={() => saveEdit(d.id)} className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditingId(null)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="px-6 py-3.5 font-semibold text-slate-700">{d.name}</td>
                          <td className="px-3 py-3.5 text-slate-500">{d.strength || <span className="text-slate-300">ยังไม่ระบุ</span>}</td>
                          <td className="px-3 py-3.5 text-slate-500">{d.form || <span className="text-slate-300">ยังไม่ระบุ</span>}</td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => startEdit(d)} className="rounded-lg bg-amber-50 p-1.5 text-amber-600 hover:bg-amber-100"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => handleDelete(d.id, d.name)} className="rounded-lg bg-red-50 p-1.5 text-red-500 hover:bg-red-100"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </>
                      )}
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
