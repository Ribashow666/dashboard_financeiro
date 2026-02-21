import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Target, Plus, X,
  LayoutDashboard, ArrowUpCircle, Moon, Sun, LogOut, ChevronRight, Download,
  Trash2, CheckCircle, AlertCircle, Bell, Search,
  BarChart2, RefreshCw, Mail, Lock, Eye, EyeOff, User, Menu
} from "lucide-react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

// ── Supabase Config ────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = {
  auth: {
    signUp: async ({ email, password, options, captchaToken }) => {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password, data: options?.data || {}, gotrue_meta_security: { captcha_token: captchaToken } })
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: data };
      return { data, error: null };
    },
    signInWithPassword: async ({ email, password, captchaToken }) => {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password, gotrue_meta_security: { captcha_token: captchaToken } })
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: data };

      // bloqueia login se email não foi confirmado
      if (!data.user?.email_confirmed_at) {
        return { data: null, error: { message: "Email not confirmed" } };
      }

      localStorage.setItem("sb_session", JSON.stringify(data));

      // ✅ salva dados do usuário no banco
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const { ip } = await ipRes.json();

        await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_user_profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${data.access_token}`,
          },
          body: JSON.stringify({
            p_user_id: data.user.id,
            p_email: data.user.email,
            p_full_name: data.user.user_metadata?.full_name || "",
            p_ip: ip
          })
        });
      } catch (e) {
        // falha silenciosa, não impede o login
      }

      return { data, error: null };
    },
    resendConfirmation: async (email) => {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ type: "signup", email })
      });
      const data = await res.json();
      if (!res.ok) return { error: data };
      return { error: null };
    },
    signOut: async () => {
      const session = JSON.parse(localStorage.getItem("sb_session") || "null");
      if (session?.access_token) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${session.access_token}`, "apikey": SUPABASE_ANON_KEY }
        });
      }
      localStorage.removeItem("sb_session");
      return { error: null };
    },
    getSession: () => {
      const session = JSON.parse(localStorage.getItem("sb_session") || "null");
      return { data: { session } };
    },
    updateUser: async ({ email, password, data: meta }) => {
      const session = JSON.parse(localStorage.getItem("sb_session") || "null");
      if (!session?.access_token) return { data: null, error: { message: "Não autenticado." } };
      const body = {};
      if (email) body.email = email;
      if (password) body.password = password;
      if (meta) body.data = meta;
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify(body)
      });
      const result = await res.json();
      if (!res.ok) return { data: null, error: result };
      const updated = {
        ...session,
        user: {
          ...session.user,
          ...result,
          user_metadata: {
            ...(session.user?.user_metadata || {}),
            ...(result?.user_metadata || {}),
          }
        }
      };
      localStorage.setItem("sb_session", JSON.stringify(updated));
      return { data: result, error: null };
    },
    uploadAvatar: async (file) => {
      const session = JSON.parse(localStorage.getItem("sb_session") || "null");
      if (!session?.access_token) return { url: null, error: { message: "Não autenticado." } };
      const userId = session.user?.id || "unknown";
      const ext = file.name.split(".").pop();
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${userId}.${ext}`, {
        method: "POST",
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${session.access_token}`, "Content-Type": file.type, "x-upsert": "true" },
        body: file
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { url: null, error: err };
      }
      const url = `${SUPABASE_URL}/storage/v1/object/public/avatars/${userId}.${ext}?t=${Date.now()}`;
      return { url, error: null };
    }
  },
  db: {
    _req: async (method, path, body) => {
      const session = JSON.parse(localStorage.getItem("sb_session") || "null");
      const headers = { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${session?.access_token}`, "Prefer": "return=representation" };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      if (!res.ok) return { data: null, error: data };
      return { data, error: null };
    },
    fetchTransactions: async () => {
      const session = JSON.parse(localStorage.getItem("sb_session") || "null");
      const uid = session?.user?.id;
      return supabase.db._req("GET", `transactions?user_id=eq.${uid}&order=date.desc,created_at.desc`);
    },
    insertTransaction: async (tx) => {
      const session = JSON.parse(localStorage.getItem("sb_session") || "null");
      const uid = session?.user?.id;
      return supabase.db._req("POST", "transactions", { ...tx, user_id: uid });
    },
    deleteTransaction: async (id) => {
      const session = JSON.parse(localStorage.getItem("sb_session") || "null");
      const uid = session?.user?.id;
      return supabase.db._req("DELETE", `transactions?id=eq.${id}&user_id=eq.${uid}`);
    },
    fetchGoals: async () => {
      const session = JSON.parse(localStorage.getItem("sb_session") || "null");
      const uid = session?.user?.id;
      return supabase.db._req("GET", `goals?user_id=eq.${uid}&order=created_at.asc`);
    },
    insertGoal: async (goal) => {
      const session = JSON.parse(localStorage.getItem("sb_session") || "null");
      const uid = session?.user?.id;
      return supabase.db._req("POST", "goals", { ...goal, user_id: uid });
    },
    updateGoal: async (id, patch) => {
      const session = JSON.parse(localStorage.getItem("sb_session") || "null");
      const uid = session?.user?.id;
      return supabase.db._req("PATCH", `goals?id=eq.${id}&user_id=eq.${uid}`, patch);
    },
    deleteGoal: async (id) => {
      const session = JSON.parse(localStorage.getItem("sb_session") || "null");
      const uid = session?.user?.id;
      return supabase.db._req("DELETE", `goals?id=eq.${id}&user_id=eq.${uid}`);
    },
  }
};

// ── Seed data ──────────────────────────────────────────────────────────────
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
const getNextMonth = (curMonth, curYear, offset) => {
  const d = new Date(curYear, curMonth + offset, 1);
  const name = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return (name.charAt(0).toUpperCase() + name.slice(1)) + "*";
};
const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtPct = (v) => `${v.toFixed(1)}%`;
const progress = (cur, tgt) => Math.min(100, (cur / tgt) * 100);

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border backdrop-blur-sm
          ${t.type === "success" ? "bg-emerald-500/90 border-emerald-400 text-white" : "bg-red-500/90 border-red-400 text-white"}`}>
          {t.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Profile Page ───────────────────────────────────────────────────────────
function ProfilePage({ session, dark, onUpdate, toast }) {
  const text = dark ? "text-white" : "text-gray-900";
  const muted = dark ? "text-gray-400" : "text-gray-500";
  const surface = dark ? "bg-gray-800/60 border-gray-700/50" : "bg-white border-gray-200";
  const border = dark ? "border-gray-700" : "border-gray-200";
  const inputCls = `w-full px-3 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition border
    ${dark ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`;
  const labelCls = `block text-xs font-semibold mb-1 ${muted}`;

  const getName = () => session?.user?.user_metadata?.full_name || session?.user_metadata?.full_name || "";
  const getEmail = () => session?.user?.email || session?.email || "";
  const getAvatar = () => session?.user?.user_metadata?.avatar_url || session?.user_metadata?.avatar_url || null;

  const [name, setName] = useState(getName());
  const [email, setEmail] = useState(getEmail());
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(getAvatar());
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState("info");

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const initials = name.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "U";

  const handleSaveInfo = async () => {
    setLoading(true);
    try {
      let newAvatarUrl = avatarUrl;
      if (avatarFile) {
        const { url, error: upErr } = await supabase.auth.uploadAvatar(avatarFile);
        if (upErr) { toast("Erro ao enviar foto: " + (upErr.message || "tente novamente"), "error"); setLoading(false); return; }
        newAvatarUrl = url;
        setAvatarUrl(url);
        setAvatarPreview(null);
        setAvatarFile(null);
      }
      const updates = { data: { full_name: name, avatar_url: newAvatarUrl } };
      if (email !== getEmail()) updates.email = email;
      const { error } = await supabase.auth.updateUser(updates);
      if (error) { toast("Erro: " + (error.message || "tente novamente"), "error"); return; }
      onUpdate();
      toast("Perfil atualizado com sucesso! ✅");
    } finally { setLoading(false); }
  };

  const handleSavePassword = async () => {
    if (!newPass) return toast("Digite a nova senha.", "error");
    if (newPass.length < 6) return toast("Senha deve ter ao menos 6 caracteres.", "error");
    if (newPass !== confirmPass) return toast("As senhas não coincidem.", "error");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) { toast("Erro: " + (error.message || "tente novamente"), "error"); return; }
      setNewPass(""); setConfirmPass("");
      toast("Senha alterada com sucesso! 🔒");
    } finally { setLoading(false); }
  };

  const displayAvatar = avatarPreview || avatarUrl;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className={`rounded-2xl border ${surface} p-6 flex items-center gap-5`}>
        <div className="relative group">
          {displayAvatar
            ? <img src={displayAvatar} alt="avatar" className="w-20 h-20 rounded-2xl object-cover shadow-lg ring-2 ring-indigo-500/40" />
            : <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">{initials}</div>
          }
          <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition cursor-pointer">
            <span className="text-white text-xs font-semibold">Trocar foto</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
        </div>
        <div>
          <p className={`text-xl font-bold ${text}`}>{name || "Usuário"}</p>
          <p className={`text-sm ${muted}`}>{getEmail()}</p>
          <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium">Conta ativa</span>
        </div>
      </div>

      <div className={`flex gap-1 p-1 rounded-xl ${dark ? "bg-gray-800" : "bg-gray-100"} w-fit`}>
        {[{ id: "info", label: "Informações" }, { id: "password", label: "Senha" }].map(t => (
          <button key={t.id} onClick={() => setSection(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition
              ${section === t.id ? "bg-indigo-600 text-white shadow" : `${muted} hover:text-white`}`}>
            {t.label}
          </button>
        ))}
      </div>

      {section === "info" && (
        <div className={`rounded-2xl border ${surface} p-6 space-y-4`}>
          <h2 className={`font-semibold ${text} mb-2`}>Informações do Perfil</h2>
          <div>
            <label className={labelCls}>Nome completo</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Seu nome" />
          </div>
          <div>
            <label className={labelCls}>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="seu@email.com" />
            {email !== getEmail() && <p className="text-xs text-amber-400 mt-1">⚠ Você receberá um e-mail de confirmação no novo endereço.</p>}
          </div>
          <div>
            <label className={labelCls}>Foto de perfil</label>
            <label className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition hover:border-indigo-500
              ${dark ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
              <ArrowUpCircle size={16} className="text-indigo-400" />
              <span className="text-sm">{avatarFile ? avatarFile.name : "Clique para selecionar uma imagem"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          {avatarPreview && (
            <div className="flex items-center gap-3">
              <img src={avatarPreview} alt="preview" className="w-14 h-14 rounded-xl object-cover border-2 border-indigo-500" />
              <div>
                <p className={`text-sm font-medium ${text}`}>Preview da nova foto</p>
                <button onClick={() => { setAvatarPreview(null); setAvatarFile(null); }} className="text-xs text-red-400 hover:text-red-300 transition">Remover</button>
              </div>
            </div>
          )}
          <button onClick={handleSaveInfo} disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2">
            {loading ? <><RefreshCw size={15} className="animate-spin" /> Salvando...</> : "Salvar alterações"}
          </button>
        </div>
      )}

      {section === "password" && (
        <div className={`rounded-2xl border ${surface} p-6 space-y-4`}>
          <h2 className={`font-semibold ${text} mb-2`}>Trocar Senha</h2>
          <div>
            <label className={labelCls}>Nova senha</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={newPass} onChange={e => setNewPass(e.target.value)}
                className={inputCls} placeholder="••••••••" />
              <button onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Confirmar nova senha</label>
            <input type={showPass ? "text" : "password"} value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
              className={inputCls} placeholder="••••••••" />
          </div>
          {newPass && confirmPass && newPass !== confirmPass && (
            <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} /> As senhas não coincidem.</p>
          )}
          {newPass && confirmPass && newPass === confirmPass && (
            <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle size={12} /> Senhas conferem!</p>
          )}
          <button onClick={handleSavePassword} disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2">
            {loading ? <><RefreshCw size={15} className="animate-spin" /> Salvando...</> : "Alterar senha"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Auth Screen ────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const captchaRef = useRef(null);

  const translateError = (msg) => {
    if (!msg) return "Erro desconhecido.";
    if (msg.includes("Invalid login") || msg.includes("invalid_credentials")) return "E-mail ou senha incorretos.";
    if (msg.includes("already registered") || msg.includes("already been registered")) return "Este e-mail já está cadastrado.";
    if (msg.includes("valid email")) return "Informe um e-mail válido.";
    if (msg.includes("Password should")) return "Senha deve ter ao menos 6 caracteres.";
    if (msg.includes("Email not confirmed") || msg.includes("email_not_confirmed"))
      return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada! 📧";
    return msg;
  };

  const handleSubmit = async () => {
    setError(""); setSuccess("");
    if (!email || !password) return setError("Preencha e-mail e senha.");
    if (mode === "register" && !name) return setError("Informe seu nome.");
    if (password.length < 6) return setError("Senha deve ter ao menos 6 caracteres.");
    setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password, captchaToken });
        if (error) {
          const msg = error.message || error.msg || error.error_description || "";
          setError(translateError(msg));
          if (msg.includes("Email not confirmed") || msg.includes("email_not_confirmed")) {
            setShowResend(true);
          }
          return;
        }
        onLogin(data);
        return;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } }, captchaToken });
        if (error) return setError(translateError(error.message || error.msg || error.error_description || ""));
        setSuccess("Conta criada! Verifique seu e-mail para confirmar o cadastro, depois faça login.");
        setMode("login");
      }
    } finally {
      setLoading(false);
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    }
  };

  const handleResend = async () => {
    if (!email) return setError("Digite seu e-mail acima para reenviar.");
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resendConfirmation(email);
      if (error) {
        setError("Erro ao reenviar: " + (error.message || "tente novamente"));
      } else {
        setError(""); setShowResend(false);
        setSuccess("E-mail de confirmação reenviado! Verifique sua caixa de entrada. 📧");
      }
    } finally { setResendLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>
      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/30">
            <Wallet size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">FinançasPRO</h1>
          <p className="text-gray-400 text-sm mt-1">{mode === "login" ? "Acesse sua conta" : "Crie sua conta grátis"}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex bg-gray-800 rounded-xl p-1 mb-6">
            {["login", "register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); setCaptchaToken(null); captchaRef.current?.resetCaptcha(); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition
                  ${mode === m ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-white"}`}>
                {m === "login" ? "Entrar" : "Cadastrar"}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Nome completo</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500 transition" />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">E-mail</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500 transition" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Senha</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500 transition" />
                <button onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                <AlertCircle size={13} /> {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                <CheckCircle size={13} /> {success}
              </div>
            )}

            {/* ✅ hCaptcha */}
            <div className="flex justify-center">
              <HCaptcha
                sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY}
                onVerify={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken(null)}
                ref={captchaRef}
                theme="dark"
              />
            </div>

            <button onClick={handleSubmit} disabled={loading || !captchaToken}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 mt-1">
              {loading ? <><RefreshCw size={15} className="animate-spin" /> Aguarde...</> : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </div>
          {showResend && (
            <button onClick={handleResend} disabled={resendLoading}
              className="w-full mt-3 py-2.5 border border-indigo-500/40 hover:border-indigo-400 text-indigo-400 hover:text-indigo-300 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2">
              {resendLoading ? <><RefreshCw size={15} className="animate-spin" /> Reenviando...</> : <><Mail size={15} /> Reenviar e-mail de confirmação</>}
            </button>
          )}
          {mode === "login" && (
            <p className="text-center text-xs text-gray-500 mt-4">
              Não tem conta?{" "}
              <button onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
                className="text-indigo-400 hover:text-indigo-300 font-semibold transition">Cadastre-se grátis</button>
            </p>
          )}
        </div>
        <p className="text-center text-xs text-gray-600 mt-4">© {new Date().getFullYear()} FinançasPRO · Feito por Ailton Ribas</p>
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, trend, color, dark }) {
  const up = trend >= 0;
  return (
    <div className={`rounded-2xl p-5 border relative overflow-hidden transition-all hover:scale-[1.02] cursor-default select-none
      ${dark ? "bg-gray-800/60 border-gray-700/50" : "bg-white border-gray-100 shadow-sm"}`}>
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10" style={{ background: color }} />
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-xl" style={{ background: color + "20" }}>
          <Icon size={18} style={{ color }} />
        </div>
        {trend !== null && trend !== undefined && (
          <span className={`text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded-full
            ${up ? "text-emerald-600 bg-emerald-100" : "text-red-500 bg-red-100"}`}>
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend).toFixed(1)}%
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
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
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
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState(() => localStorage.getItem("fp_page") || "dashboard");
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [txModal, setTxModal] = useState(false);
  const [goalModal, setGoalModal] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [txForm, setTxForm] = useState({ type: "despesa", desc: "", amount: "", category: "Outros", date: new Date().toISOString().slice(0, 10), recurrent: false });
  const [goalForm, setGoalForm] = useState({ name: "", target: "", current: "", deadline: "" });

  useEffect(() => {
    const { data } = supabase.auth.getSession();
    if (data.session) setSession(data.session);
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    const loadData = async () => {
      setDataLoading(true);
      const [txRes, goalRes] = await Promise.all([
        supabase.db.fetchTransactions(),
        supabase.db.fetchGoals(),
      ]);

      let allTx = txRes.data ? txRes.data.map(t => ({ ...t, desc: t.description })) : [];

      // ✅ Processa recorrentes automaticamente
      const now = new Date();
      const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;

      const recorrentes = allTx.filter(t => t.recurrent && t.date?.startsWith(lastMonthStr));
      const jaExisteEsseMes = allTx.filter(t => t.date?.startsWith(thisMonthStr)).map(t => t.description);

      for (const t of recorrentes) {
        if (!jaExisteEsseMes.includes(t.description)) {
          const novaData = t.date.replace(lastMonthStr, thisMonthStr);
          const { data, error } = await supabase.db.insertTransaction({
            type: t.type,
            description: t.description,
            amount: t.amount,
            category: t.category,
            date: novaData,
            recurrent: true
          });
          if (!error && data?.[0]) {
            allTx = [{ ...data[0], desc: data[0].description }, ...allTx];
          }
        }
      }

      setTransactions(allTx);
      if (goalRes.data) setGoals(goalRes.data);
      setDataLoading(false);
    };
    loadData();
  }, [session]);

  useEffect(() => { localStorage.setItem("fp_page", page); }, [page]);

  useEffect(() => {
    const handler = () => { setNotifOpen(false); setProfileOpen(false); };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const toast = (msg, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem("sb_session");
    setSession(null);
  };

  const notifications = goals
    .filter(g => g.deadline && progress(g.current, g.target) < 100)
    .map(g => {
      const daysLeft = Math.round((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24));
      const pct = progress(g.current, g.target);
      return { id: g.id, name: g.name, daysLeft, pct, urgent: daysLeft <= 30 };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const nowDate = new Date();
  const curYear = nowDate.getFullYear();
  const curMonth = nowDate.getMonth();

  const thisMonthStr = `${curYear}-${String(curMonth + 1).padStart(2, "0")}`;
  const lastMonthStr = curMonth === 0
    ? `${curYear - 1}-12`
    : `${curYear}-${String(curMonth).padStart(2, "0")}`;

  const thisMonth = transactions.filter(t => t.date && t.date.startsWith(thisMonthStr));
  const lastMonth = transactions.filter(t => t.date && t.date.startsWith(lastMonthStr));

  const totalReceita = thisMonth.filter(t => t.type === "receita").reduce((a, t) => a + Number(t.amount), 0);
  const totalDespesa = thisMonth.filter(t => t.type === "despesa").reduce((a, t) => a + Number(t.amount), 0);
  const saldo = totalReceita - totalDespesa;
  const economia = totalReceita > 0 ? ((saldo / totalReceita) * 100) : 0;

  const lastReceita = lastMonth.filter(t => t.type === "receita").reduce((a, t) => a + Number(t.amount), 0);
  const lastDespesa = lastMonth.filter(t => t.type === "despesa").reduce((a, t) => a + Number(t.amount), 0);
  const trendReceita = lastReceita > 0 ? ((totalReceita - lastReceita) / lastReceita * 100) : 0;
  const trendDespesa = lastDespesa > 0 ? ((totalDespesa - lastDespesa) / lastDespesa * 100) : 0;

  const saldoTotal = transactions.reduce((a, t) => t.type === "receita" ? a + Number(t.amount) : a - Number(t.amount), 0);

  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(curYear, curMonth - 5 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    const txs = transactions.filter(t => t.date && t.date.startsWith(key));
    return {
      month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      receita: txs.filter(t => t.type === "receita").reduce((a, t) => a + Number(t.amount), 0),
      despesa: txs.filter(t => t.type === "despesa").reduce((a, t) => a + Number(t.amount), 0),
    };
  });

  const balanceByMonth = last6Months.reduce((acc, m, i) => {
    const prev = i === 0 ? saldoTotal - last6Months.slice(i).reduce((a, x) => a + (x.receita - x.despesa), 0) : acc[i - 1].balance;
    return [...acc, { month: m.month, balance: prev + m.receita - m.despesa }];
  }, []);

  const avg3 = last6Months.slice(-3).reduce((a, m) => ({ r: a.r + m.receita, d: a.d + m.despesa }), { r: 0, d: 0 });
  const avgSaldo = (avg3.r - avg3.d) / 3;
  const lastBalance = balanceByMonth[balanceByMonth.length - 1]?.balance || 0;
  const projData = [
    ...balanceByMonth,
    { month: getNextMonth(curMonth, curYear, 1), balance: lastBalance + avgSaldo, projected: true },
    { month: getNextMonth(curMonth, curYear, 2), balance: lastBalance + avgSaldo * 2, projected: true },
    { month: getNextMonth(curMonth, curYear, 3), balance: lastBalance + avgSaldo * 3, projected: true },
  ];

  const CATEGORY_COLORS = { "Trabalho": "#10b981", "Moradia": "#6366f1", "Alimentação": "#22d3ee", "Transporte": "#f59e0b", "Saúde": "#f43f5e", "Lazer": "#8b5cf6", "Investimentos": "#06b6d4", "Outros": "#94a3b8" };
  const catMap = {};
  thisMonth.filter(t => t.type === "despesa").forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount);
  });
  const realCategories = Object.entries(catMap).map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] || "#6366f1" })).sort((a, b) => b.value - a.value);

  const biggestReceita = thisMonth.filter(t => t.type === "receita").sort((a, b) => b.amount - a.amount)[0];
  const biggestDespesa = thisMonth.filter(t => t.type === "despesa").sort((a, b) => b.amount - a.amount)[0];
  const topCategory = realCategories[0];

  const allCatMap = {};
  transactions.filter(t => t.type === "despesa").forEach(t => {
    allCatMap[t.category] = (allCatMap[t.category] || 0) + Number(t.amount);
  });
  const allCategories = Object.entries(allCatMap).map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] || "#6366f1" })).sort((a, b) => b.value - a.value);

  const filteredTx = transactions.filter(t => {
    const matchType = filterType === "all" || t.type === filterType;
    const matchSearch = t.desc.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const addTransaction = async () => {
    if (!txForm.desc || !txForm.amount) return toast("Preencha todos os campos", "error");
    const { desc, ...rest } = { ...txForm, amount: parseFloat(txForm.amount) };
    const payload = { ...rest, description: desc };
    const { data, error } = await supabase.db.insertTransaction(payload);
    if (error) return toast("Erro ao salvar: " + (error.message || "tente novamente"), "error");
    setTransactions(p => [{ ...data[0], desc: data[0].description }, ...p]);
    setTxModal(false);
    setTxForm({ type: "despesa", desc: "", amount: "", category: "Outros", date: new Date().toISOString().slice(0, 10), recurrent: false });
    toast("Transação adicionada! ✅");
  };

  const addGoal = async () => {
    if (!goalForm.name || !goalForm.target) return toast("Preencha todos os campos", "error");
    const colors = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#8b5cf6"];
    const payload = { ...goalForm, target: parseFloat(goalForm.target), current: parseFloat(goalForm.current || 0), color: colors[goals.length % colors.length] };
    const { data, error } = await supabase.db.insertGoal(payload);
    if (error) return toast("Erro ao salvar: " + (error.message || "tente novamente"), "error");
    setGoals(p => [...p, data[0]]);
    setGoalModal(false);
    setGoalForm({ name: "", target: "", current: "", deadline: "" });
    toast("Meta criada! 🎯");
  };

  const exportCSV = () => {
    const header = "Tipo,Descrição,Valor,Categoria,Data,Recorrente\n";
    const rows = transactions.map(t => `${t.type},${t.desc},${t.amount},${t.category},${t.date},${t.recurrent}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "financas.csv"; a.click();
    toast("CSV exportado!");
  };

  const getUserInitials = () => {
    const n = session?.user?.user_metadata?.full_name || session?.user_metadata?.full_name || session?.email || "U";
    return n.split(" ").map(x => x[0]).join("").toUpperCase().slice(0, 2);
  };

  const getUserName = () => session?.user?.user_metadata?.full_name || session?.user_metadata?.full_name || "Usuário";
  const getUserEmail = () => session?.user?.email || session?.email || "";
  const getUserAvatar = () => session?.user?.user_metadata?.avatar_url || session?.user_metadata?.avatar_url || null;

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Wallet size={20} className="text-white" />
          </div>
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) return <AuthScreen onLogin={(data) => setSession(data?.session || data)} />;

  return (
    <div className={`${bg} min-h-screen flex font-sans`} style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Toast toasts={toasts} />

      {/* ── SIDEBAR (desktop only) ── */}
      <aside className={`hidden md:flex ${sidebarOpen ? "w-60" : "w-16"} ${surface} border-r ${border} flex-col py-6 transition-all duration-300 shrink-0`}>
        <div className="flex items-center gap-3 px-4 mb-8">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <Wallet size={16} className="text-white" />
          </div>
          {sidebarOpen && <span className={`font-bold text-base ${text}`}>FinançasPRO</span>}
        </div>
        <nav className="flex flex-col gap-1 px-2 flex-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setPage(id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left w-full
                ${page === id ? "bg-indigo-600 text-white" : `${muted} hover:${text}`}`}>
              <Icon size={18} className="shrink-0" />
              {sidebarOpen && label}
            </button>
          ))}
        </nav>
        <div className="px-2 mt-auto flex flex-col gap-1">
          {sidebarOpen && (
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 ${dark ? "bg-gray-800/60" : "bg-gray-100/60"}`}>
              <div className="w-7 h-7 rounded-lg shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,#6366f1,#9333ea)" }}>
                {getUserAvatar()
                  ? <img src={getUserAvatar()} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "11px" }}>{getUserInitials()}</div>}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-semibold truncate ${text}`}>{getUserName()}</p>
                <p className={`text-xs truncate ${muted}`}>{getUserEmail()}</p>
              </div>
            </div>
          )}
          <button onClick={() => setDark(d => !d)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${muted}`}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {sidebarOpen && (dark ? "Modo Claro" : "Modo Escuro")}
          </button>
          <button onClick={handleLogout}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${muted} hover:text-red-500`}>
            <LogOut size={18} />
            {sidebarOpen && "Sair"}
          </button>
        </div>
      </aside>

      {/* ── MOBILE DRAWER ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className={`absolute left-0 top-0 bottom-0 w-72 ${surface} flex flex-col py-8 px-4 shadow-2xl`}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                  <Wallet size={16} className="text-white" />
                </div>
                <span className={`font-bold text-base ${text}`}>FinançasPRO</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className={`p-2 rounded-xl ${muted}`}><X size={18} /></button>
            </div>
            <div className={`flex items-center gap-3 p-3 rounded-2xl mb-6 ${dark ? "bg-gray-800" : "bg-gray-100"}`}>
              <div className="w-10 h-10 rounded-xl shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,#6366f1,#9333ea)" }}>
                {getUserAvatar()
                  ? <img src={getUserAvatar()} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "13px" }}>{getUserInitials()}</div>}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${text}`}>{getUserName()}</p>
                <p className={`text-xs truncate ${muted}`}>{getUserEmail()}</p>
              </div>
            </div>
            <nav className="flex flex-col gap-1 flex-1">
              {[...navItems, { id: "profile", label: "Meu Perfil", icon: User }].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setPage(id); setMobileMenuOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition text-left w-full
                    ${page === id ? "bg-indigo-600 text-white" : `${muted}`}`}>
                  <Icon size={18} className="shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
            <div className="flex flex-col gap-1 mt-4 border-t pt-4" style={{ borderColor: dark ? "#1f2937" : "#e5e7eb" }}>
              <button onClick={() => setDark(d => !d)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${muted}`}>
                {dark ? <Sun size={18} /> : <Moon size={18} />}
                {dark ? "Modo Claro" : "Modo Escuro"}
              </button>
              <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition text-red-400 hover:bg-red-500/10">
                <LogOut size={18} />
                Sair da conta
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className={`sticky top-0 z-10 ${surface} border-b ${border} px-4 md:px-6 py-4 flex items-center justify-between backdrop-blur-xl`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(o => !o)} className={`hidden md:flex p-2 rounded-xl transition ${dark ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}>
              <ChevronRight size={18} className={`${muted} transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
            </button>
            <button onClick={() => setMobileMenuOpen(true)} className={`flex md:hidden p-2 rounded-xl transition ${dark ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}>
              <Menu size={18} className={muted} />
            </button>
            <div>
              <h1 className={`font-bold text-lg ${text}`}>
                {page === "dashboard" && "Dashboard"}{page === "transactions" && "Transações"}{page === "goals" && "Metas"}{page === "reports" && "Relatórios"}{page === "profile" && "Meu Perfil"}
              </h1>
              <p className={`text-xs ${muted}`}>{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setNotifOpen(v => !v)}
                className={`p-2 rounded-xl transition relative ${dark ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}>
                <Bell size={18} className={muted} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className={`absolute right-0 top-12 w-80 rounded-2xl shadow-2xl border z-50 overflow-hidden
                  ${dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                  <div className={`px-4 py-3 border-b ${border}`}>
                    <p className={`font-semibold text-sm ${text}`}>Alertas de Metas</p>
                  </div>
                  {notifications.length === 0 ? (
                    <p className={`text-xs ${muted} text-center py-6`}>Nenhum alerta no momento 🎉</p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.map(n => (
                        <div key={n.id} className={`px-4 py-3 border-b last:border-0 ${border} ${n.urgent ? "bg-red-500/5" : ""}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className={`text-xs font-semibold ${n.urgent ? "text-red-400" : text}`}>{n.name}</p>
                              <p className={`text-xs ${muted} mt-0.5`}>{n.daysLeft < 0 ? "Prazo vencido!" : `${n.daysLeft} dias restantes`}</p>
                            </div>
                            <span className={`text-xs font-bold shrink-0 ${n.urgent ? "text-red-400" : "text-indigo-400"}`}>{fmtPct(n.pct)}</span>
                          </div>
                          <div className={`mt-2 h-1.5 rounded-full ${dark ? "bg-gray-700" : "bg-gray-200"} overflow-hidden`}>
                            <div className="h-full rounded-full" style={{ width: `${n.pct}%`, background: n.urgent ? "#f43f5e" : "#6366f1" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setProfileOpen(v => !v)}
                className="w-9 h-9 rounded-xl overflow-hidden hover:scale-105 transition-transform shadow-lg shadow-indigo-500/30 ring-2 ring-transparent hover:ring-indigo-400 shrink-0"
                style={{ background: "linear-gradient(135deg,#6366f1,#9333ea)" }}>
                {getUserAvatar()
                  ? <img src={getUserAvatar()} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "12px" }}>{getUserInitials()}</div>}
              </button>
              {profileOpen && (
                <div className={`absolute right-0 top-12 w-64 rounded-2xl shadow-2xl border z-50 overflow-hidden
                  ${dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                  <div className="p-4 border-b border-gray-700/50 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg shrink-0" style={{ background: "linear-gradient(135deg,#6366f1,#9333ea)" }}>
                      {getUserAvatar()
                        ? <img src={getUserAvatar()} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "14px" }}>{getUserInitials()}</div>}
                    </div>
                    <div className="min-w-0">
                      <p className={`font-semibold text-sm truncate ${text}`}>{getUserName()}</p>
                      <p className={`text-xs truncate ${muted}`}>{getUserEmail()}</p>
                    </div>
                  </div>
                  <div className="p-2">
                    <button onClick={() => { setPage("profile"); setProfileOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${dark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-700"}`}>
                      <User size={16} />
                      Meu Perfil
                    </button>
                    <button onClick={() => { setDark(d => !d); setProfileOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${dark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-700"}`}>
                      {dark ? <Sun size={16} /> : <Moon size={16} />}
                      {dark ? "Modo Claro" : "Modo Escuro"}
                    </button>
                    <button onClick={() => { handleLogout(); setProfileOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition text-red-400 hover:bg-red-500/10`}>
                      <LogOut size={16} />
                      Sair da conta
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6 max-w-7xl mx-auto pb-24 md:pb-6">

          {dataLoading && page !== "profile" && (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-3 animate-pulse">
                  <Wallet size={18} className="text-white" />
                </div>
                <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-500"}`}>Carregando seus dados...</p>
              </div>
            </div>
          )}

          {page === "profile" && (
            <ProfilePage
              session={session}
              dark={dark}
              toast={toast}
              onUpdate={() => {
                const fresh = JSON.parse(localStorage.getItem("sb_session") || "null");
                if (fresh) setSession({ ...fresh });
              }}
            />
          )}

          {!dataLoading && page === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard dark={dark} label="Saldo Total" value={fmt(saldoTotal)} sub="Patrimônio acumulado" icon={Wallet} color="#6366f1" trend={null} />
                <StatCard dark={dark} label="Receitas do Mês" value={fmt(totalReceita)} sub={lastReceita > 0 ? `${trendReceita >= 0 ? "+" : ""}${trendReceita.toFixed(1)}% vs mês anterior` : "Primeiro mês"} icon={TrendingUp} color="#10b981" trend={trendReceita} />
                <StatCard dark={dark} label="Despesas do Mês" value={fmt(totalDespesa)} sub={lastDespesa > 0 ? `${trendDespesa >= 0 ? "+" : ""}${trendDespesa.toFixed(1)}% vs mês anterior` : "Primeiro mês"} icon={TrendingDown} color="#f43f5e" trend={-trendDespesa} />
                <StatCard dark={dark} label="Taxa de Economia" value={fmtPct(economia)} sub={`${fmt(saldo)} guardados este mês`} icon={Target} color="#f59e0b" trend={null} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`col-span-2 ${surface} rounded-2xl border ${border} p-5`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className={`font-semibold ${text}`}>Evolução do Patrimônio</p>
                      <p className={`text-xs ${muted}`}>Últimos 6 meses + projeção 3 meses</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-medium">* Projetado</span>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={transactions.length > 0 ? projData : balanceByMonth} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1f2937" : "#f1f5f9"} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: dark ? "#9ca3af" : "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: dark ? "#9ca3af" : "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip dark={dark} />} />
                      <Area type="monotone" dataKey="balance" name="Saldo" stroke="#6366f1" strokeWidth={2.5} fill="url(#balGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className={`${surface} rounded-2xl border ${border} p-5`}>
                  <p className={`font-semibold ${text} mb-1`}>Gastos por Categoria</p>
                  <p className={`text-xs ${muted} mb-4`}>{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie data={realCategories.length > 0 ? realCategories : [{ name: "Sem dados", value: 1, color: "#374151" }]} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                        {(realCategories.length > 0 ? realCategories : [{ name: "Sem dados", value: 1, color: "#374151" }]).map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip dark={dark} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {(realCategories.length > 0 ? realCategories : []).map((c, i) => (
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

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`col-span-2 ${surface} rounded-2xl border ${border} p-5`}>
                  <p className={`font-semibold ${text} mb-1`}>Receitas vs Despesas</p>
                  <p className={`text-xs ${muted} mb-4`}>Últimos 6 meses</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={last6Months} barGap={4} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1f2937" : "#f1f5f9"} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: dark ? "#9ca3af" : "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: dark ? "#9ca3af" : "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip dark={dark} />} />
                      <Legend formatter={v => <span style={{ fontSize: 12, color: dark ? "#9ca3af" : "#6b7280" }}>{v === "receita" ? "Receita" : "Despesa"}</span>} />
                      <Bar dataKey="receita" name="receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesa" name="despesa" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className={`${surface} rounded-2xl border ${border} p-5`}>
                  <div className="flex items-center justify-between mb-4">
                    <p className={`font-semibold ${text}`}>Últimas Transações</p>
                    <button onClick={() => setPage("transactions")} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">Ver todas</button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {transactions.slice(0, 6).map(t => (
                      <div key={t.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${t.type === "receita" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                            {t.type === "receita" ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-red-500" />}
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
                          <span className="text-xs font-semibold" style={{ color: done ? "#10b981" : g.color }}>{fmtPct(pct)}</span>
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

          {!dataLoading && page === "transactions" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${border} ${surface} flex-1`}>
                  <Search size={16} className={muted} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar transações..."
                    className={`bg-transparent outline-none text-sm flex-1 ${text}`} />
                </div>
                <div className="flex gap-2">
                  {["all", "receita", "despesa"].map(f => (
                    <button key={f} onClick={() => setFilterType(f)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition
                        ${filterType === f ? "bg-indigo-600 text-white" : `${surface} border ${border} ${muted}`}`}>
                      {f === "all" ? "Todas" : f === "receita" ? "Receitas" : "Despesas"}
                    </button>
                  ))}
                </div>
                <button onClick={exportCSV} className={`${btnGhost} border ${border} flex items-center gap-2`}><Download size={15} /> CSV</button>
                <button onClick={() => setTxModal(true)} className={`${btnPrimary} flex items-center gap-2`}><Plus size={15} /> Nova</button>
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
                    {filteredTx.map(t => (
                      <tr key={t.id} className={`border-b ${border} last:border-0 transition`}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${t.type === "receita" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                              {t.type === "receita" ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-red-500" />}
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
                          <button onClick={async () => { const { error } = await supabase.db.deleteTransaction(t.id); if (error) return toast("Erro ao excluir", "error"); setTransactions(p => p.filter(x => x.id !== t.id)); toast("Transação excluída!"); }} className="p-1.5 rounded-lg hover:text-red-500 transition text-gray-400">
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

          {!dataLoading && page === "goals" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className={`text-sm ${muted}`}>{goals.length} metas ativas</p>
                <button onClick={() => setGoalModal(true)} className={`${btnPrimary} flex items-center gap-2`}><Plus size={15} /> Nova Meta</button>
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
                        <div className="flex items-center gap-2">
                          {done && <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold flex items-center gap-1"><CheckCircle size={11} />Concluída</span>}
                          <button onClick={async () => { const v = prompt("Adicionar valor à meta (R$):"); if (!v || isNaN(parseFloat(v))) return; const novoValor = Math.min(g.target, g.current + parseFloat(v)); const { error } = await supabase.db.updateGoal(g.id, { current: novoValor }); if (error) return toast("Erro ao atualizar", "error"); setGoals(p => p.map(x => x.id === g.id ? { ...x, current: novoValor } : x)); toast("Meta atualizada! 💰"); }} className={`p-1.5 rounded-lg text-xs transition ${dark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`} title="Depositar"><TrendingUp size={14} /></button>
                          <button onClick={async () => { if (!confirm("Excluir esta meta?")) return; const { error } = await supabase.db.deleteGoal(g.id); if (error) return toast("Erro ao excluir", "error"); setGoals(p => p.filter(x => x.id !== g.id)); toast("Meta excluída!"); }} className="p-1.5 rounded-lg text-xs transition hover:text-red-500 text-gray-400" title="Excluir"><Trash2 size={14} /></button>
                        </div>
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
                        {!done && monthsLeft !== null && <span className={`text-xs ${muted}`}>{monthsLeft}m • {fmt(monthlyNeed)}/mês</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!dataLoading && page === "reports" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Maior Receita do Mês", val: biggestReceita?.desc || "—", amount: biggestReceita?.amount || 0, color: "#10b981" },
                  { label: "Maior Despesa do Mês", val: biggestDespesa?.desc || "—", amount: biggestDespesa?.amount || 0, color: "#f43f5e" },
                  { label: "Categoria Principal", val: topCategory?.name || "—", amount: topCategory?.value || 0, color: "#6366f1" },
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
                  <AreaChart data={projData.slice(-3)} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1f2937" : "#f1f5f9"} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: dark ? "#9ca3af" : "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: dark ? "#9ca3af" : "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip dark={dark} />} />
                    <Area type="monotone" dataKey="balance" name="Saldo Projetado" stroke="#22d3ee" strokeWidth={2.5} strokeDasharray="6 3" fill="url(#pGrad)" dot={{ fill: "#22d3ee", r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className={`${surface} rounded-2xl border ${border} p-5`}>
                <div className="flex items-center justify-between mb-4">
                  <p className={`font-semibold ${text}`}>Resumo por Categoria</p>
                  <button onClick={exportCSV} className={`${btnGhost} border ${border} flex items-center gap-2 text-xs`}><Download size={13} /> Exportar CSV</button>
                </div>
                <div className="space-y-3">
                  {allCategories.map((c, i) => {
                    const pct = (c.value / allCategories.reduce((a, x) => a + x.value, 0)) * 100;
                    return (
                      <div key={i}>
                        <div className="flex justify-between mb-1">
                          <span className={`text-sm ${text} font-medium`}>{c.name}</span>
                          <span className="text-sm font-semibold" style={{ color: c.color }}>{fmt(c.value)}</span>
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

        <footer className={`border-t ${border} px-6 py-4 mt-4`}>
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Wallet size={12} className="text-white" />
              </div>
              <span className={`text-xs ${muted}`}>
                © {new Date().getFullYear()} FinançasPRO · Feito com ❤️ por{" "}
                <a href="https://www.linkedin.com/in/ailton-guilherme" target="_blank" rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 transition font-semibold">Ailton Ribas</a>
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 font-mono">v1.0.0</span>
            </div>
            <div className="flex items-center gap-3">
              <a href="https://www.linkedin.com/in/ailton-guilherme" target="_blank" rel="noopener noreferrer" className={`text-xs ${muted} hover:text-indigo-400 transition font-medium`}>LinkedIn</a>
              <span className={`text-xs ${muted}`}>·</span>
              <a href="https://instagram.com/ag_ribas" target="_blank" rel="noopener noreferrer" className={`text-xs ${muted} hover:text-pink-400 transition font-medium`}>Instagram</a>
              <span className={`text-xs ${muted}`}>·</span>
              <a href="https://github.com/Ribashow666" target="_blank" rel="noopener noreferrer" className={`text-xs ${muted} hover:text-white transition font-medium`}>GitHub</a>
              <span className={`text-xs ${muted}`}>·</span>
              <a href="mailto:guilherme_ribas12@hotmail.com" className={`text-xs ${muted} hover:text-emerald-400 transition font-medium`}>Suporte</a>
            </div>
          </div>
        </footer>
      </main>

      <nav className={`fixed bottom-0 left-0 right-0 z-40 md:hidden ${surface} border-t ${border} flex items-center justify-around px-2 py-2 safe-area-pb`}
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        {[...navItems, { id: "profile", label: "Perfil", icon: User }].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setPage(id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition min-w-0 flex-1
              ${page === id ? "text-indigo-500" : muted}`}>
            <Icon size={20} className="shrink-0" />
            <span className="text-[10px] font-medium truncate">{label}</span>
          </button>
        ))}
      </nav>

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