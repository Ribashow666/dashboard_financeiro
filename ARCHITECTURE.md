# FinançasPRO — Documentação Completa de Arquitetura

## Visão Geral

Sistema SaaS de gestão financeira pessoal construído com Next.js 14 (App Router), Node.js, PostgreSQL e Prisma. Design minimalista premium com dark/light mode.

---

## 1. ESTRUTURA DE PASTAS

```
financas-pro/
├── apps/
│   └── web/                          # Next.js App
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx
│       │   │   └── register/page.tsx
│       │   ├── (dashboard)/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx           # Dashboard principal
│       │   │   ├── transactions/page.tsx
│       │   │   ├── goals/page.tsx
│       │   │   └── reports/page.tsx
│       │   ├── api/
│       │   │   ├── auth/
│       │   │   │   ├── login/route.ts
│       │   │   │   ├── register/route.ts
│       │   │   │   ├── logout/route.ts
│       │   │   │   └── refresh/route.ts
│       │   │   ├── transactions/
│       │   │   │   ├── route.ts       # GET, POST
│       │   │   │   └── [id]/route.ts  # PUT, DELETE
│       │   │   ├── categories/route.ts
│       │   │   └── goals/
│       │   │       ├── route.ts
│       │   │       └── [id]/route.ts
│       │   ├── layout.tsx
│       │   └── globals.css
│       ├── components/
│       │   ├── ui/                    # shadcn/ui base
│       │   ├── charts/
│       │   │   ├── BalanceChart.tsx
│       │   │   ├── CategoryPieChart.tsx
│       │   │   ├── RevenueExpenseBar.tsx
│       │   │   └── ProjectionChart.tsx
│       │   ├── dashboard/
│       │   │   ├── StatCard.tsx
│       │   │   ├── RecentTransactions.tsx
│       │   │   └── GoalProgress.tsx
│       │   ├── transactions/
│       │   │   ├── TransactionTable.tsx
│       │   │   ├── TransactionModal.tsx
│       │   │   └── TransactionFilters.tsx
│       │   ├── goals/
│       │   │   ├── GoalCard.tsx
│       │   │   └── GoalModal.tsx
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── Header.tsx
│       │   │   └── ThemeToggle.tsx
│       │   └── shared/
│       │       ├── Toast.tsx
│       │       ├── Modal.tsx
│       │       ├── SkeletonCard.tsx
│       │       └── EmptyState.tsx
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useTransactions.ts
│       │   ├── useGoals.ts
│       │   └── useDashboardData.ts
│       ├── lib/
│       │   ├── api.ts                 # fetch wrapper
│       │   ├── auth.ts                # JWT client helpers
│       │   ├── formatters.ts
│       │   └── validators.ts          # Zod schemas
│       ├── store/
│       │   └── authStore.ts           # Zustand
│       ├── types/
│       │   └── index.ts
│       ├── middleware.ts              # Auth middleware
│       └── next.config.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── .env.example
├── package.json
└── README.md
```

---

## 2. SCHEMA PRISMA

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum TransactionType {
  INCOME
  EXPENSE
}

model User {
  id           String        @id @default(cuid())
  name         String
  email        String        @unique
  passwordHash String
  avatarUrl    String?
  currency     String        @default("BRL")
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  deletedAt    DateTime?     // soft delete

  transactions Transaction[]
  categories   Category[]
  goals        Goal[]
  refreshTokens RefreshToken[]

  @@index([email])
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
}

model Category {
  id           String   @id @default(cuid())
  name         String
  icon         String   @default("tag")
  color        String   @default("#6366f1")
  isDefault    Boolean  @default(false)
  userId       String?  // null = global category
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user         User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]

  @@unique([name, userId])
  @@index([userId])
}

model Transaction {
  id          String          @id @default(cuid())
  type        TransactionType
  description String
  amount      Decimal         @db.Decimal(12, 2)
  date        DateTime
  isRecurrent Boolean         @default(false)
  installments Int?           // for expenses in installments
  installmentCurrent Int?
  notes       String?
  deletedAt   DateTime?       // soft delete

  userId      String
  categoryId  String

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  category    Category @relation(fields: [categoryId], references: [id])

  @@index([userId])
  @@index([userId, date])
  @@index([categoryId])
  @@index([type])
}

