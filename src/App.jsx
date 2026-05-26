import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  CalendarDays,
  Activity,
  TrendingUp,
  Trash2,
  PlusCircle,
  Building2,
  CalendarClock,
  Filter,
  Check,
} from "lucide-react";

// ==========================================
// 🚀 Firebase 金鑰配置
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyC-NBub5GWvKxUuEfWPpzdeI-M0VPFkHCw",
  authDomain: "wishvision-predict-system.firebaseapp.com",
  projectId: "wishvision-predict-system",
  storageBucket: "wishvision-predict-system.firebasestorage.app",
  messagingSenderId: "1037730294811",
  appId: "1:1037730294811:web:14b566956c826d04d81cbe",
  measurementId: "G-TD83NHWXW7",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const DB_COLLECTION_NAME = "wishvision_stats";

const BRANCHES = ["台北館前院", "台北仁愛院", "台中東興院", "新竹光明院"];
const BRANCH_COLORS = {
  台北館前院: "#3b82f6",
  台北仁愛院: "#ec4899",
  台中東興院: "#10b981",
  新竹光明院: "#f59e0b",
};

const METRICS = [
  { id: "currentC", label: "本月諮詢", color: "#3b82f6" },
  { id: "nextC", label: "下月諮詢", color: "#8b5cf6" },
  { id: "currentS", label: "本月手術", color: "#10b981" },
  { id: "nextS", label: "下月手術", color: "#06b6d4" },
];

