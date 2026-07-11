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
  Lock,
  Unlock,
  X,
  HelpCircle,
  Info,
  Sparkles,
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
const MAINT_BRANCHES = [...BRANCHES, "全院總計"];
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

// --- 🔑 Google Places API 設定 ---
const GOOGLE_API_KEY = "AIzaSyDSUvpggI_9eUomipSO0wnBhAqLcH1k75U";
const PLACE_IDS = {
  台北館前院: "ChIJOUn0JHOpQjQR8Ta_Y_gRO84",
  台北仁愛院: "ChIJz9OotYSrQjQRnSVsov3Vy7g",
  台中東興院: "ChIJWzXUcuI9aTQReoSSKPzkDGk",
  新竹光明院: "ChIJeR9GzQo3aDQR5YcSkFT-ljQ",
};

// 輔助函數：計算 YoY
const calcYoY = (cur, prev) => {
  if (
    prev === null ||
    prev === undefined ||
    prev === 0 ||
    cur === null ||
    cur === undefined
  )
    return "--";
  const change = ((cur - prev) / prev) * 100;
  return (change > 0 ? "+" : "") + change.toFixed(1) + "%";
};

// 核心輔助函數：計算精準平均（忽略 Null，包含 0）
const getAvg = (docs, key) => {
  const validDocs = docs.filter((d) => d[key] !== null && d[key] !== undefined);
  if (validDocs.length === 0) return 0;
  const sum = validDocs.reduce((acc, cur) => acc + Number(cur[key]), 0);
  return parseFloat((sum / validDocs.length).toFixed(1));
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

  // 說明視窗開關狀態
  const [showInfoVolume, setShowInfoVolume] = useState(false);
  const [showInfoQuality, setShowInfoQuality] = useState(false);
  const [showInfoFinance, setShowInfoFinance] = useState(false);
  const [showInfoRev, setShowInfoRev] = useState(false);
  const [showInfoReviewNew, setShowInfoReviewNew] = useState(false);

  // 維護矩陣狀態
  const [maintYear, setMaintYear] = useState(
    new Date().getFullYear().toString()
  );
  const [maintBranch, setMaintBranch] = useState(BRANCHES[0]);
  const [maintGrid, setMaintGrid] = useState({});
  const [isMaintEditing, setIsMaintEditing] = useState(false);

  const [uiStatus, setUiStatus] = useState({
    loading: false,
    msg: "",
    type: "",
  });
  const [isFetchingReviews, setIsFetchingReviews] = useState(false);

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

  useEffect(() => {
    setMaintGrid({});
    setIsMaintEditing(false);
  }, [maintYear, maintBranch]);

  const handleMetricToggle = (metricKey) => {
    if (selectedMetrics.includes(metricKey)) {
      if (selectedMetrics.length > 1)
        setSelectedMetrics(selectedMetrics.filter((m) => m !== metricKey));
    } else {
      setSelectedMetrics([...selectedMetrics, metricKey]);
    }
  };

  // --- 每日動能計算 (含全局 LOCF 與新增數) ---
  const dailyMetrics = useMemo(() => {
    const currentMonthDocs = dbData.filter(
      (d) => (d.month || d.date.slice(0, 7)) === selectedMonth
    );
    const [year, month] = selectedMonth.split("-").map(Number);
    const totalDays = new Date(year, month, 0).getDate();

    // 建立按日期的時間軸排序
    const uniqueDates = Array.from(
      new Set(currentMonthDocs.map((d) => d.date))
    ).sort();

    // 建立分院狀態追蹤歷史 (LOCF 演算法 - 全面套用於所有指標)
    let branchStateHistory = {};
    let runningState = {};
    BRANCHES.forEach((b) => {
      runningState[b] = {
        currentC: 0,
        currentS: 0,
        nextC: 0,
        nextS: 0,
        reviews: null,
      };
    });

    uniqueDates.forEach((dateStr) => {
      BRANCHES.forEach((b) => {
        const bDocs = currentMonthDocs
          .filter((d) => d.date === dateStr && d.branch === b)
          .sort((a, b) => b.timestamp - a.timestamp);

        let activeData = { ...runningState[b] }; // 繼承上一筆狀態

        if (bDocs.length > 0) {
          const doc = bDocs[0];

          // Google 評論防呆
          let rVal = doc.reviews;
          if (
            rVal !== 0 &&
            rVal !== null &&
            rVal !== undefined &&
            rVal !== ""
          ) {
            activeData.reviews = Number(rVal);
            runningState[b].reviews = activeData.reviews;
          }

          // 其他流量指標防呆 (諮詢、手術、預約)
          ["currentC", "currentS", "nextC", "nextS"].forEach((k) => {
            let val = doc[k];
            if (val !== null && val !== undefined && val !== "") {
              activeData[k] = Number(val);
              runningState[b][k] = activeData[k];
            }
          });
        }

        branchStateHistory[`${dateStr}_${b}`] = {
          ...activeData,
          date: dateStr,
          branch: b,
        };
      });
    });

    let branchSummary = [];
    let totalCurC = 0,
      totalCurS = 0,
      totalCurR = 0,
      totalFirstDayR = 0,
      totalForeC = 0,
      totalForeS = 0,
      totalForeR = 0;
    let maxDayObserved = 1;

    BRANCHES.forEach((b) => {
      // 獲取該分院當月所有 LOCF 填補後的歷史紀錄
      const bLocfDocs = uniqueDates
        .map((dateStr) => branchStateHistory[`${dateStr}_${b}`])
        .filter(Boolean);

      let curC = 0,
        curS = 0,
        nextC = 0,
        nextS = 0,
        avgC = 0,
        avgS = 0,
        foreC = 0,
        foreS = 0;

      if (bLocfDocs.length > 0) {
        const lastLocf = bLocfDocs[bLocfDocs.length - 1];
        curC = lastLocf.currentC || 0;
        curS = lastLocf.currentS || 0;
        nextC = lastLocf.nextC || 0;
        nextS = lastLocf.nextS || 0;

        // 計算最大天數 (以有真實填寫紀錄的最後一天為主)
        const bRealDocs = currentMonthDocs
          .filter((d) => d.branch === b)
          .sort((a, b) => a.day - b.day);

        const day =
          bRealDocs.length > 0
            ? bRealDocs[bRealDocs.length - 1].day ||
              parseInt(bRealDocs[bRealDocs.length - 1].date.split("-")[2], 10)
            : 1;

        if (selectedBranches.includes(b) && day > maxDayObserved) {
          maxDayObserved = day;
        }

        const safeMinC = bLocfDocs.find((d) => d.currentC > 0)?.currentC || 0;
        const safeMinS = bLocfDocs.find((d) => d.currentS > 0)?.currentS || 0;

        const rem = totalDays - day;

        if (curC > safeMinC && day > 0) {
          avgC = (curC - safeMinC) / day;
          foreC = Math.round(curC + avgC * rem);
        } else {
          foreC = curC;
        }

        if (curS > safeMinS && day > 0) {
          avgS = (curS - safeMinS) / day;
          foreS = Math.round(curS + avgS * rem);
        } else {
          foreS = curS;
        }
      }

      // 評論指標計算
      const validRevs = bLocfDocs
        .map((d) => d.reviews)
        .filter((r) => r !== null && r !== undefined && r > 0);
      const minR = validRevs.length > 0 ? Math.min(...validRevs) : 0;
      const curR = validRevs.length > 0 ? validRevs[validRevs.length - 1] : 0;
      const firstDayR = validRevs.length > 0 ? validRevs[0] : 0; // 本月第一筆有效資料

      let dayForR = maxDayObserved;
      const docWithLastValidR = bLocfDocs
        .slice()
        .reverse()
        .find((d) => d.reviews > 0);
      if (docWithLastValidR) {
        dayForR =
          parseInt(docWithLastValidR.date.split("-")[2], 10) || maxDayObserved;
      }

      const remR = totalDays - dayForR;
      let avgR = 0,
        foreR = curR;
      if (curR > minR && dayForR > 0) {
        avgR = (curR - minR) / dayForR;
        foreR = Math.round(curR + avgR * remR);
      }

      branchSummary.push({
        branch: b,
        curC,
        curS,
        nextC,
        nextS,
        avgC: avgC.toFixed(1),
        avgS: avgS.toFixed(1),
        avgR: avgR.toFixed(1),
        reviews: curR,
        isFiltered: selectedBranches.includes(b),
      });

      if (selectedBranches.includes(b)) {
        totalCurC += curC;
        totalCurS += curS;
        totalCurR += curR;
        totalFirstDayR += firstDayR;
        totalForeC += foreC;
        totalForeS += foreS;
        totalForeR += foreR;
      }
    });

    const thisMonthNewR =
      totalCurR > 0 && totalFirstDayR > 0 ? totalCurR - totalFirstDayR : 0;

    // Daily Logs 呈現平滑後的數據
    const dailyLogs = [];
    uniqueDates.forEach((dateStr) => {
      BRANCHES.forEach((b) => {
        const exists = currentMonthDocs.some(
          (d) => d.date === dateStr && d.branch === b
        );
        if (exists && selectedBranches.includes(b)) {
          const originalDoc = currentMonthDocs.find(
            (d) => d.date === dateStr && d.branch === b
          );
          const smoothedData = branchStateHistory[`${dateStr}_${b}`];
          dailyLogs.push({
            ...originalDoc,
            currentC: smoothedData.currentC || 0,
            currentS: smoothedData.currentS || 0,
            nextC: smoothedData.nextC || 0,
            nextS: smoothedData.nextS || 0,
            reviews: smoothedData.reviews || 0,
          });
        }
      });
    });
    dailyLogs.sort(
      (a, b) => b.date.localeCompare(a.date) || a.branch.localeCompare(b.branch)
    );

    let chartDataAggregate = [];
    let previousBranchRevs = {}; // 追蹤昨天的評論數以計算每日新增
    uniqueDates.forEach((dateStr) => {
      let aggRow = {
        date: dateStr.slice(5),
        currentC: 0,
        currentS: 0,
        nextC: 0,
        nextS: 0,
        reviews: 0,
        newReviews: 0,
      };
      let totalNewRevForDay = 0;

      BRANCHES.forEach((b) => {
        const activeData = branchStateHistory[`${dateStr}_${b}`];
        if (activeData && selectedBranches.includes(b)) {
          const revs = activeData.reviews || 0;
          const prevRev =
            previousBranchRevs[b] !== undefined ? previousBranchRevs[b] : revs;
          const newRev = Math.max(0, revs - prevRev);
          previousBranchRevs[b] = revs;
          totalNewRevForDay += newRev;

          aggRow.currentC += activeData.currentC || 0;
          aggRow.currentS += activeData.currentS || 0;
          aggRow.nextC += activeData.nextC || 0;
          aggRow.nextS += activeData.nextS || 0;
          aggRow.reviews += revs;

          aggRow[`${b}_currentC`] = activeData.currentC || 0;
          aggRow[`${b}_currentS`] = activeData.currentS || 0;
          aggRow[`${b}_nextC`] = activeData.nextC || 0;
          aggRow[`${b}_nextS`] = activeData.nextS || 0;
          aggRow[`${b}_reviews`] = revs;
          aggRow[`${b}_newReviews`] = newRev;
        }
      });
      aggRow.newReviews = totalNewRevForDay;
      chartDataAggregate.push(aggRow);
    });

    return {
      branchSummary,
      totalCurC,
      totalCurS,
      totalCurR,
      thisMonthNewR,
      totalForeC,
      totalForeS,
      totalForeR,
      maxDayObserved,
      totalDays,
      dailyLogs,
      chartData: chartDataAggregate,
    };
  }, [dbData, selectedMonth, selectedBranches]);

  // --- 5. 戰略看板數據矩陣 (全圖表套用 Rolling Baseline) ---
  const strategyData = useMemo(() => {
    const processedHistory = historyData.map((d) => ({
      ...d,
      revenue:
        d.revenue === null || d.revenue === undefined || d.revenue === ""
          ? null
          : Number(d.revenue),
      consultation:
        d.consultation === null ||
        d.consultation === undefined ||
        d.consultation === ""
          ? null
          : Number(d.consultation),
      surgery:
        d.surgery === null || d.surgery === undefined || d.surgery === ""
          ? null
          : Number(d.surgery),
      conv:
        d.conversion === null ||
        d.conversion === undefined ||
        d.conversion === ""
          ? null
          : Number(d.conversion),
      succ:
        d.successRate === null ||
        d.successRate === undefined ||
        d.successRate === ""
          ? null
          : Number(d.successRate),
    }));

    const isAgg = stratFilterMode === "aggregate";
    const branchDocs = processedHistory.filter((d) =>
      isAgg ? BRANCHES.includes(d.branch) : d.branch === stratBranch
    );
    const groupDocs = processedHistory.filter((d) => d.branch === "全院總計");

    // 💡 解析每日紀錄，生成全年度的評論月數據
    const monthlyReviewsMap = {};
    BRANCHES.forEach((b) => {
      const bDailyDocs = dbData
        .filter((d) => d.branch === b)
        .sort((a, b) => a.date.localeCompare(b.date));
      let prevMonthLastReview = 0;
      const bMonths = Array.from(
        new Set(bDailyDocs.map((d) => d.date.slice(0, 7)))
      );
      bMonths.forEach((ym) => {
        const ymDocs = bDailyDocs.filter((d) => d.date.startsWith(ym));

        // 抓取當月有效(大於0)的紀錄
        const validDocs = ymDocs.filter((d) => d.reviews > 0);
        const total =
          validDocs.length > 0 ? validDocs[validDocs.length - 1].reviews : 0;

        let newRevs = 0;
        if (total > 0) {
          if (prevMonthLastReview > 0) {
            newRevs = Math.max(0, total - prevMonthLastReview);
          } else {
            // 這是該分院歷史上第一個有資料的月份(例如6月)，抓取該月第一筆有效資料做為起始基準
            const firstValidRev = validDocs[0].reviews;
            newRevs = Math.max(0, total - firstValidRev);
          }
          prevMonthLastReview = total;
        }
        monthlyReviewsMap[`${ym}_${b}`] = { total, new: newRevs };
      });
    });

    const getRevData = (ym, branchesArr) => {
      let total = null;
      let newRev = null;
      branchesArr.forEach((b) => {
        const d = monthlyReviewsMap[`${ym}_${b}`];
        if (d && d.total > 0) {
          total = (total || 0) + d.total;
          newRev = (newRev || 0) + d.new;
        }
      });
      return { total, newRev };
    };

    // 1. 年度趨勢
    const yearlyTrend = YEARS.map((y) => {
      const yBranchDocs = branchDocs.filter((d) => d.year === y);
      const yGroupDocs = groupDocs.filter((d) => d.year === y);

      const curRev = yBranchDocs.reduce(
        (acc, cur) => acc + (cur.revenue || 0),
        0
      );
      const curSur = yBranchDocs.reduce(
        (acc, cur) => acc + (cur.surgery || 0),
        0
      );
      const curCon = yBranchDocs.reduce(
        (acc, cur) => acc + (cur.consultation || 0),
        0
      );
      const asp = curSur > 0 ? Math.round(curRev / curSur) : 0;

      let avgConv = getAvg(yBranchDocs, "conv");
      let avgSucc = getAvg(yBranchDocs, "succ");
      if (
        isAgg &&
        yGroupDocs.some((d) => d.conv !== null && d.conv !== undefined)
      )
        avgConv = getAvg(yGroupDocs, "conv");
      if (
        isAgg &&
        yGroupDocs.some((d) => d.succ !== null && d.succ !== undefined)
      )
        avgSucc = getAvg(yGroupDocs, "succ");

      const prevYear = (parseInt(y) - 1).toString();
      const pBranchDocs = branchDocs.filter((d) => d.year === prevYear);
      const pGroupDocs = groupDocs.filter((d) => d.year === prevYear);
      const prevRev = pBranchDocs.reduce(
        (acc, cur) => acc + (cur.revenue || 0),
        0
      );
      const prevSur = pBranchDocs.reduce(
        (acc, cur) => acc + (cur.surgery || 0),
        0
      );
      const prevCon = pBranchDocs.reduce(
        (acc, cur) => acc + (cur.consultation || 0),
        0
      );
      const prevAsp = prevSur > 0 ? Math.round(prevRev / prevSur) : 0;

      let prevConv = getAvg(pBranchDocs, "conv");
      let prevSucc = getAvg(pBranchDocs, "succ");
      if (
        isAgg &&
        pGroupDocs.some((d) => d.conv !== null && d.conv !== undefined)
      )
        prevConv = getAvg(pGroupDocs, "conv");
      if (
        isAgg &&
        pGroupDocs.some((d) => d.succ !== null && d.succ !== undefined)
      )
        prevSucc = getAvg(pGroupDocs, "succ");

      // 抓取年度最後一個有效月份的總評論數
      let curRevTotal = null;
      let prevRevTotal = null;
      const targetBranches = isAgg ? BRANCHES : [stratBranch];

      targetBranches.forEach((b) => {
        let lastTotal = null;
        for (let m = 12; m >= 1; m--) {
          const ym = `${y}-${m.toString().padStart(2, "0")}`;
          if (
            monthlyReviewsMap[`${ym}_${b}`] &&
            monthlyReviewsMap[`${ym}_${b}`].total > 0
          ) {
            lastTotal = monthlyReviewsMap[`${ym}_${b}`].total;
            break;
          }
        }
        if (lastTotal !== null) curRevTotal = (curRevTotal || 0) + lastTotal;

        let pLastTotal = null;
        for (let m = 12; m >= 1; m--) {
          const ym = `${prevYear}-${m.toString().padStart(2, "0")}`;
          if (
            monthlyReviewsMap[`${ym}_${b}`] &&
            monthlyReviewsMap[`${ym}_${b}`].total > 0
          ) {
            pLastTotal = monthlyReviewsMap[`${ym}_${b}`].total;
            break;
          }
        }
        if (pLastTotal !== null)
          prevRevTotal = (prevRevTotal || 0) + pLastTotal;
      });

      return {
        name: y,
        revenue: curRev,
        surgery: curSur,
        consultation: curCon,
        conv: avgConv,
        succ: avgSucc,
        asp: asp,
        reviewTotal: curRevTotal,
        yoyRev: calcYoY(curRev, prevRev),
        yoySur: calcYoY(curSur, prevSur),
        yoyCon: calcYoY(curCon, prevCon),
        yoyConv: calcYoY(avgConv, prevConv),
        yoySucc: calcYoY(avgSucc, prevSucc),
        yoyAsp: calcYoY(asp, prevAsp),
        yoyReviewTotal: calcYoY(curRevTotal, prevRevTotal),
      };
    });

    // 2. 歷年季節常態模型大腦 (💡 升級：滾動式基準 Rolling Baseline)
    const currentDateObj = new Date();
    const currentYearNum = currentDateObj.getFullYear();
    const currentMonthNum = currentDateObj.getMonth() + 1; // 1-12

    const rollingCompletedDocs = processedHistory.filter((d) => {
      const dYear = Number(d.year);
      const dMonth = Number(d.month);
      // 納入過往所有年份，且納入今年「小於目前月份」的已完結月份
      return (
        dYear < currentYearNum ||
        (dYear === currentYearNum && dMonth < currentMonthNum)
      );
    });

    const targetBranches = isAgg ? BRANCHES : [stratBranch];

    const seasonalityBaseline = MONTHS.map((m) => {
      const targetMonthDocs = rollingCompletedDocs.filter(
        (d) =>
          d.month === m &&
          (isAgg ? BRANCHES.includes(d.branch) : d.branch === stratBranch)
      );
      const targetGroupDocs = rollingCompletedDocs.filter(
        (d) => d.month === m && d.branch === "全院總計"
      );

      const avgConsultation = getAvg(targetMonthDocs, "consultation");
      const avgSurgery = getAvg(targetMonthDocs, "surgery");
      const avgRevenue = getAvg(targetMonthDocs, "revenue");

      let avgConversion = getAvg(targetMonthDocs, "conv");
      let avgSuccess = getAvg(targetMonthDocs, "succ");

      if (
        isAgg &&
        targetGroupDocs.some((d) => d.conv !== null && d.conv !== undefined)
      )
        avgConversion = getAvg(targetGroupDocs, "conv");
      if (
        isAgg &&
        targetGroupDocs.some((d) => d.succ !== null && d.succ !== undefined)
      )
        avgSuccess = getAvg(targetGroupDocs, "succ");

      const validSurRevDocs = targetMonthDocs.filter(
        (d) => d.surgery !== null && d.revenue !== null
      );
      const sumSur = validSurRevDocs.reduce(
        (acc, cur) => acc + Number(cur.surgery),
        0
      );
      const sumRev = validSurRevDocs.reduce(
        (acc, cur) => acc + Number(cur.revenue),
        0
      );
      const avgASP = sumSur > 0 ? Math.round(sumRev / sumSur) : 0;

      // 評論新增的滾動基準平均
      let sumReviewNew = 0;
      let countReviewNew = 0;
      YEARS.forEach((y) => {
        if (
          Number(y) < currentYearNum ||
          (Number(y) === currentYearNum && Number(m) < currentMonthNum)
        ) {
          const ym = `${y}-${m}`;
          const rData = getRevData(ym, targetBranches);
          if (rData.newRev !== null) {
            sumReviewNew += rData.newRev;
            countReviewNew++;
          }
        }
      });
      const avgReviewNew =
        countReviewNew > 0 ? Math.round(sumReviewNew / countReviewNew) : 0;

      return {
        name: `${m}月`,
        avgConsultation: Math.round(avgConsultation),
        avgSurgery: Math.round(avgSurgery),
        avgConversion: avgConversion,
        avgSuccess: avgSuccess,
        avgASP: avgASP,
        avgRevenue: Math.round(avgRevenue),
        avgReviewNew: avgReviewNew,
      };
    });

    // 3. 月度 YoY 對比
    const prevYear = (parseInt(stratBaseYear) - 1).toString();
    const monthlyYoY = MONTHS.map((m) => {
      const curBranchDocs = branchDocs.filter(
        (d) => d.year === stratBaseYear && d.month === m
      );
      const curGroupDocs = groupDocs.filter(
        (d) => d.year === stratBaseYear && d.month === m
      );
      const prevBranchDocs = branchDocs.filter(
        (d) => d.year === prevYear && d.month === m
      );
      const prevGroupDocs = groupDocs.filter(
        (d) => d.year === prevYear && d.month === m
      );

      const aggregateDocs = (bDocs, gDocs) => {
        if (bDocs.length === 0 && gDocs.length === 0) return null;
        const getSum = (k) => {
          const valid = bDocs.filter(
            (d) => d[k] !== null && d[k] !== undefined
          );
          if (valid.length === 0) return null;
          return valid.reduce((sum, d) => sum + Number(d[k]), 0);
        };
        const hasGroupConv =
          isAgg && gDocs.some((d) => d.conv !== null && d.conv !== undefined);
        const hasGroupSucc =
          isAgg && gDocs.some((d) => d.succ !== null && d.succ !== undefined);

        const revSum = getSum("revenue");
        const surSum = getSum("surgery");
        const aspCalc = surSum > 0 ? Math.round(revSum / surSum) : null;

        return {
          revenue: revSum,
          consultation: getSum("consultation"),
          surgery: surSum,
          conv: hasGroupConv ? getAvg(gDocs, "conv") : getAvg(bDocs, "conv"),
          succ: hasGroupSucc ? getAvg(gDocs, "succ") : getAvg(bDocs, "succ"),
          asp: aspCalc,
        };
      };

      const curData = aggregateDocs(curBranchDocs, curGroupDocs) || {};
      const prevData = aggregateDocs(prevBranchDocs, prevGroupDocs) || {};

      const curYm = `${stratBaseYear}-${m}`;
      const prevYm = `${prevYear}-${m}`;
      const curRevData = getRevData(curYm, targetBranches);
      const prevRevData = getRevData(prevYm, targetBranches);

      curData.reviewTotal = curRevData.total;
      curData.reviewNew = curRevData.newRev;
      prevData.reviewTotal = prevRevData.total;
      prevData.reviewNew = prevRevData.newRev;

      const getVal = (obj, key) => {
        if (!obj) return null;
        if (key === "revenue") return obj.revenue;
        if (key === "consultation") return obj.consultation;
        if (key === "surgery") return obj.surgery;
        if (key === "conversion") return obj.conv;
        if (key === "success") return obj.succ;
        if (key === "asp") return obj.asp;
        if (key === "reviewTotal") return obj.reviewTotal;
        if (key === "reviewNew") return obj.reviewNew;
        return null;
      };

      const cV = getVal(curData, stratMetric);
      const pV = getVal(prevData, stratMetric);

      const baseline = seasonalityBaseline.find((b) => b.name === `${m}月`);
      let histAvg = null;
      if (baseline && stratMetric !== "reviewTotal") {
        // 評論總數隱藏均線
        if (stratMetric === "revenue") histAvg = baseline.avgRevenue;
        else if (stratMetric === "consultation")
          histAvg = baseline.avgConsultation;
        else if (stratMetric === "surgery") histAvg = baseline.avgSurgery;
        else if (stratMetric === "conversion") histAvg = baseline.avgConversion;
        else if (stratMetric === "success") histAvg = baseline.avgSuccess;
        else if (stratMetric === "asp") histAvg = baseline.avgASP;
        else if (stratMetric === "reviewNew") histAvg = baseline.avgReviewNew;
      }

      return {
        name: `${m}月`,
        baseVal: cV,
        prevVal: pV,
        historyAvg: histAvg,
        yoy: calcYoY(cV, pV),
        curData: curData,
        prevData: prevData,
      };
    });

    return { yearlyTrend, monthlyYoY, processedHistory, seasonalityBaseline };
  }, [
    historyData,
    dbData,
    stratFilterMode,
    stratBranch,
    stratBaseYear,
    stratMetric,
  ]);

  // --- 6. 事件處理 ---
  const handleFetchReviews = async () => {
    const placeId = PLACE_IDS[formData.branch];
    if (!placeId) {
      setUiStatus({
        loading: false,
        msg: "找不到該分院的 Place ID",
        type: "error",
      });
      setTimeout(
        () => setUiStatus({ loading: false, msg: "", type: "" }),
        3000
      );
      return;
    }

    setIsFetchingReviews(true);
    try {
      const url = `https://places.googleapis.com/v1/places/${placeId}?fields=userRatingCount&key=${GOOGLE_API_KEY}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("API 請求失敗");

      const data = await response.json();
      if (data.userRatingCount !== undefined) {
        setFormData({ ...formData, reviews: data.userRatingCount.toString() });
        setUiStatus({
          loading: false,
          msg: `✨ 同步成功！${formData.branch} 最新評論為 ${data.userRatingCount} 則`,
          type: "success",
        });
      } else {
        throw new Error("無法獲取評論數");
      }
    } catch (error) {
      console.error("Fetch reviews error:", error);
      setUiStatus({
        loading: false,
        msg: "同步失敗，請確認網路連線或 API 金鑰限制",
        type: "error",
      });
    } finally {
      setIsFetchingReviews(false);
      setTimeout(
        () => setUiStatus({ loading: false, msg: "", type: "" }),
        4000
      );
    }
  };

  const handleDailySubmit = async (e) => {
    e.preventDefault();
    setUiStatus({ loading: true, msg: "儲存中...", type: "info" });
    const id = `${formData.date}_${formData.branch}`;
    try {
      await setDoc(doc(db, "wishvision_stats", id), {
        ...formData,
        month: formData.date.slice(0, 7),
        day: parseInt(formData.date.split("-")[2], 10),
        currentC: parseInt(formData.currentC) || null,
        currentS: parseInt(formData.currentS) || null,
        nextC: parseInt(formData.nextC) || null,
        nextS: parseInt(formData.nextS) || null,
        reviews: parseInt(formData.reviews) || null,
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
    const editedData = maintGrid[m] || {};
    const existingData =
      strategyData.processedHistory.find((h) => h.id === id) || {};

    const parseInput = (val) =>
      val === "" || val === null || val === undefined ? null : Number(val);

    try {
      await setDoc(doc(db, "wishvision_monthly_history", id), {
        id,
        year: maintYear,
        month: m,
        branch: maintBranch,
        consultation: parseInput(
          editedData.consultation !== undefined
            ? editedData.consultation
            : existingData.consultation
        ),
        surgery: parseInput(
          editedData.surgery !== undefined
            ? editedData.surgery
            : existingData.surgery
        ),
        revenue: parseInput(
          editedData.revenue !== undefined
            ? editedData.revenue
            : existingData.revenue
        ),
        conversion: parseInput(
          editedData.conversion !== undefined
            ? editedData.conversion
            : existingData.conv
        ),
        successRate: parseInput(
          editedData.successRate !== undefined
            ? editedData.successRate
            : existingData.succ
        ),
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
    setIsMaintEditing(false);
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
        <>
          <Bar
            yAxisId="left"
            dataKey="newReviews"
            name="每日新增 (所選分院)"
            fill="#f59e0b"
            barSize={20}
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="reviews"
            name="累積總數 (所選分院)"
            stroke="#d97706"
            strokeWidth={4}
            dot={{ r: 4 }}
          />
        </>
      );
    } else {
      const colors = ["#2563eb", "#16a34a", "#7c3aed", "#06b6d4"];
      return selectedBranches.map((b, idx) => (
        <React.Fragment key={`${b}_reviews`}>
          <Bar
            yAxisId="left"
            dataKey={`${b}_newReviews`}
            name={`${b} 新增`}
            fill={colors[idx % colors.length]}
            opacity={0.5}
            barSize={12}
            radius={[2, 2, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={`${b}_reviews`}
            name={`${b} 累積`}
            stroke={colors[idx % colors.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </React.Fragment>
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
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-bold text-amber-600">
                          口碑指標
                        </p>
                        <button
                          type="button"
                          onClick={handleFetchReviews}
                          disabled={isFetchingReviews}
                          className="text-[10px] bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-3 py-1 rounded-lg flex items-center gap-1 transition-all shadow-sm"
                        >
                          {isFetchingReviews ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          智能同步
                        </button>
                      </div>
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
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400 font-bold">
                            評論:
                          </span>
                          <span className="font-black text-amber-500">
                            +{s.avgR}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 預估落點卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-[2rem] text-white shadow-xl shadow-blue-100 relative overflow-hidden">
                  <Activity className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
                  <p className="text-xs font-bold opacity-70 uppercase tracking-widest">
                    本月諮詢預估落點
                  </p>
                  <h3 className="text-5xl font-black mt-2">
                    {dailyMetrics.totalForeC}{" "}
                    <span className="text-sm font-normal opacity-50">人</span>
                  </h3>
                  <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-black uppercase">
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
                  <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-black uppercase">
                    <div className="bg-white/10 px-3 py-2 rounded-xl backdrop-blur-sm">
                      累積: {dailyMetrics.totalCurS}
                    </div>
                    <div className="bg-white/10 px-3 py-2 rounded-xl backdrop-blur-sm">
                      進度: {dailyMetrics.maxDayObserved} /{" "}
                      {dailyMetrics.totalDays} 天
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-amber-700 p-6 rounded-[2rem] text-white shadow-xl shadow-amber-100 relative overflow-hidden">
                  <Star className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
                  <p className="text-xs font-bold opacity-70 uppercase tracking-widest">
                    本月評論預估落點
                  </p>
                  <h3 className="text-5xl font-black mt-2">
                    {dailyMetrics.totalForeR}{" "}
                    <span className="text-sm font-normal opacity-50">則</span>
                  </h3>
                  <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-black uppercase">
                    <div className="bg-white/10 px-3 py-2 rounded-xl backdrop-blur-sm">
                      累積: {dailyMetrics.totalCurR}
                    </div>
                    <div className="bg-white/10 px-3 py-2 rounded-xl backdrop-blur-sm">
                      本月新增: {dailyMetrics.thisMonthNewR}
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

              {/* 口碑聲量圖 (雙 Y 軸) */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />{" "}
                  口碑聲量指標（Google 評論）
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dailyMetrics.chartData}>
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
                        yAxisId="left"
                        tick={{ fontSize: 10, fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
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
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 每日紀錄詳細日誌 */}
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
            {/* 全局主控制列 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap justify-between items-center gap-4">
              <div className="flex gap-4 items-center">
                <div className="bg-slate-100 p-1 rounded-xl flex gap-1 text-[11px] font-black uppercase">
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
              </div>
              <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-100">
                雷達已啟動：歷年縱深數據加權模組 (絕對控制優先)
              </span>
            </div>

            {/* 1. 年度大局走勢 */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex flex-wrap justify-between items-end gap-6 mb-8">
                <div>
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-blue-600" />{" "}
                    年度戰略走勢全覽 (Macro Annual Trend)
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    追蹤跨年度產能擴張與團隊收單品質
                  </p>
                </div>
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
                    視角 B: 諮詢品質
                  </button>
                  <button
                    onClick={() => setStratView("macro_C")}
                    className={`px-5 py-2.5 rounded-xl transition-all ${
                      stratView === "macro_C"
                        ? "bg-white text-blue-700 shadow-md"
                        : "text-white opacity-60"
                    }`}
                  >
                    視角 C: 口碑聲量
                  </button>
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
                    {stratView === "macro_A" && (
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fontWeight: 700,
                          fill: "#94a3b8",
                        }}
                      />
                    )}
                    <Tooltip
                      contentStyle={{
                        borderRadius: "20px",
                        border: "none",
                        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    {stratView === "macro_A" && (
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
                    )}
                    {stratView === "macro_B" && (
                      <>
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="conv"
                          name="歷年平均轉換率 (%)"
                          stroke="#7c3aed"
                          strokeWidth={4}
                          dot={{ r: 5, fill: "#7c3aed" }}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="succ"
                          name="歷年平均諮詢成功率 (%)"
                          stroke="#06b6d4"
                          strokeWidth={4}
                          dot={{ r: 5, fill: "#06b6d4" }}
                        />
                      </>
                    )}
                    {stratView === "macro_C" && (
                      <>
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="reviewTotal"
                          name="年度累積評論總數"
                          stroke="#f59e0b"
                          strokeWidth={4}
                          dot={{ r: 5, fill: "#f59e0b" }}
                          connectNulls={false}
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* 表格 B: 年度明細與成長率 */}
              <div className="mt-12 overflow-hidden rounded-3xl border border-slate-100">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-400 font-black uppercase">
                    <tr>
                      <th className="p-4">年度指標</th>
                      {stratView === "macro_A" && (
                        <>
                          <th className="p-4">總諮詢量</th>
                          <th className="p-4">YoY</th>
                          <th className="p-4">總手術量</th>
                          <th className="p-4">YoY</th>
                          <th className="p-4">總營業額</th>
                          <th className="p-4">YoY</th>
                          <th className="p-4">歷年平均 ASP</th>
                          <th className="p-4">YoY</th>
                        </>
                      )}
                      {stratView === "macro_B" && (
                        <>
                          <th className="p-4">歷年平均轉換率</th>
                          <th className="p-4">YoY</th>
                          <th className="p-4">歷年平均諮詢成功率</th>
                          <th className="p-4">YoY</th>
                        </>
                      )}
                      {stratView === "macro_C" && (
                        <>
                          <th className="p-4">年度總評論數 (年底)</th>
                          <th className="p-4">YoY 成長率</th>
                        </>
                      )}
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
                          {stratView === "macro_A" && (
                            <>
                              <td className="p-4 text-blue-600">
                                {y.consultation === 0 &&
                                !strategyData.processedHistory.some(
                                  (d) =>
                                    d.year === y.name && d.consultation !== null
                                )
                                  ? "--"
                                  : y.consultation.toLocaleString()}
                              </td>
                              <td
                                className={`p-4 ${
                                  y.yoyCon.includes("-")
                                    ? "text-red-500"
                                    : y.yoyCon !== "--"
                                    ? "text-green-600"
                                    : "text-slate-400"
                                }`}
                              >
                                {y.yoyCon}
                              </td>
                              <td className="p-4 text-emerald-600">
                                {y.surgery === 0 &&
                                !strategyData.processedHistory.some(
                                  (d) => d.year === y.name && d.surgery !== null
                                )
                                  ? "--"
                                  : y.surgery.toLocaleString()}
                              </td>
                              <td
                                className={`p-4 ${
                                  y.yoySur.includes("-")
                                    ? "text-red-500"
                                    : y.yoySur !== "--"
                                    ? "text-green-600"
                                    : "text-slate-400"
                                }`}
                              >
                                {y.yoySur}
                              </td>
                              <td className="p-4 text-amber-600">
                                {y.revenue === 0 &&
                                !strategyData.processedHistory.some(
                                  (d) => d.year === y.name && d.revenue !== null
                                )
                                  ? "--"
                                  : `$${(y.revenue / 10000).toFixed(0)}萬`}
                              </td>
                              <td
                                className={`p-4 ${
                                  y.yoyRev.includes("-")
                                    ? "text-red-500"
                                    : y.yoyRev !== "--"
                                    ? "text-green-600"
                                    : "text-slate-400"
                                }`}
                              >
                                {y.yoyRev}
                              </td>
                              <td className="p-4 text-slate-600">
                                {y.asp === 0
                                  ? "--"
                                  : `$${y.asp.toLocaleString()}`}
                              </td>
                              <td
                                className={`p-4 ${
                                  y.yoyAsp.includes("-")
                                    ? "text-red-500"
                                    : y.yoyAsp !== "--"
                                    ? "text-green-600"
                                    : "text-slate-400"
                                }`}
                              >
                                {y.yoyAsp}
                              </td>
                            </>
                          )}
                          {stratView === "macro_B" && (
                            <>
                              <td className="p-4 text-purple-600">
                                {y.conv === 0 &&
                                !strategyData.processedHistory.some(
                                  (d) => d.year === y.name && d.conv !== null
                                )
                                  ? "--"
                                  : `${y.conv}%`}
                              </td>
                              <td
                                className={`p-4 ${
                                  y.yoyConv.includes("-")
                                    ? "text-red-500"
                                    : y.yoyConv !== "--"
                                    ? "text-green-600"
                                    : "text-slate-400"
                                }`}
                              >
                                {y.yoyConv}
                              </td>
                              <td className="p-4 text-cyan-600">
                                {y.succ === 0 &&
                                !strategyData.processedHistory.some(
                                  (d) => d.year === y.name && d.succ !== null
                                )
                                  ? "--"
                                  : `${y.succ}%`}
                              </td>
                              <td
                                className={`p-4 ${
                                  y.yoySucc.includes("-")
                                    ? "text-red-500"
                                    : y.yoySucc !== "--"
                                    ? "text-green-600"
                                    : "text-slate-400"
                                }`}
                              >
                                {y.yoySucc}
                              </td>
                            </>
                          )}
                          {stratView === "macro_C" && (
                            <>
                              <td className="p-4 text-amber-600">
                                {y.reviewTotal === null
                                  ? "--"
                                  : y.reviewTotal.toLocaleString()}
                              </td>
                              <td
                                className={`p-4 ${
                                  y.yoyReviewTotal.includes("-")
                                    ? "text-red-500"
                                    : y.yoyReviewTotal !== "--"
                                    ? "text-green-600"
                                    : "text-slate-400"
                                }`}
                              >
                                {y.yoyReviewTotal}
                              </td>
                            </>
                          )}
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
                  <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap gap-1 text-[10px] font-black uppercase max-w-xl">
                    {[
                      { id: "revenue", label: "營收", icon: DollarSign },
                      { id: "consultation", label: "諮詢", icon: Activity },
                      { id: "surgery", label: "手術", icon: Target },
                      { id: "conversion", label: "轉換%", icon: Percent },
                      { id: "success", label: "成功%", icon: Star },
                      { id: "asp", label: "ASP", icon: DollarSign },
                      { id: "reviewTotal", label: "評論總數", icon: Star },
                      { id: "reviewNew", label: "評論新增", icon: PlusCircle },
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
                      tickFormatter={(val) => {
                        if (stratMetric === "revenue")
                          return `$${(val / 10000).toFixed(0)}萬`;
                        if (stratMetric === "asp")
                          return `$${val.toLocaleString()}`;
                        if (
                          stratMetric === "conversion" ||
                          stratMetric === "success"
                        )
                          return `${val}%`;
                        return val;
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "20px",
                        border: "none",
                        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                      }}
                      formatter={(value, name) => {
                        if (value === null || value === undefined)
                          return ["--", name];
                        if (stratMetric === "revenue")
                          return [`$${(value / 10000).toFixed(0)}萬`, name];
                        if (stratMetric === "asp")
                          return [`$${Number(value).toLocaleString()}`, name];
                        if (
                          stratMetric === "conversion" ||
                          stratMetric === "success"
                        )
                          return [`${value}%`, name];
                        return [value, name];
                      }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Line
                      type="monotone"
                      dataKey="baseVal"
                      connectNulls={false}
                      name={`${stratBaseYear}年度 (基準)`}
                      stroke="#7c3aed"
                      strokeWidth={5}
                      dot={{ r: 6, fill: "#7c3aed" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="prevVal"
                      connectNulls={false}
                      name={`${parseInt(stratBaseYear) - 1}年度 (對比)`}
                      stroke="#cbd5e1"
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={{ r: 4, fill: "#cbd5e1" }}
                    />
                    {stratMetric !== "reviewTotal" && (
                      <Line
                        type="monotone"
                        dataKey="historyAvg"
                        connectNulls={false}
                        name="歷年常態平均"
                        stroke="#10b981"
                        strokeWidth={3}
                        strokeDasharray="3 3"
                        dot={{ r: 4, fill: "#10b981" }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* 表格 A: 月度 YoY 明細 */}
              <div className="mt-12 overflow-x-auto rounded-3xl border border-slate-100 shadow-sm">
                <table className="w-full text-left text-[11px] whitespace-nowrap">
                  <thead className="bg-slate-900 text-white font-black uppercase">
                    <tr>
                      <th className="p-4">月度對比指標</th>
                      <th className="p-4 text-purple-300">當期實績</th>
                      <th className="p-4 text-purple-300">前期對比</th>
                      <th className="p-4 text-purple-300">YoY 成長率</th>
                      <th className="p-4">轉換率</th>
                      <th className="p-4">YoY</th>
                      <th className="p-4">成功率</th>
                      <th className="p-4">YoY</th>
                      <th className="p-4">評論總數</th>
                      <th className="p-4">YoY</th>
                      <th className="p-4">評論新增</th>
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
                          {m.baseVal === null
                            ? "--"
                            : stratMetric === "revenue"
                            ? `$${(m.baseVal / 10000).toFixed(0)}萬`
                            : stratMetric === "asp"
                            ? `$${m.baseVal.toLocaleString()}`
                            : m.baseVal}
                        </td>
                        <td className="p-4 text-slate-400">
                          {m.prevVal === null
                            ? "--"
                            : stratMetric === "revenue"
                            ? `$${(m.prevVal / 10000).toFixed(0)}萬`
                            : stratMetric === "asp"
                            ? `$${m.prevVal.toLocaleString()}`
                            : m.prevVal}
                        </td>
                        <td
                          className={`p-4 flex items-center gap-1 ${
                            m.yoy.includes("-")
                              ? "text-red-500"
                              : m.yoy !== "--"
                              ? "text-green-600"
                              : "text-slate-400"
                          }`}
                        >
                          {m.yoy !== "--" &&
                            (m.yoy.includes("-") ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            ))}
                          {m.yoy}
                        </td>
                        <td className="p-4 text-purple-600">
                          {m.curData.conv !== undefined &&
                          m.curData.conv !== null
                            ? `${m.curData.conv}%`
                            : "--"}
                        </td>
                        <td
                          className={`p-4 ${
                            calcYoY(m.curData.conv, m.prevData.conv).includes(
                              "-"
                            )
                              ? "text-red-500"
                              : calcYoY(m.curData.conv, m.prevData.conv) !==
                                "--"
                              ? "text-green-600"
                              : "text-slate-400"
                          }`}
                        >
                          {calcYoY(m.curData.conv, m.prevData.conv)}
                        </td>
                        <td className="p-4 text-cyan-600">
                          {m.curData.succ !== undefined &&
                          m.curData.succ !== null
                            ? `${m.curData.succ}%`
                            : "--"}
                        </td>
                        <td
                          className={`p-4 ${
                            calcYoY(m.curData.succ, m.prevData.succ).includes(
                              "-"
                            )
                              ? "text-red-500"
                              : calcYoY(m.curData.succ, m.prevData.succ) !==
                                "--"
                              ? "text-green-600"
                              : "text-slate-400"
                          }`}
                        >
                          {calcYoY(m.curData.succ, m.prevData.succ)}
                        </td>
                        <td className="p-4 text-amber-600">
                          {m.curData.reviewTotal !== undefined &&
                          m.curData.reviewTotal !== null
                            ? m.curData.reviewTotal.toLocaleString()
                            : "--"}
                        </td>
                        <td
                          className={`p-4 ${
                            calcYoY(
                              m.curData.reviewTotal,
                              m.prevData.reviewTotal
                            ).includes("-")
                              ? "text-red-500"
                              : calcYoY(
                                  m.curData.reviewTotal,
                                  m.prevData.reviewTotal
                                ) !== "--"
                              ? "text-green-600"
                              : "text-slate-400"
                          }`}
                        >
                          {calcYoY(
                            m.curData.reviewTotal,
                            m.prevData.reviewTotal
                          )}
                        </td>
                        <td className="p-4 text-orange-600">
                          {m.curData.reviewNew !== undefined &&
                          m.curData.reviewNew !== null
                            ? m.curData.reviewNew.toLocaleString()
                            : "--"}
                        </td>
                        <td
                          className={`p-4 ${
                            calcYoY(
                              m.curData.reviewNew,
                              m.prevData.reviewNew
                            ).includes("-")
                              ? "text-red-500"
                              : calcYoY(
                                  m.curData.reviewNew,
                                  m.prevData.reviewNew
                                ) !== "--"
                              ? "text-green-600"
                              : "text-slate-400"
                          }`}
                        >
                          {calcYoY(m.curData.reviewNew, m.prevData.reviewNew)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. 歷年季節性常態大腦核心區塊 */}
            <div className="border-t-4 border-dashed border-slate-200 pt-8 space-y-8">
              <div className="bg-slate-900 text-white p-6 rounded-3xl flex justify-between items-center shadow-lg">
                <div>
                  <h4 className="text-base font-black tracking-wide">
                    📊 ✨ 歷年動態季節性常態基線 (Rolling Seasonality Baseline)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 font-semibold">
                    系統採用【滾動式常態基準】：納入歷年數據，並自動加進今年「已經完整過完的月份」。
                  </p>
                </div>
              </div>

              {/* 3-A. 流量視角淡旺季 */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-800">
                      【流量視角】歷年每月平均諮詢量與手術量常態
                    </h3>
                    <button
                      onClick={() => setShowInfoVolume(!showInfoVolume)}
                      className="text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {showInfoVolume && (
                  <div className="mb-6 p-4 bg-blue-50/80 border border-blue-100 rounded-2xl text-xs text-blue-800 font-bold leading-relaxed animate-in fade-in duration-300">
                    <p className="flex items-center gap-1 text-blue-900 font-black mb-1">
                      <Info className="w-3.5 h-3.5" /> 流量視角戰略意涵：
                    </p>
                    此圖表統計集團歷年（包含今年已完結之月份）各月份的總平均。系統採用滾動式基準，當前未完結之月份會自動排除以防失真。可用於觀測品牌的「市場季節性常規週期」，在淡季前提早一個月調整行銷廣告投放預算。
                  </div>
                )}

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={strategyData.seasonalityBaseline}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fontWeight: 800,
                          fill: "#94a3b8",
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fontWeight: 700,
                          fill: "#94a3b8",
                        }}
                      />
                      <Tooltip />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", fontWeight: 800 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgConsultation"
                        name="歷年平均諮詢量"
                        stroke="#2563eb"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgSurgery"
                        name="歷年平均手術量"
                        stroke="#16a34a"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 3-B. 品質視角淡旺季 */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-800">
                      【品質視角】歷年每月平均轉換率與諮詢成功率常態
                    </h3>
                    <button
                      onClick={() => setShowInfoQuality(!showInfoQuality)}
                      className="text-slate-400 hover:text-purple-600 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {showInfoQuality && (
                  <div className="mb-6 p-4 bg-purple-50/80 border border-purple-100 rounded-2xl text-xs text-purple-800 font-bold leading-relaxed animate-in fade-in duration-300">
                    <p className="flex items-center gap-1 text-purple-900 font-black mb-1">
                      <Info className="w-3.5 h-3.5" /> 品質視角戰略意涵：
                    </p>
                    用於檢視現場前線團隊的「收單難易度」季節週期。同樣採用滾動式基準，若某月份流量極大但轉換率通常處於低谷，代表該月份存在大量無效比價名單，團隊應適度優化前端篩選機制。
                  </div>
                )}

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={strategyData.seasonalityBaseline}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fontWeight: 800,
                          fill: "#94a3b8",
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fontWeight: 700,
                          fill: "#94a3b8",
                        }}
                      />
                      <Tooltip />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", fontWeight: 800 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgConversion"
                        name="歷年平均轉換率 (%)"
                        stroke="#7c3aed"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgSuccess"
                        name="歷年平均諮詢成功率 (%)"
                        stroke="#06b6d4"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 3-C. 財務視角淡旺季 */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-800">
                      【財務視角】歷年每月平均 ASP (手術客單價) 季節常態
                    </h3>
                    <button
                      onClick={() => setShowInfoFinance(!showInfoFinance)}
                      className="text-slate-400 hover:text-amber-600 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {showInfoFinance && (
                  <div className="mb-6 p-4 bg-amber-50/80 border border-amber-100 rounded-2xl text-xs text-amber-800 font-bold leading-relaxed animate-in fade-in duration-300">
                    <p className="flex items-center gap-1 text-amber-900 font-black mb-1">
                      <Info className="w-3.5 h-3.5" /> 財務視角戰略意涵：
                    </p>
                    客單價（ASP）是驅動營收擴張的關鍵財務引擎。此常態圖（套用滾動式基準）用來抓出高階自費手術在一年之中的銷售蜜月期。管理層可藉此評估自費手術分期付款活動、高端產品促銷的最佳切入月份。
                  </div>
                )}

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={strategyData.seasonalityBaseline}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fontWeight: 800,
                          fill: "#94a3b8",
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fontWeight: 700,
                          fill: "#94a3b8",
                        }}
                      />
                      <Tooltip />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", fontWeight: 800 }}
                      />
                      <Bar
                        dataKey="avgASP"
                        name="歷年平均客單價 (NT$)"
                        fill="#fbbf24"
                        radius={[8, 8, 0, 0]}
                        barSize={35}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 3-D. 營收視角淡旺季 */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-800">
                      【營收視角】歷年每月平均總營收常態
                    </h3>
                    <button
                      onClick={() => setShowInfoRev(!showInfoRev)}
                      className="text-slate-400 hover:text-green-600 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {showInfoRev && (
                  <div className="mb-6 p-4 bg-green-50/80 border border-green-100 rounded-2xl text-xs text-green-800 font-bold leading-relaxed animate-in fade-in duration-300">
                    <p className="flex items-center gap-1 text-green-900 font-black mb-1">
                      <Info className="w-3.5 h-3.5" /> 營收視角戰略意涵：
                    </p>
                    統計歷年（含今年已完結之月份）各月份的平均總營收。可用於觀測集團或分院在全年度的「現金流與產值水位」真實波動，協助財務端進行資金調度規劃與次年度之營收預算編列參考。
                  </div>
                )}

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={strategyData.seasonalityBaseline}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fontWeight: 800,
                          fill: "#94a3b8",
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fontWeight: 700,
                          fill: "#94a3b8",
                        }}
                        tickFormatter={(val) =>
                          `$${(val / 10000).toFixed(0)}萬`
                        }
                      />
                      <Tooltip
                        formatter={(value) =>
                          `$${Number(value).toLocaleString()}`
                        }
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", fontWeight: 800 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgRevenue"
                        name="歷年平均總營收 (NT$)"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 💡 3-E. 新增口碑視角淡旺季 */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-800">
                      【口碑視角】歷年每月平均 Google 評論新增常態
                    </h3>
                    <button
                      onClick={() => setShowInfoReviewNew(!showInfoReviewNew)}
                      className="text-slate-400 hover:text-orange-600 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {showInfoReviewNew && (
                  <div className="mb-6 p-4 bg-orange-50/80 border border-orange-100 rounded-2xl text-xs text-orange-800 font-bold leading-relaxed animate-in fade-in duration-300">
                    <p className="flex items-center gap-1 text-orange-900 font-black mb-1">
                      <Info className="w-3.5 h-3.5" /> 口碑視角戰略意涵：
                    </p>
                    由於 Google
                    評論為近期導入系統之指標，此圖表採用滾動式基準，將即時吸納「今年
                    1
                    月至今已完結月份」的歷史數據，為您動態勾勒出集團口碑資產的季節性增長能量，讓行銷公關活動的效果視覺化。
                  </div>
                )}

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={strategyData.seasonalityBaseline}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fontWeight: 800,
                          fill: "#94a3b8",
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fontWeight: 700,
                          fill: "#94a3b8",
                        }}
                      />
                      <Tooltip />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", fontWeight: 800 }}
                      />
                      <Bar
                        dataKey="avgReviewNew"
                        name="歷年平均評論新增 (則)"
                        fill="#f97316"
                        radius={[8, 8, 0, 0]}
                        barSize={35}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        );
      case "maintenance":
        return (
          <div className="space-y-6 animate-in zoom-in-95 duration-300">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              {/* 控制列與鎖定按鈕 */}
              <div className="flex flex-wrap gap-4 items-end mb-8 border-b border-slate-100 pb-8">
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
                    {MAINT_BRANCHES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-grow"></div>

                {!isMaintEditing ? (
                  <button
                    onClick={() => setIsMaintEditing(true)}
                    className="bg-slate-800 text-white font-black px-6 py-3 rounded-2xl shadow-lg hover:bg-slate-900 transition-all flex items-center gap-2"
                  >
                    <Unlock className="w-4 h-4" /> 解鎖並修改數據
                  </button>
                ) : (
                  <div className="flex items-center gap-3 animate-in fade-in duration-300">
                    <button
                      onClick={() => {
                        setIsMaintEditing(false);
                        setMaintGrid({});
                      }}
                      className="bg-white text-slate-500 border border-slate-200 font-bold px-6 py-3 rounded-2xl hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                      <X className="w-4 h-4" /> 捨棄並上鎖
                    </button>
                    <button
                      onClick={handleMaintBulkSave}
                      disabled={uiStatus.loading}
                      className="bg-blue-600 text-white font-black px-6 py-3 rounded-2xl shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
                    >
                      {uiStatus.loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4" />
                      )}
                      批次儲存年度資料 ({maintYear})
                    </button>
                  </div>
                )}
              </div>

              {uiStatus.msg && (
                <p className="mb-4 text-center text-xs font-black text-blue-600 bg-blue-50 p-3 rounded-2xl border border-blue-100">
                  {uiStatus.msg}
                </p>
              )}

              {/* 全院總計專屬 UI 提示 */}
              {maintBranch === "全院總計" && (
                <div className="w-full bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4 animate-in fade-in flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-blue-800 leading-relaxed">
                    全院總計模式：您只需維護「CRM
                    轉換率」與「諮詢成功率」。流量與財務指標留白即可，系統在戰略看板中會為您自動加總各實體分院，避免重複計算。
                  </p>
                </div>
              )}

              <div
                key={`${maintYear}-${maintBranch}`}
                className="overflow-x-auto rounded-3xl border border-slate-50 relative"
              >
                {!isMaintEditing && (
                  <div className="absolute inset-0 z-10 pointer-events-none flex justify-center items-center">
                    <div className="bg-slate-900/5 backdrop-blur-[1px] absolute inset-0"></div>
                    <div className="bg-white/90 px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2 text-slate-400 font-black text-xs z-20 border border-slate-100">
                      <Lock className="w-4 h-4" /> 唯讀模式 (點擊右上角解鎖編輯)
                    </div>
                  </div>
                )}

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
                        諮詢成功率%
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
                          className={`transition-colors ${
                            isMaintEditing ? "hover:bg-slate-50" : "bg-white"
                          }`}
                        >
                          <td className="p-5 font-black text-slate-300 text-xl">
                            {m}
                          </td>
                          <td className="p-5">
                            <input
                              type="number"
                              value={
                                (maintGrid[m]?.consultation !== undefined
                                  ? maintGrid[m].consultation
                                  : existing.consultation) ?? ""
                              }
                              onChange={(e) =>
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    consultation: e.target.value,
                                  },
                                }))
                              }
                              disabled={!isMaintEditing}
                              className={`w-24 border-none rounded-xl p-2 font-black text-blue-600 focus:outline-none focus:ring-2 ring-blue-500 transition-all ${
                                isMaintEditing
                                  ? "bg-slate-50"
                                  : "bg-transparent text-center opacity-70"
                              }`}
                            />
                          </td>
                          <td className="p-5">
                            <input
                              type="number"
                              value={
                                (maintGrid[m]?.surgery !== undefined
                                  ? maintGrid[m].surgery
                                  : existing.surgery) ?? ""
                              }
                              onChange={(e) =>
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    surgery: e.target.value,
                                  },
                                }))
                              }
                              disabled={!isMaintEditing}
                              className={`w-24 border-none rounded-xl p-2 font-black text-emerald-600 focus:outline-none focus:ring-2 ring-emerald-500 transition-all ${
                                isMaintEditing
                                  ? "bg-slate-50"
                                  : "bg-transparent text-center opacity-70"
                              }`}
                            />
                          </td>
                          <td className="p-5">
                            <input
                              type="number"
                              value={
                                (maintGrid[m]?.revenue !== undefined
                                  ? maintGrid[m].revenue
                                  : existing.revenue) ?? ""
                              }
                              onChange={(e) =>
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    revenue: e.target.value,
                                  },
                                }))
                              }
                              disabled={!isMaintEditing}
                              className={`w-36 border-none rounded-xl p-2 font-black text-amber-600 focus:outline-none focus:ring-2 ring-amber-500 transition-all ${
                                isMaintEditing
                                  ? "bg-slate-50"
                                  : "bg-transparent text-center opacity-70"
                              }`}
                            />
                          </td>
                          <td className="p-5">
                            <input
                              type="number"
                              step="0.1"
                              value={
                                (maintGrid[m]?.conversion !== undefined
                                  ? maintGrid[m].conversion
                                  : existing.conv) ?? ""
                              }
                              onChange={(e) =>
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    conversion: e.target.value,
                                  },
                                }))
                              }
                              disabled={!isMaintEditing}
                              className={`w-20 border-none rounded-xl p-2 font-black text-purple-600 focus:outline-none focus:ring-2 ring-purple-500 transition-all ${
                                isMaintEditing
                                  ? "bg-slate-50"
                                  : "bg-transparent text-center opacity-70"
                              }`}
                            />
                            <span className="text-slate-300 font-bold ml-1">
                              %
                            </span>
                          </td>
                          <td className="p-5">
                            <input
                              type="number"
                              step="0.1"
                              value={
                                (maintGrid[m]?.successRate !== undefined
                                  ? maintGrid[m].successRate
                                  : existing.succ) ?? ""
                              }
                              onChange={(e) =>
                                setMaintGrid((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || existing),
                                    successRate: e.target.value,
                                  },
                                }))
                              }
                              disabled={!isMaintEditing}
                              className={`w-20 border-none rounded-xl p-2 font-black text-cyan-600 focus:outline-none focus:ring-2 ring-cyan-500 transition-all ${
                                isMaintEditing
                                  ? "bg-slate-50"
                                  : "bg-transparent text-center opacity-70"
                              }`}
                            />
                            <span className="text-slate-300 font-bold ml-1">
                              %
                            </span>
                          </td>
                          <td className="p-5 text-center">
                            <button
                              onClick={() => handleMaintSave(m)}
                              disabled={!isMaintEditing}
                              className={`p-2.5 rounded-xl transition-all border ${
                                isMaintEditing
                                  ? "bg-white border-slate-200 hover:bg-slate-900 hover:text-white text-slate-600 cursor-pointer"
                                  : "bg-transparent border-transparent text-slate-300 cursor-not-allowed opacity-50"
                              }`}
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
