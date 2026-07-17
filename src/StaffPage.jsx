import React, { useState } from "react";
import { Users, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useStaffList, addStaff, updateStaff, deleteStaff } from "./useStaff";

export default function StaffPage() {
  const { staff, loading, reload } = useStaffList();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await addStaff(name.trim(), role.trim() || null);
    if (!error) {
      setName("");
      setRole("");
      reload();
    } else {
      alert(error.message);
    }
  }

  function startEdit(s) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditRole(s.role || "");
  }

  async function saveEdit(id) {
    const { error } = await updateStaff(id, { name: editName.trim(), role: editRole.trim() || null });
    if (!error) {
      setEditingId(null);
      reload();
    } else {
      alert(error.message);
    }
  }

  async function toggleActive(s) {
    await updateStaff(s.id, { active: !s.active });
    reload();
  }

  async function handleDelete(id) {
    if (!confirm("ลบเจ้าหน้าที่คนนี้ใช่ไหม?")) return;
    const { error } = await deleteStaff(id);
    if (!error) reload();
    else alert(error.message);
  }

  return (
    <div className="min-h-screen w-full bg-[#eef1f6] p-4 font-sans md:p-6">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#0d2a63]">
            <Users className="h-5 w-5" /> จัดการเจ้าหน้าที่
          </h2>

          <form onSubmit={handleAdd} className="mb-5 flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อ-นามสกุล"
              className="min-w-[160px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="ตำแหน่ง (ไม่บังคับ)"
              className="min-w-[140px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button type="submit" className="flex items-center gap-1.5 rounded-lg bg-[#2f8fdc] px-4 py-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> เพิ่ม
            </button>
          </form>

          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">กำลังโหลด...</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {staff.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                  {editingId === s.id ? (
                    <div className="flex flex-1 flex-wrap gap-2">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="min-w-[140px] flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                      <input value={editRole} onChange={(e) => setEditRole(e.target.value)} className="min-w-[120px] flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                      <button onClick={() => saveEdit(s.id)} className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setEditingId(null)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${s.active ? "bg-emerald-500" : "bg-slate-300"}`} />
                        <span className="text-sm font-medium text-slate-700">{s.name}</span>
                        {s.role && <span className="text-xs text-slate-400">{s.role}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleActive(s)} className="rounded px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100">
                          {s.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </button>
                        <button onClick={() => startEdit(s)} className="rounded p-1.5 text-amber-500 hover:bg-amber-50"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDelete(s.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </>
                  )}
                </li>
              ))}
              {staff.length === 0 && <p className="py-6 text-center text-sm text-slate-400">ยังไม่มีเจ้าหน้าที่ในระบบ</p>}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