model Goal {
  id          String   @id @default(cuid())
  name        String
  description String?
  targetAmount Decimal @db.Decimal(12, 2)
  currentAmount Decimal @db.Decimal(12, 2) @default(0)
  color       String   @default("#6366f1")
  icon        String   @default("target")
  deadline    DateTime?
  isCompleted Boolean  @default(false)
  deletedAt   DateTime?

  userId      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

---

## 3. BACKEND — API ROUTES (Next.js)

### 3.1 Middleware de Autenticação

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/register", "/api/auth/login", "/api/auth/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("access_token")?.value
    ?? request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Token inválido ou expirado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.userId);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### 3.2 Auth — Login

```typescript
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, generateAccessToken, generateRefreshToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  // Rate limiting: 5 requests / minute por IP
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const limited = await rateLimit(ip, 5, 60);
  if (limited) return NextResponse.json({ error: "Muitas tentativas. Tente novamente em 1 minuto." }, { status: 429 });

  const body = await req.json();
  const parse = loginSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const { email, password } = parse.data;

  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (!user) return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });

  const accessToken = generateAccessToken({ userId: user.id, email: user.email });
  const refreshToken = await generateRefreshToken(user.id);

  const response = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email },
    accessToken,
  });

  response.cookies.set("access_token", accessToken, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 60 * 15, // 15 min
  });
  response.cookies.set("refresh_token", refreshToken, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
```

### 3.3 Transactions — CRUD

```typescript
// app/api/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { transactionSchema } from "@/lib/validators";
import { Prisma } from "@prisma/client";

// GET /api/transactions?type=INCOME&from=2025-01-01&to=2025-02-28&page=1&limit=20
export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id")!;
  const { searchParams } = new URL(req.url);

  const type = searchParams.get("type") as "INCOME" | "EXPENSE" | null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

  const where: Prisma.TransactionWhereInput = {
    userId,
    deletedAt: null,
    ...(type && { type }),
    ...(category && { categoryId: category }),
    ...(from || to ? {
      date: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to + "T23:59:59") }),
      }
    } : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({ transactions, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
}

// POST /api/transactions
export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id")!;
  const body = await req.json();
  const parse = transactionSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const transaction = await prisma.transaction.create({
    data: { ...parse.data, userId, date: new Date(parse.data.date) },
    include: { category: true },
  });

  return NextResponse.json({ transaction }, { status: 201 });
}
```

```typescript
// app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { transactionSchema } from "@/lib/validators";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = req.headers.get("x-user-id")!;
  const body = await req.json();
  const parse = transactionSchema.partial().safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const tx = await prisma.transaction.findFirst({ where: { id: params.id, userId, deletedAt: null } });
  if (!tx) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data: { ...parse.data, ...(parse.data.date && { date: new Date(parse.data.date) }) },
    include: { category: true },
  });

  return NextResponse.json({ transaction: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = req.headers.get("x-user-id")!;
  const tx = await prisma.transaction.findFirst({ where: { id: params.id, userId, deletedAt: null } });
  if (!tx) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  // Soft delete
  await prisma.transaction.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
```

---

## 4. LIB UTILITÁRIOS

### 4.1 Auth Helpers

```typescript
// lib/auth.ts
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET!);

export const hashPassword = (pwd: string) => bcrypt.hash(pwd, 12);
export const comparePassword = (pwd: string, hash: string) => bcrypt.compare(pwd, hash);

export async function generateAccessToken(payload: { userId: string; email: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export function verifyAccessToken(token: string) {
  try {
    return jwtVerify(token, JWT_SECRET);
  } catch { return null; }
}

export async function generateRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}
```

### 4.2 Validadores Zod

