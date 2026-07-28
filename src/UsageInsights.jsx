import { useMemo, useState } from "react";
import { TrendingUp, Building2, Pill, Loader2, AlertOctagon } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { useUsageStats } from "./useUsageStats";

const NAVY = "#0d2a63";

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// สีของแต่ละเส้นกราฟ — 5 สีหลัก + สีเทาสำหรับกลุ่ม "อื่นๆ" (ที่ไม่ติดท็อป 5)
const SERIES_COLORS = ["#0d2a63", "#16a34a", "#e2931a", "#7c5cf0", "#dc6b4f"];
const OTHERS_COLOR = "#94a3b8";
const OTHERS_KEY = "อื่นๆ";
const MAX_SERIES = 5;

// หาวันจันทร์ของสัปดาห์ที่ d อยู่ (ใช้เป็นจุดเริ่มต้นของแต่ละ bucket รายสัปดาห์)
function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = อาทิตย์ ... 6 = เสาร์
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function bucketOf(dateStr, granularity) {
  const d = new Date(dateStr);
  if (granularity === "month") {
    const y = d.getFullYear();
    const m = d.getMonth();
    return {
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: `${THAI_MONTHS_SHORT[m]} ${String((y + 543) % 100).padStart(2, "0")}`,
    };
  }
  const monday = startOfWeek(d);
  return {
    key: monday.toISOString().slice(0, 10),
    label: `${monday.getDate()}/${monday.getMonth() + 1}`,
  };
}

