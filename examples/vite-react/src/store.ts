import type { Locale } from './i18n';

export type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'voided';
export type FilterStatus = 'all' | 'pending' | 'paid' | 'overdue';
export type ThemeMode = 'light' | 'dark';
export type TesterRole = 'finance-admin' | 'viewer';

export interface Invoice {
  id: string;
  client: string;
  clientAr: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
}

export interface ActivityEntry {
  id: string;
  method: string;
  endpoint: string;
  status: number;
  note: string;
  at: string;
}

export interface UserProfile {
  name: string;
  email: string;
  role: TesterRole;
}

export interface AppSnapshot {
  user: UserProfile | null;
  /** Intentionally named with `Token` so `reins_state` demonstrates automatic secret redaction (`[redacted]`). */
  sessionToken: string | null;
  locale: Locale;
  dir: 'ltr' | 'rtl';
  theme: ThemeMode;
  filter: FilterStatus;
  query: string;
  totals: {
    outstandingUsd: number;
    paidThisMonthUsd: number;
    overdueCount: number;
  };
  invoices: Invoice[];
  visibleInvoiceIds: string[];
  activityLog: ActivityEntry[];
}

const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'INV-1041',
    client: 'Northwind Logistics Ltd.',
    clientAr: 'شركة نورث ويند للخدمات اللوجستية',
    dueDate: '2026-10-28',
    amount: 4850,
    status: 'paid',
  },
  {
    id: 'INV-1042',
    client: 'Al-Bahr Maritime Systems',
    clientAr: 'أنظمة البحر الملاحية',
    dueDate: '2026-10-14',
    amount: 3200,
    status: 'overdue',
  },
  {
    id: 'INV-1043',
    client: 'Atelier Lumière SAS',
    clientAr: 'أتيليه لوميير للتصميم',
    dueDate: '2026-11-18',
    amount: 6400,
    status: 'pending',
  },
  {
    id: 'INV-1044',
    client: 'Kestrel Cloud Analytics',
    clientAr: 'كيسترل لتحليلات السحابة',
    dueDate: '2026-10-05',
    amount: 1950,
    status: 'overdue',
  },
  {
    id: 'INV-1045',
    client: 'Vanguard Solar Co-op',
    clientAr: 'تعاونية فانغارد للطاقة الشمسية',
    dueDate: '2026-11-24',
    amount: 5100,
    status: 'paid',
  },
];

let user: UserProfile | null = null;
let sessionToken: string | null = null;
let locale: Locale = 'en';
let theme: ThemeMode = 'light';
let filter: FilterStatus = 'all';
let query = '';
let invoices: Invoice[] = INITIAL_INVOICES.map((inv) => ({ ...inv }));
let activityLog: ActivityEntry[] = [
  {
    id: 'ACT-1',
    method: 'READY',
    endpoint: '/__reins/token',
    status: 200,
    note: 'Dev workspace initialized; waiting for agent or tester actions',
    at: '09:00:00',
  },
];

const listeners = new Set<() => void>();
let actSeq = 1;

let cachedSnap: AppSnapshot | null = null;

function notify() {
  cachedSnap = null;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('data-theme', theme);
  }
  listeners.forEach((fn) => fn());
}

function recordActivity(method: string, endpoint: string, status: number, note: string) {
  const now = new Date().toISOString().slice(11, 19);
  activityLog = [
    {
      id: `ACT-${++actSeq}`,
      method,
      endpoint,
      status,
      note,
      at: now,
    },
    ...activityLog.slice(0, 7),
  ];
}

async function callDevApi(method: 'GET' | 'POST', endpoint: string, body?: unknown): Promise<number> {
  if (typeof fetch !== 'function' || typeof window === 'undefined') {
    return 200;
  }
  try {
    const res = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken || 'sk-dev-guest-token'}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.status;
  } catch {
    return 200;
  }
}

export function computeTotals(list: Invoice[]) {
  let outstandingUsd = 0;
  let paidThisMonthUsd = 0;
  let overdueCount = 0;

  for (const inv of list) {
    if (inv.status === 'pending' || inv.status === 'overdue') {
      outstandingUsd += inv.amount;
    }
    if (inv.status === 'paid') {
      paidThisMonthUsd += inv.amount;
    }
    if (inv.status === 'overdue') {
      overdueCount += 1;
    }
  }
  return { outstandingUsd, paidThisMonthUsd, overdueCount };
}

export function getVisibleInvoices(): Invoice[] {
  const q = query.trim().toLowerCase();
  return invoices.filter((inv) => {
    const matchesStatus = filter === 'all' || inv.status === filter;
    const matchesQuery =
      !q ||
      inv.id.toLowerCase().includes(q) ||
      inv.client.toLowerCase().includes(q) ||
      inv.clientAr.includes(q);
    return matchesStatus && matchesQuery;
  });
}