```typescript
// lib/validators.ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(100),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Deve conter letra maiúscula")
    .regex(/[0-9]/, "Deve conter número"),
});

export const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  description: z.string().min(1).max(200),
  amount: z.number().positive().max(999999999),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  categoryId: z.string().cuid(),
  isRecurrent: z.boolean().optional().default(false),
  installments: z.number().int().min(2).max(120).optional(),
  installmentCurrent: z.number().int().optional(),
  notes: z.string().max(500).optional(),
});

export const goalSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0).optional().default(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  deadline: z.string().datetime({ offset: true }).optional(),
});
```

### 4.3 Rate Limiting (Redis/in-memory)

```typescript
// lib/rateLimit.ts
const store = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return false; // not limited
  }

  if (entry.count >= limit) return true; // limited

  entry.count++;
  return false;
}
// Em produção, substitua pelo redis-rate-limiter com ioredis
```

---

## 5. FRONTEND — COMPONENTES PRINCIPAIS

### 5.1 Hook useTransactions

```typescript
// hooks/useTransactions.ts
import { useState, useEffect, useCallback } from "react";
import type { Transaction } from "@/types";

interface Filters { type?: string; from?: string; to?: string; category?: string; }

export function useTransactions(filters: Filters = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });

  const fetch = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), ...filters as Record<string, string> });
      const res = await fetch(`/api/transactions?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTransactions(data.transactions);
      setMeta(data.meta);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (data: Partial<Transaction>) => {
    const res = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) throw new Error(await res.text());
    await fetch();
    return res.json();
  };

  const remove = async (id: string) => {
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  return { transactions, loading, error, meta, create, remove, refresh: fetch };
}
```

### 5.2 Dashboard Page

```typescript
// app/(dashboard)/page.tsx
import { Suspense } from "react";
import { StatCards } from "@/components/dashboard/StatCards";
import { BalanceChart } from "@/components/charts/BalanceChart";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { RevenueExpenseBar } from "@/components/charts/RevenueExpenseBar";
import { GoalProgress } from "@/components/dashboard/GoalProgress";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { getDashboardData } from "@/lib/api/dashboard";

