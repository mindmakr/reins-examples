export type Locale = 'en' | 'ar' | 'fr';

export interface Translations {
  brandTitle: string;
  brandSubtitle: string;
  pairedBadge: string;
  roleFinanceAdmin: string;
  roleViewer: string;
  roleGuest: string;
  loginAsAdmin: string;
  themeLight: string;
  themeDark: string;
  hudTitle: string;
  hudSubtitle: string;
  hudLifecycle: string;
  hudComponents: string;
  hudApiLatency: string;
  hudServerTiming: string;
  hudLayoutHealth: string;
  hudZeroClip: string;
  hudRecordBtn: string;
  hudExportBtn: string;
  summaryTitle: string;
  totalOutstanding: string;
  totalOutstandingSub: string;
  paidThisMonth: string;
  paidThisMonthSub: string;
  overdueCount: string;
  overdueCountSub: string;
  invoicesTitle: string;
  filterAll: string;
  filterPending: string;
  filterPaid: string;
  filterOverdue: string;
  searchPlaceholder: string;
  voidOverdueBtn: string;
  colInvoice: string;
  colClient: string;
  colDueDate: string;
  colAmount: string;
  colStatus: string;
  colAction: string;
  statusPaid: string;
  statusPending: string;
  statusOverdue: string;
  statusVoided: string;
  markPaidBtn: string;
  settledLabel: string;
  activityTitle: string;
  activitySubtitle: string;
  noInvoicesMatch: string;
}

