import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Calendar,
  Building2,
  TrendingUp,
  BarChart2,
  PlusCircle,
  CheckCircle,
  RefreshCw,
  Activity,
  Zap,
  Star,
  Table,
} from "lucide-react";

// 您專屬的 WishVision Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyC-NBub5GWvKxUuEfWPzdeI-M0VPFkHCw",
  authDomain: "wishvision-predict-system.firebaseapp.com",
  projectId: "wishvision-predict-system",
  storageBucket: "wishvision-predict-system.firebasestorage.app",
  messagingSenderId: "1037730294811",
  appId: "1:1037730294811:web:14b566956c826d04d81cbe",
  measurementId: "G-TD83NHWXW7",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BRANCHES = ["台北館前院", "台北仁愛院", "台中東興院", "新竹光明院"];
const METRICS = [
  { key: "currentC", label: "本月諮詢", color: "#2563eb" },
  { key: "nextC", label: "下月諮詢", color: "#7c3aed" },
  { key: "currentS", label: "本月手術", color: "#16a34a" },
  { key: "nextS", label: "下月手術", color: "#06b6d4" },
];

export default function App() {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    branch: BRANCHES[0],
    currentC: "",
    currentS: "",
    nextC: "",
    nextS: "",
    reviews: "",
  });

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [selectedBranches, setSelectedBranches] = useState(BRANCHES);
  const [selectedMetrics, setSelectedMetrics] = useState([
    "currentC",
    "nextC",
    "currentS",
    "nextS",
  ]);
  const [dbData, setDbData] = useState([]);
  const [uiStatus, setUiStatus] = useState({
    loading: false,
    msg: "",
    type: "",
  });
  const [viewMode, setViewMode] = useState("aggregate");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "wishvision_stats"),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDbData(data);
      },
      (error) => {
        console.error("Firestore 監聽失敗:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBranchToggle = (branch) => {
    if (selectedBranches.includes(branch)) {
      if (selectedBranches.length > 1) {
        setSelectedBranches(selectedBranches.filter((b) => b !== branch));
      }
    } else {
      setSelectedBranches([...selectedBranches, branch]);
    }
  };

  const handleMetricToggle = (metricKey) => {
    if (selectedMetrics.includes(metricKey)) {
      if (selectedMetrics.length > 1) {
        setSelectedMetrics(selectedMetrics.filter((m) => m !== metricKey));
      }
    } else {
      setSelectedMetrics([...selectedMetrics, metricKey]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUiStatus({ loading: true, msg: "正在儲存紀錄...", type: "info" });

    const { date, branch, currentC, currentS, nextC, nextS, reviews } =
      formData;
    if (!currentC || !currentS || !nextC || !nextS) {
      setUiStatus({ loading: false, msg: "請填寫業績數據欄位", type: "error" });
      return;
    }

    const docId = `${date}_${branch}`;
    try {
      await setDoc(doc(db, "wishvision_stats", docId), {
        date: date,
        branch: branch,
        month: date.slice(0, 7),
        day: parseInt(date.split("-")[2], 10),
        currentC: parseInt(currentC, 10),
        currentS: parseInt(currentS, 10),
        nextC: parseInt(nextC, 10),
        nextS: parseInt(nextS, 10),
        reviews: reviews ? parseInt(reviews, 10) : 0,
        timestamp: Date.now(),
      });
      setUiStatus({ loading: false, msg: "紀錄儲存成功！", type: "success" });
      setFormData((prev) => ({
        ...prev,
        currentC: "",
        currentS: "",
        nextC: "",
        nextS: "",
      }));
      setTimeout(
        () => setUiStatus({ loading: false, msg: "", type: "" }),
        3000
      );
    } catch (err) {
      setUiStatus({
        loading: false,
        msg: `儲存失敗: ${err.message}`,
        type: "error",
      });
    }
  };

  const {
    chartData,
    summaryMetrics,
    branchStats,
    dailyRecords,
    latestUpdateStr,
  } = useMemo(() => {
    const filtered = dbData.filter((d) => {
      const docMonth = d.month || (d.date ? d.date.slice(0, 7) : "");
      return docMonth === selectedMonth;
    });

    const uniqueDates = Array.from(new Set(filtered.map((d) => d.date))).sort();
    const [year, month] = selectedMonth.split("-").map(Number);
    const totalDaysInMonth = new Date(year, month, 0).getDate();

    let chartDataAggregate = [];
    let branchLatest = {};

    BRANCHES.forEach((b) => {
      branchLatest[b] = {
        currentC: 0,
        currentS: 0,
        nextC: 0,
        nextS: 0,
        reviews: 0,
        day: 0,
      };
    });

    uniqueDates.forEach((dateStr) => {
      let aggRow = {
        date: dateStr.slice(5),
        currentC: 0,
        currentS: 0,
        nextC: 0,
        nextS: 0,
        reviews: 0,
      };

      BRANCHES.forEach((b) => {
        const bData = filtered.filter(
          (d) => d.date === dateStr && d.branch === b
        );
        if (bData.length > 0) {
          const latestDayDoc = bData.sort(
            (a, b) => b.timestamp - a.timestamp
          )[0];
          branchLatest[b] = latestDayDoc;
        }

        const activeData = branchLatest[b];
        if (activeData && selectedBranches.includes(b)) {
          aggRow.currentC += activeData.currentC || 0;
          aggRow.currentS += activeData.currentS || 0;
          aggRow.nextC += activeData.nextC || 0;
          aggRow.nextS += activeData.nextS || 0;
          aggRow.reviews += activeData.reviews || 0;

          // 儲存分支數據供對比模式使用
          aggRow[`${b}_currentC`] = activeData.currentC || 0;
          aggRow[`${b}_currentS`] = activeData.currentS || 0;
          aggRow[`${b}_nextC`] = activeData.nextC || 0;
          aggRow[`${b}_nextS`] = activeData.nextS || 0;
          aggRow[`${b}_reviews`] = activeData.reviews || 0;
        }
      });
      chartDataAggregate.push(aggRow);
    });

    let totalCurrentC = 0,
      totalCurrentS = 0,
      totalNextC = 0,
      totalNextS = 0;
    let baseCurrentC = 0,
      baseCurrentS = 0,
      baseNextC = 0,
      baseNextS = 0;
    let minDay = null;
    let maxDay = null;
    let computedBranchStats = [];

    BRANCHES.forEach((b) => {
      const bDataAsc = filtered
        .filter((d) => d.branch === b)
        .sort((a, b) => {
          const dayA =
            a.day || (a.date ? parseInt(a.date.split("-")[2], 10) : 0);
          const dayB =
            b.day || (b.date ? parseInt(b.date.split("-")[2], 10) : 0);
          return dayA - dayB || a.timestamp - b.timestamp;
        });

      if (bDataAsc.length > 0) {
        const firstDoc = bDataAsc[0];
        const lastDoc = bDataAsc[bDataAsc.length - 1];
        const fDay =
          firstDoc.day ||
          (firstDoc.date ? parseInt(firstDoc.date.split("-")[2], 10) : 1);
        const lDay =
          lastDoc.day ||
          (lastDoc.date ? parseInt(lastDoc.date.split("-")[2], 10) : 1);
        const bDaysDiff = lDay - fDay;

        computedBranchStats.push({
          branch: b,
          avgC:
            bDaysDiff > 0
              ? ((lastDoc.currentC - firstDoc.currentC) / bDaysDiff).toFixed(1)
              : "0.0",
          avgS:
            bDaysDiff > 0
              ? ((lastDoc.currentS - firstDoc.currentS) / bDaysDiff).toFixed(1)
              : "0.0",
          currentC: lastDoc.currentC || 0,
          nextC: lastDoc.nextC || 0,
          currentS: lastDoc.currentS || 0,
          nextS: lastDoc.nextS || 0,
          reviews: lastDoc.reviews || 0,
          isFiltered: selectedBranches.includes(b),
        });

        if (selectedBranches.includes(b)) {
          baseCurrentC += firstDoc.currentC || 0;
          baseCurrentS += firstDoc.currentS || 0;
          baseNextC += firstDoc.nextC || 0;
          baseNextS += firstDoc.nextS || 0;
          totalCurrentC += lastDoc.currentC || 0;
          totalCurrentS += lastDoc.currentS || 0;
          totalNextC += lastDoc.nextC || 0;
          totalNextS += lastDoc.nextS || 0;
          if (minDay === null || fDay < minDay) minDay = fDay;
          if (maxDay === null || lDay > maxDay) maxDay = lDay;
        }
      } else {
        computedBranchStats.push({
          branch: b,
          avgC: "0.0",
          avgS: "0.0",
          currentC: 0,
          nextC: 0,
          currentS: 0,
          nextS: 0,
          reviews: 0,
          isFiltered: selectedBranches.includes(b),
        });
      }
    });

    const dailyMap = {};
    filtered.forEach((d) => {
      if (selectedBranches.includes(d.branch)) {
        const key = `${d.date}_${d.branch}`;
        if (!dailyMap[key] || d.timestamp > dailyMap[key].timestamp)
          dailyMap[key] = d;
      }
    });
    const computedDailyRecords = Object.values(dailyMap).sort(
      (a, b) => b.date.localeCompare(a.date) || a.branch.localeCompare(b.branch)
    );

    const daysDiff = maxDay !== null && minDay !== null ? maxDay - minDay : 0;
    const remainingDays = maxDay !== null ? totalDaysInMonth - maxDay : 0;

    let fcC = totalCurrentC,
      fcS = totalCurrentS,
      fcNC = totalNextC,
      fcNS = totalNextS;
    if (daysDiff > 0) {
      fcC = Math.round(
        totalCurrentC +
          ((totalCurrentC - baseCurrentC) / daysDiff) * remainingDays
      );
      fcS = Math.round(
        totalCurrentS +
          ((totalCurrentS - baseCurrentS) / daysDiff) * remainingDays
      );
      fcNC = Math.round(
        totalNextC + ((totalNextC - baseNextC) / daysDiff) * remainingDays
      );
      fcNS = Math.round(
        totalNextS + ((totalNextS - baseNextS) / daysDiff) * remainingDays
      );
    }

    let latestTs = 0;
    filtered.forEach((d) => {
      if (d.timestamp > latestTs) latestTs = d.timestamp;
    });
    return {
      chartData: chartDataAggregate,
      summaryMetrics: {
        currentC: totalCurrentC,
        currentS: totalCurrentS,
        nextC: totalNextC,
        nextS: totalNextS,
        foreC: fcC,
        foreS: fcS,
        foreNextC: fcNC,
        foreNextS: fcNS,
        progress:
          maxDay !== null
            ? `${maxDay}/${totalDaysInMonth}天`
            : `0/${totalDaysInMonth}天`,
      },
      branchStats: computedBranchStats,
      dailyRecords: computedDailyRecords,
      latestUpdateStr: latestTs
        ? new Date(latestTs).toLocaleTimeString()
        : "無",
    };
  }, [dbData, selectedMonth, selectedBranches]);

  const renderChartLines = () => {
    if (viewMode === "aggregate") {
      return METRICS.filter((m) => selectedMetrics.includes(m.key)).map((m) => (
        <Line
          key={m.key}
          type="monotone"
          dataKey={m.key}
          name={m.label}
          stroke={m.color}
          strokeWidth={m.key.startsWith("current") ? 3 : 2}
          strokeDasharray={m.key.startsWith("next") ? "5 5" : "0"}
          dot={{ r: 4 }}
        />
      ));
    } else {
      let lines = [];
      const colors = ["#2563eb", "#16a34a", "#7c3aed", "#06b6d4"];
      selectedBranches.forEach((b, idx) => {
        METRICS.filter((m) => selectedMetrics.includes(m.key)).forEach((m) => {
          lines.push(
            <Line
              key={`${b}_${m.key}`}
              type="monotone"
              dataKey={`${b}_${m.key}`}
              name={`${b} ${m.label}`}
              stroke={colors[idx % colors.length]}
              strokeWidth={2}
              strokeDasharray={m.key.startsWith("next") ? "3 3" : "0"}
            />
          );
        });
      });
      return lines;
    }
  };

  // 💡 升級版：口碑聲量曲線渲染 (支援加總與分院對比)
  const renderReviewsLines = () => {
    if (viewMode === "aggregate") {
      return (
        <Line
          type="monotone"
          dataKey="reviews"
          name="總評論數 (所選分院加總)"
          stroke="#d97706"
          strokeWidth={3}
          dot={{ r: 4 }}
        />
      );
    } else {
      const colors = ["#2563eb", "#16a34a", "#7c3aed", "#06b6d4"];
      return selectedBranches.map((b, idx) => (
        <Line
          key={`${b}_reviews`}
          type="monotone"
          dataKey={`${b}_reviews`}
          name={`${b} 評論數`}
          stroke={colors[idx % colors.length]}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      ));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-800 font-sans">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-sm p-6 mb-6 border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
            <TrendingUp className="text-blue-600" /> WishVision 業績動能觀測台
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            各分院本月即時進度與全月落點預估系統
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 text-sm">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="font-medium">
            數據進度：{summaryMetrics.progress}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-900">
              <PlusCircle className="w-5 h-5 text-blue-500" /> 新增每日動能紀錄
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  觀察日期
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleFormChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  分院
                </label>
                <select
                  name="branch"
                  value={formData.branch}
                  onChange={handleFormChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 space-y-3">
                <span className="text-xs font-bold text-blue-700 flex items-center gap-1">
                  當月累積指標
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    name="currentC"
                    placeholder="諮詢量"
                    value={formData.currentC}
                    onChange={handleFormChange}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="number"
                    name="currentS"
                    placeholder="手術量"
                    value={formData.currentS}
                    onChange={handleFormChange}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 space-y-3">
                <span className="text-xs font-bold text-purple-700 flex items-center gap-1">
                  下月預約儲備
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    name="nextC"
                    placeholder="預約諮詢"
                    value={formData.nextC}
                    onChange={handleFormChange}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="number"
                    name="nextS"
                    placeholder="預約手術"
                    value={formData.nextS}
                    onChange={handleFormChange}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 space-y-3">
                <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-500" /> 口碑聲量指標
                </span>
                <input
                  type="number"
                  name="reviews"
                  placeholder="目前 Google 評論總則數"
                  value={formData.reviews}
                  onChange={handleFormChange}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={uiStatus.loading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-xl text-sm transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {uiStatus.loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  "儲存今日紀錄"
                )}
              </button>
              {uiStatus.msg && (
                <div
                  className={`text-xs p-3 rounded-xl border text-center font-medium ${
                    uiStatus.type === "error"
                      ? "border-red-200 text-red-600 bg-red-50"
                      : uiStatus.type === "success"
                      ? "border-green-200 text-green-600 bg-green-50"
                      : "border-blue-200 text-blue-600 bg-blue-50"
                  }`}
                >
                  {uiStatus.msg}
                </div>
              )}
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-blue-500"
              />
              <span className="text-xs text-slate-400">
                最後更新：{latestUpdateStr}
              </span>
            </div>
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 text-xs font-medium">
              <button
                onClick={() => setViewMode("aggregate")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === "aggregate"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                合併加總
              </button>
              <button
                onClick={() => setViewMode("compare")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === "compare"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                分院對比
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase block mb-2 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> 分院篩選
              </span>
              <div className="flex flex-wrap gap-2">
                {BRANCHES.map((b) => (
                  <button
                    key={b}
                    onClick={() => handleBranchToggle(b)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1 ${
                      selectedBranches.includes(b)
                        ? "bg-slate-900 border-slate-900 text-white"
                        : "bg-white text-slate-600"
                    }`}
                  >
                    {selectedBranches.includes(b) && (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    )}{" "}
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase block mb-2 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> 圖表指標
              </span>
              <div className="flex flex-wrap gap-2">
                {METRICS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => handleMetricToggle(m.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1 ${
                      selectedMetrics.includes(m.key)
                        ? "text-white"
                        : "bg-white text-slate-600"
                    }`}
                    style={
                      selectedMetrics.includes(m.key)
                        ? { backgroundColor: m.color, borderColor: m.color }
                        : {}
                    }
                  >
                    {selectedMetrics.includes(m.key) && (
                      <CheckCircle className="w-3 h-3 text-white" />
                    )}{" "}
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3 flex items-center gap-1.5">
              <Table className="w-4 h-4 text-blue-500" /> 各分院每日歷史明細表 (
              {selectedMonth})
            </h3>
            <div className="max-h-80 overflow-y-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold sticky top-0 z-10">
                    <th className="p-2.5 bg-slate-50">觀察日期</th>
                    <th className="p-2.5 bg-slate-50">分院名稱</th>
                    <th className="p-2.5 bg-slate-50">本月諮詢</th>
                    <th className="p-2.5 bg-slate-50">下月預約</th>
                    <th className="p-2.5 bg-slate-50">本月手術</th>
                    <th className="p-2.5 bg-slate-50">下月手術</th>
                    <th className="p-2.5 bg-slate-50">Google評論</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan="7"
                        className="p-4 text-center text-slate-400"
                      >
                        尚無數據
                      </td>
                    </tr>
                  ) : (
                    dailyRecords.map((r, idx) => (
                      <tr
                        key={`${r.date}_${r.branch}_${idx}`}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="p-2.5 text-slate-500 font-medium whitespace-nowrap">
                          {r.date}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">
                          {r.branch}
                        </td>
                        <td className="p-2.5 font-semibold text-blue-600">
                          {r.currentC}
                        </td>
                        <td className="p-2.5 text-purple-600">{r.nextC}</td>
                        <td className="p-2.5 font-semibold text-emerald-600">
                          {r.currentS}
                        </td>
                        <td className="p-2.5 text-cyan-600">{r.nextS}</td>
                        <td className="p-2.5 font-bold text-amber-600">
                          {r.reviews > 0 ? `${r.reviews} 則` : "--"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase block mb-3 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />{" "}
              各分院實質日增動能速度
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {branchStats.map((s) => (
                <div
                  key={s.branch}
                  className={`p-3 rounded-xl border transition-all ${
                    s.isFiltered
                      ? "bg-slate-50/80 border-slate-200"
                      : "bg-white border-slate-100 opacity-40"
                  }`}
                >
                  <p className="text-xs font-bold text-slate-700 truncate">
                    {s.branch}
                  </p>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">諮詢日增:</span>
                      <span className="font-semibold text-blue-600">
                        +{s.avgC} /天
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">手術日增:</span>
                      <span className="font-semibold text-emerald-600">
                        +{s.avgS} /天
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-blue-600 px-4 py-2 text-white font-semibold text-sm flex justify-between items-center">
                <span>諮詢量動能</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  Run-Rate 預測
                </span>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4 divide-x divide-slate-100">
                <div>
                  <p className="text-xs text-slate-400 font-medium">
                    本月已累積
                  </p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {summaryMetrics.currentC}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    下月預約：
                    <span className="font-semibold text-slate-700">
                      {summaryMetrics.nextC}
                    </span>
                  </p>
                </div>
                <div className="pl-4">
                  <p className="text-xs text-amber-600 font-bold flex items-center gap-0.5">
                    🎯 本月預估落點
                  </p>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {summaryMetrics.foreC}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    下月預估存量：
                    <span className="font-semibold text-slate-700">
                      {summaryMetrics.foreNextC}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-emerald-600 px-4 py-2 text-white font-semibold text-sm flex justify-between items-center">
                <span>手術量動能</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  Run-Rate 預測
                </span>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4 divide-x divide-slate-100">
                <div>
                  <p className="text-xs text-slate-400 font-medium">
                    本月已累積
                  </p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    {summaryMetrics.currentS}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    下月預約：
                    <span className="font-semibold text-slate-700">
                      {summaryMetrics.nextS}
                    </span>
                  </p>
                </div>
                <div className="pl-4">
                  <p className="text-xs text-amber-600 font-bold flex items-center gap-0.5">
                    🎯 本月預估落點
                  </p>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {summaryMetrics.foreS}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    下月預估存量：
                    <span className="font-semibold text-slate-700">
                      {summaryMetrics.foreNextS}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4" /> 營運累積與動能走勢圖
            </h3>
            <div className="w-full h-72">
              {chartData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                  尚無數據
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: "20px", fontSize: "12px" }}
                      iconType="circle"
                    />
                    {renderChartLines()}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />{" "}
              口碑聲量指標（Google 評論總數）走勢圖
            </h3>
            <div className="w-full h-72">
              {chartData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                  尚無數據
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: "20px", fontSize: "12px" }}
                      iconType="circle"
                    />
                    {renderReviewsLines()}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