export default async function DashboardPage() {
  const data = await getDashboardData(); // server-side fetch com cookies

  return (
    <div className="space-y-6 p-6">
      <Suspense fallback={<div className="grid grid-cols-4 gap-4">{Array(4).fill(0).map((_,i)=><SkeletonCard key={i}/>)}</div>}>
        <StatCards data={data.summary}/>
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-2">
          <BalanceChart data={data.balanceHistory}/>
        </div>
        <CategoryPieChart data={data.categoryBreakdown}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-2">
          <RevenueExpenseBar data={data.monthlyComparison}/>
        </div>
        <RecentTransactions transactions={data.recentTransactions}/>
      </div>

      <GoalProgress goals={data.goals}/>
    </div>
  );
}
```

### 5.3 Login Page

```typescript
// app/(auth)/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { loginSchema } from "@/lib/validators";
import { Wallet, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const parse = loginSchema.safeParse(form);
    if (!parse.success) {
      setError(parse.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao fazer login");
        return;
      }

      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center">
            <Wallet size={20} className="text-white"/>
          </div>
          <span className="text-white font-bold text-xl">FinançasPRO</span>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          <h1 className="text-white font-bold text-2xl mb-1">Bem-vindo de volta</h1>
          <p className="text-gray-400 text-sm mb-6">Entre na sua conta para continuar</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Senha</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2.5 pr-10 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition">
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-4">
            Não tem conta?{" "}
            <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Criar conta grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. SEED DE DADOS

```typescript
// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "Salário", icon: "briefcase", color: "#10b981", isDefault: true },
  { name: "Freelance", icon: "laptop", color: "#6366f1", isDefault: true },
  { name: "Investimentos", icon: "trending-up", color: "#f59e0b", isDefault: true },
  { name: "Moradia", icon: "home", color: "#3b82f6", isDefault: true },
  { name: "Alimentação", icon: "utensils", color: "#f43f5e", isDefault: true },
  { name: "Transporte", icon: "car", color: "#8b5cf6", isDefault: true },
  { name: "Saúde", icon: "heart", color: "#22d3ee", isDefault: true },
  { name: "Lazer", icon: "smile", color: "#f97316", isDefault: true },
  { name: "Educação", icon: "book", color: "#84cc16", isDefault: true },
  { name: "Outros", icon: "tag", color: "#6b7280", isDefault: true },
];

async function main() {
  console.log("Seeding...");

  // Default categories (sem usuário)
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { name_userId: { name: cat.name, userId: null as any } },
      update: {},
      create: cat,
    });
  }

  // Demo user
  const passwordHash = await bcrypt.hash("Demo@1234", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@financaspro.com" },
    update: {},
    create: { name: "Demo User", email: "demo@financaspro.com", passwordHash },
  });

  const categories = await prisma.category.findMany({ where: { isDefault: true } });
  const catMap = Object.fromEntries(categories.map(c => [c.name, c.id]));

  // 6 months of transactions
  const now = new Date();
  for (let m = 5; m >= 0; m--) {
    const month = new Date(now.getFullYear(), now.getMonth() - m, 1);
    
    await prisma.transaction.createMany({ data: [
      { userId: user.id, type: "INCOME", description: "Salário", amount: 7500, date: new Date(month.getFullYear(), month.getMonth(), 5), categoryId: catMap["Salário"], isRecurrent: true },
      { userId: user.id, type: "INCOME", description: "Freelance", amount: Math.floor(Math.random()*2000+500), date: new Date(month.getFullYear(), month.getMonth(), 15), categoryId: catMap["Freelance"] },
      { userId: user.id, type: "EXPENSE", description: "Aluguel", amount: 2400, date: new Date(month.getFullYear(), month.getMonth(), 5), categoryId: catMap["Moradia"], isRecurrent: true },
      { userId: user.id, type: "EXPENSE", description: "Mercado", amount: Math.floor(Math.random()*400+400), date: new Date(month.getFullYear(), month.getMonth(), 10), categoryId: catMap["Alimentação"] },
      { userId: user.id, type: "EXPENSE", description: "Combustível", amount: Math.floor(Math.random()*200+200), date: new Date(month.getFullYear(), month.getMonth(), 20), categoryId: catMap["Transporte"] },
      { userId: user.id, type: "EXPENSE", description: "Restaurantes", amount: Math.floor(Math.random()*300+100), date: new Date(month.getFullYear(), month.getMonth(), 25), categoryId: catMap["Alimentação"] },
    ]});
  }

  // Goals
  await prisma.goal.createMany({ data: [
    { userId: user.id, name: "Reserva de Emergência", targetAmount: 30000, currentAmount: 19850, color: "#6366f1", deadline: new Date("2025-12-31") },
    { userId: user.id, name: "Viagem Europa", targetAmount: 15000, currentAmount: 6200, color: "#22d3ee", deadline: new Date("2026-07-01") },
    { userId: user.id, name: "Carro", targetAmount: 50000, currentAmount: 12000, color: "#f59e0b", deadline: new Date("2027-01-01") },
  ]});

  console.log("Seed concluído! Login: demo@financaspro.com / Demo@1234");
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

---

## 7. ARQUIVO .ENV.EXAMPLE

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/financaspro"

# Auth
JWT_SECRET="sua-chave-secreta-super-longa-aqui-min-32-chars"
JWT_REFRESH_SECRET="outra-chave-secreta-super-longa-para-refresh-token"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# Email (opcional - para recuperação de senha)
SMTP_HOST="smtp.resend.com"
SMTP_PORT="587"
SMTP_USER="resend"
SMTP_PASS="your-api-key"
SMTP_FROM="noreply@financaspro.com"

# Redis (opcional - para rate limiting em produção)
REDIS_URL="redis://localhost:6379"
```

---

## 8. PACKAGE.JSON

```json
{
  "name": "financas-pro",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:seed": "npx ts-node prisma/seed.ts",
    "db:studio": "prisma studio",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@prisma/client": "^5.14.0",
    "prisma": "^5.14.0",
    "bcryptjs": "^2.4.3",
    "jose": "^5.3.0",
    "zod": "^3.23.0",
    "recharts": "^2.12.0",
    "zustand": "^4.5.0",
    "lucide-react": "^0.378.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-select": "^2.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "date-fns": "^3.6.0",
    "papaparse": "^5.4.1"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/bcryptjs": "^2.4.6",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "vitest": "^1.6.0",
    "@testing-library/react": "^15.0.0"
  }
}
```

---

## 9. TESTES BÁSICOS

```typescript
// __tests__/transactions.test.ts
import { describe, it, expect, vi } from "vitest";
import { transactionSchema, goalSchema, loginSchema } from "@/lib/validators";

describe("Validators", () => {
  it("valida transação correta", () => {
    const result = transactionSchema.safeParse({
      type: "INCOME",
      description: "Salário",
      amount: 5000,
      date: "2025-02-01",
      categoryId: "clxxxxxxxxxxxxxxx",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita amount negativo", () => {
    const result = transactionSchema.safeParse({
      type: "EXPENSE",
      description: "Teste",
      amount: -100,
      date: "2025-02-01",
      categoryId: "clxxxxxxxxxxxxxxx",
    });
    expect(result.success).toBe(false);
  });

  it("valida login com email válido", () => {
    const r = loginSchema.safeParse({ email: "test@test.com", password: "abc123" });
    expect(r.success).toBe(true);
  });

  it("rejeita login sem email", () => {
    const r = loginSchema.safeParse({ email: "invalido", password: "123" });
    expect(r.success).toBe(false);
  });
});
```

---

## 10. COMO RODAR O PROJETO

```bash
# 1. Clone e instale
git clone https://github.com/seu-user/financas-pro
cd financas-pro
npm install

# 2. Configure o banco
cp .env.example .env
# Edite o .env com suas credenciais

# 3. Suba o PostgreSQL via Docker (opcional)
docker run --name financaspro-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=financaspro \
  -p 5432:5432 -d postgres:16

# 4. Rode as migrations e seed
npm run db:push
npm run db:seed

# 5. Inicie o servidor
npm run dev
# → http://localhost:3000

# Login demo: demo@financaspro.com / Demo@1234
```

---

## 11. DEPLOY — VERCEL + RAILWAY

```bash
# Backend (Railway)
# 1. Crie projeto no railway.app
# 2. Add service: PostgreSQL → anote a DATABASE_URL
# 3. Add service: GitHub repo
# 4. Configure env vars no Railway

# Frontend (Vercel)
# 1. Importe o repositório no vercel.com
# 2. Configure env vars:
#    DATABASE_URL → (Railway PostgreSQL URL)
#    JWT_SECRET → (gere com: openssl rand -base64 64)
#    JWT_REFRESH_SECRET → (idem)
# 3. Deploy automático no push para main
```

---

## 12. ESTRATÉGIA DE MONETIZAÇÃO SaaS

### Planos

| Feature | Free | Pro (R$29/mês) | Business (R$79/mês) |
|---------|------|-----------------|----------------------|
| Transações | 50/mês | Ilimitado | Ilimitado |
| Metas | 3 | Ilimitado | Ilimitado |
| Exportação CSV | ❌ | ✅ | ✅ |
| Múltiplas contas | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ |
| Relatórios avançados | ❌ | ✅ | ✅ |

### Stack de Pagamento
- **Stripe** para cobranças recorrentes
- **Webhook** para sincronizar status do plano
- **Tabela `Subscription`** no banco para controle de acesso

---

## 13. MELHORIAS FUTURAS

1. **Integração bancária** via Open Finance (Belvo/Pluggy)
2. **IA para categorização automática** de transações (Claude API)
3. **Relatório de impostos** (IR, declaração)
4. **App mobile** com React Native / Expo
5. **Multi-moeda** com cotações em tempo real
6. **Compartilhamento familiar** (múltiplos usuários por conta)
7. **Alertas por e-mail/push** (limites de gastos)
8. **Importação OFX/QIF** (extrato bancário)
9. **Portfolio de investimentos** com cotações B3
10. **PWA** com suporte offline
```
