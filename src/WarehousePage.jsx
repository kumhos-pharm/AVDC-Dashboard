import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Warehouse, Search, PackagePlus, Send, Loader2, Pencil, Trash2, X, XCircle, AlertTriangle, SquarePen, Undo2 } from "lucide-react";
import { useDrugsAndDepartments } from "./useDispense";
import { useWarehouseLots, receiveStock, transferStock, removeStockLot, updateLotDetails, updateMinMax, useWarehouseMinMax, returnLotToWarehouse } from "./useWarehouse";
import { findOrCreateDrug, updateDrug } from "./useDrugs";
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

// ---- ฟอร์มรับยาเข้าคลัง / แก้ไขรายการยา (ใช้ฟอร์มเดียวกัน สลับโหมดตาม editTarget) ----
function ReceiveForm({ drugs, warehouseDeptId, onReceived, editTarget, minMaxByName, onSavedEdit, onCancelEdit }) {
  const isEditing = !!editTarget;

  const [drugQuery, setDrugQuery] = useState("");
  const [drugId, setDrugId] = useState(null);
  const [strength, setStrength] = useState("");
  const [form, setForm] = useState("");
  const [lot, setLot] = useState("");
  const [qty, setQty] = useState("");
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [expDate, setExpDate] = useState("");
  const [staffName, setStaffName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // เติมข้อมูลลงฟอร์มเมื่อกด "แก้ไข" จากตาราง
  useEffect(() => {
    if (!editTarget) return;
    setDrugQuery(editTarget.drug_name || "");
    setDrugId(editTarget.drug_id ?? null);
    setStrength(editTarget.strength || "");
    setForm(editTarget.form || "");
    setLot(editTarget.lot || "");
    setQty(String(editTarget.quantity ?? ""));
    const mm = minMaxByName[editTarget.drug_name] || {};
    setMinQty(editTarget.min_qty ?? mm.min ?? "");
    setMaxQty(editTarget.max_qty ?? mm.max ?? "");
    setMfgDate(toDateInput(editTarget.mfg_date));
    setExpDate(toDateInput(editTarget.exp_date));
    setStaffName("");
    setMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget]);

  function resetForm() {
    setDrugQuery("");
    setDrugId(null);
    setStrength("");
    setForm("");
    setLot("");
    setQty("");
    setMinQty("");
    setMaxQty("");
    setMfgDate("");
    setExpDate("");
    setStaffName("");
  }

  const filteredDrugs = useMemo(() => {
    if (isEditing || !drugQuery.trim()) return [];
    return drugs.filter((d) => d.name.toLowerCase().includes(drugQuery.trim().toLowerCase())).slice(0, 8);
  }, [drugQuery, drugs, isEditing]);

  const isNewDrug = !isEditing && drugQuery.trim() && !drugs.some((d) => d.name.toLowerCase() === drugQuery.trim().toLowerCase());

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);
    if (!drugQuery.trim()) return setMessage({ type: "error", text: "กรุณาระบุชื่อยา" });
    const qtyNum = Number(qty);
    if (qtyNum < 0 || (!isEditing && qtyNum <= 0)) return setMessage({ type: "error", text: "กรุณาระบุจำนวนให้ถูกต้อง" });
    if (!lot.trim()) return setMessage({ type: "error", text: "กรุณาระบุเลข Lot" });

    setSaving(true);

    if (isEditing) {
      // 1) อัปเดตชื่อยา / ความแรง / รูปแบบยา (drug master)
      const { error: drugErr } = await updateDrug(editTarget.drug_id, {
        name: drugQuery.trim(),
        strength: strength.trim() || null,
        form: form.trim() || null,
      });
      if (drugErr) {
        setSaving(false);
        alertError(drugErr.message);
        return setMessage({ type: "error", text: drugErr.message });
      }

      // 2) อัปเดต Lot / จำนวน / วันผลิต / วันหมดอายุ
      const { error: lotErr } = await updateLotDetails({
        lotId: editTarget.id,
        drugId: editTarget.drug_id,
        departmentId: editTarget.department_id,
        oldLot: editTarget.lot,
        oldMfgDate: editTarget.mfg_date,
        oldExpDate: editTarget.exp_date,
        oldQty: editTarget.quantity,
        newLot: lot.trim(),
        newMfgDate: mfgDate || null,
        newExpDate: expDate || null,
        newQty: qtyNum,
        staffName: staffName || null,
      });
      if (lotErr) {
        setSaving(false);
        alertError(lotErr.message);
        return setMessage({ type: "error", text: lotErr.message });
      }

      // 3) อัปเดต Min / Max (ถ้ามีการกรอก)
      if (minQty !== "" || maxQty !== "") {
        const { error: mmErr } = await updateMinMax({
          departmentId: editTarget.department_id,
          drugId: editTarget.drug_id,
          min: minQty,
          max: maxQty,
        });
        if (mmErr) {
          setSaving(false);
          alertError(`บันทึก Min/Max ไม่สำเร็จ: ${mmErr.message}`);
          return setMessage({ type: "error", text: `บันทึก Min/Max ไม่สำเร็จ: ${mmErr.message}` });
        }
      }

      setSaving(false);
      alertSuccess(`บันทึกการแก้ไข ${drugQuery.trim()} เรียบร้อยแล้ว`);
      onSavedEdit?.();
      return;
    }

    // ---- โหมดรับยาเข้าคลัง (เพิ่มใหม่) ----
    const { id: resolvedDrugId, error: drugError } = await findOrCreateDrug({ name: drugQuery, strength, form });
    if (drugError || !resolvedDrugId) {
      setSaving(false);
      return setMessage({ type: "error", text: drugError?.message || "ไม่สามารถบันทึกชื่อยาได้" });
    }

    const { error } = await receiveStock({
      drug_id: resolvedDrugId,
      department_id: warehouseDeptId,
      change_qty: qtyNum,
      lot: lot.trim(),
      mfg_date: mfgDate || null,
      exp_date: expDate || null,
      staff_name: staffName || null,
    });

    if (minQty !== "" || maxQty !== "") {
      await updateMinMax({ departmentId: warehouseDeptId, drugId: resolvedDrugId, min: minQty, max: maxQty });
    }

    setSaving(false);
    if (error) {
      alertError(error.message);
      return setMessage({ type: "error", text: error.message });
    }

    alertSuccess(isNewDrug ? "เพิ่มยาใหม่และรับยาเข้าคลังเรียบร้อยแล้ว" : "รับยาเข้าคลังเรียบร้อยแล้ว");
    setMessage({ type: "success", text: isNewDrug ? "เพิ่มยาใหม่และรับยาเข้าคลังเรียบร้อย" : "รับยาเข้าคลังเรียบร้อย" });
    resetForm();
    onReceived?.();
  }

  const accent = isEditing ? "amber" : "emerald";

  return (
    <form
      onSubmit={handleSubmit}
      className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]"
    >
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${isEditing ? "from-amber-400 to-amber-600" : "from-emerald-400 to-emerald-600"}`} />
      <div className="mb-5 flex items-center justify-between">
        <h2 className={`flex items-center gap-2.5 text-lg font-bold ${isEditing ? "text-amber-600" : "text-emerald-600"}`}>
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isEditing ? "bg-amber-50" : "bg-emerald-50"}`}>
            {isEditing ? <SquarePen className="h-5 w-5" /> : <PackagePlus className="h-5 w-5" />}
          </span>
          {isEditing ? "แก้ไขรายการยา" : "รับยาเข้าคลังยา"}
        </h2>
        {isEditing && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              onCancelEdit?.();
            }}
            title="ยกเลิกการแก้ไข"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-red-50 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="relative col-span-2 md:col-span-4">
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">ชื่อยา</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={drugQuery}
              onChange={(e) => {
                setDrugQuery(e.target.value);
                if (!isEditing) {
                  setDrugId(null);
                  setStrength("");
                  setForm("");
                }
              }}
              placeholder="พิมพ์ชื่อยา..."
              className={`w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:bg-white focus:ring-4 ${isEditing ? "focus:border-amber-400 focus:ring-amber-50" : "focus:border-emerald-400 focus:ring-emerald-50"}`}
            />
          </div>
          {filteredDrugs.length > 0 && !drugId && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {filteredDrugs.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setDrugId(d.id);
                      setDrugQuery(d.name);
                      setStrength(d.strength || "");
                      setForm(d.form || "");
                    }}
                    className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-emerald-50"
                  >
                    {d.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {isNewDrug && (
            <p className="mt-1.5 text-xs font-medium text-amber-500">ยังไม่มียานี้ในระบบ — จะเพิ่มเป็นยาใหม่โดยอัตโนมัติเมื่อบันทึก</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">ความแรง</label>
          <input value={strength} onChange={(e) => setStrength(e.target.value)} placeholder="เช่น 500 mg" className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">รูปแบบยา</label>
          <select
            value={form}
            onChange={(e) => setForm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
          >
            <option value="">เลือกรูปแบบยา</option>
            <option value="ยาฉีด (Ampoule)">ยาฉีด (Ampoule)</option>
            <option value="ยาฉีด (Vial)">ยาฉีด (Vial)</option>
            <option value="ยาฉีด (Vial)">ยาฉีด (ถุง)</option>
            <option value="ซอง (Powder)">ซอง (Powder)</option>
            <option value="ขวด">ขวด</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">Lot Number</label>
          <input value={lot} onChange={(e) => setLot(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50" />
        </div>
        <div>
          <label className={`mb-1.5 block text-xs font-semibold ${isEditing ? "text-amber-600" : "text-emerald-600"}`}>
            {isEditing ? "จำนวนคงเหลือ *" : "จำนวนรับเข้า *"}
          </label>
          <input
            type="number"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className={`w-full rounded-xl border bg-opacity-30 px-3.5 py-2.5 text-sm outline-none transition focus:ring-4 ${isEditing ? "border-amber-300 bg-amber-50/30 focus:border-amber-500 focus:ring-amber-50" : "border-emerald-300 bg-emerald-50/30 focus:border-emerald-500 focus:ring-emerald-50"}`}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">Min</label>
          <input type="number" min="0" value={minQty} onChange={(e) => setMinQty(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">Max</label>
          <input type="number" min="0" value={maxQty} onChange={(e) => setMaxQty(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50" />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">วันผลิต</label>
          <input type="date" value={mfgDate} onChange={(e) => setMfgDate(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">วันหมดอายุ</label>
          <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50" />
        </div>

        <div className="col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">ผู้บันทึก</label>
          <StaffAutocomplete value={staffName} onChange={setStaffName} />
        </div>
      </div>

      {message && (
        <p className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ${message.type === "error" ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r py-3 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60 ${isEditing ? "from-amber-500 to-amber-600 shadow-amber-200 hover:from-amber-600 hover:to-amber-700" : "from-emerald-500 to-emerald-600 shadow-emerald-200 hover:from-emerald-600 hover:to-emerald-700"}`}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? <SquarePen className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
        {isEditing ? "บันทึกการแก้ไข" : "บันทึกรับยาเข้าคลัง"}
      </button>

      {isEditing && (
        <div className="mt-2.5 flex justify-center">
          <button
            type="button"
            onClick={() => {
              resetForm();
              onCancelEdit?.();
            }}
            className="flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-500 transition hover:border-red-200 hover:bg-red-100"
          >
            <XCircle className="h-4 w-4" /> ยกเลิกการแก้ไข
          </button>
        </div>
      )}
    </form>
  );
}

// ---- แถวเดียวของตาราง lot พร้อมปุ่ม เติมยา / แก้ไข / ลบ ----
function LotRow({ lot, departments, minMax, onDone, onEdit, editingKey }) {
  const [mode, setMode] = useState(null); // null | "transfer"
  const [toDept, setToDept] = useState("");
  const [qty, setQty] = useState("");
  const [staffName, setStaffName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState(null);

  const warehouseDept = departments.find((d) => d.name === "คลังยา");
  const isWarehouseView = !!warehouseDept && lot.department_id === warehouseDept.id;

  const rowKey = `${lot.drug_id}-${lot.lot}`;
  const isBeingEdited = editingKey === rowKey;

  async function handleTransfer() {
    setError(null);
    const qtyNum = Number(qty);
    if (!toDept) return setError("เลือกหน่วยงานปลายทาง");
    if (!qtyNum || qtyNum <= 0 || qtyNum > lot.quantity) return setError(`จำนวนต้องมากกว่า 0 และไม่เกิน ${lot.quantity}`);

    setSaving(true);
    const { error: err } = await transferStock({
      drugId: lot.drug_id,
      lot: lot.lot,
      fromDepartmentId: lot.department_id,
      toDepartmentId: Number(toDept),
      qty: qtyNum,
      mfgDate: lot.mfg_date,
      expDate: lot.exp_date,
      staffName,
    });
    setSaving(false);

    if (err) return setError(err.message);
    setMode(null);
    setQty("");
    setToDept("");
    alertSuccess(`เติมยา ${lot.drug_name} (Lot ${lot.lot}) จำนวน ${qtyNum} ให้หน่วยงานปลายทางเรียบร้อยแล้ว`);
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
      title: "ยืนยันลบรายการยา?",
      text: isWarehouseView
        ? `${lot.drug_name} (Lot ${lot.lot}) จะถูกลบออกจากคลังยาถาวร`
        : `${lot.drug_name} (Lot ${lot.lot}) จะถูกตัดออกจากระบบถาวร (ใช้กรณีใช้ยาไปแล้ว/หมดอายุ/ชำรุด) — ยอดจะไม่ถูกคืนไปที่คลังยา ถ้าต้องการคืนของ ให้ใช้ปุ่ม "คืนคลัง" แทน`,
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
      setError(err.message);
      alertError(err.message);
      return;
    }
    alertSuccess(`ลบ ${lot.drug_name} (Lot ${lot.lot}) ออกจากคลังยาเรียบร้อยแล้ว`);
    onDone?.();
  }

  const isExpiringSoon = lot.exp_date && new Date(lot.exp_date) - new Date() < 90 * 24 * 60 * 60 * 1000;
  const mm = minMax[lot.drug_name] || {};
  const min = lot.min_qty ?? mm.min ?? null;
  const max = lot.max_qty ?? mm.max ?? null;

  return (
    <>
      <tr className={`border-t border-slate-100 text-sm transition-colors hover:bg-slate-50/80 ${isBeingEdited ? "bg-amber-50/60" : ""}`}>
        <td className="p-3 font-semibold text-slate-700">{lot.drug_name}</td>
        <td className="p-3 text-slate-500">{lot.strength || "-"}</td>
        <td className="p-3 text-slate-500">{lot.form || "-"}</td>
        <td className="p-3 text-slate-500">{lot.lot}</td>
        <td className="p-3 text-center text-base font-bold" style={{ color: NAVY }}>{lot.quantity}</td>
        <td className="p-3 text-center text-slate-500">{min ?? "-"}</td>
        <td className="p-3 text-center text-slate-500">{max ?? "-"}</td>
        <td className="p-3 text-slate-500">{fmtDate(lot.mfg_date)}</td>
        <td className={`p-3 font-medium ${isExpiringSoon ? "text-red-500" : "text-slate-500"}`}>{fmtDate(lot.exp_date)}</td>
        <td className="p-3">
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => setMode(mode === "transfer" ? null : "transfer")}
              className="flex items-center gap-1 rounded-lg bg-[#2f8fdc] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2678bd]"
              title="เติมให้หน่วยงาน"
            >
              <Send className="h-3 w-3" /> เติมยา
            </button>
            <button
              onClick={() => onEdit?.(lot)}
              className={`flex items-center justify-center rounded-lg p-1.5 transition ${isBeingEdited ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-600 hover:bg-amber-100"}`}
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

      {mode === "transfer" && (
        <tr className="border-t border-slate-100 bg-blue-50/40">
          <td colSpan={10} className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">หน่วยงานปลายทาง</label>
                <select value={toDept} onChange={(e) => setToDept(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="">เลือกหน่วยงาน</option>
                  {departments.filter((d) => d.id !== lot.department_id).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">จำนวน (สูงสุด {lot.quantity})</label>
                <input type="number" min="1" max={lot.quantity} value={qty} onChange={(e) => setQty(e.target.value)} className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div className="min-w-[180px]">
                <label className="mb-1 block text-xs font-medium text-slate-500">ผู้บันทึก</label>
                <StaffAutocomplete value={staffName} onChange={setStaffName} />
              </div>
              <button onClick={handleTransfer} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} ยืนยันเติมยา
              </button>
              <button
                type="button"
                onClick={() => setMode(null)}
                className="flex items-center gap-1.5 rounded-lg bg-red-50 px-4 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-100"
              >
                <XCircle className="h-3.5 w-3.5" /> ยกเลิก
              </button>
            </div>
            {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
          </td>
        </tr>
      )}
      {error && mode !== "transfer" && (
        <tr className="border-t border-slate-100">
          <td colSpan={10} className="px-4 pb-2 pt-1 text-xs font-medium text-red-500">{error}</td>
        </tr>
      )}
    </>
  );
}

export default function WarehousePage() {
  const { drugs, departments } = useDrugsAndDepartments();
  const warehouseDept = departments.find((d) => d.name === "คลังยา");
  const [viewDeptId, setViewDeptId] = useState("");
  // ค่าจาก <select> เป็น string เสมอ ส่วน d.id ที่มาจากฐานข้อมูลเป็น number
  // ต้องแปลงให้เป็นชนิดเดียวกันก่อนเทียบ ไม่เช่นนั้นจะไม่ตรงกันเลยและ dropdown จะใช้งานไม่ได้
  const viewDept = departments.find((d) => String(d.id) === String(viewDeptId)) || warehouseDept;
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  // รองรับลิงก์ด่วนจากแดชบอร์ดหลัก: /admin/warehouse?q=<ชื่อยา>&dept=<id>
  // เพื่อให้คลิกจากยอดที่ต่ำกว่า Min แล้วพามาที่นี่พร้อมค้นหา/เลือกหน่วยงานให้เลยทันที
  useEffect(() => {
    const q = searchParams.get("q");
    const dept = searchParams.get("dept");
    if (q) setSearch(q);
    if (dept) setViewDeptId(dept);
    if (q || dept) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { rows, loading, reload } = useWarehouseLots(viewDept?.id, search);
  const { map: minMax, reload: reloadMinMax } = useWarehouseMinMax(viewDept?.name);
  const [editingLot, setEditingLot] = useState(null);

  function handleSavedEdit() {
    setEditingLot(null);
    reload();
    reloadMinMax();
  }

  return (
    <div className="min-h-screen w-full bg-[#eef1f6] p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-[1680px]">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: NAVY }}>
            <Warehouse className="h-5.5 w-5.5" />
          </span>
          <div>
            <h1 className="text-xl font-bold" style={{ color: NAVY }}>คลังยา</h1>
            <p className="text-xs text-slate-400">จัดการยาคงคลังของศูนย์ AVDC</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="w-full">
            <ReceiveForm
              drugs={drugs}
              warehouseDeptId={warehouseDept?.id}
              onReceived={() => {
                reload();
                reloadMinMax();
              }}
              editTarget={editingLot}
              minMaxByName={minMax}
              onSavedEdit={handleSavedEdit}
              onCancelEdit={() => setEditingLot(null)}
            />
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            <div className="border-b border-slate-100 p-6 pb-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2.5 text-lg font-bold" style={{ color: NAVY }}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                    <Warehouse className="h-5 w-5" style={{ color: NAVY }} />
                  </span>
                  รายการยาคงคลัง ({viewDept?.name || "เลือกหน่วยงาน"})
                </h2>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">ดูหน่วยงาน</label>
                  <select
                    value={viewDept?.id || ""}
                    onChange={(e) => setViewDeptId(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm font-medium outline-none focus:border-[#2f8fdc] focus:bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
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
              <table className="w-full min-w-[920px] border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="p-3 text-left font-semibold">ชื่อยา</th>
                    <th className="p-3 text-left font-semibold">ความแรง</th>
                    <th className="p-3 text-left font-semibold">รูปแบบยา</th>
                    <th className="p-3 text-left font-semibold">Lot No.</th>
                    <th className="p-3 text-center font-semibold">จำนวน</th>
                    <th className="p-3 text-center font-semibold">Min</th>
                    <th className="p-3 text-center font-semibold">Max</th>
                    <th className="p-3 text-left font-semibold">วันผลิต</th>
                    <th className="p-3 text-left font-semibold">วันหมดอายุ</th>
                    <th className="p-3 text-center font-semibold">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={10} className="p-8 text-center text-slate-400">กำลังโหลด...</td></tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={10} className="p-8 text-center text-slate-400">ยังไม่มียาในคลัง</td></tr>
                  )}
                  {rows.map((lot) => (
                    <LotRow
                      key={lot.id ?? `${lot.drug_id}-${lot.lot}`}
                      lot={lot}
                      departments={departments}
                      minMax={minMax}
                      onDone={() => {
                        if (editingLot && editingLot.drug_id === lot.drug_id && editingLot.lot === lot.lot) setEditingLot(null);
                        reload();
                      }}
                      onEdit={setEditingLot}
                      editingKey={editingLot ? `${editingLot.drug_id}-${editingLot.lot}` : null}
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