function ToggleGroup({ value, onChange, options }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            value === opt.value ? "bg-white text-[#0d2a63] shadow-sm" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TopFiveCard({ title, icon, items, unit = "หน่วย" }) {
  const max = items.length > 0 ? items[0].qty : 0;
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-bold text-slate-700">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">ยังไม่มีข้อมูลการจ่ายยาในช่วงนี้</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((it, idx) => (
            <div key={it.name} className="flex items-center gap-2.5">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                  idx === 0 ? "bg-[#fef6df] text-[#b7860b]" : "bg-white text-slate-400 border border-slate-200"
                }`}
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-bold text-slate-700">{it.name}</span>
                  <span className="shrink-0 text-xs font-black text-slate-600">
                    {it.qty.toLocaleString()} <span className="font-semibold text-slate-400">{unit}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[#0d2a63]"
                    style={{ width: `${max > 0 ? Math.max((it.qty / max) * 100, 4) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UsageInsights() {
  const { rows, loading, error } = useUsageStats();
  const [granularity, setGranularity] = useState("month"); // "month" | "week"
  const [groupBy, setGroupBy] = useState("drug"); // "drug" | "dept"

  const { chartData, seriesKeys } = useMemo(() => {
    if (rows.length === 0) return { chartData: [], seriesKeys: [] };

    // 1) รวมยอดตามชื่อ (ยา/หน่วยงาน) ทั้งหมด เพื่อหา top 5 ไว้ก่อน — ตัวที่เหลือจะถูกรวมเป็น "อื่นๆ"
    const totalsByName = new Map();
    rows.forEach((r) => {
      const name = groupBy === "drug" ? r.drugName : r.deptName;
      totalsByName.set(name, (totalsByName.get(name) || 0) + r.qty);
    });
    const topNames = [...totalsByName.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SERIES)
      .map(([name]) => name);
    const topSet = new Set(topNames);

    // 2) รวมยอดตาม bucket เวลา (สัปดาห์/เดือน) แยกตามชื่อ (หรือ "อื่นๆ" ถ้าไม่ติดท็อป 5)
    const buckets = new Map(); // key -> { label, sortKey, values: { [name]: qty } }
    rows.forEach((r) => {
      const { key, label } = bucketOf(r.createdAt, granularity);
      if (!buckets.has(key)) buckets.set(key, { label, sortKey: key, values: {} });
      const bucket = buckets.get(key);
      const name = groupBy === "drug" ? r.drugName : r.deptName;
      const seriesName = topSet.has(name) ? name : OTHERS_KEY;
      bucket.values[seriesName] = (bucket.values[seriesName] || 0) + r.qty;
    });

    const sortedBuckets = [...buckets.values()].sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1));
    const hasOthers = sortedBuckets.some((b) => b.values[OTHERS_KEY] != null);
    const keys = hasOthers ? [...topNames, OTHERS_KEY] : topNames;

    const data = sortedBuckets.map((b) => {
      const row = { label: b.label };
      keys.forEach((k) => {
        row[k] = b.values[k] || 0;
      });
      return row;
    });

    return { chartData: data, seriesKeys: keys };
  }, [rows, granularity, groupBy]);

  const topDrugs = useMemo(() => {
    const totals = new Map();
    rows.forEach((r) => totals.set(r.drugName, (totals.get(r.drugName) || 0) + r.qty));
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));
  }, [rows]);

  const topDepartments = useMemo(() => {
    const totals = new Map();
    rows.forEach((r) => totals.set(r.deptName, (totals.get(r.deptName) || 0) + r.qty));
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));
  }, [rows]);

  return (
    <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-5">
      {/* หัวข้อ + ตัวสลับมุมมอง */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0d2a63]/5 text-[#0d2a63]">
            <TrendingUp className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">แนวโน้มการใช้ยา</h2>
            <p className="text-xs font-semibold text-slate-400">อ้างอิงจากรายการจ่ายยาให้ผู้ป่วยย้อนหลัง 6 เดือน</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: "drug", label: "ต่อชนิดยา" },
              { value: "dept", label: "ต่อหน่วยงาน" },
            ]}
          />
          <ToggleGroup
            value={granularity}
            onChange={setGranularity}
            options={[
              { value: "week", label: "รายสัปดาห์" },
              { value: "month", label: "รายเดือน" },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-[260px] items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดข้อมูล...
        </div>
      ) : error ? (
        <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center text-slate-400">
          <AlertOctagon className="h-6 w-6 text-red-400" />
          <p className="text-xs font-semibold text-red-500">ดึงข้อมูลแนวโน้มการใช้ยาไม่สำเร็จ</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
          ยังไม่มีประวัติการจ่ายยาในช่วง 6 เดือนที่ผ่านมา
        </div>
      ) : (
        <>
          {chartData.length < 3 && (
            <p className="mb-2 text-center text-[11px] font-semibold text-slate-400">
              มีข้อมูลแค่ {chartData.length} {granularity === "month" ? "เดือน" : "สัปดาห์"} — แนวโน้มจะเห็นชัดขึ้นเมื่อสะสมข้อมูลมากขึ้น
            </p>
          )}
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 12, left: -12, bottom: 0 }} barCategoryGap={chartData.length <= 2 ? "35%" : "20%"} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: "Kanit", fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis tick={{ fontSize: 11, fontFamily: "Kanit", fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{ fontFamily: "Kanit", fontSize: 12, borderRadius: 12, border: "1px solid #eef1f6" }}
                  labelStyle={{ fontWeight: 700, color: NAVY }}
                />
                <Legend wrapperStyle={{ fontFamily: "Kanit", fontSize: 11 }} />
                {seriesKeys.map((key, idx) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={key === OTHERS_KEY ? OTHERS_COLOR : SERIES_COLORS[idx % SERIES_COLORS.length]}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={40}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Top 5 ยาที่ใช้บ่อยที่สุด / หน่วยงานที่เบิกบ่อยที่สุด */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <TopFiveCard
          title="ยาที่ใช้บ่อยที่สุด (Top 5)"
          icon={<Pill className="h-4 w-4 text-[#16a34a]" />}
          items={topDrugs}
        />
        <TopFiveCard
          title="หน่วยงานที่เบิกบ่อยที่สุด (Top 5)"
          icon={<Building2 className="h-4 w-4 text-[#e2931a]" />}
          items={topDepartments}
        />
      </div>
    </div>
  );
}
