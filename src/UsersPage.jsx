import { useState, useEffect, useCallback } from "react";
import { UserCog, Loader2, Save, Info } from "lucide-react";
import { supabase } from "./supabaseClient";
import { ROLES, ROLE_LABELS, useAuth } from "./AuthContext";

const NAVY = "#0d2a63";

function useProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
    setProfiles(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { profiles, loading, reload };
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { profiles, loading, reload } = useProfiles();
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({}); // { [id]: { full_name, role } } ค่าที่กำลังแก้ไขในตาราง ก่อนกดบันทึก

  function getDraft(p) {
    return drafts[p.id] ?? { full_name: p.full_name || "", role: p.role || "" };
  }

  function setDraft(id, patch) {
    setDrafts((prev) => {
      const p = profiles.find((x) => x.id === id);
      const current = prev[id] ?? { full_name: p?.full_name || "", role: p?.role || "" };
      return { ...prev, [id]: { ...current, ...patch } };
    });
  }

  async function handleSave(p) {
    const draft = getDraft(p);
    setSavingId(p.id);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: draft.full_name.trim() || null, role: draft.role || null })
      .eq("id", p.id);
    setSavingId(null);
    if (error) {
      alert("บันทึกไม่สำเร็จ: " + error.message);
      return;
    }
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[p.id];
      return next;
    });
    reload();
  }

  return (
    <div className="min-h-screen w-full bg-[#eef1f6] p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: NAVY }}>
            <UserCog className="h-5.5 w-5.5" />
          </span>
          <div>
            <h1 className="text-xl font-bold" style={{ color: NAVY }}>ผู้ใช้งานระบบ</h1>
            <p className="text-xs text-slate-400">กำหนดชื่อและบทบาท (สิทธิ์การเข้าถึง) ของผู้ใช้แต่ละคน</p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-slate-600">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#2f8fdc]" />
          <span>
            การสร้างบัญชีผู้ใช้ใหม่ (อีเมล/รหัสผ่าน) ทำผ่านเมนู Authentication ใน Supabase Dashboard
            เมื่อสร้างบัญชีแล้ว ชื่อผู้ใช้จะปรากฏในตารางด้านล่างโดยอัตโนมัติ — ให้กำหนด "บทบาท" ที่นี่เพื่อเปิดสิทธิ์การใช้งาน
          </span>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
            </div>
          ) : profiles.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">ยังไม่มีผู้ใช้งานในระบบ</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400">
                  <th className="px-5 py-3 font-medium">อีเมล</th>
                  <th className="px-5 py-3 font-medium">ชื่อ-สกุล</th>
                  <th className="px-5 py-3 font-medium">บทบาท</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const draft = getDraft(p);
                  const dirty = draft.full_name !== (p.full_name || "") || draft.role !== (p.role || "");
                  return (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 text-slate-600">
                        {p.email}
                        {p.id === currentUser?.id && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">คุณ</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <input
                          value={draft.full_name}
                          onChange={(e) => setDraft(p.id, { full_name: e.target.value })}
                          placeholder="ระบุชื่อ-สกุล"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-sm outline-none focus:border-[#2f8fdc] focus:bg-white"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={draft.role}
                          onChange={(e) => setDraft(p.id, { role: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-sm outline-none focus:border-[#2f8fdc] focus:bg-white"
                        >
                          <option value="">— ยังไม่กำหนด —</option>
                          {Object.values(ROLES).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          disabled={!dirty || savingId === p.id}
                          onClick={() => handleSave(p)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f8fdc] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2a7ec2] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {savingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          บันทึก
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
