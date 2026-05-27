import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, Building2, TrendingUp, BarChart2, PlusCircle, CheckCircle, RefreshCw } from 'lucide-react';

// 您專屬的 WishVision Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyC-NBub5GWvKxUuEfWPzdeI-M0VPFkHCw",
  authDomain: "wishvision-predict-system.firebaseapp.com",
  projectId: "wishvision-predict-system",
  storageBucket: "wishvision-predict-system.firebasestorage.app",
  messagingSenderId: "1037730294811",
  appId: "1:1037730294811:web:14b566956c826d04d81cbe",
  measurementId: "G-TD83NHWXW7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BRANCHES = ["台北館前院", "台北仁愛院", "台中東興院", "新竹光明院"];

export default function App() {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    branch: BRANCHES[0],
    currentC: '',
    currentS: '',
    nextC: '',
    nextS: ''
  });

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedBranches, setSelectedBranches] = useState(BRANCHES);
  const [dbData, setDbData] = useState([]);
  const [uiStatus, setUiStatus] = useState({ loading: false, msg: '', type: '' });
  const [viewMode, setViewMode] = useState('aggregate'); // 'aggregate' 或 'compare'

  // 即時監聽 Firestore 資料
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "wishvision_stats"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDbData(data);
    }, (error) => {
      console.error("Firestore 監聽失敗:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBranchToggle = (branch) => {
    if (selectedBranches.includes(branch)) {
      if (selectedBranches.length > 1) {
        setSelectedBranches(selectedBranches.filter(b => b !== branch));
      }
    } else {
      setSelectedBranches([...selectedBranches, branch]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUiStatus({ loading: true, msg: '正在儲存紀錄...', type: 'info' });

    const { date, branch, currentC, currentS, nextC, nextS } = formData;
    if (!currentC || !currentS || !nextC || !nextS) {
      setUiStatus({ loading: false, msg: '請填寫所有數據欄位', type: 'error' });
      return;
    }

    const docId = `${date}_${branch}`;
    try {
      // 這裡的語法已經修復完畢
      await setDoc(doc(db, "wishvision_stats", docId), {
        date,
        branch,
        month: date.slice(0, 7),
        day: parseInt(date.split('-')[2], 10),
        currentC: parseInt(currentC, 10),
        currentS: parseInt(currentS, 10),
        nextC: parseInt(nextC, 10),
        nextS: parseInt(nextS, 10),
        timestamp: Date.now()
      });
      setUiStatus({ loading: false, msg: '紀錄儲存成功！', type: 'success' });
      setFormData(prev => ({ ...prev, currentC: '', currentS: '', nextC: '', nextS: '' }));
      setTimeout(() => setUiStatus({ loading: false, msg: '', type: '' }), 3000);
    } catch (err) {
      setUiStatus({ loading: false, msg: `儲存失敗: ${err.message}`, type: 'error' });
    }
  };

  // 核心計算：處理篩選資料、加總、以及 Run-Rate 預估落點
  const { chartData, summaryMetrics, latestUpdateStr } = useMemo(() => {
    const filtered = dbData.filter(d => d.month === selectedMonth);