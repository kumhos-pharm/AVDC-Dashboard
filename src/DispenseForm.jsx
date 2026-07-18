import React, { useState, useEffect } from "react";
import { Save, Info, X } from "lucide-react";
import Swal from "sweetalert2";
import { supabase } from "./supabaseClient"; // ปรับ path ตามโครงสร้างจริงของคุณ
import { updateDispense } from "./useDispense";

// ตั้งค่าธีมสีของ SweetAlert ให้เข้ากับฟอนต์/โทนสีของระบบ
const swalBase = {
  confirmButtonColor: "#007bff",
  cancelButtonColor: "#94a3b8",
  customClass: { popup: "font-['Kanit']" },
};

// props:
// - onSaved: เรียกหลังบันทึกสำเร็จ (ทั้งกรณีจ่ายยาใหม่ และแก้ไขรายการเดิม)
// - editingRow: แถวจาก "ประวัติบันทึกล่าสุด" ที่กำลังแก้ไขอยู่ (null = โหมดจ่ายยาใหม่ตามปกติ)
// - onCancelEdit: เรียกเมื่อผู้ใช้กดยกเลิกการแก้ไข หรือบันทึกการแก้ไขสำเร็จแล้ว
export default function DispenseForm({ onSaved, editingRow, onCancelEdit }) {
  const isEditMode = !!editingRow;
  const [formData, setFormData] = useState({
    prefix: "",
    patientName: "",
    hn: "",
    dispenseDate: "2026-07-16",
    dispenseTime: "22:14",
    staff: "",
    searchDrug: "",
    drugId: "",
    lotRowId: "",       // = drug_lots.id (มาจาก v_dispensable_lots.lot_row_id) ใช้ตัดสต็อกล็อตนี้เท่านั้น
    strength: "",
    drugType: "",        // = form (รูปแบบยา)
    unit: "",
    lotNumber: "",
    quantity: "",
    mfgDate: "",          // แสดงผล (พ.ศ.)
    expDate: "",          // แสดงผล (พ.ศ.)
    mfgDateRaw: "",        // ค่าจริงไว้บันทึกลง DB
    expDateRaw: "",
    maxQuantity: undefined,
  });

  // หน่วยงานที่จ่าย (ต้องเลือกก่อน เพราะสต็อก/ล็อตที่ค้นหาได้ผูกกับหน่วยงานนี้)
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState([]);

  // เภสัชกร/เจ้าหน้าที่ผู้จ่าย (ค้นหาแบบ autocomplete จากตาราง staff)
  const [staffList, setStaffList] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [staffHighlightIndex, setStaffHighlightIndex] = useState(-1);

  // รายการยาที่จ่ายได้ (จาก view v_dispensable_lots)
  const [drugList, setDrugList] = useState([]);
  const [filteredDrugs, setFilteredDrugs] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [drugHighlightIndex, setDrugHighlightIndex] = useState(-1);
  const [drugFetchError, setDrugFetchError] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchStaff();
  }, []);

  // เมื่อผู้ใช้กด "แก้ไข" จากประวัติ ให้ดึงข้อมูลรายการนั้นมาแสดงในฟอร์มนี้แทนการเปิด popup
  // เติมค่าตั้งต้นจากรายการเดิม แต่ผู้ใช้แก้ไขได้ทุกช่อง รวมถึงหน่วยงาน/รายการยา/ล็อตด้วย
  useEffect(() => {
    if (!editingRow) return;
    setDepartmentId(editingRow.department_id || "");
    setFormData((prev) => ({
      ...prev,
      prefix: editingRow.patient_prefix || "",
      patientName: editingRow.patient_name || "",
      hn: editingRow.patient_hn || "",
      staff: editingRow.staff_name || "",
      searchDrug: editingRow.drug_name || "",
      drugId: editingRow.drug_id || "",
      lotRowId: "",
      strength: editingRow.strength || "",
      drugType: editingRow.drug_form || editingRow.form || "",
      unit: editingRow.unit || "",
      lotNumber: editingRow.lot || "",
      quantity: String(Math.abs(editingRow.change_qty ?? 0)),
      mfgDate: formatDate(editingRow.mfg_date),
      expDate: formatDate(editingRow.exp_date),
      mfgDateRaw: editingRow.mfg_date || "",
      expDateRaw: editingRow.exp_date || "",
      maxQuantity: undefined,
    }));
    setShowDropdown(false);
    setShowStaffDropdown(false);
  }, [editingRow]);

  // เมื่อเลือกหน่วยงานแล้ว ค่อยดึงรายการยาที่จ่ายได้ของหน่วยงานนั้น (เรียงหมดอายุก่อน - FIFO)
  useEffect(() => {
    if (departmentId) {
      fetchDrugs(departmentId);
    } else {
      setDrugList([]);
      setFilteredDrugs([]);
    }
  }, [departmentId]);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error("Error fetching departments:", error.message);
    }
  };

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setStaffList(data || []);
    } catch (error) {
      console.error("Error fetching staff:", error.message);
    }
  };

  // ดึงรายการยาที่จ่ายได้ของหน่วยงานนี้ จาก view v_dispensable_lots
  // (view รวมชื่อยา + ล็อต + สต็อกให้แล้ว) เรียงหมดอายุก่อน (FIFO)
  const fetchDrugs = async (deptId) => {
    setDrugFetchError("");
    try {
      const { data, error } = await supabase
        .from("v_dispensable_lots")
        .select("*")
        .eq("department_id", deptId)
        .gt("quantity", 0)
        .order("exp_date", { ascending: true });

      if (error) throw error;
      setDrugList(data || []);
    } catch (error) {
      console.error("Error fetching drugs:", error.message);
      setDrugList([]);
      setDrugFetchError("ไม่สามารถดึงรายการยาได้: " + error.message);
    }
  };

  const handleDepartmentChange = (e) => {
    setDepartmentId(e.target.value);
    // เปลี่ยนหน่วยงานแล้ว ต้องล้างยาที่เคยเลือกไว้ เพราะสต็อก/ล็อตผูกกับหน่วยงานเดิม
    setFormData((prev) => ({
      ...prev,
      searchDrug: "",
      drugId: "",
      lotRowId: "",
      strength: "",
      drugType: "",
      unit: "",
      lotNumber: "",
      mfgDate: "",
      expDate: "",
      mfgDateRaw: "",
      expDateRaw: "",
      maxQuantity: undefined,
    }));
    setFilteredDrugs([]);
    setShowDropdown(false);
  };

  const handleSearchStaffChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, staff: value }));
    setStaffHighlightIndex(-1);

    if (value.trim() === "") {
      setFilteredStaff([]);
      setShowStaffDropdown(false);
      return;
    }

    const filtered = staffList.filter((s) =>
      s.name.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredStaff(filtered);
    setShowStaffDropdown(true);
  };

  const handleSelectStaff = (staffMember) => {
    setFormData((prev) => ({ ...prev, staff: staffMember.name }));
    setShowStaffDropdown(false);
    setStaffHighlightIndex(-1);
  };

  // เลื่อนเลือกรายชื่อผู้จ่ายด้วยลูกศร ขึ้น/ลง และยืนยันด้วย Enter
  const handleStaffKeyDown = (e) => {
    if (!showStaffDropdown || filteredStaff.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setStaffHighlightIndex((prev) => (prev + 1) % filteredStaff.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setStaffHighlightIndex((prev) => (prev - 1 + filteredStaff.length) % filteredStaff.length);
    } else if (e.key === "Enter") {
      if (staffHighlightIndex >= 0 && staffHighlightIndex < filteredStaff.length) {
        e.preventDefault();
        handleSelectStaff(filteredStaff[staffHighlightIndex]);
      }
    } else if (e.key === "Escape") {
      setShowStaffDropdown(false);
    }
  };

  const handleSearchDrugChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, searchDrug: value }));
    setDrugHighlightIndex(-1);

    if (value.trim() === "") {
      setFilteredDrugs([]);
      setShowDropdown(false);
      return;
    }

    const filtered = drugList.filter((drug) =>
      drug.drug_name.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredDrugs(filtered);
    setShowDropdown(true);
  };

  const handleSelectDrug = (drug) => {
    setFormData((prev) => ({
      ...prev,
      searchDrug: drug.drug_name,
      drugId: drug.drug_id,
      lotRowId: drug.lot_row_id,
      strength: drug.strength || "",
      drugType: drug.form || "",
      unit: drug.unit || "",
      lotNumber: drug.lot || "",
      mfgDate: formatDate(drug.mfg_date),
      expDate: formatDate(drug.exp_date),
      mfgDateRaw: drug.mfg_date || "",
      expDateRaw: drug.exp_date || "",
      maxQuantity: drug.quantity,
    }));
    setShowDropdown(false);
    setDrugHighlightIndex(-1);
  };

  // เลื่อนเลือกรายการยาด้วยลูกศร ขึ้น/ลง และยืนยันด้วย Enter
  const handleDrugKeyDown = (e) => {
    if (!showDropdown || filteredDrugs.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDrugHighlightIndex((prev) => (prev + 1) % filteredDrugs.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDrugHighlightIndex((prev) => (prev - 1 + filteredDrugs.length) % filteredDrugs.length);
    } else if (e.key === "Enter") {
      if (drugHighlightIndex >= 0 && drugHighlightIndex < filteredDrugs.length) {
        e.preventDefault();
        handleSelectDrug(filteredDrugs[drugHighlightIndex]);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${parseInt(year) + 543}`; // แสดงเป็น พ.ศ. ตามดีไซน์
  };

  // ล็อตที่ยังไม่มีเลข Lot จริง หรือไม่มีวันหมดอายุ (เช่นค่าเริ่มต้น "INITIAL" ตอนตั้งระบบ)
  // ถือว่าข้อมูลยังไม่สมบูรณ์ ควรเตือนก่อนจ่ายยา
  const isLotDataIncomplete =
    !!formData.drugId &&
    (!formData.lotNumber ||
      formData.lotNumber.trim().toUpperCase() === "INITIAL" ||
      !formData.expDateRaw);

  const resetForm = () => {
    setFormData({
      prefix: "",
      patientName: "",
      hn: "",
      dispenseDate: "2026-07-16",
      dispenseTime: "22:14",
      staff: "",
      searchDrug: "",
      drugId: "",
      lotRowId: "",
      strength: "",
      drugType: "",
      unit: "",
      lotNumber: "",
      quantity: "",
      mfgDate: "",
      expDate: "",
      mfgDateRaw: "",
      expDateRaw: "",
      maxQuantity: undefined,
    });
  };

  const handleCancelEdit = () => {
    resetForm();
    if (onCancelEdit) onCancelEdit();
  };

  // URL ของ Google Apps Script (Web App) เดิมที่มีบอทไลน์ + Token/Group ID ตั้งค่าไว้อยู่แล้ว
  const GAS_NOTIFY_URL =
    "https://script.google.com/macros/s/AKfycbyeSchVefRGqtLUtl-y0-daEKnmBziowBUynloUMIcqkk0zBviu7_JhuNolPaQ-AuESew/exec";

  // ส่งข้อความแจ้งเตือนเข้ากลุ่มไลน์ผ่าน Apps Script เดิม (ไม่บล็อกการบันทึก ถ้าส่งไม่สำเร็จแค่ log error ไว้เฉยๆ)
  // ใช้ mode: "no-cors" เพราะ Apps Script Web App ไม่ส่ง Access-Control-Allow-Origin กลับมา
  // ทำให้เบราว์เซอร์บล็อกการอ่าน response (แม้คำขอจะไปถึงเซิร์ฟเวอร์และทำงานจริงก็ตาม)
  // ข้อแลกเปลี่ยน: จะอ่านผลลัพธ์สำเร็จ/ไม่สำเร็จจริงจากฝั่ง React ไม่ได้อีกต่อไป (response กลายเป็น opaque)
  // แต่ไม่กระทบอะไร เพราะจุดประสงค์คือแค่ให้ข้อความไปถึงกลุ่มไลน์เท่านั้น
  const notifyLine = async (text) => {
    try {
      await fetch(GAS_NOTIFY_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ message: text }),
      });
    } catch (err) {
      console.error("แจ้งเตือนเข้า LINE ไม่สำเร็จ:", err.message);
    }
  };

  // สร้างข้อความสรุปรายการจ่ายยา สำหรับส่งเข้ากลุ่มไลน์ (รูปแบบเดียวกับระบบเดิม)
  const buildDispenseMessage = (qty, remainingStock) => {
    const lines = [
      "📢 บันทึกจ่ายยาใหม่! 💊",
      "------------------------------",
      `👤 ผู้ป่วย: ${formData.prefix}${formData.patientName || "-"}`,
      `🆔 HN: ${formData.hn || "-"}`,
      "------------------------------",
      "รายการยา:",
      `🔹 ${formData.searchDrug || "-"}${formData.strength ? ` (${formData.strength})` : ""}`,
      `📦 รูปแบบ: ${formData.drugType || "-"}`,
      `🔢 จำนวนจ่าย: ${qty} ${formData.unit || ""}`,
    ];
    if (remainingStock !== undefined && remainingStock !== null) {
      lines.push(`📦 คงเหลือในคลัง: ${remainingStock} ${formData.unit || ""}`);
    }
    lines.push(
      `🏷️ Lot: ${formData.lotNumber || "-"}`,
      `📅 EXP: ${formData.expDate || "-"}`,
      "------------------------------",
      `👤 ผู้บันทึก: ${formData.staff || "-"}`
    );
    return lines.join("\n");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // โหมดแก้ไขรายการเดิม (มาจากการกดปุ่มแก้ไขในประวัติ) — แก้ไขได้ทั้งยา/ล็อต/หน่วยงาน/ผู้ป่วย/จำนวน/ผู้จ่าย
    // บันทึกผ่าน updateDispense (insert รายการใหม่ตามข้อมูลล่าสุดในฟอร์ม + ลบรายการเดิม)
    if (isEditMode) {
      if (
        !departmentId ||
        !formData.patientName ||
        !formData.hn ||
        !formData.staff ||
        !formData.drugId ||
        !formData.quantity
      ) {
        alert("กรุณากรอกข้อมูลสำคัญให้ครบถ้วน (หน่วยงาน, ผู้ป่วย, HN, ผู้จ่าย, รายการยา, จำนวน)");
        return;
      }

      const editQty = parseInt(formData.quantity);
      if (editQty <= 0) {
        alert("จำนวนที่จ่ายต้องมากกว่า 0");
        return;
      }

      // เช็คสต็อกคงเหลือเฉพาะกรณีที่เลือกล็อตใหม่ (มี maxQuantity จากล็อตที่เพิ่งเลือก)
      // ถ้าไม่ได้เปลี่ยนยา/ล็อตเลย (ยังเป็นค่าจากรายการเดิม) จะไม่มี maxQuantity ให้เช็ค เหมือนพฤติกรรมเดิม
      if (formData.maxQuantity !== undefined && editQty > formData.maxQuantity) {
        alert(`ยอดสต็อกไม่พอจ่าย (คงเหลือ: ${formData.maxQuantity})`);
        return;
      }

      const confirmResult = await Swal.fire({
        ...swalBase,
        icon: "question",
        title: "ยืนยันการแก้ไขรายการนี้?",
        text: "ระบบจะบันทึกรายการใหม่แทนรายการเดิม และปรับยอดสต็อกให้อัตโนมัติ",
        showCancelButton: true,
        confirmButtonText: "บันทึกการแก้ไข",
        cancelButtonText: "ยกเลิก",
        reverseButtons: true,
      });
      if (!confirmResult.isConfirmed) return;

      setLoading(true);

      const payload = {
        drug_id: formData.drugId,
        department_id: departmentId,
        lot: formData.lotNumber,
        lot_row_id: formData.lotRowId || editingRow.lot_row_id || null,
        mfg_date: formData.mfgDateRaw || null,
        exp_date: formData.expDateRaw || null,
        note: editingRow.note,
        change_qty: -editQty,
        patient_prefix: formData.prefix,
        patient_name: formData.patientName,
        patient_hn: formData.hn,
        staff_name: formData.staff,
      };

      const { error } = await updateDispense(editingRow.id, payload);
      setLoading(false);

      if (error) {
        Swal.fire({ ...swalBase, icon: "error", title: "แก้ไขไม่สำเร็จ", text: error.message });
        return;
      }

      Swal.fire({ ...swalBase, icon: "success", title: "แก้ไขรายการแล้ว", timer: 1500, showConfirmButton: false });
      notifyLine(`✏️ แก้ไขรายการ\n${buildDispenseMessage(editQty)}`);
      resetForm();
      if (onCancelEdit) onCancelEdit();
      if (onSaved) onSaved();
      return;
    }

    if (
      !departmentId ||
      !formData.patientName ||
      !formData.hn ||
      !formData.staff ||
      !formData.lotRowId ||
      !formData.quantity
    ) {
      alert("กรุณากรอกข้อมูลสำคัญให้ครบถ้วน (หน่วยงาน, ผู้ป่วย, HN, ผู้จ่าย, รายการยา, จำนวน)");
      return;
    }

    const dispenseQty = parseInt(formData.quantity);
    if (dispenseQty <= 0) {
      alert("จำนวนที่จ่ายต้องมากกว่า 0");
      return;
    }

    if (dispenseQty > formData.maxQuantity) {
      alert(`ยอดสต็อกไม่พอจ่าย (คงเหลือ: ${formData.maxQuantity})`);
      return;
    }

    setLoading(true);

    try {
      // 1. บันทึกประวัติการจ่ายยาลง stock_movements (change_qty ติดลบ = จ่ายออก)
      const { error: insertError } = await supabase
        .from("stock_movements")
        .insert([
          {
            drug_id: formData.drugId,
            department_id: departmentId,
            change_qty: -dispenseQty,
            reason: "dispense",
            note: null,
            staff_name: formData.staff,
            lot: formData.lotNumber,
            lot_row_id: formData.lotRowId,
            mfg_date: formData.mfgDateRaw || null,
            exp_date: formData.expDateRaw || null,
            patient_prefix: formData.prefix,
            patient_name: formData.patientName,
            patient_hn: formData.hn,
          },
        ]);

      if (insertError) throw insertError;

      // 2. หักยอดสต็อกของ "ล็อตนี้" ในตาราง drug_lots (ไม่ใช่ drugs)
      const newQuantity = formData.maxQuantity - dispenseQty;
      const { error: updateError } = await supabase
        .from("drug_lots")
        .update({ quantity: newQuantity })
        .eq("id", formData.lotRowId);

      if (updateError) throw updateError;

      Swal.fire({ ...swalBase, icon: "success", title: "บันทึกสำเร็จ", text: "บันทึกข้อมูลและตัดสต็อกเรียบร้อยแล้ว", timer: 1500, showConfirmButton: false });
      notifyLine(buildDispenseMessage(dispenseQty, newQuantity));

      resetForm();
      fetchDrugs(departmentId);
      if (onSaved) onSaved();

    } catch (error) {
      console.error("Error dispensing drug:", error.message);
      alert("ล้มเหลว: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-[#007bff]/40 bg-white p-6 md:p-7 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] font-['Kanit'] w-full max-w-xl mx-auto relative min-h-[700px] flex flex-col justify-between">
      
      <form onSubmit={handleSubmit} className="space-y-4 flex-grow">
        
        {/* หัวข้อฟอร์ม */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1 text-[#007bff]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#0056b3]">บันทึกการจ่ายยา</h2>
        </div>

        {/* แถบแจ้งว่ากำลังแก้ไขรายการเดิม (แทนที่ popup) */}
        {isEditMode && (
          <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>
              ✏️ กำลังแก้ไขรายการ: <strong>{formData.searchDrug || "-"}</strong>
              {formData.strength ? ` (${formData.strength})` : ""}
            </span>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="flex items-center gap-1 font-bold text-amber-700 hover:text-amber-900"
            >
              <X className="h-3.5 w-3.5" /> ยกเลิก
            </button>
          </div>
        )}

        {/* หน่วยงานที่จ่าย ต้องเลือกก่อน เพราะสต็อก/ล็อตที่ค้นหาได้ผูกกับหน่วยงานนี้ */}
        <div>
          <label className="mb-1 block text-sm font-bold text-[#2f8fdc]">หน่วยงานที่จ่าย *</label>
          <select
            value={departmentId}
            onChange={handleDepartmentChange}
            required
            className="w-full rounded-lg border border-[#2f8fdc] px-3 py-2 text-sm h-11 focus:outline-none focus:ring-2 focus:ring-[#2f8fdc]"
          >
            <option value="">เลือกหน่วยงาน</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}{d.is_home ? " (หน่วยงานหลัก)" : ""}
              </option>
            ))}
          </select>
          {!departmentId && (
            <p className="mt-1 text-[12px] text-red-500">กรุณาเลือกหน่วยงานก่อนค้นหารายการยา</p>
          )}
        </div>

        {/* แถวที่ 1: คำนำหน้า, ชื่อ-นามสกุล, HN */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-3">
            <label className="block text-sm font-bold text-slate-800 mb-1">คำนำหน้า</label>
            <select 
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#007bff] focus:outline-none focus:ring-2 focus:ring-[#007bff] h-11"
              value={formData.prefix}
              onChange={(e) => setFormData({...formData, prefix: e.target.value})}
            >
              <option value="">เลือก</option>
              <option value="นาย">นาย</option>
              <option value="นาง">นาง</option>
              <option value="น.ส.">น.ส.</option>
              <option value="พระ">พระ</option>
            </select>
          </div>
          <div className="col-span-5">
            <label className="block text-sm font-bold text-slate-800 mb-1">ชื่อ-นามสกุล ผู้ป่วย</label>
            <input 
              type="text" 
              placeholder="ระบุชื่อผู้ป่วย"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#007bff] focus:outline-none focus:ring-2 focus:ring-[#007bff] h-11"
              value={formData.patientName}
              onChange={(e) => setFormData({...formData, patientName: e.target.value})}
            />
          </div>
          <div className="col-span-4">
            <label className="block text-sm font-bold text-slate-800 mb-1">HN</label>
            <input 
              type="text" 
              placeholder="เลข HN"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#007bff] focus:outline-none focus:ring-2 focus:ring-[#007bff] h-11"
              value={formData.hn}
              onChange={(e) => setFormData({...formData, hn: e.target.value})}
            />
          </div>
        </div>

        {/* แถวที่ 2: วันที่จ่าย, เวลา */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">วันที่จ่าย</label>
            <input 
              type="date" 
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#007bff] focus:outline-none focus:ring-2 focus:ring-[#007bff] h-11"
              value={formData.dispenseDate}
              onChange={(e) => setFormData({...formData, dispenseDate: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">เวลา</label>
            <input 
              type="time" 
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#007bff] focus:outline-none focus:ring-2 focus:ring-[#007bff] h-11"
              value={formData.dispenseTime}
              onChange={(e) => setFormData({...formData, dispenseTime: e.target.value})}
            />
          </div>
        </div>

        {/* แถวที่ 3: เจ้าหน้าที่ผู้จ่าย (ค้นหาแบบ autocomplete จากตาราง staff) */}
        <div className="relative">
          <label className="block text-sm font-bold text-slate-800 mb-1">เภสัชกร/เจ้าหน้าที่ผู้จ่าย</label>
          <input 
            type="text" 
            placeholder="พิมพ์หรือใช้ลูกศร ↑↓ เพื่อเลือกชื่อผู้บันทึก"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#007bff] focus:outline-none focus:ring-2 focus:ring-[#007bff] h-11"
            value={formData.staff}
            onChange={handleSearchStaffChange}
            onKeyDown={handleStaffKeyDown}
            onFocus={() => { if (formData.staff) setShowStaffDropdown(true); }}
            onBlur={() => setTimeout(() => setShowStaffDropdown(false), 150)}
          />

          {showStaffDropdown && filteredStaff.length > 0 && (
            <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-md">
              {filteredStaff.map((s, idx) => (
                <div
                  key={s.id}
                  onMouseDown={() => handleSelectStaff(s)}
                  onMouseEnter={() => setStaffHighlightIndex(idx)}
                  className={`px-3 py-2 cursor-pointer text-sm border-b border-slate-50 ${
                    idx === staffHighlightIndex ? "bg-blue-50" : "hover:bg-blue-50"
                  }`}
                >
                  <strong className="text-slate-800">{s.name}</strong>
                  {s.role && (
                    <span className="text-[12px] text-slate-500 ml-2">({s.role})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* แถวที่ 4: ค้นหายา (จาก v_dispensable_lots) */}
        <div className="relative">
          <label className="block text-sm font-bold text-slate-800 mb-1">
            ค้นหารายการยา <span className="text-red-500 font-normal">*เรียงตามหมดอายุก่อน</span>
          </label>
          <input 
            type="text" 
            placeholder={departmentId ? "พิมพ์ชื่อยา หรือใช้ลูกศร ↑↓ เพื่อเลือก..." : "กรุณาเลือกหน่วยงานก่อน"}
            disabled={!departmentId}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#007bff] focus:outline-none focus:ring-2 focus:ring-[#007bff] h-11 disabled:bg-slate-50 disabled:cursor-not-allowed"
            value={formData.searchDrug}
            onChange={handleSearchDrugChange}
            onKeyDown={handleDrugKeyDown}
            onFocus={() => { if (formData.searchDrug) setShowDropdown(true); }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          />
          {drugFetchError && (
            <p className="mt-1 text-[12px] text-amber-600">{drugFetchError}</p>
          )}
          {isLotDataIncomplete && (
            <p className="mt-1 text-[12px] text-red-500 font-medium">
              ⚠ ล็อตนี้ยังไม่มีเลข Lot / วันหมดอายุที่สมบูรณ์ในระบบ กรุณาไปแก้ไขข้อมูลที่หน้า "คลังยา" ก่อนจ่ายยาจริง
            </p>
          )}

          {showDropdown && filteredDrugs.length > 0 && (
            <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-md">
              {filteredDrugs.map((drug, idx) => (
                <div
                  key={drug.lot_row_id}
                  onMouseDown={() => handleSelectDrug(drug)}
                  onMouseEnter={() => setDrugHighlightIndex(idx)}
                  className={`px-3 py-2 cursor-pointer text-sm border-b border-slate-50 leading-relaxed ${
                    idx === drugHighlightIndex ? "bg-blue-50" : "hover:bg-blue-50"
                  }`}
                >
                  <span className="text-emerald-600 font-bold">[คงเหลือ: {drug.quantity} {drug.unit || "หน่วย"}]</span>
                  {" "}
                  <span className="text-slate-800">{drug.drug_name}</span>
                  {drug.strength && <span className="text-slate-500"> ({drug.strength})</span>}
                  {" | "}
                  <span className="text-slate-600">Lot: {drug.lot}</span>
                  {" | "}
                  <span className="text-red-500">Exp: {drug.exp_date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* แถวที่ 5: ความแรง, รูปแบบยา */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">ความแรง</label>
            <input 
              type="text" 
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed outline-none h-11"
              value={formData.strength}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">รูปแบบยา</label>
            <input 
              type="text" 
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed outline-none h-11"
              value={formData.drugType}
            />
          </div>
        </div>

        {/* แถวที่ 6: Lot Number และ จำนวนที่จ่าย */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">Lot Number</label>
            <input 
              type="text" 
              readOnly
              className={`w-full rounded-lg border px-3 py-2 text-sm cursor-not-allowed outline-none h-11 ${
                isLotDataIncomplete
                  ? "border-red-300 bg-red-50 text-red-500"
                  : "border-slate-200 bg-slate-50/50 text-slate-500"
              }`}
              value={formData.lotNumber}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#007bff] mb-1">
              จำนวนที่จ่าย{formData.unit ? ` (${formData.unit})` : ""}
            </label>
            <input 
              type="number" 
              required
              min="1"
              max={formData.maxQuantity || undefined}
              className="w-full rounded-lg border-2 border-[#007bff] px-3 py-2 text-base font-bold text-[#007bff] focus:outline-none h-11"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
            />
          </div>
        </div>

        {/* แถวที่ 7: วันผลิต, วันหมดอายุ */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">วันผลิต</label>
            <input 
              type="text" 
              placeholder="วว/ดด/ปปปป"
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-400 cursor-not-allowed outline-none h-11"
              value={formData.mfgDate}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">วันหมดอายุ</label>
            <input 
              type="text" 
              placeholder="วว/ดด/ปปปป"
              readOnly
              className={`w-full rounded-lg border px-3 py-2 text-sm cursor-not-allowed outline-none h-11 ${
                isLotDataIncomplete
                  ? "border-red-300 bg-red-50 text-red-500"
                  : "border-slate-200 bg-slate-50/50 text-slate-400"
              }`}
              value={formData.expDate}
            />
          </div>
        </div>

        {/* ปุ่มบันทึกข้อมูลและตัดสต็อก */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#007bff] py-3 text-base font-bold text-white shadow-sm hover:bg-[#0069d9] active:scale-[0.99] transition-all disabled:opacity-50 h-12"
        >
          <Save className="h-5 w-5" /> {loading ? "กำลังบันทึก..." : "บันทึกข้อมูลและตัดสต็อก"}
        </button>

      </form>

      {/* ไอคอนข้อมูล (i) ที่มุมซ้ายล่าง */}
      <div className="absolute left-2.5 bottom-2.5 text-slate-400 hover:text-slate-600 cursor-pointer">
        <Info className="h-4 w-4" />
      </div>

    </div>
  );
}