export const TRANSLATIONS: Record<Locale, Translations> = {
  en: {
    brandTitle: 'Payday Invoice Studio',
    brandSubtitle: 'Lucid Billing Desk · Driven via reins MCP',
    pairedBadge: 'reins ready',
    roleFinanceAdmin: 'Maya Lin · Finance Admin',
    roleViewer: 'Samir Patel · Auditor (Read-only)',
    roleGuest: 'Guest Session (Not signed in)',
    loginAsAdmin: 'Sign in as Finance Admin',
    themeLight: 'Light',
    themeDark: 'Dark',
    hudTitle: 'Live Runtime Instruments (reins_perf · reins_dom · reins_server)',
    hudSubtitle: 'Lucid Coding Principle #2 & #8 — lifecycle, panel renders, API + backend DB spans & CSS layout check',
    hudLifecycle: 'Page Lifecycle',
    hudComponents: 'Panel Mounts & Renders',
    hudApiLatency: 'API Call Stats',
    hudServerTiming: 'Backend (@mindmakr/reins/node)',
    hudLayoutHealth: 'DOM & CSS Layout',
    hudZeroClip: '0 clipping issues',
    hudRecordBtn: 'Record Session',
    hudExportBtn: 'Export Session (.md)',
    summaryTitle: 'Receivables Overview',
    totalOutstanding: 'Total Outstanding',
    totalOutstandingSub: 'Pending + overdue receivables',
    paidThisMonth: 'Paid This Month',
    paidThisMonthSub: 'Cleared via ACH & wire',
    overdueCount: 'Overdue Invoices',
    overdueCountSub: 'Requires follow-up or write-off',
    invoicesTitle: 'Client Invoices',
    filterAll: 'All',
    filterPending: 'Pending',
    filterPaid: 'Paid',
    filterOverdue: 'Overdue',
    searchPlaceholder: 'Filter by client or invoice ID…',
    voidOverdueBtn: 'Void All Overdue',
    colInvoice: 'Invoice',
    colClient: 'Client',
    colDueDate: 'Due Date',
    colAmount: 'Amount',
    colStatus: 'Status',
    colAction: 'Action',
    statusPaid: 'Paid',
    statusPending: 'Pending',
    statusOverdue: 'Overdue',
    statusVoided: 'Voided',
    markPaidBtn: 'Mark Paid',
    settledLabel: 'Cleared',
    activityTitle: 'Network & Agent Telemetry',
    activitySubtitle: 'Authorization headers and session tokens are automatically [redacted] by reins',
    noInvoicesMatch: 'No invoices match the active filter.',
  },
  ar: {
    brandTitle: 'استوديو فواتير باي داي',
    brandSubtitle: 'مكتب الفوترة الذكي · يعمل عبر reins MCP',
    pairedBadge: 'متصل بـ reins',
    roleFinanceAdmin: 'مايا لين · مديرة المالية',
    roleViewer: 'سمير باتل · مدقق حسابات',
    roleGuest: 'جلسة ضيف (غير مسجل)',
    loginAsAdmin: 'تسجيل الدخول كمدير مالي',
    themeLight: 'فاتح',
    themeDark: 'داكن',
    hudTitle: 'مؤشرات الأداء والتشخيص الحية (reins_perf · reins_dom · reins_server)',
    hudSubtitle: 'مبادئ البرمجة الواعية #2 و #8 — أوقات التحميل، اللوحات، استعلامات قاعدة البيانات الخلفية وتخطيط RTL',
    hudLifecycle: 'دورة حياة الصفحة',
    hudComponents: 'تركيب ورسم اللوحات',
    hudApiLatency: 'إحصائيات طلبات API',
    hudServerTiming: 'الخادم الخلفي (@mindmakr/reins/node)',
    hudLayoutHealth: 'فحص DOM وتخطيط CSS',
    hudZeroClip: 'لا توجد مشاكل قص',
    hudRecordBtn: 'تسجيل الجلسة',
    hudExportBtn: 'تصدير التقرير (.md)',
    summaryTitle: 'ملخص المستحقات المالية',
    totalOutstanding: 'إجمالي المستحقات',
    totalOutstandingSub: 'الفواتير المعلقة والمتأخرة',
    paidThisMonth: 'المدفوع هذا الشهر',
    paidThisMonthSub: 'تمت التسوية عبر التحويل البنكي',
    overdueCount: 'الفواتير المتأخرة',
    overdueCountSub: 'تتطلب متابعة فورية أو إلغاء',
    invoicesTitle: 'فواتير العملاء',
    filterAll: 'الكل',
    filterPending: 'معلقة',
    filterPaid: 'مدفوعة',
    filterOverdue: 'متأخرة',
    searchPlaceholder: 'ابحث باسم العميل أو رقم الفاتورة…',
    voidOverdueBtn: 'إلغاء جميع المتأخرات',
    colInvoice: 'رقم الفاتورة',
    colClient: 'العميل',
    colDueDate: 'تاريخ الاستحقاق',
    colAmount: 'المبلغ',
    colStatus: 'الحالة',
    colAction: 'الإجراء',
    statusPaid: 'مدفوعة',
    statusPending: 'معلقة',
    statusOverdue: 'متأخرة',
    statusVoided: 'ملغاة',
    markPaidBtn: 'تأكيد الدفع',
    settledLabel: 'مسددة',
    activityTitle: 'سجل الشبكة وعمليات الوكيل',
    activitySubtitle: 'يتم إخفاء رموز الجلسة وترويسات التفويض تلقائياً بواسطة reins',
    noInvoicesMatch: 'لا توجد فواتير تطابق عامل التصفية الحالي.',
  },
  fr: {
    brandTitle: 'Studio Factures Payday',
    brandSubtitle: 'Bureau de Facturation · Piloté via reins MCP',
    pairedBadge: 'reins actif',
    roleFinanceAdmin: 'Maya Lin · Admin Finance',
    roleViewer: 'Samir Patel · Auditeur',
    roleGuest: 'Session Invité',
    loginAsAdmin: 'Connexion Admin Finance',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    hudTitle: 'Instruments Runtime en Direct (reins_perf · reins_dom · reins_server)',
    hudSubtitle: 'Principes Lucid Coding #2 & #8 — cycle de vie, rendus, latence API + spans DB serveur et CSS',
    hudLifecycle: 'Cycle de Page',
    hudComponents: 'Montages & Rendus',
    hudApiLatency: 'Latence API',
    hudServerTiming: 'Serveur (@mindmakr/reins/node)',
    hudLayoutHealth: 'Diagnostic DOM & CSS',
    hudZeroClip: '0 débordement détecté',
    hudRecordBtn: 'Enregistrer',
    hudExportBtn: 'Exporter Session (.md)',
    summaryTitle: 'Aperçu des Créances',
    totalOutstanding: 'Total en Attente',
    totalOutstandingSub: 'Factures en attente et en retard',
    paidThisMonth: 'Payé ce Mois-ci',
    paidThisMonthSub: 'Réglé par virement bancaire',
    overdueCount: 'Factures en Retard',
    overdueCountSub: 'Relance ou annulation requise',
    invoicesTitle: 'Factures Clients',
    filterAll: 'Toutes',
    filterPending: 'En attente',
    filterPaid: 'Payées',
    filterOverdue: 'En retard',
    searchPlaceholder: 'Filtrer par client ou N° facture…',
    voidOverdueBtn: 'Annuler les Retards',
    colInvoice: 'Facture',
    colClient: 'Client',
    colDueDate: 'Échéance',
    colAmount: 'Montant',
    colStatus: 'Statut',
    colAction: 'Action',
    statusPaid: 'Payée',
    statusPending: 'En attente',
    statusOverdue: 'En retard',
    statusVoided: 'Annulée',
    markPaidBtn: 'Marquer Payée',
    settledLabel: 'Réglée',
    activityTitle: 'Journaux Réseau & Agent',
    activitySubtitle: 'Les jetons de session et en-têtes Authorization sont masqués [redacted] par reins',
    noInvoicesMatch: 'Aucune facture ne correspond au filtre actif.',
  },
};