export default function App() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [branch, setBranch] = useState(BRANCHES[0]);
  const [currentC, setCurrentC] = useState("");
  const [currentS, setCurrentS] = useState("");
  const [nextC, setNextC] = useState("");
  const [nextS, setNextS] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedObsMonth, setSelectedObsMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [selectedBranches, setSelectedBranches] = useState(BRANCHES);
  const [selectedMetrics, setSelectedMetrics] = useState([
    "currentC",
    "nextC",
    "currentS",
    "nextS",
  ]);
  const [viewMode, setViewMode] = useState("aggregate");

  const dateObj = new Date(date);
  const currMonthLabel = `${dateObj.getMonth() + 1}月`;
  const nextMonthDate = new Date(
    dateObj.getFullYear(),
    dateObj.getMonth() + 1,
    1
  );
  const nextMonthLabel = `${nextMonthDate.getMonth() + 1}月`;

  useEffect(() => {
    const collectionRef = collection(db, DB_COLLECTION_NAME);
    const unsubscribeData = onSnapshot(
      collectionRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRecords(data);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore error:", err);
        setError("無法讀取資料，請確認資料庫權限設定為測試模式。");
        setLoading(false);
      }
    );
    return () => unsubscribeData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !date ||
      !branch ||
      currentC === "" ||
      currentS === "" ||
      nextC === "" ||
      nextS === ""
    ) {
      alert("請填寫完整資訊，若無數據請填 0");
      return;
    }
    setIsSubmitting(true);
    try {
      const docId = `${date}_${branch}`;
      const docRef = doc(db, DB_COLLECTION_NAME, docId);
      await setDoc(docRef, {
        date,
        branch,
        currentMonth: date.slice(0, 7),
        nextMonth: nextMonthDate.toISOString().slice(0, 7),
        currentC: Number(currentC),
        currentS: Number(currentS),
        nextC: Number(nextC),
        nextS: Number(nextS),
        timestamp: new Date().getTime(),
      });
      setCurrentC("");
      setCurrentS("");
      setNextC("");
      setNextS("");
    } catch (err) {
      alert("新增失敗，請檢查資料庫權限");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("確定要刪除這筆資料嗎？")) return;
    try {
      await deleteDoc(doc(db, DB_COLLECTION_NAME, id));
    } catch (err) {
      alert("刪除失敗");
    }
  };

  const toggleBranch = (b) => {
    if (selectedBranches.includes(b)) {
      if (selectedBranches.length > 1)
        setSelectedBranches(selectedBranches.filter((x) => x !== b));
    } else {
      setSelectedBranches([...selectedBranches, b]);
    }
  };

  const toggleMetric = (m) => {
    if (selectedMetrics.includes(m)) {
      if (selectedMetrics.length > 1)
        setSelectedMetrics(selectedMetrics.filter((x) => x !== m));
    } else {
      setSelectedMetrics([...selectedMetrics, m]);
    }
  };

  const processedData = useMemo(() => {
    const monthRecords = records.filter((r) =>
      r.date.startsWith(selectedObsMonth)
    );
    const sortedRecords = [...monthRecords].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
    const uniqueDates = [...new Set(sortedRecords.map((r) => r.date))].sort();
    const chartDataAggregate = [];
    const chartDataCompare = [];
    const branchLatest = {};

    uniqueDates.forEach((dateStr) => {
      const recordsForDate = sortedRecords.filter((r) => r.date === dateStr);
      recordsForDate.forEach((r) => {
        branchLatest[r.branch] = r;
      });
      let aggRow = {
        date: dateStr,
        currentC: 0,
        currentS: 0,
        nextC: 0,
        nextS: 0,
      };
      let compRow = { date: dateStr };
      selectedBranches.forEach((b) => {
        const bData = branchLatest[b];
        if (bData) {
          aggRow.currentC += bData.currentC || 0;
          aggRow.currentS += bData.currentS || 0;
          aggRow.nextC += bData.nextC || 0;
          aggRow.nextS += bData.nextS || 0;
          compRow[`${b}_currentC`] = bData.currentC || 0;
          compRow[`${b}_currentS`] = bData.currentS || 0;
          compRow[`${b}_nextC`] = bData.nextC || 0;
          compRow[`${b}_nextS`] = bData.nextS || 0;
        }
      });
      chartDataAggregate.push(aggRow);
      chartDataCompare.push(compRow);
    });

    const lastData = chartDataAggregate[chartDataAggregate.length - 1];
    let stats = {
      currentC: lastData?.currentC || 0,
      currentS: lastData?.currentS || 0,
      nextC: lastData?.nextC || 0,
      nextS: lastData?.nextS || 0,
      paceCC: "---",
      paceCS: "---",
      paceNC: "---",
      paceNS: "---",
      estCC: lastData?.currentC || 0,
      estCS: lastData?.currentS || 0,
      estNC: lastData?.nextC || 0,
      estNS: lastData?.nextS || 0,
      hasEnoughData: false,
      latestDate: uniqueDates[uniqueDates.length - 1] || "",
    };

    const targetYear = parseInt(selectedObsMonth.split("-")[0]);
    const targetMonthNum = parseInt(selectedObsMonth.split("-")[1]);
    const targetEndDate = new Date(targetYear, targetMonthNum, 0);

    if (chartDataAggregate.length > 1) {
      stats.hasEnoughData = true;
      const firstData = chartDataAggregate[0];
      const elapsedDays = Math.round(
        (new Date(lastData.date) - new Date(firstData.date)) /
          (1000 * 60 * 60 * 24)
      );
      if (elapsedDays > 0) {
        const pCC = (lastData.currentC - firstData.currentC) / elapsedDays;
        const pCS = (lastData.currentS - firstData.currentS) / elapsedDays;
        const pNC = (lastData.nextC - firstData.nextC) / elapsedDays;
        const pNS = (lastData.nextS - firstData.nextS) / elapsedDays;
        stats.paceCC = pCC > 0 ? `+${pCC.toFixed(1)}` : pCC.toFixed(1);
        stats.paceCS = pCS > 0 ? `+${pCS.toFixed(1)}` : pCS.toFixed(1);
        stats.paceNC = pNC > 0 ? `+${pNC.toFixed(1)}` : pNC.toFixed(1);
        stats.paceNS = pNS > 0 ? `+${pNS.toFixed(1)}` : pNS.toFixed(1);
        const daysRemaining = Math.max(
          0,
          Math.round(
            (targetEndDate - new Date(lastData.date)) / (1000 * 60 * 60 * 24)
          )
        );
        stats.estCC = Math.max(
          stats.currentC,
          Math.round(stats.currentC + pCC * daysRemaining)
        );
        stats.estCS = Math.max(
          stats.currentS,
          Math.round(stats.currentS + pCS * daysRemaining)
        );
        stats.estNC = Math.max(
          stats.nextC,
          Math.round(stats.nextC + pNC * daysRemaining)
        );
        stats.estNS = Math.max(
          stats.nextS,
          Math.round(stats.nextS + pNS * daysRemaining)
        );
      }
    }
    const filteredRecordsForTable = [...monthRecords]
      .filter((r) => selectedBranches.includes(r.branch))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return {
      filteredRecords: filteredRecordsForTable,
      chartDataAggregate,
      chartDataCompare,
      stats,
    };
  }, [records, selectedObsMonth, selectedBranches]);

  const renderChartLines = () => {
    if (viewMode === "aggregate") {
      return (
        <>
          {selectedMetrics.includes("currentC") && (
            <Line
              type="monotone"
              name="本月諮詢(加總)"
              dataKey="currentC"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
            />
          )}
          {selectedMetrics.includes("nextC") && (
            <Line
              type="monotone"
              name="下月諮詢(加總)"
              dataKey="nextC"
              stroke="#8b5cf6"
              strokeWidth={2.5}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
            />
          )}
          {selectedMetrics.includes("currentS") && (
            <Line
              type="monotone"
              name="本月手術(加總)"
              dataKey="currentS"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
            />
          )}
          {selectedMetrics.includes("nextS") && (
            <Line
              type="monotone"
              name="下月手術(加總)"
              dataKey="nextS"
              stroke="#06b6d4"
              strokeWidth={2.5}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
            />
          )}
        </>
      );
    } else {
      return selectedBranches.flatMap((branch) => {
        const lines = [];
        const color = BRANCH_COLORS[branch] || "#94a3b8";
        if (selectedMetrics.includes("currentC"))
          lines.push(
            <Line
              key={`${branch}_currentC`}
              type="monotone"
              dataKey={`${branch}_currentC`}
              name={`${branch} 本月諮詢`}
              stroke={color}
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          );
        if (selectedMetrics.includes("nextC"))
          lines.push(
            <Line
              key={`${branch}_nextC`}
              type="monotone"
              dataKey={`${branch}_nextC`}
              name={`${branch} 下月諮詢`}
              stroke={color}
              strokeWidth={2.5}
              strokeDasharray="5 5"
              dot={{ r: 4 }}
            />
          );
        if (selectedMetrics.includes("currentS"))
          lines.push(
            <Line
              key={`${branch}_currentS`}
              type="monotone"
              dataKey={`${branch}_currentS`}
              name={`${branch} 本月手術`}
              stroke={color}
              strokeWidth={3}
              dot={{ r: 4, shape: "triangle" }}
              activeDot={{ r: 6 }}
            />
          );
        if (selectedMetrics.includes("nextS"))
          lines.push(
            <Line
              key={`${branch}_nextS`}
              type="monotone"
              dataKey={`${branch}_nextS`}
              name={`${branch} 下月手術`}
              stroke={color}
              strokeWidth={2.5}
              strokeDasharray="5 5"
              dot={{ r: 4, shape: "triangle" }}
            />
          );
        return lines;
      });
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center text-blue-600 font-semibold text-lg">
        正在連接系統...
      </div>
    );
  if (error)
    return (
      <div className="flex h-screen items-center justify-center text-red-500 font-semibold text-lg">
        {error}
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <CalendarClock className="text-blue-600" />
              WishVision 業績動能觀測台
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              各分院本月與下月預約儲備對比系統
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-3 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 h-fit">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-blue-500" /> 新增紀錄
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  觀察日期
                </label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-9 pr-2 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  分院
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full pl-9 pr-2 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl space-y-2">
                <h3 className="font-bold text-blue-800 flex justify-between items-center text-xs border-b border-blue-200/50 pb-1.5">
                  <span>當月累積指標</span>
                  <span className="bg-blue-200/50 text-blue-700 px-1.5 py-0.5 rounded">
                    {currMonthLabel}
                  </span>
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      諮詢量
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={currentC}
                      onChange={(e) => setCurrentC(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      手術量
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={currentS}
                      onChange={(e) => setCurrentS(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl space-y-2">
                <h3 className="font-bold text-indigo-800 flex justify-between items-center text-xs border-b border-indigo-200/50 pb-1.5">
                  <span>下月預約儲備</span>
                  <span className="bg-indigo-200/50 text-indigo-700 px-1.5 py-0.5 rounded">
                    {nextMonthLabel}
                  </span>
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      預約諮詢
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={nextC}
                      onChange={(e) => setNextC(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      預約手術
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={nextS}
                      onChange={(e) => setNextS(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 rounded-xl transition-colors text-sm disabled:opacity-50"
              >
                {isSubmitting ? "儲存中..." : "儲存紀錄"}
              </button>
            </form>
          </div>
          <div className="xl:col-span-9 space-y-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 rounded-lg p-1">
                    <input
                      type="month"
                      value={selectedObsMonth}
                      onChange={(e) => setSelectedObsMonth(e.target.value)}
                      className="px-2 py-1 bg-transparent text-slate-700 text-sm font-bold focus:outline-none cursor-pointer"
                    />
                  </div>
                  <div className="text-xs text-slate-400">
                    最後更新：{processedData.stats.latestDate || "無"}
                  </div>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode("aggregate")}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                      viewMode === "aggregate"
                        ? "bg-white shadow text-blue-600"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    合併加總模式
                  </button>
                  <button
                    onClick={() => setViewMode("compare")}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                      viewMode === "compare"
                        ? "bg-white shadow text-blue-600"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    分開對比模式
                  </button>
                </div>
              </div>
              <hr className="border-slate-100" />
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> 分院篩選
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BRANCHES.map((b) => {
                      const isSelected = selectedBranches.includes(b);
                      return (
                        <button
                          key={b}
                          onClick={() => toggleBranch(b)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            isSelected
                              ? "bg-slate-800 text-white border-slate-800"
                              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />} {b}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> 圖表指標
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {METRICS.map((m) => {
                      const isSelected = selectedMetrics.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleMetric(m.id)}
                          style={{
                            borderColor: isSelected ? m.color : "#e2e8f0",
                            backgroundColor: isSelected ? m.color : "white",
                            color: isSelected ? "white" : "#64748b",
                          }}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover:opacity-90`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}{" "}
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-blue-600 px-4 py-2 flex justify-between items-center">
                  <h3 className="text-white text-sm font-bold">
                    諮詢量動能 (加總)
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4 divide-x divide-slate-100">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">本月累積</div>
                    <div className="text-2xl font-bold text-slate-800 mb-2">
                      {processedData.stats.currentC}
                    </div>
                  </div>
                  <div className="pl-4">
                    <div className="text-xs text-slate-500 mb-1">下月預約</div>
                    <div className="text-2xl font-bold text-slate-800 mb-2">
                      {processedData.stats.nextC}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-emerald-600 px-4 py-2 flex justify-between items-center">
                  <h3 className="text-white text-sm font-bold">
                    手術量動能 (加總)
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4 divide-x divide-slate-100">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">本月累積</div>
                    <div className="text-2xl font-bold text-slate-800 mb-2">
                      {processedData.stats.currentS}
                    </div>
                  </div>
                  <div className="pl-4">
                    <div className="text-xs text-slate-500 mb-1">下月預約</div>
                    <div className="text-2xl font-bold text-slate-800 mb-2">
                      {processedData.stats.nextS}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-800" />
                  趨勢圖表
                </h3>
              </div>
              {processedData.chartDataAggregate.length > 0 ? (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={
                        viewMode === "aggregate"
                          ? processedData.chartDataAggregate
                          : processedData.chartDataCompare
                      }
                      margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(tick) => tick.substring(5)}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "none",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ paddingTop: "20px", fontSize: "12px" }}
                      />
                      {renderChartLines()}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-sm">
                  尚無數據
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
