import { useState, useRef, useEffect } from "react";
import "@/App.css";
import axios from "axios";
import { Upload, Send, BarChart3, PieChart, Table2, MessageCircle, FileSpreadsheet, Loader2, X, ChevronDown, ToggleLeft, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart as RPieChart, Pie,
} from "recharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CHART_COLORS = ["#38bdf8", "#2dd4bf", "#818cf8", "#f472b6", "#fbbf24", "#34d399", "#a78bfa", "#fb923c"];

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [data, setData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [regrouping, setRegrouping] = useState(false);

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API}/upload`, formData);
      setSessionId(res.data.session_id);
      setData(res.data);
      setMessages([]);
    } catch (e) {
      const msg = e.response?.data?.detail || "Failed to process CSV file. Please check the format.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setUploading(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim() || !sessionId) return;
    const q = question.trim();
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setAsking(true);

    try {
      const res = await axios.post(`${API}/ask`, {
        session_id: sessionId,
        question: q,
      });
      setMessages((prev) => [...prev, { role: "ai", text: res.data.answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Sorry, I couldn't process that question. Please try again." }]);
    } finally {
      setAsking(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) handleUpload(file);
  };

  const handleReset = () => {
    setSessionId(null);
    setData(null);
    setMessages([]);
    setError(null);
  };

  const handleRegroup = async (groupChoice) => {
    if (!sessionId || regrouping) return;
    setRegrouping(true);
    try {
      const res = await axios.post(`${API}/regroup?session_id=${sessionId}&group_choice=${groupChoice}`);
      setData((prev) => ({
        ...prev,
        summary: res.data.summary,
        summary_columns: res.data.summary_columns,
        chart_data: res.data.chart_data,
        pie_data: res.data.pie_data,
        group_key: res.data.group_key,
        group_label: res.data.group_label,
      }));
      setMessages([]);
    } catch {
      // silently fail
    } finally {
      setRegrouping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 overflow-x-hidden relative">
      {/* Background */}
      <div className="fixed inset-0 z-0 opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #38bdf8 0%, transparent 50%), radial-gradient(circle at 80% 20%, #2dd4bf 0%, transparent 50%), radial-gradient(circle at 50% 80%, #818cf8 0%, transparent 50%)" }}
      />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_0%,#030712_70%)]" />

      {/* Content */}
      <div className="relative z-10">
        {!data ? (
          <UploadSection
            uploading={uploading}
            dragOver={dragOver}
            setDragOver={setDragOver}
            onDrop={onDrop}
            fileInputRef={fileInputRef}
            handleUpload={handleUpload}
            error={error}
          />
        ) : (
          <DashboardSection
            data={data}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            messages={messages}
            question={question}
            setQuestion={setQuestion}
            asking={asking}
            handleAsk={handleAsk}
            chatEndRef={chatEndRef}
            handleReset={handleReset}
            handleRegroup={handleRegroup}
            regrouping={regrouping}
          />
        )}
      </div>
    </div>
  );
}

/* ====== UPLOAD SECTION ====== */
function UploadSection({ uploading, dragOver, setDragOver, onDrop, fileInputRef, handleUpload, error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-20">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white" data-testid="app-title">
            Transaction Analytics
          </h1>
        </div>
        <p className="text-slate-400 text-sm md:text-base mb-10 max-w-md" data-testid="app-subtitle">
          Upload your CSV data. Ask AI anything about it.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
        className={`w-full max-w-lg rounded-2xl border-2 border-dashed transition-all duration-300 p-12 text-center cursor-pointer
          ${dragOver ? "border-cyan-400 bg-cyan-500/10 scale-[1.02]" : "border-slate-700/60 hover:border-slate-600 bg-black/30"}
          ${uploading ? "pointer-events-none opacity-60" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        data-testid="upload-dropzone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files[0])}
          data-testid="file-input"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            <p className="text-slate-300 text-sm">Processing your data...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center">
              <Upload className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-white font-medium">Drop your CSV here</p>
            <p className="text-slate-500 text-sm">or click to browse</p>
          </div>
        )}
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm max-w-lg w-full" data-testid="upload-error">
          {error}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-10 glass-light rounded-xl px-6 py-4 max-w-lg w-full">
        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">Supported format</p>
        <p className="text-slate-300 text-sm leading-relaxed">
          CSV with <span className="text-cyan-300">Price</span> + <span className="text-cyan-300">Quantity</span> columns, and at least one of <span className="text-cyan-300">Category</span> or <span className="text-cyan-300">Product Name</span>.
          Optional: Rating, Date.
        </p>
      </motion.div>
    </div>
  );
}