export function getSnapshot(): AppSnapshot {
  if (cachedSnap) return cachedSnap;
  const visible = getVisibleInvoices();
  cachedSnap = {
    user,
    sessionToken,
    locale,
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    theme,
    filter,
    query,
    totals: computeTotals(invoices),
    invoices: invoices.map((i) => ({ ...i })),
    visibleInvoiceIds: visible.map((i) => i.id),
    activityLog: [...activityLog],
  };
  return cachedSnap;
}

export const store = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot,

  async loginAsTester(role: TesterRole = 'finance-admin') {
    user =
      role === 'finance-admin'
        ? { name: 'Maya Lin', email: 'maya.lin@payday.example', role: 'finance-admin' }
        : { name: 'Samir Patel', email: 'samir.patel@payday.example', role: 'viewer' };
    sessionToken = `sk-live-session-${role}-9941`;
    const loginStatus = await callDevApi('POST', '/api/session/login', { role, email: user.email });
    const syncStatus = await callDevApi('GET', `/api/invoices?role=${encodeURIComponent(role)}`);
    recordActivity('POST', '/api/session/login', loginStatus, `Signed in as ${user.name} (${role})`);
    recordActivity('GET', `/api/invoices?role=${role}`, syncStatus, `Synced ${invoices.length} invoices`);
    notify();
    return { signedInAs: user.name, role: user.role, syncedInvoices: invoices.length };
  },

  setLocale(next: Locale) {
    if (!['en', 'ar', 'fr'].includes(next)) {
      throw new Error(`Unsupported locale: ${next}`);
    }
    locale = next;
    recordActivity('ACTION', `set-locale (${next})`, 200, `Switched UI locale to ${next.toUpperCase()} (${next === 'ar' ? 'RTL' : 'LTR'})`);
    notify();
    return { locale, dir: locale === 'ar' ? 'rtl' : 'ltr' };
  },

  setTheme(next: ThemeMode) {
    if (next !== 'light' && next !== 'dark') {
      throw new Error(`Unsupported theme: ${next}`);
    }
    theme = next;
    recordActivity('ACTION', `set-theme (${next})`, 200, `Switched theme to ${next}`);
    notify();
    return { theme };
  },

  filterInvoices(status: FilterStatus, searchQuery?: string) {
    if (!['all', 'pending', 'paid', 'overdue'].includes(status)) {
      throw new Error(`Unsupported filter status: ${status}`);
    }
    filter = status;
    if (typeof searchQuery === 'string') {
      query = searchQuery;
    }
    const visible = getVisibleInvoices();
    recordActivity('ACTION', `filter-invoices (${status})`, 200, `Showing ${visible.length} matching invoices`);
    notify();
    return { filter, query, matchingCount: visible.length, matchingIds: visible.map((i) => i.id) };
  },

  setSearchQuery(nextQuery: string) {
    query = nextQuery;
    notify();
  },

  async markInvoicePaid(id: string) {
    const target = invoices.find((inv) => inv.id === id);
    if (!target) {
      throw new Error(`Invoice ${id} not found`);
    }
    invoices = invoices.map((inv) => (inv.id === id ? { ...inv, status: 'paid' } : inv));
    const status = await callDevApi('POST', `/api/invoices/${encodeURIComponent(id)}/pay`, {
      id,
      amount: target.amount,
    });
    recordActivity('POST', `/api/invoices/${id}/pay`, status, `Marked ${id} ($${target.amount.toLocaleString()}) as paid`);
    notify();
    return { id, status: 'paid', totals: computeTotals(invoices) };
  },

  async voidOverdueInvoices(reason = 'Write-off approved by Finance Admin') {
    const overdueIds = invoices.filter((inv) => inv.status === 'overdue').map((inv) => inv.id);
    invoices = invoices.map((inv) => (inv.status === 'overdue' ? { ...inv, status: 'voided' } : inv));
    const status = await callDevApi('POST', '/api/invoices/void-overdue', { overdueIds, reason });
    recordActivity('POST', '/api/invoices/void-overdue', status, `Voided ${overdueIds.length} overdue invoice(s): ${overdueIds.join(', ') || 'none'}`);
    notify();
    return { voidedIds: overdueIds, reason, totals: computeTotals(invoices) };
  },

  resetForTests() {
    user = null;
    sessionToken = null;
    locale = 'en';
    theme = 'light';
    filter = 'all';
    query = '';
    invoices = INITIAL_INVOICES.map((inv) => ({ ...inv }));
    notify();
  },
};
