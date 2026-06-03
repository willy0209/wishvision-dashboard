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
  ArrowUpRight,
  DollarSign,
  Percent,
  TrendingDown,
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

// 輔助函數：計算 YoY
const calcYoY = (cur, prev) => {
  if (!prev || prev === 0) return "--";
  const change = ((cur - prev) / prev) * 100;
  return change.toFixed(1) + "%";
};

export default function App() {
  const [activeTab, setActiveTab] = useState("daily");
  const [dbData, setDbData] = useState([]);
  const [historyData, setHistoryData] = useState([]);

  // 每日數據狀態
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
  const [dailyViewMode, setDailyViewMode] = useState("aggregate");

  // 戰略看板狀態
  const [stratMetric, setStratMetric] = useState("revenue");
  const [stratBaseYear, setStratBaseYear] = useState(
    new Date().getFullYear().toString()
  );
  const [stratView, setStratView] = useState("macro_A");
  const [stratBranch, setStratBranch] = useState(BRANCHES[0]);
  const [stratFilterMode, setStratFilterMode] = useState("aggregate");

  // 維護矩陣狀態
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

  // --- 數據監聽 ---
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

  // --- 每日動能計算 ---
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

  // --- 5. 戰略看板數據矩陣 ---
  const strategyData = useMemo(() => {
    const processedHistory = historyData.map((d) => ({
      ...d,
      revenue: parseFloat(d.revenue || 0),
      consultation: parseInt(d.consultation || 0),
      surgery: parseInt(d.surgery || 0),
      conv: parseFloat(d.conversion || 0),
      succ: parseFloat(d.successRate || 0),
      asp: d.surgery > 0 ? Math.round(d.revenue / d.surgery) : 0,
    }));

    // 1. 年度趨勢
    const yearlyTrend = YEARS.map((y, idx) => {
      const yearDocs = processedHistory.filter(
        (d) =>
          d.year === y &&
          (stratFilterMode === "aggregate" ? true : d.branch === stratBranch)
      );
      const curRev = yearDocs.reduce((acc, cur) => acc + cur.revenue, 0);
      const curSur = yearDocs.reduce((acc, cur) => acc + cur.surgery, 0);
      const curCon = yearDocs.reduce((acc, cur) => acc + cur.consultation, 0);
      const avgConv =
        yearDocs.length > 0
          ? parseFloat(
              (
                yearDocs.reduce((acc, cur) => acc + cur.conv, 0) /
                yearDocs.length
              ).toFixed(1)
            )
          : 0;
      const avgSucc =
        yearDocs.length > 0
          ? parseFloat(
              (
                yearDocs.reduce((acc, cur) => acc + cur.succ, 0) /
                yearDocs.length
              ).toFixed(1)
            )
          : 0;

      const prevYear = (parseInt(y) - 1).toString();
      const prevDocs = processedHistory.filter(
        (d) =>
          d.year === prevYear &&
          (stratFilterMode === "aggregate" ? true : d.branch === stratBranch)
      );
      const prevRev = prevDocs.reduce((acc, cur) => acc + cur.revenue, 0);
      const prevSur = prevDocs.reduce((acc, cur) => acc + cur.surgery, 0);
      const prevCon = prevDocs.reduce((acc, cur) => acc + cur.consultation, 0);

      return {
        name: y,
        revenue: curRev,
        surgery: curSur,
        consultation: curCon,
        conv: avgConv,
        succ: avgSucc,
        asp: curSur > 0 ? Math.round(curRev / curSur) : 0,
        yoyRev: calcYoY(curRev, prevRev),
        yoySur: calcYoY(curSur, prevSur),
        yoyCon: calcYoY(curCon, prevCon),
      };
    });

    // 2. 月度 YoY 對比
    const prevYear = (parseInt(stratBaseYear) - 1).toString();
    const monthlyYoY = MONTHS.map((m) => {
      const cur =
        processedHistory.find(
          (d) =>
            d.year === stratBaseYear &&
            d.month === m &&
            (stratFilterMode === "aggregate" ? true : d.branch === stratBranch)
        ) || {};
      const prev =
        processedHistory.find(
          (d) =>
            d.year === prevYear &&
            d.month === m &&
            (stratFilterMode === "aggregate" ? true : d.branch === stratBranch)
        ) || {};

      const getVal = (obj, key) => {
        if (key === "revenue") return obj.revenue || 0;
        if (key === "consultation") return obj.consultation || 0;
        if (key === "surgery") return obj.surgery || 0;
        if (key === "conversion") return obj.conv || 0;
        if (key === "success") return obj.succ || 0;
        return 0;
      };

      const cV = getVal(cur, stratMetric);
      const pV = getVal(prev, stratMetric);

      return {
        name: `${m}月`,
        baseVal: cV,
        prevVal: pV,
        yoy: calcYoY(cV, pV),
        curData: cur,
        prevData: prev,
      };
    });

    return { yearlyTrend, monthlyYoY, processedHistory };
  }, [historyData, stratFilterMode, stratBranch, stratBaseYear, stratMetric]);

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
      setTimeout(
        () => setUiStatus({ loading: false, msg: "", type: "" }),
        3000
      );
    } catch (err) {
      setUiStatus({ loading: false, msg: err.message, type: "error" });
    }
  };

  const handleMaintSave = async (m) => {
    const id = `${maintYear}-${m}_${maintBranch}`;
    const data =
      maintGrid[m] ||
      strategyData.processedHistory.find((h) => h.id === id) ||
      {};
    try {
      await setDoc(doc(db, "wishvision_monthly_history", id), {
        id,
        year: maintYear,
        month: m,
        branch: maintBranch,
        consultation: parseInt(data.consultation || 0),
        surgery: parseInt(data.surgery || 0),
        revenue: parseInt(data.revenue || 0),
        conversion: parseFloat(data.conversion || data.conv || 0),
        successRate: parseFloat(data.successRate || data.succ || 0),
        timestamp: Date.now(),
      });
      return true;
    } catch (err) {
      alert(`${m}月 儲存失敗`);
      return false;
    }
  };

  const handleMaintBulkSave = async () => {
    setUiStatus({ loading: true, msg: "年度資料批次更新中...", type: "info" });
    let count = 0;
    for (let m of MONTHS) {
      const success = await handleMaintSave(m);
      if (success) count++;
    }
    setUiStatus({
      loading: false,
      msg: `年度資料更新完成，共 ${count} 個月`,
      type: "success",
    });
    setTimeout(() => setUiStatus({ loading: false, msg: "", type: "" }), 3000);
  };

  const renderDailyChartLines = () => {
    if (dailyViewMode === "aggregate") {
      return METRICS.filter((m) => selectedMetrics.includes(m.key)).map((m) => (
        <Line
          key={m.key}
          type="monotone"
          dataKey={m.key}
          name={m.label}
          stroke={m.color}
          strokeWidth={3}
          dot={{ r: 4 }}
          strokeDasharray={m.key.includes("next") ? "5 5" : "0"}
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
              dot={{ r: 2 }}
              strokeDasharray={m.key.includes("next") ? "5 5" : "0"}
            />
          );
        });
      });
      return lines;
    }
  };

  const renderDailyReviewsLines = () => {
    if (dailyViewMode === "aggregate") {
      return (
        <Line
          type="monotone"
          dataKey="reviews"
          name="總評論數(所選分院加總)"
          stroke="#f59e0b"
          strokeWidth={4}
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
          name={`${b} 評論`}
          stroke={colors[idx % colors.length]}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      ));
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "daily":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {/* 左側輸入表單 */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl shadow-sm p-6 border border-slate-100">
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
                        className="w-full bg-slate-50 border-none rounded-xl p-2.5 text-sm"
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
                        className="w-full bg-slate-50 border-none rounded-xl p-2.5 text-sm"
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
                    <div className="bg-blue-50/50 p-4 rounded-2xl space-y-2">
                      <p className="text-[10px] font-bold text-blue-600">
                        本月累積指標
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
                    <div className="bg-purple-50/50 p-4 rounded-2xl space-y-2">
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
                    <div className="bg-amber-50/50 p-4 rounded-2xl space-y-2">
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
                  <button className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-2xl shadow-lg hover:bg-black transition-all flex justify-center items-center gap-2">
                    {uiStatus.loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      "儲存今日數據"
                    )}
                  </button>
                  {uiStatus.msg && (
                    <p
                      className={`text-center text-xs font-bold p-2 rounded-xl border ${
                        uiStatus.type === "success"
                          ? "bg-green-50 border-green-100 text-green-600"
                          : "bg-blue-50 border-blue-100 text-blue-600"
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
              <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-wrap justify-between items-center gap-4">
                <div className="flex gap-4 items-center">
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-slate-100 border-none rounded-xl px-4 py-2.5 text-sm font-bold"
                  />
                  <div className="bg-slate-100 p-1 rounded-xl flex gap-1 text-[10px] font-black uppercase">
                    <button
                      onClick={() => setDailyViewMode("aggregate")}
                      className={`px-4 py-2 rounded-lg transition-all ${
                        dailyViewMode === "aggregate"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-400"
                      }`}
                    >
                      合併加總
                    </button>
                    <button
                      onClick={() => setDailyViewMode("compare")}
                      className={`px-4 py-2 rounded-lg transition-all ${
                        dailyViewMode === "compare"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-400"
                      }`}
                    >
                      分院對比
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {BRANCHES.map((b) => (
                    <button
                      key={b}
                      onClick={() => {
                        if (selectedBranches.includes(b)) {
                          if (selectedBranches.length > 1)
                            setSelectedBranches(
                              selectedBranches.filter((x) => x !== b)
                            );
                        } else setSelectedBranches([...selectedBranches, b]);
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

              {/* 實質日增動能卡片 */}
              <div className="bg-white rounded-3xl p-4 border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-3 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />{" "}
                  各分院實質日增動能速度
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {dailyMetrics.branchSummary.map((s) => (
                    <div
                      key={s.branch}
                      className={`p-3 rounded-2xl border transition-all ${
                        s.isFiltered
                          ? "bg-slate-50/80 border-slate-200 shadow-sm"
                          : "bg-white border-slate-100 opacity-40"
                      }`}
                    >
                      <p className="text-[11px] font-black text-slate-700 truncate mb-2">
                        {s.branch}
                      </p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400 font-bold">
                            諮詢:
                          </span>
                          <span className="font-black text-blue-600">
                            +{s.avgC}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400 font-bold">
                            手術:
                          </span>
                          <span className="font-black text-emerald-600">
                            +{s.avgS}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 預估落點卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-[2rem] text-white shadow-xl shadow-blue-100 relative overflow-hidden">
                  <Activity className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
                  <p className="text-xs font-bold opacity-70 uppercase tracking-widest">
                    本月諮詢預估落點
                  </p>
                  <h3 className="text-5xl font-black mt-2">
                    {dailyMetrics.totalForeC}{" "}
                    <span className="text-sm font-normal opacity-50">人</span>
                  </h3>
                  <div className="mt-6 flex gap-4 text-[10px] font-black uppercase">
                    <div className="bg-white/10 px-3 py-2 rounded-xl backdrop-blur-sm">
                      累積: {dailyMetrics.totalCurC}
                    </div>
                    <div className="bg-white/10 px-3 py-2 rounded-xl backdrop-blur-sm">
                      進度: {dailyMetrics.maxDayObserved} /{" "}
                      {dailyMetrics.totalDays} 天
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 rounded-[2rem] text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
                  <Target className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
                  <p className="text-xs font-bold opacity-70 uppercase tracking-widest">
                    本月手術預估落點
                  </p>
                  <h3 className="text-5xl font-black mt-2">
                    {dailyMetrics.totalForeS}{" "}
                    <span className="text-sm font-normal opacity-50">台</span>
                  </h3>
                  <div className="mt-6 flex gap-4 text-[10px] font-black uppercase">
                    <div className="bg-white/10 px-3 py-2 rounded-xl backdrop-blur-sm">
                      累積: {dailyMetrics.totalCurS}
                    </div>
                    <div className="bg-white/10 px-3 py-2 rounded-xl backdrop-blur-sm">
                      進度: {dailyMetrics.maxDayObserved} /{" "}
                      {dailyMetrics.totalDays} 天
                    </div>
                  </div>
                </div>
              </div>

              {/* 主趨勢圖 */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-blue-500" />{" "}
                    營運動能累積走勢
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {METRICS.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => handleMetricToggle(m.key)}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black transition-all border ${
                          selectedMetrics.includes(m.key)
                            ? "text-white"
                            : "bg-white text-slate-300"
                        }`}
                        style={
                          selectedMetrics.includes(m.key)
                            ? { backgroundColor: m.color, borderColor: m.color }
                            : {}
                        }
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyMetrics.chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "16px",
                          border: "none",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                          fontSize: "11px",
                        }}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{
                          fontSize: "10px",
                          fontWeight: 900,
                          paddingTop: "10px",
                        }}
                      />
                      {renderDailyChartLines()}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 口碑聲量圖 */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />{" "}
                  口碑聲量指標（Google 評論）
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyMetrics.chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                        domain={["auto", "auto"]}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "16px",
                          fontSize: "11px",
                        }}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ fontSize: "10px", fontWeight: 900 }}
                      />
                      {renderDailyReviewsLines()}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 明細清單 */}
              <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    每日紀錄詳細日誌
                  </h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-50 text-slate-400 sticky top-0 font-bold uppercase">
                      <tr>
                        <th className="p-4">日期</th>
                        <th className="p-4">分院</th>
                        <th className="p-4 text-blue-600">諮詢</th>
                        <th className="p-4 text-emerald-600">手術</th>
                        <th className="p-4">下月預約</th>
                        <th className="p-4">評論</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {dailyMetrics.dailyLogs.map((r, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="p-4 font-bold text-slate-400">
                            {r.date.slice(5)}
                          </td>
                          <td className="p-4 font-black text-slate-900">
                            {r.branch}
                          </td>
                          <td className="p-4 font-black text-blue-600">
                            {r.currentC}
                          </td>
                          <td className="p-4 font-black text-emerald-600">
                            {r.currentS}
                          </td>
                          <td className="p-4 text-slate-500 font-bold">
                            {r.nextC} / {r.nextS}
                          </td>
                          <td className="p-4 text-amber-600 font-black">
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
          <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            {/* 1. 年度大局走勢 */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex flex-wrap justify-between items-end gap-6 mb-8">
                <div>
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-blue-600" />{" "}
                    年度戰略走勢全覽 (Macro Annual Trend)
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    追蹤跨年度產能擴張與醫療品質穩定度
                  </p>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="bg-slate-100 p-1 rounded-2xl flex gap-1 text-[11px] font-black uppercase">
                    <button
                      onClick={() => setStratFilterMode("aggregate")}
                      className={`px-5 py-2.5 rounded-xl transition-all ${
                        stratFilterMode === "aggregate"
                          ? "bg-white text-slate-900 shadow-md"
                          : "text-slate-400"
                      }`}
                    >
                      全院加總
                    </button>
                    <button
                      onClick={() => setStratFilterMode("compare")}
                      className={`px-5 py-2.5 rounded-xl transition-all ${
                        stratFilterMode === "compare"
                          ? "bg-white text-slate-900 shadow-md"
                          : "text-slate-400"
                      }`}
                    >
                      單一分院
                    </button>
                  </div>
                  {stratFilterMode === "compare" && (
                    <select
                      value={stratBranch}
                      onChange={(e) => setStratBranch(e.target.value)}
                      className="bg-slate-100 border-none rounded-2xl px-5 py-2.5 text-xs font-black"
                    >
                      {BRANCHES.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="h-10 w-px bg-slate-200 mx-2"></div>
                  <div className="bg-blue-600 p-1 rounded-2xl flex gap-1 text-[11px] font-black uppercase">
                    <button
                      onClick={() => setStratView("macro_A")}
                      className={`px-5 py-2.5 rounded-xl transition-all ${
                        stratView === "macro_A"
                          ? "bg-white text-blue-700 shadow-md"
                          : "text-white opacity-60"
                      }`}
                    >
                      視角 A: 產值流量
                    </button>
                    <button
                      onClick={() => setStratView("macro_B")}
                      className={`px-5 py-2.5 rounded-xl transition-all ${
                        stratView === "macro_B"
                          ? "bg-white text-blue-700 shadow-md"
                          : "text-white opacity-60"
                      }`}
                    >
                      視角 B: 醫療品質
                    </button>
                  </div>
                </div>
              </div>
              <div className="h-96">
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
                      tick={{ fontSize: 12, fontWeight: 800, fill: "#94a3b8" }}
                    />
                    <YAxis
                      yAxisId="left"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fontWeight: 700, fill: "#94a3b8" }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fontWeight: 700, fill: "#94a3b8" }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "20px",
                        border: "none",
                        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    {stratView === "macro_A" ? (
                      <>
                        <Bar
                          yAxisId="right"
                          dataKey="revenue"
                          name="年度總營收"
                          fill="#fbbf24"
                          radius={[12, 12, 0, 0]}
                          barSize={40}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="consultation"
                          name="諮詢總量"
                          stroke="#2563eb"
                          strokeWidth={4}
                          dot={{ r: 5, fill: "#2563eb" }}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="surgery"
                          name="手術總量"
                          stroke="#16a34a"
                          strokeWidth={4}
                          dot={{ r: 5, fill: "#16a34a" }}
                        />
                      </>
                    ) : (
                      <>
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="conv"
                          name="平均轉換率 (%)"
                          stroke="#7c3aed"
                          strokeWidth={4}
                          dot={{ r: 5, fill: "#7c3aed" }}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="succ"
                          name="醫療成功率 (%)"
                          stroke="#06b6d4"
                          strokeWidth={4}
                          dot={{ r: 5, fill: "#06b6d4" }}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="asp"
                          name="平均 ASP (客單價)"
                          fill="#e2e8f0"
                          radius={[12, 12, 0, 0]}
                          barSize={30}
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* 💡 修復關鍵 Bug 2：加上 [...] 淺拷貝再 sort，徹底防堵記憶體污染造成的頁籤全白 */}
              <div className="mt-12 overflow-hidden rounded-3xl border border-slate-100">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-400 font-black uppercase">
                    <tr>
                      <th className="p-4">年度指標</th>
                      <th className="p-4">總諮詢量</th>
                      <th className="p-4">YoY</th>
                      <th className="p-4">總手術量</th>
                      <th className="p-4">YoY</th>
                      <th className="p-4">總營業額</th>
                      <th className="p-4">YoY</th>
                      <th className="p-4">平均 ASP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...strategyData.yearlyTrend]
                      .sort((a, b) => b.name - a.name)
                      .map((y, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-50 transition-all font-bold"
                        >
                          <td className="p-4 text-slate-900 font-black text-sm">
                            {y.name}
                          </td>
                          <td className="p-4 text-blue-600">
                            {y.consultation.toLocaleString()}
                          </td>
                          <td
                            className={`p-4 ${
                              y.yoyCon.includes("-")
                                ? "text-red-500"
                                : "text-green-600"
                            }`}
                          >
                            {y.yoyCon}
                          </td>
                          <td className="p-4 text-emerald-600">
                            {y.surgery.toLocaleString()}
                          </td>
                          <td
                            className={`p-4 ${
                              y.yoySur.includes("-")
                                ? "text-red-500"
                                : "text-green-600"
                            }`}
                          >
                            {y.yoySur}
                          </td>
                          <td className="p-4 text-amber-600">
                            ${(y.revenue / 10000).toFixed(0)}萬
                          </td>
                          <td
                            className={`p-4 ${
                              y.yoyRev.includes("-")
                                ? "text-red-500"
                                : "text-green-600"
                            }`}
                          >
                            {y.yoyRev}
                          </td>
                          <td className="p-4 text-slate-400">
                            ${y.asp.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. 月度 YoY 戰術對比 */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex flex-wrap justify-between items-end gap-6 mb-8">
                <div>
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <BarChart2 className="w-6 h-6 text-purple-600" /> 月度 YoY
                    戰術對比分析
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    基準年：{stratBaseYear} vs 前期：
                    {parseInt(stratBaseYear) - 1}
                  </p>
                </div>
                <div className="flex gap-4 items-center">
                  <select
                    value={stratBaseYear}
                    onChange={(e) => setStratBaseYear(e.target.value)}
                    className="bg-slate-100 border-none rounded-2xl px-5 py-2.5 text-xs font-black"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y} 年
                      </option>
                    ))}
                  </select>
                  <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1 text-[10px] font-black uppercase">
                    {[
                      { id: "revenue", label: "營收", icon: DollarSign },
                      { id: "consultation", label: "諮詢", icon: Activity },
                      { id: "surgery", label: "手術", icon: Target },
                      { id: "conversion", label: "轉換%", icon: Percent },
                      { id: "success", label: "成功%", icon: Star },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setStratMetric(m.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
                          stratMetric === m.id
                            ? "bg-white text-purple-700 shadow-md"
                            : "text-slate-400"
                        }`}
                      >
                        <m.icon className="w-3.5 h-3.5" /> {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="h-80">
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
                      tick={{ fontSize: 12, fontWeight: 800, fill: "#94a3b8" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fontWeight: 700, fill: "#94a3b8" }}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "20px",
                        border: "none",
                        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Line
                      type="monotone"
                      dataKey="baseVal"
                      name={`${stratBaseYear}年度 (基準)`}
                      stroke="#7c3aed"
                      strokeWidth={5}
                      dot={{ r: 6, fill: "#7c3aed" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="prevVal"
                      name={`${parseInt(stratBaseYear) - 1}年度 (對比)`}
                      stroke="#cbd5e1"
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={{ r: 4, fill: "#cbd5e1" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* 表格 A: 月度 YoY 明細 */}
              <div className="mt-12 overflow-hidden rounded-3xl border border-slate-100 shadow-sm">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-900 text-white font-black uppercase">
                    <tr>
                      <th className="p-4">月度對比指標</th>
                      <th className="p-4">當期實績</th>
                      <th className="p-4">前期對比</th>
                      <th className="p-4">YoY 成長率</th>
                      <th className="p-4">轉換率</th>
                      <th className="p-4">YoY</th>
                      <th className="p-4">成功率</th>
                      <th className="p-4">YoY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {strategyData.monthlyYoY.map((m, i) => (
                      <tr
                        key={i}
                        className="hover:bg-slate-50 transition-all font-bold"
                      >
                        <td className="p-4 text-slate-400 font-black">
                          {m.name}
                        </td>
                        <td className="p-4 text-slate-900 font-black text-sm">
                          {stratMetric === "revenue"
                            ? `$${(m.baseVal / 10000).toFixed(0)}萬`
                            : m.baseVal}
                        </td>
                        <td className="p-4 text-slate-400">
                          {stratMetric === "revenue"
                            ? `$${(m.prevVal / 10000).toFixed(0)}萬`
                            : m.prevVal}
                        </td>
                        <td
                          className={`p-4 flex items-center gap-1 ${
                            m.yoy.includes("-")
                              ? "text-red-500"
                              : "text-green-600"
                          }`}
                        >
                          {m.yoy.includes("-") ? (
                            <TrendingDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          {m.yoy}
                        </td>
                        <td className="p-4 text-purple-600">
                          {m.curData.conv || 0}%
                        </td>
                        <td
                          className={`p-4 ${
                            calcYoY(m.curData.conv, m.prevData.conv).includes(
                              "-"
                            )
                              ? "text-red-500"
                              : "text-green-600"
                          }`}
                        >
                          {calcYoY(m.curData.conv, m.prevData.conv)}
                        </td>
                        <td className="p-4 text-blue-600">
                          {m.curData.succ || 0}%
                        </td>
                        <td
                          className={`p-4 ${
                            calcYoY(m.curData.succ, m.prevData.succ).includes(
                              "-"
                            )
                              ? "text-red-500"
                              : "text-green-600"
                          }`}
                        >
                          {calcYoY(m.curData.succ, m.prevData.succ)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. 歷史戰略明細數據庫 */}
            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  歷史戰略明細數據紀錄
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-50 text-slate-400 font-bold">
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
                    {[...strategyData.processedHistory]
                      .sort((a, b) => b.id.localeCompare(a.id))
                      .slice(0, 24)
                      .map((h, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-50 transition-colors font-semibold"
                        >
                          <td className="p-3 font-bold text-slate-400">
                            {h.year}-{h.month}
                          </td>
                          <td className="p-3 font-black text-slate-800">
                            {h.branch}
                          </td>
                          <td className="p-3">{h.consultation}</td>
                          <td className="p-3">{h.surgery}</td>
                          <td className="p-3 font-bold text-slate-900">
                            ${(h.revenue / 10000).toFixed(1)}萬
                          </td>
                          <td className="p-3 text-amber-600 font-black">
                            ${h.asp.toLocaleString()}
                          </td>
                          <td className="p-3 text-purple-600 font-black">
                            {h.conv}%
                          </td>
                          <td className="p-3 text-blue-600 font-black">
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
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex flex-wrap gap-4 items-end mb-8">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-2">
                    維護年份
                  </label>
                  <select
                    value={maintYear}
                    onChange={(e) => setMaintYear(e.target.value)}
                    className="bg-slate-100 border-none rounded-2xl px-5 py-3 text-sm font-black"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y} 年
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-2">
                    維護分院
                  </label>
                  <select
                    value={maintBranch}
                    onChange={(e) => setMaintBranch(e.target.value)}
                    className="bg-slate-100 border-none rounded-2xl px-5 py-3 text-sm font-black"
                  >
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-grow"></div>
                <button
                  onClick={handleMaintBulkSave}
                  disabled={uiStatus.loading}
                  className="bg-blue-600 text-white font-black px-6 py-3 rounded-2xl shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <Database className="w-4 h-4" /> 批次儲存年度資料 ({maintYear}
                  )
                </button>
              </div>
              {uiStatus.msg && (
                <p className="mb-4 text-center text-xs font-black text-blue-600 bg-blue-50 p-3 rounded-2xl border border-blue-100">
                  {uiStatus.msg}
                </p>
              )}

              <div className="overflow-x-auto rounded-3xl border border-slate-50">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                    <tr>
                      <th className="p-5 text-left">月份</th>
                      <th className="p-5 text-left text-blue-600">諮詢量</th>
                      <th className="p-5 text-left text-emerald-600">手術量</th>
                      <th className="p-5 text-left text-amber-600">
                        總營收(NT$)
                      </th>
                      <th className="p-5 text-left text-purple-600">
                        CRM 轉換率%
                      </th>
                      <th className="p-5 text-left text-cyan-600">
                        醫療成功率%
                      </th>
                      <th className="p-5 text-center">單月</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {MONTHS.map((m) => {
                      const id = `${maintYear}-${m}_${maintBranch}`;
                      const existing =
                        strategyData.processedHistory.find(
                          (h) => h.id === id
                        ) || {};
                      return (
                        <tr
                          key={m}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="p-5 font-black text-slate-300 text-xl">
                            {m}
                          </td>
                          <td className="p-5">
                            <input
                              type="number"
                              defaultValue={existing.consultation}
                              onChange={(e) =>
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    consultation: e.target.value,
                                  },
                                }))
                              }
                              className="w-24 bg-slate-50 border-none rounded-xl p-2 font-black text-blue-600 focus:ring-2 ring-blue-500"
                            />
                          </td>
                          <td className="p-5">
                            <input
                              type="number"
                              defaultValue={existing.surgery}
                              onChange={(e) =>
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    surgery: e.target.value,
                                  },
                                }))
                              }
                              className="w-24 bg-slate-50 border-none rounded-xl p-2 font-black text-emerald-600 focus:ring-2 ring-emerald-500"
                            />
                          </td>
                          <td className="p-5">
                            <input
                              type="number"
                              defaultValue={existing.revenue}
                              onChange={(e) =>
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    revenue: e.target.value,
                                  },
                                }))
                              }
                              className="w-36 bg-slate-50 border-none rounded-xl p-2 font-black text-amber-600 focus:ring-2 ring-amber-500"
                            />
                          </td>
                          <td className="p-5">
                            <input
                              type="number"
                              step="0.1"
                              defaultValue={existing.conv}
                              onChange={(e) =>
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    conversion: e.target.value,
                                  },
                                }))
                              }
                              className="w-20 bg-slate-50 border-none rounded-xl p-2 font-black text-purple-600 focus:ring-2 ring-purple-500"
                            />{" "}
                            <span className="text-slate-300">%</span>
                          </td>
                          <td className="p-5">
                            <input
                              type="number"
                              step="0.1"
                              defaultValue={existing.succ}
                              onChange={(e) =>
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    successRate: e.target.value,
                                  },
                                }))
                              }
                              className="w-20 bg-slate-50 border-none rounded-xl p-2 font-black text-cyan-600 focus:ring-2 ring-cyan-500"
                            />{" "}
                            <span className="text-slate-300">%</span>
                          </td>
                          <td className="p-5 text-center">
                            <button
                              onClick={() => handleMaintSave(m)}
                              className="bg-white border border-slate-200 hover:bg-slate-900 hover:text-white p-2.5 rounded-xl transition-all"
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
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-24 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-blue-100 shadow-2xl">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter">
                WishVision <span className="text-blue-600">Enterprise BI</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                Global Dynamic Strategy Hub
              </p>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] gap-1">
            {[
              { id: "daily", label: "每日動能追蹤", icon: Zap },
              { id: "strategy", label: "歷史戰略看板", icon: BarChart2 },
              { id: "maintenance", label: "數據維護矩陣", icon: Database },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-[11px] font-black transition-all ${
                  activeTab === tab.id
                    ? "bg-white shadow-xl text-slate-900"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <main className="max-w-7xl mx-auto px-6 py-10">{renderContent()}</main>
    </div>
  );
}
