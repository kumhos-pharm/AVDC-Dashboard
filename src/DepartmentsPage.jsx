import React, { useState } from "react";
import { Building2, Search, Pencil, Trash2, Check, X, Loader2, AlertTriangle, PackageSearch, Undo2 } from "lucide-react";
import { useDrugsAndDepartments } from "./useDispense";
import { useWarehouseLots, useWarehouseMinMax, updateLotDetails, updateMinMax, removeStockLot, returnLotToWarehouse } from "./useWarehouse";
import StaffAutocomplete from "./StaffAutocomplete";
import { alertSuccess, alertError, confirmAction } from "./alert";

const NAVY = "#0d2a63";

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH");
}

// input[type=date] ต้องการรูปแบบ yyyy-mm-dd
function toDateInput(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function StatusBadge({ qty, min, max }) {
  if (min == null && max == null) {
    return <span className="text-xs text-slate-300">ไม่กำหนด</span>;
  }
  if (min != null && qty < min) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
        <AlertTriangle className="h-3 w-3" /> ต่ำกว่า Min
      </span>
    );
  }
  if (max != null && qty > max) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-600">
        <AlertTriangle className="h-3 w-3" /> เกิน Max
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
      ปกติ
    </span>
  );
}

// ---- แถวเดียวของตารางยาในหน่วยงาน พร้อมโหมดแก้ไขแบบ inline, ปุ่มคืนคลัง และปุ่มลบ ----
function DeptLotRow({ lot, minMax, onDone, warehouseDept, isWarehouseView }) {
  const [editing, setEditing] = useState(false);
  const [lotNo, setLotNo] = useState(lot.lot || "");
  const [qty, setQty] = useState(String(lot.quantity ?? ""));
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [expDate, setExpDate] = useState("");
  const [staffName, setStaffName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState(null);

  const mm = minMax[lot.drug_name] || {};
  const min = lot.min_qty ?? mm.min ?? null;
  const max = lot.max_qty ?? mm.max ?? null;

  function startEdit() {
    setLotNo(lot.lot || "");
    setQty(String(lot.quantity ?? ""));
    setMinQty(min ?? "");
    setMaxQty(max ?? "");
    setMfgDate(toDateInput(lot.mfg_date));
    setExpDate(toDateInput(lot.exp_date));
    setStaffName("");
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setError(null);
    const qtyNum = Number(qty);
    if (qtyNum < 0 || Number.isNaN(qtyNum)) return setError("กรุณาระบุจำนวนให้ถูกต้อง");
    if (!lotNo.trim()) return setError("กรุณาระบุเลข Lot");

    setSaving(true);

    const { error: lotErr } = await updateLotDetails({
      drugId: lot.drug_id,
      departmentId: lot.department_id,
      oldLot: lot.lot,
      oldMfgDate: lot.mfg_date,
      oldExpDate: lot.exp_date,
      oldQty: lot.quantity,
      newLot: lotNo.trim(),
      newMfgDate: mfgDate || null,
      newExpDate: expDate || null,
      newQty: qtyNum,
      staffName: staffName || null,
    });
    if (lotErr) {
      setSaving(false);
      setError(lotErr.message);
      alertError(lotErr.message);
      return;
    }

    if (minQty !== "" || maxQty !== "") {
      const { error: mmErr } = await updateMinMax({
        departmentId: lot.department_id,
        drugId: lot.drug_id,
        min: minQty,
        max: maxQty,
      });
      if (mmErr) {
        setSaving(false);
        setError(`บันทึก Min/Max ไม่สำเร็จ: ${mmErr.message}`);
        alertError(mmErr.message, "บันทึก Min/Max ไม่สำเร็จ");
        return;
      }
    }

    setSaving(false);
    setEditing(false);
    alertSuccess(`บันทึกการแก้ไข ${lot.drug_name} เรียบร้อยแล้ว`);
    onDone?.();
  }

  async function handleReturn() {
    if (!warehouseDept?.id) {
      alertError("ไม่พบข้อมูลคลังยา ไม่สามารถคืนของได้");
      return;
    }
    const ok = await confirmAction({
      title: "คืนยาเข้าคลังยา?",
      text: `${lot.drug_name} (Lot ${lot.lot}) จำนวน ${lot.quantity} จะถูกโอนกลับไปที่ "คลังยา" (ใช้เมื่อเติมยาผิดหรือเกิน)`,
      confirmText: "คืนเลย",
    });
    if (!ok) return;
    setReturning(true);
    const { error: err } = await returnLotToWarehouse({
      drugId: lot.drug_id,
      lot: lot.lot,
      departmentId: lot.department_id,
      warehouseDepartmentId: warehouseDept.id,
      qty: lot.quantity,
      mfgDate: lot.mfg_date,
      expDate: lot.exp_date,
      staffName: null,
    });
    setReturning(false);
    if (err) {
      alertError(err.message);
      return;
    }
    alertSuccess(`คืน ${lot.drug_name} (Lot ${lot.lot}) จำนวน ${lot.quantity} เข้าคลังยาเรียบร้อยแล้ว`);
    onDone?.();
  }

  async function handleDelete() {
    const ok = await confirmAction({
      title: "ยืนยันลบรายการยานี้?",
      text: `${lot.drug_name} (Lot ${lot.lot}) จะถูกตัดออกจากระบบถาวร (ใช้กรณีใช้ยาไปแล้ว/หมดอายุ/ชำรุด) — ยอดจะไม่ถูกคืนไปที่คลังยา ถ้าต้องการคืนของ ให้ใช้ปุ่ม "คืนคลัง" แทน`,
      confirmText: "ลบเลย",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    const { error: err } = await removeStockLot({
      drugId: lot.drug_id,
      departmentId: lot.department_id,
      lot: lot.lot,
      mfgDate: lot.mfg_date,
      expDate: lot.exp_date,
      quantity: lot.quantity,
      staffName: null,
    });
    setDeleting(false);
    if (err) {
      alertError(err.message);
      return;
    }
    alertSuccess(`ลบ ${lot.drug_name} (Lot ${lot.lot}) ออกจากหน่วยงานเรียบร้อยแล้ว`);
    onDone?.();
  }

  const isExpiringSoon = lot.exp_date && new Date(lot.exp_date) - new Date() < 90 * 24 * 60 * 60 * 1000;

  if (editing) {
    return (
      <tr className="border-t border-slate-100 bg-amber-50/40 text-sm">
        <td colSpan={9} className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Lot No.</label>
              <input value={lotNo} onChange={(e) => setLotNo(e.target.value)} className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">จำนวน</label>
              <input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Min</label>
              <input type="number" min="0" value={minQty} onChange={(e) => setMinQty(e.target.value)} className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Max</label>
              <input type="number" min="0" value={maxQty} onChange={(e) => setMaxQty(e.target.value)} className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">วันผลิต</label>
              <input type="date" value={mfgDate} onChange={(e) => setMfgDate(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">วันหมดอายุ</label>
              <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="min-w-[180px]">
              <label className="mb-1 block text-xs font-medium text-slate-500">ผู้บันทึก</label>
              <StaffAutocomplete value={staffName} onChange={setStaffName} />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} บันทึก
            </button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-xs font-medium text-slate-400 underline">
              <X className="h-3.5 w-3.5" /> ยกเลิก
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100 text-sm transition-colors hover:bg-slate-50/80">
      <td className="p-3 font-semibold text-slate-700">{lot.drug_name}</td>
      <td className="p-3 text-slate-500">{lot.strength || "-"}</td>
      <td className="p-3 text-slate-500">{lot.form || "-"}</td>
      <td className="p-3 text-slate-500">{lot.lot}</td>
      <td className="p-3 text-center text-base font-bold" style={{ color: NAVY }}>{lot.quantity}</td>
      <td className="p-3 text-center">
        <StatusBadge qty={lot.quantity} min={min} max={max} />
      </td>
      <td className="p-3 text-slate-500">{fmtDate(lot.mfg_date)}</td>
      <td className={`p-3 font-medium ${isExpiringSoon ? "text-red-500" : "text-slate-500"}`}>{fmtDate(lot.exp_date)}</td>
      <td className="p-3">
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={startEdit}
            className="flex items-center justify-center rounded-lg bg-amber-50 p-1.5 text-amber-600 transition hover:bg-amber-100"
            title="แก้ไขรายการยา"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {!isWarehouseView && (
            <button
              onClick={handleReturn}
              disabled={returning}
              className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1.5 text-[11px] font-semibold text-[#2f8fdc] transition hover:bg-blue-100 disabled:opacity-50"
              title="คืนยาเข้าคลังยา"
            >
              {returning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} คืนคลัง
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center justify-center rounded-lg bg-red-50 p-1.5 text-red-500 transition hover:bg-red-100 disabled:opacity-50"
            title="ลบ (ตัดจำหน่ายถาวร)"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function DepartmentsPage() {
  const { departments } = useDrugsAndDepartments();
  const warehouseDept = departments.find((d) => d.name === "คลังยา");
  const [activeDeptId, setActiveDeptId] = useState(null);
  const activeDept = departments.find((d) => String(d.id) === String(activeDeptId)) || departments[0];
  const isWarehouseView = !!activeDept && !!warehouseDept && activeDept.id === warehouseDept.id;
  const [search, setSearch] = useState("");

  const { rows, loading, reload } = useWarehouseLots(activeDept?.id, search);
  const { map: minMax, reload: reloadMinMax } = useWarehouseMinMax(activeDept?.name);

  function handleDone() {
    reload();
    reloadMinMax();
  }

  return (
    <div className="min-h-screen w-full bg-[#eef1f6] p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-[1680px]">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: NAVY }}>
            <Building2 className="h-5.5 w-5.5" />
          </span>
          <div>
            <h1 className="text-xl font-bold" style={{ color: NAVY }}>หน่วยงาน</h1>
            <p className="text-xs text-slate-400">ดูรายการยาที่แต่ละหน่วยงานได้รับ พร้อมแก้ไข/ลบได้</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[260px_1fr]">
          {/* รายชื่อหน่วยงาน */}
          <div className="xl:sticky xl:top-6 xl:self-start">
            <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
              <div className="border-b border-slate-100 p-4">
                <h2 className="text-sm font-bold" style={{ color: NAVY }}>รายชื่อหน่วยงาน</h2>
              </div>
              <div className="flex flex-col gap-1 p-2">
                {departments.length === 0 && (
                  <p className="p-3 text-center text-xs text-slate-400">ไม่พบข้อมูลหน่วยงาน</p>
                )}
                {departments.map((d) => {
                  const active = activeDept?.id === d.id;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setActiveDeptId(d.id)}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                        active ? "bg-[#0d2a63] text-white" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Building2 className={`h-4 w-4 ${active ? "text-white" : "text-slate-400"}`} />
                      {d.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* รายการยาของหน่วยงานที่เลือก */}
          <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            <div className="border-b border-slate-100 p-6 pb-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2.5 text-lg font-bold" style={{ color: NAVY }}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                    <PackageSearch className="h-5 w-5" style={{ color: NAVY }} />
                  </span>
                  รายการยาที่ได้รับ ({activeDept?.name || "เลือกหน่วยงาน"})
                </h2>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาชื่อยา หรือ Lot..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#2f8fdc] focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="p-3 text-left font-semibold">ชื่อยา</th>
                    <th className="p-3 text-left font-semibold">ความแรง</th>
                    <th className="p-3 text-left font-semibold">รูปแบบยา</th>
                    <th className="p-3 text-left font-semibold">Lot No.</th>
                    <th className="p-3 text-center font-semibold">จำนวน</th>
                    <th className="p-3 text-center font-semibold">สถานะ</th>
                    <th className="p-3 text-left font-semibold">วันผลิต</th>
                    <th className="p-3 text-left font-semibold">วันหมดอายุ</th>
                    <th className="p-3 text-center font-semibold">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={9} className="p-8 text-center text-slate-400">กำลังโหลด...</td></tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={9} className="p-8 text-center text-slate-400">หน่วยงานนี้ยังไม่มียาที่ได้รับ</td></tr>
                  )}
                  {rows.map((lot) => (
                    <DeptLotRow
                      key={lot.id ?? `${lot.drug_id}-${lot.lot}`}
                      lot={lot}
                      minMax={minMax}
                      onDone={handleDone}
                      warehouseDept={warehouseDept}
                      isWarehouseView={isWarehouseView}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