/* ====== DASHBOARD ====== */
function DashboardSection({ data, activeTab, setActiveTab, messages, question, setQuestion, asking, handleAsk, chatEndRef, handleReset, handleRegroup, regrouping }) {
  const tabs = [
    { id: "preview", label: "Data Preview", icon: Table2 },
    { id: "summary", label: "Summary", icon: FileSpreadsheet },
    { id: "charts", label: "Charts", icon: BarChart3 },
    { id: "chat", label: "Ask AI", icon: MessageCircle },
  ];

  const showGroupToggle = data.group_options && data.group_options.length > 1;

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold tracking-tight" data-testid="dashboard-title">Transaction Analytics</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Group By Toggle */}
          {showGroupToggle && (
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black/40 border border-white/5" data-testid="group-toggle">
              <Layers className="w-3.5 h-3.5 text-slate-500 ml-2" />
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Group by</span>
              {data.group_options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleRegroup(opt)}
                  disabled={regrouping}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 capitalize
                    ${data.group_label === opt
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                    }
                    ${regrouping ? "opacity-50 cursor-wait" : ""}`}
                  data-testid={`group-option-${opt}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={handleReset}
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-700/60 hover:border-slate-600"
            data-testid="reset-button"
          >
            <X className="w-3.5 h-3.5" /> New upload
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <StatsRow data={data} />

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-black/40 border border-white/5 w-fit" data-testid="tab-navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${activeTab === tab.id ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20" : "text-slate-400 hover:text-slate-200 border border-transparent"}`}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "preview" && (
          <TabPanel key="preview">
            <DataTable title="Data Preview" rows={data.preview} columns={data.columns} />
          </TabPanel>
        )}
        {activeTab === "summary" && (
          <TabPanel key="summary">
            <DataTable title={`Summary by ${data.group_label}`} rows={data.summary} columns={data.summary_columns} />
          </TabPanel>
        )}
        {activeTab === "charts" && (
          <TabPanel key="charts">
            <ChartsPanel data={data} />
          </TabPanel>
        )}
        {activeTab === "chat" && (
          <TabPanel key="chat">
            <ChatPanel
              messages={messages}
              question={question}
              setQuestion={setQuestion}
              asking={asking}
              handleAsk={handleAsk}
              chatEndRef={chatEndRef}
              groupLabel={data.group_label}
            />
          </TabPanel>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ====== STATS ROW ====== */
function StatsRow({ data }) {
  const totalRevenue = data.chart_data.reduce((s, d) => s + d.revenue, 0);
  const totalQty = data.chart_data.reduce((s, d) => s + d.quantity, 0);

  const stats = [
    { label: "Rows", value: data.row_count.toLocaleString(), color: "cyan" },
    { label: "Groups", value: data.chart_data.length, color: "teal" },
    { label: "Revenue", value: `$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "indigo" },
    { label: "Units Sold", value: totalQty.toLocaleString(), color: "pink" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" data-testid="stats-row">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="rounded-xl border border-white/[0.06] bg-black/30 backdrop-blur-xl px-4 py-3"
          data-testid={`stat-${s.label.toLowerCase().replace(/\s/g, "-")}`}
        >
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{s.label}</p>
          <p className="text-lg font-bold text-white mt-0.5 font-mono">{s.value}</p>
        </motion.div>
      ))}
    </div>
  );
}

/* ====== TAB PANEL WRAPPER ====== */
function TabPanel({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

/* ====== DATA TABLE ====== */
function DataTable({ title, rows, columns }) {
  const [visibleRows, setVisibleRows] = useState(20);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/30 backdrop-blur-xl overflow-hidden" data-testid="data-table">
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-slate-500 font-mono">{rows.length} rows</span>
      </div>
      <div className="overflow-auto max-h-[500px]">
        <table className="w-full text-sm data-table">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {columns.map((col) => (
                <th key={col} className="px-4 py-2.5 text-left text-[11px] text-slate-500 uppercase tracking-wider font-medium whitespace-nowrap bg-black/20 sticky top-0">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, visibleRows).map((row, i) => (
              <tr key={i} className="border-b border-white/[0.03] transition-colors">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-2 text-slate-300 whitespace-nowrap font-mono text-xs">
                    {typeof row[col] === "number" ? (col.toLowerCase().includes("revenue") || col.toLowerCase().includes("price") ? `$${row[col].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : row[col].toLocaleString(undefined, { maximumFractionDigits: 2 })) : String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visibleRows < rows.length && (
        <button
          onClick={() => setVisibleRows((v) => v + 20)}
          className="w-full py-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center justify-center gap-1 border-t border-white/[0.04]"
          data-testid="load-more-rows"
        >
          <ChevronDown className="w-3.5 h-3.5" /> Show more
        </button>
      )}
    </div>
  );
}

/* ====== CHARTS PANEL ====== */
function ChartsPanel({ data }) {
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass-heavy rounded-lg px-3 py-2 text-xs">
        <p className="text-white font-medium mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-mono">
            {p.name}: {p.name === "revenue" ? `$${p.value.toLocaleString()}` : p.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" data-testid="charts-panel">
      {/* Bar Chart */}
      <div className="lg:col-span-8 rounded-xl border border-white/[0.06] bg-black/30 backdrop-blur-xl p-5" data-testid="revenue-chart">
        <h3 className="text-sm font-semibold text-white mb-4">Revenue by {data.group_label}</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data.chart_data} margin={{ top: 5, right: 5, bottom: 60, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-35} textAnchor="end" axisLine={{ stroke: "rgba(255,255,255,0.06)" }} tickLine={false} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={50}>
              {data.chart_data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart */}
      <div className="lg:col-span-4 rounded-xl border border-white/[0.06] bg-black/30 backdrop-blur-xl p-5" data-testid="quantity-chart">
        <h3 className="text-sm font-semibold text-white mb-4">Quantity Distribution</h3>
        {data.pie_data.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <RPieChart>
              <Pie
                data={data.pie_data}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={110}
                dataKey="value"
                nameKey="name"
                paddingAngle={2}
                stroke="none"
              >
                {data.pie_data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />
                ))}
              </Pie>
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="glass-heavy rounded-lg px-3 py-2 text-xs">
                    <p className="text-white font-medium">{payload[0].name}</p>
                    <p className="text-cyan-300 font-mono">{payload[0].value.toLocaleString()} units</p>
                  </div>
                );
              }} />
            </RPieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[350px] text-slate-500 text-sm">
            Too many items for pie chart
          </div>
        )}
        {/* Legend */}
        {data.pie_data.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {data.pie_data.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {d.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ====== CHAT PANEL ====== */
function ChatPanel({ messages, question, setQuestion, asking, handleAsk, chatEndRef, groupLabel }) {
  const examples = [
    `Which ${groupLabel} sells the most?`,
    `Which ${groupLabel} has the highest revenue?`,
    `Compare top 3 ${groupLabel}s`,
  ];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/30 backdrop-blur-xl overflow-hidden flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "500px" }} data-testid="chat-panel">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
              <MessageCircle className="w-7 h-7 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Ask about your data</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-sm">AI will analyze your transaction data and answer questions based only on the uploaded information.</p>
            <div className="flex flex-wrap justify-center gap-2" data-testid="example-questions">
              {examples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => { setQuestion(ex); }}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-700/60 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30 transition-all duration-200"
                  data-testid={`example-question-${i}`}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] md:max-w-[70%] px-5 py-3.5 text-sm leading-relaxed
                ${msg.role === "user"
                  ? "bg-slate-800/80 text-white rounded-2xl rounded-tr-sm border border-slate-700/50"
                  : "bg-gradient-to-br from-cyan-900/30 to-blue-900/30 text-cyan-50 rounded-2xl rounded-tl-sm border border-cyan-500/15 shadow-[0_0_15px_rgba(56,189,248,0.06)]"
                }`}
              data-testid={`chat-bubble-${msg.role}-${i}`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          </motion.div>
        ))}

        {asking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 text-cyan-50 rounded-2xl rounded-tl-sm border border-cyan-500/15 px-5 py-3.5 flex gap-1.5 items-center" data-testid="typing-indicator">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 typing-dot" />
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 typing-dot" />
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 typing-dot" />
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.06] px-4 md:px-8 py-4 bg-black/20">
        <div className="flex gap-3 items-center max-w-3xl mx-auto">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAsk()}
            placeholder={`Ask about your ${groupLabel} data...`}
            className="flex-1 bg-slate-900/50 border border-slate-700/60 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200"
            disabled={asking}
            data-testid="chat-input"
          />
          <button
            onClick={handleAsk}
            disabled={asking || !question.trim()}
            className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/25 hover:text-cyan-300 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            data-testid="send-button"
          >
            {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
