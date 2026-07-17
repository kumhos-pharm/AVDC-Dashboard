import Swal from "sweetalert2";

const NAVY = "#0d2a63";

// แจ้งเตือนสำเร็จ (auto-close) — ใช้ตอนบันทึก/แก้ไข/ลบ/เติมยา เสร็จ
export function alertSuccess(text, title = "สำเร็จ") {
  return Swal.fire({
    icon: "success",
    title,
    text,
    confirmButtonColor: NAVY,
    timer: 2000,
    timerProgressBar: true,
    showConfirmButton: false,
  });
}

// แจ้งเตือนข้อผิดพลาด
export function alertError(text, title = "เกิดข้อผิดพลาด") {
  return Swal.fire({
    icon: "error",
    title,
    text,
    confirmButtonColor: NAVY,
  });
}

// กล่องยืนยันก่อนทำรายการ (เช่น ลบ) — คืนค่า true ถ้าผู้ใช้กด "ยืนยัน"
export async function confirmAction({
  title = "ยืนยันการทำรายการ?",
  text = "",
  confirmText = "ยืนยัน",
  cancelText = "ยกเลิก",
  danger = false,
} = {}) {
  const result = await Swal.fire({
    icon: "warning",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: danger ? "#dc2626" : NAVY,
    cancelButtonColor: "#94a3b8",
    reverseButtons: true,
  });
  return result.isConfirmed;
}
