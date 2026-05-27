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

export default function App() {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    branch: BRANCHES[0],
    currentC: "",
    currentS: "",
    nextC: "",
    nextS: "",
  });

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [selectedBranches, setSelectedBranches] = useState(BRANCHES);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUiStatus({ loading: true, msg: "正在儲存紀錄...", type: "info" });

    const { date, branch, currentC, currentS, nextC, nextS } = formData;
    if (!currentC || !currentS || !nextC || !nextS) {
      setUiStatus({ loading: false, msg: "請填寫所有數據欄位", type: "error" });
      return;
    }

    const docId = `${date}_${branch}`;
    try {
      await setDoc(doc(db, "wishvision_stats", docId), {
        date,
        branch,
        month: date.slice(0, 7),
        day: parseInt(date.split("-")[2], 10),
        currentC: parseInt(currentC, 10),
        currentS: parseInt(currentS, 10),
        nextC: parseInt(nextC, 10),
        nextS: parseInt(nextS, 10),
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

  const { chartData, summaryMetrics, latestUpdateStr } = useMemo(() => {
    const filtered = dbData.filter((d) => d.month === selectedMonth);
    const uniqueDates = Array.from(new Set(filtered.map((d) => d.date))).sort();

    let maxDayPassed = 1;
    filtered.forEach((d) => {
      if (d.day > maxDayPassed) maxDayPassed = d.day;
    });

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
        day: 0,
      };
    });

    uniqueDates.forEach((dateStr) => {
      const currentDayDocs = filtered.filter((d) => d.date === dateStr);
      currentDayDocs.forEach((d) => {
        if (d.timestamp > (branchLatest[d.branch]?.timestamp || 0)) {
          branchLatest[d.branch] = d;
        }
      });

      let aggRow = {
        date: dateStr.slice(5),
        currentC: 0,
        currentS: 0,
        nextC: 0,
        nextS: 0,
      };

      selectedBranches.forEach((b) => {
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
        if (activeData) {
          aggRow.currentC += activeData.currentC || 0;
          aggRow.currentS += activeData.currentS || 0;
          aggRow.nextC += activeData.nextC || 0;
          aggRow.nextS += activeData.nextS || 0;

          aggRow[`${b}_currentC`] = activeData.currentC || 0;
          aggRow[`${b}_currentS`] = activeData.currentS || 0;
          aggRow[`${b}_nextC`] = activeData.nextC || 0;
          aggRow[`${b}_nextS`] = activeData.nextS || 0;
        }
      });

      chartDataAggregate.push(aggRow);
    });

    let totalCurrentC = 0,
      totalCurrentS = 0,
      totalNextC = 0,
      totalNextS = 0;
    selectedBranches.forEach((b) => {
      const activeData = filtered
        .filter((d) => d.branch === b)
        .sort((a, b) => b.day - a.day || b.timestamp - a.timestamp)[0];
      if (activeData) {
        totalCurrentC += activeData.currentC || 0;
        totalCurrentS += activeData.currentS || 0;
        totalNextC += activeData.nextC || 0;
        totalNextS += activeData.nextS || 0;
      }
    });

    const forecastCurrentC =
      maxDayPassed > 0
        ? Math.round((totalCurrentC / maxDayPassed) * totalDaysInMonth)
        : totalCurrentC;
    const forecastCurrentS =
      maxDayPassed > 0
        ? Math.round((totalCurrentS / maxDayPassed) * totalDaysInMonth)
        : totalCurrentS;
    const forecastNextC =
      maxDayPassed > 0
        ? Math.round((totalNextC / maxDayPassed) * totalDaysInMonth)
        : totalNextC;
    const forecastNextS =
      maxDayPassed > 0
        ? Math.round((totalNextS / maxDayPassed) * totalDaysInMonth)
        : totalNextS;

    let latestTs = 0;
    filtered.forEach((d) => {
      if (d.timestamp > latestTs) latestTs = d.timestamp;
    });
    const latestUpdateStr = latestTs
      ? new Date(latestTs).toLocaleTimeString()
      : "無";

    return {
      chartData: chartDataAggregate,
      summaryMetrics: {
        currentC: totalCurrentC,
        currentS: totalCurrentS,
        nextC: totalNextC,
        nextS: totalNextS,
        foreC: forecastCurrentC,
        foreS: forecastCurrentS,
        foreNextC: forecastNextC,
        foreNextS: forecastNextS,
        progress: `${maxDayPassed}/${totalDaysInMonth}天`,
      },
      latestUpdateStr,
    };
  }, [dbData, selectedMonth, selectedBranches]);

  const renderChartLines = () => {
    if (viewMode === "aggregate") {
      return (
        <>
          <Line
            type="monotone"
            dataKey="currentC"
            name="本月累積諮詢"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="nextC"
            name="下月預約諮詢"
            stroke="#7c3aed"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
          <Line
            type="monotone"
            dataKey="currentS"
            name="本月累積手術"
            stroke="#16a34a"
            strokeWidth={3}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="nextS"
            name="下月預約手術"
            stroke="#06b6d4"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        </>
      );
    } else {
      const colors = ["#2563eb", "#16a34a", "#7c3aed", "#06b6d4"];
      return selectedBranches.map((b, idx) => (
        <React.Fragment key={b}>
          <Line
            type="monotone"
            dataKey={`${b}_currentC`}
            name={`${b} 本月諮詢`}
            stroke={colors[idx % colors.length]}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey={`${b}_currentS`}
            name={`${b} 本月手術`}
            stroke={colors[idx % colors.length]}
            strokeWidth={2}
            strokeDasharray="3 3"
          />
        </React.Fragment>
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50 space-y-3">
                <span className="text-xs font-bold text-blue-700 flex items-center gap-1">
                  當月累積指標 ({parseInt(formData.date.split("-")[1], 10)}月)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="number"
                      name="currentC"
                      placeholder="諮詢量"
                      value={formData.currentC}
                      onChange={handleFormChange}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
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
              </div>

              <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100/50 space-y-3">
                <span className="text-xs font-bold text-purple-700 flex items-center gap-1">
                  下月預約儲備 (
                  {parseInt(formData.date.split("-")[1], 10) === 12
                    ? 1
                    : parseInt(formData.date.split("-")[1], 10) + 1}
                  月)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="number"
                      name="nextC"
                      placeholder="預約諮詢"
                      value={formData.nextC}
                      onChange={handleFormChange}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
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
                    uiStatus.type === "success"
                      ? "bg-green-50 border-green-200 text-green-700"
                      : uiStatus.type === "error"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-blue-50 border-blue-200 text-blue-700"
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
                合併加總模式
              </button>
              <button
                onClick={() => setViewMode("compare")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === "compare"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                分院對比模式
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase block mb-2 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> 分院篩選
            </span>
            <div className="flex flex-wrap gap-2">
              {BRANCHES.map((b) => {
                const active = selectedBranches.includes(b);
                return (
                  <button
                    key={b}
                    onClick={() => handleBranchToggle(b)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1 ${
                      active
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {active && (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    )}{" "}
                    {b}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-blue-600 px-4 py-2.5 text-white font-semibold text-sm flex justify-between items-center">
                <span>諮詢量動能 (所選分院加總)</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-normal">
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
                  <p className="text-xs text-slate-400 mt-2">
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
                  <p className="text-xs text-slate-400 mt-2">
                    下月預估存量：
                    <span className="font-semibold text-slate-700">
                      {summaryMetrics.foreNextC}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-emerald-600 px-4 py-2.5 text-white font-semibold text-sm flex justify-between items-center">
                <span>手術量動能 (所選分院加總)</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-normal">
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
                  <p className="text-xs text-slate-400 mt-2">
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
                  <p className="text-xs text-slate-400 mt-2">
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
            <div className="w-full h-80">
              {chartData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                  該月份目前尚無數據紀錄
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
        </div>
      </div>
    </div>
  );
}
