import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Target, Plus, X,
  LayoutDashboard, ArrowUpCircle, ArrowDownCircle, Settings,
  Moon, Sun, LogOut, ChevronRight, Filter, Download,
  Edit2, Trash2, CheckCircle, AlertCircle, Bell, Search,
  BarChart2, Calendar, RefreshCw
} from "lucide-react";

// ── Seed data ──────────────────────────────────────────────────────────────
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const seedBalance = [
  { month: "Set", balance: 12400 },
  { month: "Out", balance: 15200 },
  { month: "Nov", balance: 13800 },
  { month: "Dez", balance: 17600 },
  { month: "Jan", balance: 16200 },
  { month: "Fev", balance: 19850 },
];

const seedRevExp = [
  { month: "Set", receita: 8500, despesa: 6200 },
  { month: "Out", receita: 9200, despesa: 5800 },
  { month: "Nov", receita: 7800, despesa: 7400 },
  { month: "Dez", receita: 11200, despesa: 8100 },
  { month: "Jan", receita: 9600, despesa: 7200 },
  { month: "Fev", receita: 10400, despesa: 6600 },
];

const seedCategories = [
  { name: "Moradia", value: 2400, color: "#6366f1" },
  { name: "Alimentação", value: 1800, color: "#22d3ee" },
  { name: "Transporte", value: 900, color: "#f59e0b" },
  { name: "Saúde", value: 600, color: "#10b981" },
  { name: "Lazer", value: 500, color: "#f43f5e" },
  { name: "Outros", value: 400, color: "#8b5cf6" },
];

const seedTransactions = [
  { id: 1, type: "receita", desc: "Salário", amount: 7500, category: "Trabalho", date: "2025-02-01", recurrent: true },
  { id: 2, type: "receita", desc: "Freelance Design", amount: 1800, category: "Trabalho", date: "2025-02-05", recurrent: false },
  { id: 3, type: "despesa", desc: "Aluguel", amount: 2400, category: "Moradia", date: "2025-02-05", recurrent: true },
  { id: 4, type: "despesa", desc: "Mercado", amount: 680, category: "Alimentação", date: "2025-02-08", recurrent: false },
  { id: 5, type: "despesa", desc: "Combustível", amount: 320, category: "Transporte", date: "2025-02-10", recurrent: false },
  { id: 6, type: "receita", desc: "Dividendos", amount: 1100, category: "Investimentos", date: "2025-02-12", recurrent: true },
  { id: 7, type: "despesa", desc: "Academia", amount: 160, category: "Saúde", date: "2025-02-15", recurrent: true },
  { id: 8, type: "despesa", desc: "Streaming", amount: 65, category: "Lazer", date: "2025-02-18", recurrent: true },
  { id: 9, type: "despesa", desc: "Farmácia", amount: 210, category: "Saúde", date: "2025-02-19", recurrent: false },
  { id: 10, type: "despesa", desc: "Restaurante", amount: 185, category: "Alimentação", date: "2025-02-20", recurrent: false },
];

const seedGoals = [
  { id: 1, name: "Reserva de Emergência", target: 30000, current: 19850, deadline: "2025-12-31", color: "#6366f1" },
  { id: 2, name: "Viagem Europa", target: 15000, current: 6200, deadline: "2026-07-01", color: "#22d3ee" },
  { id: 3, name: "Notebook Novo", target: 8000, current: 8000, deadline: "2025-01-15", color: "#10b981" },
  { id: 4, name: "Carro", target: 50000, current: 12000, deadline: "2027-01-01", color: "#f59e0b" },
];

