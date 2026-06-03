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
  BarChart,
  Bar,
  ComposedChart,
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
  Database,
  Target,
} from "lucide-react";

// --- 1. 配置與初始化 ---
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
const YEARS = Array.from({ length: 10 }, (_, i) => (2017 + i).toString());
const MONTHS = Array.from({ length: 12 }, (_, i) =>
  (i + 1).toString().padStart(2, "0")
);
const METRICS = [
  { key: "currentC", label: "本月諮詢", color: "#2563eb" },
  { key: "nextC", label: "下月諮詢", color: "#7c3aed" },
  { key: "currentS", label: "本月手術", color: "#16a34a" },
  { key: "nextS", label: "下月手術", color: "#06b6d4" },
];

// --- 2. 主程式組件 ---
export default function App() {
  const [activeTab, setActiveTab] = useState("daily");
  const [dbData, setDbData] = useState([]);
  const [historyData, setHistoryData] = useState([]);

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
  const [viewMode, setViewMode] = useState("aggregate");

  const [maintYear, setMaintYear] = useState(
    new Date().getFullYear().toString()
  );
  const [maintBranch, setMaintBranch] = useState(BRANCHES[0]);
  const [maintGrid, setMaintGrid] = useState({});

  const [uiStatus, setUiStatus] = useState({
    loading: false,
    msg: "",
    type: "",
  });

  // --- 3. 數據監聽 ---
  useEffect(() => {
    const unsubDaily = onSnapshot(
      collection(db, "wishvision_stats"),
      (snap) => {
        setDbData(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
      }
    );
    const unsubHist = onSnapshot(
      collection(db, "wishvision_monthly_history"),
      (snap) => {
        setHistoryData(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
      }
    );
    return () => {
      unsubDaily();
      unsubHist();
    };
  }, []);

  const handleMetricToggle = (metricKey) => {
    if (selectedMetrics.includes(metricKey)) {
      if (selectedMetrics.length > 1)
        setSelectedMetrics(selectedMetrics.filter((m) => m !== metricKey));
    } else {
      setSelectedMetrics([...selectedMetrics, metricKey]);
    }
  };

  // --- 4. 每日動能計算大腦 (保留最強避震演算法) ---
  const dailyMetrics = useMemo(() => {
    const currentMonthDocs = dbData.filter(
      (d) => (d.month || d.date.slice(0, 7)) === selectedMonth
    );
    const [year, month] = selectedMonth.split("-").map(Number);
    const totalDays = new Date(year, month, 0).getDate();

    let branchSummary = [];
    let totalCurC = 0,
      totalCurS = 0,
      totalForeC = 0,
      totalForeS = 0;
    let maxDayObserved = 1;

    BRANCHES.forEach((b) => {
      const bDocs = currentMonthDocs
        .filter((d) => d.branch === b)
        .sort((a, b) => a.day - b.day || a.timestamp - b.timestamp);
      if (bDocs.length > 0) {
        const last = bDocs[bDocs.length - 1];
        const day = last.day || parseInt(last.date.split("-")[2], 10);
        if (selectedBranches.includes(b) && day > maxDayObserved)
          maxDayObserved = day;

        const minC = Math.min(...bDocs.map((d) => d.currentC || 0));
        const minS = Math.min(...bDocs.map((d) => d.currentS || 0));

        const curC = last.currentC || 0;
        const curS = last.currentS || 0;
        const rem = totalDays - day;

        let avgC = 0,
          foreC = curC;
        if (curC > minC && day > 0) {
          avgC = (curC - minC) / day;
          foreC = Math.round(curC + avgC * rem);
        }
        let avgS = 0,
          foreS = curS;
        if (curS > minS && day > 0) {
          avgS = (curS - minS) / day;
          foreS = Math.round(curS + avgS * rem);
        }

        branchSummary.push({
          branch: b,
          curC,
          curS,
          nextC: last.nextC || 0,
          nextS: last.nextS || 0,
          avgC: avgC.toFixed(1),
          avgS: avgS.toFixed(1),
          reviews: last.reviews || 0,
          isFiltered: selectedBranches.includes(b),
        });

        if (selectedBranches.includes(b)) {
          totalCurC += curC;
          totalCurS += curS;
          totalForeC += foreC;
          totalForeS += foreS;
        }
      } else {
        branchSummary.push({
          branch: b,
          curC: 0,
          curS: 0,
          nextC: 0,
          nextS: 0,
          avgC: "0.0",
          avgS: "0.0",
          reviews: 0,
          isFiltered: selectedBranches.includes(b),
        });
      }
    });

    const dailyLogsMap = {};
    currentMonthDocs.forEach((d) => {
      if (selectedBranches.includes(d.branch)) {
        const k = `${d.date}_${d.branch}`;
        if (!dailyLogsMap[k] || d.timestamp > dailyLogsMap[k].timestamp)
          dailyLogsMap[k] = d;
      }
    });
    const dailyLogs = Object.values(dailyLogsMap).sort(
      (a, b) => b.date.localeCompare(a.date) || a.branch.localeCompare(b.branch)
    );

    // 💡 補回圖表繪製所需的 chartData
    const uniqueDates = Array.from(
      new Set(currentMonthDocs.map((d) => d.date))
    ).sort();
    let chartDataAggregate = [];
    let branchLatestChart = {};
    BRANCHES.forEach(
      (b) =>
        (branchLatestChart[b] = {
          currentC: 0,
          currentS: 0,
          nextC: 0,
          nextS: 0,
          reviews: 0,
        })
    );

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
        const bData = currentMonthDocs.filter(
          (d) => d.date === dateStr && d.branch === b
        );
        if (bData.length > 0)
          branchLatestChart[b] = bData.sort(
            (a, b) => b.timestamp - a.timestamp
          )[0];

        const activeData = branchLatestChart[b];
        if (activeData && selectedBranches.includes(b)) {
          aggRow.currentC += activeData.currentC || 0;
          aggRow.currentS += activeData.currentS || 0;
          aggRow.nextC += activeData.nextC || 0;
          aggRow.nextS += activeData.nextS || 0;
          aggRow.reviews += activeData.reviews || 0;

          aggRow[`${b}_currentC`] = activeData.currentC || 0;
          aggRow[`${b}_currentS`] = activeData.currentS || 0;
          aggRow[`${b}_nextC`] = activeData.nextC || 0;
          aggRow[`${b}_nextS`] = activeData.nextS || 0;
          aggRow[`${b}_reviews`] = activeData.reviews || 0;
        }
      });
      chartDataAggregate.push(aggRow);
    });

    return {
      branchSummary,
      totalCurC,
      totalCurS,
      totalForeC,
      totalForeS,
      maxDayObserved,
      totalDays,
      dailyLogs,
      chartData: chartDataAggregate,
    };
  }, [dbData, selectedMonth, selectedBranches]);

  // --- 5. 戰略看板計算大腦 (原封不動) ---
  const strategyData = useMemo(() => {
    const historyMapped = historyData.map((d) => {
      const surgery = d.surgery || 0;
      const revenue = d.revenue || 0;
      return {
        ...d,
        asp: surgery > 0 ? Math.round(revenue / surgery) : 0,
        conv: d.conversion || 0,
        succ: d.successRate || 0,
      };
    });

    const yearlyTrend = YEARS.map((y) => {
      const yearDocs = historyMapped.filter(
        (d) =>
          d.year === y &&
          (viewMode === "aggregate" ? true : d.branch === maintBranch)
      );
      return {
        name: y,
        consultation: yearDocs.reduce(
          (acc, cur) => acc + (cur.consultation || 0),
          0
        ),
        surgery: yearDocs.reduce((acc, cur) => acc + (cur.surgery || 0), 0),
        revenue: yearDocs.reduce((acc, cur) => acc + (cur.revenue || 0), 0),
      };
    });

    const monthlyYoY = MONTHS.map((m) => {
      const row = { name: `${m}月` };
      YEARS.slice(-3).forEach((y) => {
        const doc = historyMapped.find(
          (d) =>
            d.year === y &&
            d.month === m &&
            (viewMode === "aggregate" ? true : d.branch === maintBranch)
        );
        row[`val_${y}`] = doc ? doc.revenue : 0;
      });
      return row;
    });

    return { yearlyTrend, monthlyYoY, historyMapped };
  }, [historyData, viewMode, maintBranch]);

  // --- 6. 事件處理 ---
  const handleDailySubmit = async (e) => {
    e.preventDefault();
    setUiStatus({ loading: true, msg: "儲存中...", type: "info" });
    const id = `${formData.date}_${formData.branch}`;
    try {
      await setDoc(doc(db, "wishvision_stats", id), {
        ...formData,
        month: formData.date.slice(0, 7),
        day: parseInt(formData.date.split("-")[2], 10),
        currentC: parseInt(formData.currentC),
        currentS: parseInt(formData.currentS),
        nextC: parseInt(formData.nextC),
        nextS: parseInt(formData.nextS),
        reviews: parseInt(formData.reviews || 0),
        timestamp: Date.now(),
      });
      setUiStatus({ loading: false, msg: "儲存成功", type: "success" });
      setFormData({
        ...formData,
        currentC: "",
        currentS: "",
        nextC: "",
        nextS: "",
        reviews: "",
      });
    } catch (err) {
      setUiStatus({ loading: false, msg: err.message, type: "error" });
    }
  };

  const handleMaintSave = async (m) => {
    const id = `${maintYear}-${m}_${maintBranch}`;
    const data = maintGrid[m] || {};
    try {
      await setDoc(doc(db, "wishvision_monthly_history", id), {
        id,
        year: maintYear,
        month: m,
        branch: maintBranch,
        consultation: parseInt(data.consultation || 0),
        surgery: parseInt(data.surgery || 0),
        revenue: parseInt(data.revenue || 0),
        conversion: parseFloat(data.conversion || 0),
        successRate: parseFloat(data.successRate || 0),
        timestamp: Date.now(),
      });
      alert(`${m}月 數據已更新`);
    } catch (err) {
      alert("儲存失敗: " + err.message);
    }
  };

  // --- 補回：圖表渲染函數 ---
  const renderDailyChartLines = () => {
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

  const renderDailyReviewsLines = () => {
    if (viewMode === "aggregate") {
      return (
        <Line
          type="monotone"
          dataKey="reviews"
          name="總評論數(所選分院加總)"
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

  // 渲染內容切換
  const renderContent = () => {
    switch (activeTab) {
      case "daily":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {/* 左側表單 */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                  <PlusCircle className="text-blue-500" /> 每日紀錄入口
                </h2>
                <form onSubmit={handleDailySubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        日期
                      </label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) =>
                          setFormData({ ...formData, date: e.target.value })
                        }
                        className="w-full bg-slate-50 border-none rounded-xl p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        分院
                      </label>
                      <select
                        value={formData.branch}
                        onChange={(e) =>
                          setFormData({ ...formData, branch: e.target.value })
                        }
                        className="w-full bg-slate-50 border-none rounded-xl p-2 text-sm"
                      >
                        {BRANCHES.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-blue-50/50 p-3 rounded-xl space-y-2">
                      <p className="text-[10px] font-bold text-blue-600">
                        本月實際累積
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="諮詢"
                          value={formData.currentC}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              currentC: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border-slate-200 p-2 text-sm"
                        />
                        <input
                          type="number"
                          placeholder="手術"
                          value={formData.currentS}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              currentS: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border-slate-200 p-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="bg-purple-50/50 p-3 rounded-xl space-y-2">
                      <p className="text-[10px] font-bold text-purple-600">
                        下月預約儲備
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="預約諮詢"
                          value={formData.nextC}
                          onChange={(e) =>
                            setFormData({ ...formData, nextC: e.target.value })
                          }
                          className="w-full rounded-lg border-slate-200 p-2 text-sm"
                        />
                        <input
                          type="number"
                          placeholder="預約手術"
                          value={formData.nextS}
                          onChange={(e) =>
                            setFormData({ ...formData, nextS: e.target.value })
                          }
                          className="w-full rounded-lg border-slate-200 p-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="bg-amber-50/50 p-3 rounded-xl space-y-2">
                      <p className="text-[10px] font-bold text-amber-600">
                        口碑指標
                      </p>
                      <input
                        type="number"
                        placeholder="Google 評論總則數"
                        value={formData.reviews}
                        onChange={(e) =>
                          setFormData({ ...formData, reviews: e.target.value })
                        }
                        className="w-full rounded-lg border-slate-200 p-2 text-sm"
                      />
                    </div>
                  </div>
                  <button className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-black transition-all">
                    儲存數據
                  </button>
                  {uiStatus.msg && (
                    <p
                      className={`text-center text-xs font-bold ${
                        uiStatus.type === "success"
                          ? "text-green-500"
                          : "text-blue-500"
                      }`}
                    >
                      {uiStatus.msg}
                    </p>
                  )}
                </form>
              </div>
            </div>

            {/* 右側觀測看板 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 控制列 (已補回：合併加總 / 分院對比切換鈕) */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap justify-between items-center gap-4">
                <div className="flex gap-4 items-center">
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-slate-100 border-none rounded-xl px-4 py-2 text-sm font-bold"
                  />
                  <div className="bg-slate-100 p-1 rounded-xl flex gap-1 text-xs font-bold">
                    <button
                      onClick={() => setViewMode("aggregate")}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        viewMode === "aggregate"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-400"
                      }`}
                    >
                      合併加總
                    </button>
                    <button
                      onClick={() => setViewMode("compare")}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        viewMode === "compare"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-400"
                      }`}
                    >
                      分院對比
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  {BRANCHES.map((b) => (
                    <button
                      key={b}
                      onClick={() => {
                        if (selectedBranches.includes(b))
                          setSelectedBranches(
                            selectedBranches.filter((x) => x !== b)
                          );
                        else setSelectedBranches([...selectedBranches, b]);
                      }}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1 ${
                        selectedBranches.includes(b)
                          ? "bg-slate-900 border-slate-900 text-white"
                          : "bg-white text-slate-400"
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

              {/* 指標篩選器 (已補回) */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase block mb-2 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" /> 圖表指標
                </span>
                <div className="flex flex-wrap gap-2">
                  {METRICS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => handleMetricToggle(m.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 ${
                        selectedMetrics.includes(m.key)
                          ? "text-white"
                          : "bg-white text-slate-400"
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

              {/* 實質日增動能速度卡片 (已補回) */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-3 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />{" "}
                  各分院實質日增動能速度
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {dailyMetrics.branchSummary.map((s) => (
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
                          <span className="font-bold text-blue-600">
                            +{s.avgC} /天
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">手術日增:</span>
                          <span className="font-bold text-emerald-600">
                            +{s.avgS} /天
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 預估落點卡片 (避震演算法驅動) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-3xl text-white shadow-xl">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium opacity-80">
                      本月諮詢預估落點
                    </p>
                    <Zap className="w-5 h-5 text-blue-300 fill-blue-300" />
                  </div>
                  <h3 className="text-4xl font-black mt-2">
                    {dailyMetrics.totalForeC}{" "}
                    <span className="text-sm font-normal opacity-60">人</span>
                  </h3>
                  <div className="mt-4 flex gap-4 text-xs">
                    <div className="bg-white/10 px-3 py-1.5 rounded-lg">
                      累積: {dailyMetrics.totalCurC}
                    </div>
                    <div className="bg-white/10 px-3 py-1.5 rounded-lg">
                      進度: {dailyMetrics.maxDayObserved}天
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 rounded-3xl text-white shadow-xl">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium opacity-80">
                      本月手術預估落點
                    </p>
                    <Target className="w-5 h-5 text-emerald-300 fill-emerald-300" />
                  </div>
                  <h3 className="text-4xl font-black mt-2">
                    {dailyMetrics.totalForeS}{" "}
                    <span className="text-sm font-normal opacity-60">台</span>
                  </h3>
                  <div className="mt-4 flex gap-4 text-xs">
                    <div className="bg-white/10 px-3 py-1.5 rounded-lg">
                      累積: {dailyMetrics.totalCurS}
                    </div>
                    <div className="bg-white/10 px-3 py-1.5 rounded-lg">
                      進度: {dailyMetrics.maxDayObserved}天
                    </div>
                  </div>
                </div>
              </div>

              {/* 主折線圖 (已補回) */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-blue-500" />{" "}
                  營運累積與動能走勢圖
                </h3>
                <div className="w-full h-72">
                  {dailyMetrics.chartData.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                      尚無數據
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={dailyMetrics.chartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
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
                          wrapperStyle={{
                            paddingTop: "20px",
                            fontSize: "12px",
                          }}
                          iconType="circle"
                        />
                        {renderDailyChartLines()}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* 口碑聲量折線圖 (已補回) */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />{" "}
                  口碑聲量指標（Google 評論總數）走勢圖
                </h3>
                <div className="w-full h-72">
                  {dailyMetrics.chartData.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                      尚無數據
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={dailyMetrics.chartData}
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
                          wrapperStyle={{
                            paddingTop: "20px",
                            fontSize: "12px",
                          }}
                          iconType="circle"
                        />
                        {renderDailyReviewsLines()}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* 明細表格 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Table className="w-4 h-4 text-blue-500" /> 每日實質動能日誌
                  </h3>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-400 sticky top-0">
                      <tr>
                        <th className="p-3">日期</th>
                        <th className="p-3">分院</th>
                        <th className="p-3">諮詢</th>
                        <th className="p-3">手術</th>
                        <th className="p-3">下月預約</th>
                        <th className="p-3">評論</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {dailyMetrics.dailyLogs.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-400">
                            {r.date.slice(5)}
                          </td>
                          <td className="p-3 font-bold">{r.branch}</td>
                          <td className="p-3 font-semibold text-blue-600">
                            {r.currentC}
                          </td>
                          <td className="p-3 font-semibold text-emerald-600">
                            {r.currentS}
                          </td>
                          <td className="p-3 text-purple-600">
                            {r.nextC}/{r.nextS}
                          </td>
                          <td className="p-3 text-amber-600 font-bold">
                            {r.reviews}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      case "strategy":
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            {/* 戰略篩選 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-6 items-end">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-2">
                  檢視維度
                </label>
                <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                  <button
                    onClick={() => setViewMode("aggregate")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold ${
                      viewMode === "aggregate"
                        ? "bg-white shadow-sm"
                        : "text-slate-400"
                    }`}
                  >
                    全院加總
                  </button>
                  <button
                    onClick={() => setViewMode("compare")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold ${
                      viewMode === "compare"
                        ? "bg-white shadow-sm"
                        : "text-slate-400"
                    }`}
                  >
                    單一分院
                  </button>
                </div>
              </div>
              {viewMode === "compare" && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-2">
                    選擇分院
                  </label>
                  <select
                    value={maintBranch}
                    onChange={(e) => setMaintBranch(e.target.value)}
                    className="bg-slate-100 border-none rounded-xl px-4 py-1.5 text-xs font-bold"
                  >
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 年度趨勢圖 (圖表一) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />{" "}
                年度戰略走勢趨勢圖 (Macro Trend)
              </h3>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={strategyData.yearlyTrend}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#94a3b8" }}
                    />
                    <YAxis
                      yAxisId="left"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#94a3b8" }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#94a3b8" }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend iconType="circle" />
                    <Bar
                      yAxisId="right"
                      dataKey="revenue"
                      name="年度總營收"
                      fill="#fbbf24"
                      radius={[10, 10, 0, 0]}
                      barSize={40}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="consultation"
                      name="諮詢總量"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="surgery"
                      name="手術總量"
                      stroke="#16a34a"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 月度 YoY 對比 (圖表二) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-500" /> 跨年度同月營收
                YoY 對比分析
              </h3>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={strategyData.monthlyYoY}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#94a3b8" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#94a3b8" }}
                    />
                    <Tooltip />
                    <Legend />
                    {YEARS.slice(-3).map((y, i) => (
                      <Line
                        key={y}
                        type="monotone"
                        dataKey={`val_${y}`}
                        name={`${y}年度`}
                        stroke={["#cbd5e1", "#94a3b8", "#2563eb"][i]}
                        strokeWidth={i === 2 ? 4 : 2}
                        dot={i === 2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 歷史數據清單 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 bg-slate-900 text-white flex justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest">
                  歷史戰略明細數據庫
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-50 text-slate-400">
                    <tr>
                      <th className="p-3">年份-月</th>
                      <th className="p-3">分院</th>
                      <th className="p-3">諮詢</th>
                      <th className="p-3">手術</th>
                      <th className="p-3">總營收</th>
                      <th className="p-3">ASP</th>
                      <th className="p-3">轉換</th>
                      <th className="p-3">成功</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {strategyData.historyMapped
                      .sort((a, b) => b.id.localeCompare(a.id))
                      .slice(0, 24)
                      .map((h, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="p-3 font-bold text-slate-400">
                            {h.year}-{h.month}
                          </td>
                          <td className="p-3 font-bold">{h.branch}</td>
                          <td className="p-3">{h.consultation}</td>
                          <td className="p-3">{h.surgery}</td>
                          <td className="p-3 font-bold text-slate-900">
                            ${(h.revenue / 10000).toFixed(1)}萬
                          </td>
                          <td className="p-3 text-amber-600 font-bold">
                            ${h.asp.toLocaleString()}
                          </td>
                          <td className="p-3 text-purple-600 font-bold">
                            {h.conv}%
                          </td>
                          <td className="p-3 text-blue-600 font-bold">
                            {h.succ}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case "maintenance":
        return (
          <div className="space-y-6 animate-in zoom-in-95 duration-300">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex flex-wrap gap-4 items-end mb-8">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-2">
                    選擇維護年份
                  </label>
                  <select
                    value={maintYear}
                    onChange={(e) => setMaintYear(e.target.value)}
                    className="bg-slate-100 border-none rounded-xl px-4 py-2 text-sm font-bold"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-2">
                    選擇維護分院
                  </label>
                  <select
                    value={maintBranch}
                    onChange={(e) => setMaintBranch(e.target.value)}
                    className="bg-slate-100 border-none rounded-xl px-4 py-2 text-sm font-bold"
                  >
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-grow"></div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">
                    修改後請按該月份右側的「更新」按鈕
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="p-4 text-left">月份</th>
                      <th className="p-4 text-left">諮詢量</th>
                      <th className="p-4 text-left">手術量</th>
                      <th className="p-4 text-left">總營收(NT$)</th>
                      <th className="p-4 text-left">轉換率(%)</th>
                      <th className="p-4 text-left">成功率(%)</th>
                      <th className="p-4 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {MONTHS.map((m) => {
                      const existing =
                        strategyData.historyMapped.find(
                          (h) =>
                            h.year === maintYear &&
                            h.month === m &&
                            h.branch === maintBranch
                        ) || {};
                      return (
                        <tr key={m} className="hover:bg-slate-50">
                          <td className="p-4 font-black text-slate-300 text-lg">
                            {m}
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              defaultValue={existing.consultation}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    consultation: val,
                                  },
                                }));
                              }}
                              className="w-20 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none p-1 font-bold"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              defaultValue={existing.surgery}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    surgery: val,
                                  },
                                }));
                              }}
                              className="w-20 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none p-1 font-bold"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              defaultValue={existing.revenue}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    revenue: val,
                                  },
                                }));
                              }}
                              className="w-32 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none p-1 font-bold"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              step="0.1"
                              defaultValue={existing.conversion}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    conversion: val,
                                  },
                                }));
                              }}
                              className="w-16 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none p-1 font-bold text-purple-600"
                            />{" "}
                            %
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              step="0.1"
                              defaultValue={existing.successRate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    successRate: val,
                                  },
                                }));
                              }}
                              className="w-16 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none p-1 font-bold text-blue-600"
                            />{" "}
                            %
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleMaintSave(m)}
                              className="bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-600 p-2 rounded-lg transition-all"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      {/* 頂部導航 */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-blue-200 shadow-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">
                WishVision BI <span className="text-blue-600">Pro</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Strategic Management System
              </p>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
            <button
              onClick={() => setActiveTab("daily")}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === "daily"
                  ? "bg-white shadow-md text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Zap className="w-4 h-4" /> 每日動能追蹤
            </button>
            <button
              onClick={() => setActiveTab("strategy")}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === "strategy"
                  ? "bg-white shadow-md text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <BarChart2 className="w-4 h-4" /> 歷史戰略看板
            </button>
            <button
              onClick={() => setActiveTab("maintenance")}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === "maintenance"
                  ? "bg-white shadow-md text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Database className="w-4 h-4" /> 數據維護矩陣
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">{renderContent()}</main>
    </div>
  );
}
