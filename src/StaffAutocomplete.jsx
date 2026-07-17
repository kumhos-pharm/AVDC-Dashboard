import React, { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { useStaffList, addStaff } from "./useStaff";

// value = staff name (text), onChange(name) — เก็บเป็นชื่อ text ใน stock_movements.staff_name
// เหมือนเดิม แต่ผูกกับตาราง staff จริงเพื่อค้นหา/เพิ่มใหม่ได้
export default function StaffAutocomplete({ value, onChange }) {
  const { staff, reload } = useStaffList();
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    if (!value.trim()) return staff.slice(0, 6);
    return staff.filter((s) => s.name.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 6);
  }, [value, staff]);

  const exactMatch = staff.some((s) => s.name.trim().toLowerCase() === value.trim().toLowerCase());

  async function handleAddNew() {
    const name = value.trim();
    if (!name) return;
    const { error } = await addStaff(name, null);
    if (!error) {
      await reload();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="พิมพ์ชื่อผู้บันทึก"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      {open && (matches.length > 0 || value.trim()) && (
        <ul className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={() => {
                  onChange(s.name);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                {s.name}
                {s.role && <span className="ml-2 text-xs text-slate-400">{s.role}</span>}
              </button>
            </li>
          ))}
          {value.trim() && !exactMatch && (
            <li>
              <button
                type="button"
                onMouseDown={handleAddNew}
                className="flex w-full items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-[#2f8fdc] hover:bg-blue-50"
              >
                <UserPlus className="h-3.5 w-3.5" /> เพิ่มเจ้าหน้าที่ใหม่: "{value.trim()}"
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