const CATEGORIES = ["Trabalho", "Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Investimentos", "Outros"];

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtPct = (v) => `${v.toFixed(1)}%`;
const progress = (cur, tgt) => Math.min(100, (cur / tgt) * 100);

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border backdrop-blur-sm transition-all
          ${t.type === "success" ? "bg-emerald-500/90 border-emerald-400 text-white" : "bg-red-500/90 border-red-400 text-white"}`}>
          {t.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, trend, color, dark }) {
  const up = trend >= 0;
  return (
    <div className={`rounded-2xl p-5 border relative overflow-hidden transition-all hover:scale-[1.02] cursor-default select-none
      ${dark ? "bg-gray-800/60 border-gray-700/50" : "bg-white border-gray-100 shadow-sm"}`}>
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10`} style={{ background: color }} />
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl`} style={{ background: color + "20" }}>
          <Icon size={18} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded-full
            ${up ? "text-emerald-600 bg-emerald-100" : "text-red-500 bg-red-100"}`}>
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className={`text-xs font-medium mb-1 ${dark ? "text-gray-400" : "text-gray-500"}`}>{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${dark ? "text-white" : "text-gray-900"}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${dark ? "text-gray-500" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, dark }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={`rounded-xl p-3 shadow-2xl border text-xs
      ${dark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-800"}`}>
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, dark }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div onClick={e => e.stopPropagation()}
        className={`relative w-full max-w-md rounded-2xl p-6 shadow-2xl border
          ${dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className={`font-bold text-lg ${dark ? "text-white" : "text-gray-900"}`}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} className={dark ? "text-gray-400" : "text-gray-500"} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [transactions, setTransactions] = useState(seedTransactions);
  const [goals, setGoals] = useState(seedGoals);
  const [toasts, setToasts] = useState([]);
  const [txModal, setTxModal] = useState(false);
  const [goalModal, setGoalModal] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);

  const [txForm, setTxForm] = useState({ type: "despesa", desc: "", amount: "", category: "Outros", date: new Date().toISOString().slice(0, 10), recurrent: false });
  const [goalForm, setGoalForm] = useState({ name: "", target: "", current: "", deadline: "" });

  useEffect(() => {
    const handler = () => setNotifOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const toast = (msg, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };

  const thisMonth = transactions.filter(t => t.date.startsWith("2025-02"));
  const totalReceita = thisMonth.filter(t => t.type === "receita").reduce((a, t) => a + t.amount, 0);
  const totalDespesa = thisMonth.filter(t => t.type === "despesa").reduce((a, t) => a + t.amount, 0);
  const saldo = totalReceita - totalDespesa;
  const economia = totalReceita > 0 ? ((saldo / totalReceita) * 100) : 0;

  const projection = seedRevExp.slice(-3).reduce((a, m) => ({ r: a.r + m.receita, d: a.d + m.despesa }), { r: 0, d: 0 });
  const projData = [
    ...seedBalance,
    { month: "Mar*", balance: seedBalance[5].balance + (projection.r - projection.d) / 3, projected: true },
    { month: "Abr*", balance: seedBalance[5].balance + ((projection.r - projection.d) / 3) * 2, projected: true },
    { month: "Mai*", balance: seedBalance[5].balance + (projection.r - projection.d), projected: true },
  ];
  const notifications = goals
    .filter(g => g.deadline && progress(g.current, g.target) < 100)
    .map(g => {
      const daysLeft = Math.round((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24));
      const pct = progress(g.current, g.target);
      const urgent = daysLeft <= 30;
      return { id: g.id, name: g.name, daysLeft, pct, urgent };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const filteredTx = transactions.filter(t => {
    const matchType = filterType === "all" || t.type === filterType;
    const matchSearch = t.desc.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const addTransaction = () => {
    if (!txForm.desc || !txForm.amount) return toast("Preencha todos os campos", "error");
    const newTx = { ...txForm, id: Date.now(), amount: parseFloat(txForm.amount) };
    setTransactions(p => [newTx, ...p]);
    setTxModal(false);
    setTxForm({ type: "despesa", desc: "", amount: "", category: "Outros", date: new Date().toISOString().slice(0, 10), recurrent: false });
    toast("Transação adicionada!");
  };

  const deleteTransaction = (id) => {
    setTransactions(p => p.filter(t => t.id !== id));
    toast("Transação removida");
  };

  const addGoal = () => {
    if (!goalForm.name || !goalForm.target) return toast("Preencha todos os campos", "error");
    const colors = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#8b5cf6"];
    setGoals(p => [...p, { ...goalForm, id: Date.now(), target: parseFloat(goalForm.target), current: parseFloat(goalForm.current || 0), color: colors[p.length % colors.length] }]);
    setGoalModal(false);
    setGoalForm({ name: "", target: "", current: "", deadline: "" });
    toast("Meta criada!");
  };

  const exportCSV = () => {
    const header = "Tipo,Descrição,Valor,Categoria,Data,Recorrente\n";
    const rows = transactions.map(t => `${t.type},${t.desc},${t.amount},${t.category},${t.date},${t.recurrent}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "financas.csv"; a.click();
    toast("CSV exportado!");
  };

  const bg = dark ? "bg-gray-950" : "bg-slate-50";
  const surface = dark ? "bg-gray-900" : "bg-white";
  const border = dark ? "border-gray-800" : "border-gray-200";
  const text = dark ? "text-white" : "text-gray-900";
  const muted = dark ? "text-gray-400" : "text-gray-500";
  const inputCls = `w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition
    ${dark ? "bg-gray-700 border-gray-600 text-white placeholder-gray-500" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`;
  const labelCls = `block text-xs font-semibold mb-1 ${muted}`;
  const btnPrimary = "px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition";
  const btnGhost = `px-4 py-2 rounded-xl text-sm font-semibold transition ${dark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`;

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "transactions", label: "Transações", icon: ArrowUpCircle },
    { id: "goals", label: "Metas", icon: Target },
    { id: "reports", label: "Relatórios", icon: BarChart2 },
  ];

  return (
    <div className={`${bg} min-h-screen flex font-sans`} style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Toast toasts={toasts} />

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-60" : "w-16"} ${surface} border-r ${border} flex flex-col py-6 transition-all duration-300 shrink-0`}>
        <div className={`flex items-center gap-3 px-4 mb-8`}>
          <img src="/src/assets/finançaspro.png" className="w-8 h-8 rounded-full object-cover shrink-0"/>
          {sidebarOpen && <span className={`font-bold text-base ${text}`}>FinançasPRO</span>}
        </div>

        <nav className="flex flex-col gap-1 px-2 flex-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setPage(id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left w-full
                ${page === id ? "bg-indigo-600 text-white" : `${muted} hover:${dark ? "bg-gray-800" : "bg-gray-100"} hover:${text}`}`}>
              <Icon size={18} className="shrink-0" />
              {sidebarOpen && label}
            </button>
          ))}
        </nav>

        <div className="px-2 mt-auto flex flex-col gap-1">
          <button onClick={() => setDark(d => !d)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${muted} hover:${dark ? "bg-gray-800" : "bg-gray-100"}`}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {sidebarOpen && (dark ? "Modo Claro" : "Modo Escuro")}
          </button>
          <button className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${muted} hover:bg-red-500/10 hover:text-red-500`}>
            <LogOut size={18} />
            {sidebarOpen && "Sair"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className={`sticky top-0 z-10 ${surface} border-b ${border} px-6 py-4 flex items-center justify-between backdrop-blur-xl`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(o => !o)} className={`p-2 rounded-xl ${dark ? "hover:bg-gray-800" : "hover:bg-gray-100"} transition`}>
              <ChevronRight size={18} className={`${muted} transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
            </button>
            <div>
              <h1 className={`font-bold text-lg ${text}`}>
                {page === "dashboard" && "Dashboard"}{page === "transactions" && "Transações"}{page === "goals" && "Metas"}{page === "reports" && "Relatórios"}
              </h1>
              <p className={`text-xs ${muted}`}>Fevereiro 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={e => { e.stopPropagation(); setNotifOpen(o => !o); }}
                className={`p-2 rounded-xl ${dark ? "hover:bg-gray-800" : "hover:bg-gray-100"} transition relative`}>
                <Bell size={18} className={muted} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500" />
                )}
              </button>
              {notifOpen && (
                <div onClick={e => e.stopPropagation()}
                  className={`absolute right-0 top-12 w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden
        ${dark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}>
                  <div className={`px-4 py-3 border-b ${border} flex items-center justify-between`}>
                    <p className={`font-semibold text-sm ${text}`}>Notificações</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium">
                      {notifications.length} alertas
                    </span>
                  </div>
                  {notifications.length === 0 ? (
                    <p className={`text-sm ${muted} text-center py-6`}>Nenhum alerta</p>
                  ) : (
                    <div className="flex flex-col">
                      {notifications.map(n => (
                        <div key={n.id} className={`px-4 py-3 border-b last:border-0 ${border} ${n.urgent ? "bg-red-500/5" : ""}`}>
                          <div className="flex items-start gap-2">
                            <span className="text-base">{n.urgent ? "⚠️" : "🎯"}</span>
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${text}`}>{n.name}</p>
                              <p className={`text-xs ${n.urgent ? "text-red-400" : muted} mt-0.5`}>
                                {n.daysLeft > 0 ? `Faltam ${n.daysLeft} dias` : "Prazo vencido"} • {fmtPct(n.pct)} concluído
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">JD</div>
          </div>
        </header>

        <div className="p-6 max-w-7xl mx-auto">

          {/* ── DASHBOARD ── */}
          {page === "dashboard" && (
            <div className="space-y-6">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard dark={dark} label="Saldo Atual" value={fmt(seedBalance[5].balance)} sub="Patrimônio total" icon={Wallet} color="#6366f1" trend={5.2} />
                <StatCard dark={dark} label="Receitas do Mês" value={fmt(totalReceita)} sub="vs mês anterior" icon={TrendingUp} color="#10b981" trend={8.1} />
                <StatCard dark={dark} label="Despesas do Mês" value={fmt(totalDespesa)} sub="vs mês anterior" icon={TrendingDown} color="#f43f5e" trend={-3.4} />
                <StatCard dark={dark} label="Taxa de Economia" value={fmtPct(economia)} sub={`${fmt(saldo)} guardados`} icon={Target} color="#f59e0b" trend={2.1} />
              </div>

              {/* Charts row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Balance area chart */}
                <div className={`col-span-2 ${surface} rounded-2xl border ${border} p-5`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className={`font-semibold ${text}`}>Evolução do Patrimônio</p>
                      <p className={`text-xs ${muted}`}>Últimos 6 meses + projeção 3 meses</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-medium`}>* Projetado</span>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={projData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1f2937" : "#f1f5f9"} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip dark={dark} />} />
                      <Area type="monotone" dataKey="balance" name="Saldo" stroke="#6366f1" strokeWidth={2.5} fill="url(#balGrad)" dot={(p) => p.payload.projected ? <circle cx={p.cx} cy={p.cy} r={3} fill="#22d3ee" stroke="none" /> : <circle cx={p.cx} cy={p.cy} r={3} fill="#6366f1" stroke="none" />} strokeDasharray={v => v?.projected ? "5 3" : undefined} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie */}
                <div className={`${surface} rounded-2xl border ${border} p-5`}>
                  <p className={`font-semibold ${text} mb-1`}>Gastos por Categoria</p>
                  <p className={`text-xs ${muted} mb-4`}>Fevereiro 2025</p>
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie data={seedCategories} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                        {seedCategories.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip dark={dark} />} /></PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {seedCategories.map((c, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                          <span className={`text-xs ${muted}`}>{c.name}</span>
                        </div>
                        <span className={`text-xs font-medium ${text}`}>{fmt(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bar chart + Recent tx */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`col-span-2 ${surface} rounded-2xl border ${border} p-5`}>
                  <p className={`font-semibold ${text} mb-1`}>Receitas vs Despesas</p>
                  <p className={`text-xs ${muted} mb-4`}>Últimos 6 meses</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={seedRevExp} barGap={4} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1f2937" : "#f1f5f9"} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip dark={dark} />} />
                      <Legend formatter={v => <span style={{ fontSize: 12, color: dark ? "#9ca3af" : "#6b7280" }}>{v === "receita" ? "Receita" : "Despesa"}</span>} />
                      <Bar dataKey="receita" name="receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesa" name="despesa" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Recent transactions */}
                <div className={`${surface} rounded-2xl border ${border} p-5`}>
                  <div className="flex items-center justify-between mb-4">
                    <p className={`font-semibold ${text}`}>Últimas Transações</p>
                    <button onClick={() => setPage("transactions")} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">Ver todas</button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {transactions.slice(0, 6).map(t => (
                      <div key={t.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0
                            ${t.type === "receita" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                            {t.type === "receita"
                              ? <TrendingUp size={14} className="text-emerald-500" />
                              : <TrendingDown size={14} className="text-red-500" />}
                          </div>
                          <div>
                            <p className={`text-xs font-medium ${text}`}>{t.desc}</p>
                            <p className={`text-xs ${muted}`}>{t.category}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold ${t.type === "receita" ? "text-emerald-500" : "text-red-500"}`}>
                          {t.type === "receita" ? "+" : "-"}{fmt(t.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Goals preview */}
              <div className={`${surface} rounded-2xl border ${border} p-5`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className={`font-semibold ${text}`}>Metas Financeiras</p>
                    <p className={`text-xs ${muted}`}>Progresso atual</p>
                  </div>
                  <button onClick={() => setPage("goals")} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">Ver todas</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {goals.slice(0, 4).map(g => {
                    const pct = progress(g.current, g.target);
                    const done = pct >= 100;
                    return (
                      <div key={g.id}>
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-sm font-medium ${text}`}>{g.name}</p>
                          <span className={`text-xs font-semibold`} style={{ color: done ? "#10b981" : g.color }}>{fmtPct(pct)}</span>
                        </div>
                        <div className={`h-2 rounded-full ${dark ? "bg-gray-700" : "bg-gray-100"} overflow-hidden`}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: done ? "#10b981" : g.color }} />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className={`text-xs ${muted}`}>{fmt(g.current)}</span>
                          <span className={`text-xs ${muted}`}>{fmt(g.target)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── TRANSACTIONS ── */}
          {page === "transactions" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${border} ${surface} flex-1`}>
                  <Search size={16} className={muted} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar transações..."
                    className={`bg-transparent outline-none text-sm flex-1 ${text} placeholder:${muted}`} />
                </div>
                <div className="flex gap-2">
                  {["all", "receita", "despesa"].map(f => (
                    <button key={f} onClick={() => setFilterType(f)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition
                        ${filterType === f ? "bg-indigo-600 text-white" : `${surface} border ${border} ${muted} hover:${text}`}`}>
                      {f === "all" ? "Todas" : f === "receita" ? "Receitas" : "Despesas"}
                    </button>
                  ))}
                </div>
                <button onClick={exportCSV} className={`${btnGhost} border ${border} flex items-center gap-2`}>
                  <Download size={15} /> CSV
                </button>
                <button onClick={() => setTxModal(true)} className={`${btnPrimary} flex items-center gap-2`}>
                  <Plus size={15} /> Nova
                </button>
              </div>

              <div className={`${surface} rounded-2xl border ${border} overflow-hidden`}>
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${border} text-xs ${muted} font-semibold uppercase tracking-wide`}>
                      <th className="text-left px-5 py-3">Descrição</th>
                      <th className="text-left px-5 py-3 hidden sm:table-cell">Categoria</th>
                      <th className="text-left px-5 py-3 hidden md:table-cell">Data</th>
                      <th className="text-left px-5 py-3 hidden lg:table-cell">Recorrente</th>
                      <th className="text-right px-5 py-3">Valor</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTx.length === 0 && (
                      <tr><td colSpan={6} className={`text-center py-12 ${muted} text-sm`}>Nenhuma transação encontrada</td></tr>
                    )}
                    {filteredTx.map((t, i) => (
                      <tr key={t.id} className={`border-b ${border} last:border-0 hover:${dark ? "bg-gray-800/50" : "bg-gray-50"} transition`}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0
                              ${t.type === "receita" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                              {t.type === "receita"
                                ? <TrendingUp size={14} className="text-emerald-500" />
                                : <TrendingDown size={14} className="text-red-500" />}
                            </div>
                            <span className={`text-sm font-medium ${text}`}>{t.desc}</span>
                          </div>
                        </td>
                        <td className={`px-5 py-3 text-sm ${muted} hidden sm:table-cell`}>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dark ? "bg-gray-700" : "bg-gray-100"}`}>{t.category}</span>
                        </td>
                        <td className={`px-5 py-3 text-sm ${muted} hidden md:table-cell`}>{t.date}</td>
                        <td className="px-5 py-3 hidden lg:table-cell">
                          {t.recurrent && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium">Recorrente</span>}
                        </td>
                        <td className={`px-5 py-3 text-right font-semibold text-sm ${t.type === "receita" ? "text-emerald-500" : "text-red-500"}`}>
                          {t.type === "receita" ? "+" : "-"}{fmt(t.amount)}
                        </td>
                        <td className="px-3 py-3">
                          <button onClick={() => deleteTransaction(t.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition text-gray-400">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── GOALS ── */}
          {page === "goals" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className={`text-sm ${muted}`}>{goals.length} metas ativas</p>
                <button onClick={() => setGoalModal(true)} className={`${btnPrimary} flex items-center gap-2`}>
                  <Plus size={15} /> Nova Meta
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {goals.map(g => {
                  const pct = progress(g.current, g.target);
                  const done = pct >= 100;
                  const remaining = g.target - g.current;
                  const monthsLeft = g.deadline ? Math.max(0, Math.round((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24 * 30))) : null;
                  const monthlyNeed = monthsLeft ? remaining / monthsLeft : 0;
                  return (
                    <div key={g.id} className={`${surface} rounded-2xl border ${border} p-5`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className={`font-semibold ${text}`}>{g.name}</p>
                          {g.deadline && <p className={`text-xs ${muted} mt-0.5`}>Prazo: {new Date(g.deadline).toLocaleDateString("pt-BR")}</p>}
                        </div>
                        {done && <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold flex items-center gap-1"><CheckCircle size={11} />Concluída</span>}
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className={`text-2xl font-bold ${text}`}>{fmt(g.current)}</span>
                        <span className={`text-sm ${muted} self-end mb-0.5`}>de {fmt(g.target)}</span>
                      </div>
                      <div className={`h-3 rounded-full ${dark ? "bg-gray-700" : "bg-gray-100"} overflow-hidden mb-2`}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: done ? "#10b981" : g.color }} />
                      </div>
                      <div className="flex justify-between">
                        <span className={`text-xs ${muted}`}>{fmtPct(pct)} atingido</span>
                        {!done && monthsLeft !== null && (
                          <span className={`text-xs ${muted}`}>{monthsLeft}m • {fmt(monthlyNeed)}/mês</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── REPORTS ── */}
          {page === "reports" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Maior Receita", val: "Salário", amount: 7500, color: "#10b981" },
                  { label: "Maior Despesa", val: "Aluguel", amount: 2400, color: "#f43f5e" },
                  { label: "Categoria Principal", val: "Moradia", amount: 2400, color: "#6366f1" },
                ].map((c, i) => (
                  <div key={i} className={`${surface} rounded-2xl border ${border} p-5`}>
                    <p className={`text-xs ${muted} mb-1`}>{c.label}</p>
                    <p className={`font-bold text-lg ${text}`}>{c.val}</p>
                    <p className="font-semibold" style={{ color: c.color }}>{fmt(c.amount)}</p>
                  </div>
                ))}
              </div>

              <div className={`${surface} rounded-2xl border ${border} p-5`}>
                <p className={`font-semibold ${text} mb-1`}>Projeção dos Próximos 3 Meses</p>
                <p className={`text-xs ${muted} mb-4`}>Baseado na média dos últimos 3 meses</p>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={projData.slice(3)} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1f2937" : "#f1f5f9"} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip dark={dark} />} />
                    <Area type="monotone" dataKey="balance" name="Saldo Projetado" stroke="#22d3ee" strokeWidth={2.5} strokeDasharray="6 3" fill="url(#pGrad)" dot={{ fill: "#22d3ee", r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className={`${surface} rounded-2xl border ${border} p-5`}>
                <div className="flex items-center justify-between mb-4">
                  <p className={`font-semibold ${text}`}>Resumo por Categoria</p>
                  <button onClick={exportCSV} className={`${btnGhost} border ${border} flex items-center gap-2 text-xs`}>
                    <Download size={13} /> Exportar CSV
                  </button>
                </div>
                <div className="space-y-3">
                  {seedCategories.map((c, i) => {
                    const pct = (c.value / seedCategories.reduce((a, x) => a + x.value, 0)) * 100;
                    return (
                      <div key={i}>
                        <div className="flex justify-between mb-1">
                          <span className={`text-sm ${text} font-medium`}>{c.name}</span>
                          <span className={`text-sm font-semibold`} style={{ color: c.color }}>{fmt(c.value)}</span>
                        </div>
                        <div className={`h-2 rounded-full ${dark ? "bg-gray-700" : "bg-gray-100"} overflow-hidden`}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Footer */}
        <footer className={`border-t ${border} px-6 py-4 mt-auto`}>
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs ${muted}`}>© {new Date().getFullYear()} FinançasPRO — Feito por</span>
              <span className={`text-xs font-semibold ${text}`}>Ailton Ribas</span>
              <span className={`text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium`}>v1.0.0</span>
            </div>
            <div className="flex items-center gap-3">
              <a href="https://www.linkedin.com/in/ailton-guilherme" target="_blank" rel="noreferrer"
                className={`text-xs ${muted} hover:text-indigo-400 transition font-medium`}>
                LinkedIn
              </a>
              <span className={`text-xs ${muted}`}>•</span>
              <a href="https://instagram.com/ag_ribas" target="_blank" rel="noreferrer"
                className={`text-xs ${muted} hover:text-pink-400 transition font-medium`}>
                Instagram
              </a>
              <span className={`text-xs ${muted}`}>•</span>
              <a href="https://github.com/Ribashow666" target="_blank" rel="noreferrer"
                className={`text-xs ${muted} hover:text-white transition font-medium`}>
                GitHub
              </a>
              <span className={`text-xs ${muted}`}>•</span>
              <a href="mailto:guilherme_ribas12@hotmail.com"
                className={`text-xs ${muted} hover:text-emerald-400 transition font-medium`}>
                Suporte
              </a>
            </div>
          </div>
        </footer>
      </main>

      {/* Transaction Modal */}
      <Modal open={txModal} onClose={() => setTxModal(false)} title="Nova Transação" dark={dark}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {["receita", "despesa"].map(t => (
              <button key={t} onClick={() => setTxForm(f => ({ ...f, type: t }))}
                className={`py-2 rounded-xl text-sm font-semibold capitalize transition
                  ${txForm.type === t ? (t === "receita" ? "bg-emerald-600 text-white" : "bg-red-500 text-white") : `${dark ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}`}>
                {t === "receita" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>
          <div><label className={labelCls}>Descrição</label><input value={txForm.desc} onChange={e => setTxForm(f => ({ ...f, desc: e.target.value }))} className={inputCls} placeholder="Ex: Salário, Aluguel..." /></div>
          <div><label className={labelCls}>Valor (R$)</label><input type="number" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} placeholder="0,00" /></div>
          <div><label className={labelCls}>Categoria</label>
            <select value={txForm.category} onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Data</label><input type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} className={inputCls} /></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={txForm.recurrent} onChange={e => setTxForm(f => ({ ...f, recurrent: e.target.checked }))} className="rounded" />
            <span className={`text-sm ${muted}`}>Recorrente (mensal)</span>
          </label>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setTxModal(false)} className={`${btnGhost} flex-1 border ${border}`}>Cancelar</button>
            <button onClick={addTransaction} className={`${btnPrimary} flex-1`}>Adicionar</button>
          </div>
        </div>
      </Modal>

      {/* Goal Modal */}
      <Modal open={goalModal} onClose={() => setGoalModal(false)} title="Nova Meta" dark={dark}>
        <div className="space-y-3">
          <div><label className={labelCls}>Nome da Meta</label><input value={goalForm.name} onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex: Viagem para Europa" /></div>
          <div><label className={labelCls}>Valor Total (R$)</label><input type="number" value={goalForm.target} onChange={e => setGoalForm(f => ({ ...f, target: e.target.value }))} className={inputCls} placeholder="10000" /></div>
          <div><label className={labelCls}>Valor Atual (R$)</label><input type="number" value={goalForm.current} onChange={e => setGoalForm(f => ({ ...f, current: e.target.value }))} className={inputCls} placeholder="0" /></div>
          <div><label className={labelCls}>Prazo</label><input type="date" value={goalForm.deadline} onChange={e => setGoalForm(f => ({ ...f, deadline: e.target.value }))} className={inputCls} /></div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setGoalModal(false)} className={`${btnGhost} flex-1 border ${border}`}>Cancelar</button>
            <button onClick={addGoal} className={`${btnPrimary} flex-1`}>Criar Meta</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
