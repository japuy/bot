import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL
  ? path.join('/tmp', 'catatduit-data')
  : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_CATEGORIES = [
  { id: 'cat_makanan', name: 'Makanan & Minuman', icon: 'utensils', color: '#f59e0b', keywords: ['makan', 'minum', 'baso', 'bakso', 'mie', 'nasi', 'ayam', 'kopi', 'ngopi', 'jajan', 'snack', 'roti', 'es', 'teh', 'boba', 'mcd', 'kfc', 'cafe', 'sarapan', 'lunch', 'dinner'] },
  { id: 'cat_transport', name: 'Transportasi', icon: 'car', color: '#3b82f6', keywords: ['bensin', 'pertalite', 'pertamax', 'solar', 'grab', 'gojek', 'ojol', 'gocar', 'goride', 'parkir', 'tol', 'kereta', 'krl', 'mrt', 'busway', 'angkot', 'tambal ban', 'cuci motor', 'cuci mobil', 'servis'] },
  { id: 'cat_belanja', name: 'Belanja Kebutuhan', icon: 'shopping-bag', color: '#ec4899', keywords: ['belanja', 'indomaret', 'alfamart', 'supermarket', 'shopee', 'tokopedia', 'lazada', 'tiktok', 'sabun', 'shampoo', 'odol', 'minyak', 'beras', 'telur', 'baju', 'kaos', 'celana', 'sepatu', 'beli'] },
  { id: 'cat_tagihan', name: 'Tagihan & Utilitas', icon: 'file-text', color: '#ef4444', keywords: ['listrik', 'pln', 'token', 'air', 'pdam', 'wifi', 'indihome', 'biznet', 'pulsa', 'kuota', 'paket data', 'bpjs', 'sewa', 'kos', 'kontrakan', 'cicilan', 'iuran', 'pbb'] },
  { id: 'cat_hiburan', name: 'Hiburan & Liburan', icon: 'film', color: '#8b5cf6', keywords: ['bioskop', 'nonton', 'game', 'steam', 'netflix', 'spotify', 'jalan-jalan', 'liburan', 'hotel', 'wisata', 'karaoke'] },
  { id: 'cat_kesehatan', name: 'Kesehatan & Obat', icon: 'heart-pulse', color: '#10b981', keywords: ['obat', 'apotek', 'dokter', 'klinik', 'rumah sakit', 'vitamin', 'masker', 'periksa'] },
  { id: 'cat_pendidikan', name: 'Pendidikan & Buku', icon: 'book-open', color: '#06b6d4', keywords: ['buku', 'kursus', 'kuliah', 'sekolah', 'spp', 'alat tulis', 'fotokopi', 'seminar'] },
  { id: 'cat_gaji', name: 'Gaji & Upah', icon: 'wallet', color: '#10b981', keywords: ['gaji', 'upah', 'salary', 'payroll', 'uang bulanan'] },
  { id: 'cat_bisnis', name: 'Bisnis & Penjualan', icon: 'trending-up', color: '#14b8a6', keywords: ['laku', 'omset', 'penjualan', 'untung', 'customer', 'proyek', 'freelance', 'fee', 'jual'] },
  { id: 'cat_transfer', name: 'Transfer & Hadiah', icon: 'arrow-down-left', color: '#6366f1', keywords: ['transfer', 'dapat', 'terima', 'dikasih', 'kiriman', 'hadiah', 'angpao', 'thr', 'bonus', 'cashback', 'infaq'] },
  { id: 'cat_lainnya', name: 'Lain-lain', icon: 'tag', color: '#64748b', keywords: [] }
];

function getInitialData() {
  const sampleTransactions = [];

  return {
    categories: DEFAULT_CATEGORIES,
    transactions: sampleTransactions,
    settings: {
      currency: 'IDR',
      monthly_budget: 3000000,
      bot_name: 'CatatDuit WA Bot',
      auto_reply: true
    }
  };
}

let cachedData = null;

function loadData() {
  if (cachedData) return cachedData;
  if (!fs.existsSync(DB_FILE)) {
    const init = getInitialData();
    saveData(init);
    cachedData = init;
    return cachedData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    cachedData = JSON.parse(raw);
    if (!cachedData.categories || cachedData.categories.length === 0) {
      cachedData.categories = DEFAULT_CATEGORIES;
    }
    return cachedData;
  } catch (err) {
    console.error('Error reading DB, re-initializing:', err);
    const init = getInitialData();
    saveData(init);
    cachedData = init;
    return cachedData;
  }
}

function saveData(data) {
  cachedData = data;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.warn('[DB] saveData warning (fallback to memory):', err.message);
  }
}

export const db = {
  getTransactions(filter = {}) {
    const data = loadData();
    let list = [...data.transactions];

    if (filter.type && filter.type !== 'all') {
      list = list.filter(t => t.type === filter.type);
    }
    if (filter.category && filter.category !== 'all') {
      list = list.filter(t => t.category.toLowerCase() === filter.category.toLowerCase());
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(t =>
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.raw_message && t.raw_message.toLowerCase().includes(q))
      );
    }
    if (filter.startDate) {
      list = list.filter(t => new Date(t.created_at) >= new Date(filter.startDate));
    }
    if (filter.endDate) {
      const end = new Date(filter.endDate);
      end.setHours(23, 59, 59, 999);
      list = list.filter(t => new Date(t.created_at) <= end);
    }

    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = list.length;
    const limit = parseInt(filter.limit) || 100;
    const offset = parseInt(filter.offset) || 0;

    return {
      total,
      data: list.slice(offset, offset + limit)
    };
  },

  addTransaction({ type, amount, description, category, raw_message = '', source = 'whatsapp', created_at }) {
    const data = loadData();
    const newTx = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      type: type === 'income' ? 'income' : 'expense',
      amount: Math.abs(Number(amount)),
      description: description || (type === 'income' ? 'Pemasukan' : 'Pengeluaran'),
      category: category || (type === 'income' ? 'Gaji & Upah' : 'Makanan & Minuman'),
      raw_message,
      source,
      created_at: created_at || new Date().toISOString()
    };

    data.transactions.unshift(newTx);
    saveData(data);
    return newTx;
  },

  updateTransaction(id, updates) {
    const data = loadData();
    const idx = data.transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;

    if (updates.amount !== undefined) updates.amount = Math.abs(Number(updates.amount));
    data.transactions[idx] = { ...data.transactions[idx], ...updates };
    saveData(data);
    return data.transactions[idx];
  },

  deleteTransaction(id) {
    const data = loadData();
    const idx = data.transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const deleted = data.transactions.splice(idx, 1)[0];
    saveData(data);
    return deleted;
  },

  deleteLastTransaction() {
    const data = loadData();
    if (data.transactions.length === 0) return null;
    const deleted = data.transactions.shift();
    saveData(data);
    return deleted;
  },

  clearAllTransactions() {
    const data = loadData();
    const count = data.transactions.length;
    data.transactions = [];
    saveData(data);
    return count;
  },

  getCategories() {
    const data = loadData();
    return data.categories || DEFAULT_CATEGORIES;
  },

  getSettings() {
    const data = loadData();
    return data.settings || {};
  },

  updateSettings(newSettings) {
    const data = loadData();
    data.settings = { ...data.settings, ...newSettings };
    saveData(data);
    return data.settings;
  },

  getSummary(targetMonth = null, targetYear = null) {
    const data = loadData();
    const now = new Date();
    const month = targetMonth !== null ? Number(targetMonth) : now.getMonth();
    const year = targetYear !== null ? Number(targetYear) : now.getFullYear();

    let totalBalance = 0;
    let monthIncome = 0;
    let monthExpense = 0;
    let todayExpense = 0;
    let todayIncome = 0;

    const todayStr = now.toISOString().slice(0, 10);
    const categoryTotals = {};

    // Grouping for charts (days in month)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dailyExpenses = new Array(daysInMonth).fill(0);
    const dailyIncomes = new Array(daysInMonth).fill(0);

    for (const tx of data.transactions) {
      const txDate = new Date(tx.created_at);
      const isThisYear = txDate.getFullYear() === year;
      const isThisMonth = isThisYear && txDate.getMonth() === month;
      const isToday = tx.created_at.slice(0, 10) === todayStr;

      if (tx.type === 'income') {
        totalBalance += tx.amount;
        if (isThisMonth) {
          monthIncome += tx.amount;
          const dayIdx = txDate.getDate() - 1;
          if (dayIdx >= 0 && dayIdx < daysInMonth) {
            dailyIncomes[dayIdx] += tx.amount;
          }
        }
        if (isToday) {
          todayIncome += tx.amount;
        }
      } else {
        totalBalance -= tx.amount;
        if (isThisMonth) {
          monthExpense += tx.amount;
          categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
          const dayIdx = txDate.getDate() - 1;
          if (dayIdx >= 0 && dayIdx < daysInMonth) {
            dailyExpenses[dayIdx] += tx.amount;
          }
        }
        if (isToday) {
          todayExpense += tx.amount;
        }
      }
    }

    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([name, total]) => ({
        name,
        total,
        percentage: monthExpense > 0 ? ((total / monthExpense) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.total - a.total);

    const budget = data.settings?.monthly_budget || 3000000;
    const budgetUsedPercent = Math.min(100, Math.round((monthExpense / (budget || 1)) * 100));

    return {
      totalBalance,
      monthIncome,
      monthExpense,
      todayIncome,
      todayExpense,
      netSavings: monthIncome - monthExpense,
      monthlyBudget: budget,
      budgetUsedPercent,
      categoryBreakdown,
      dailyChart: {
        labels: Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`),
        expenses: dailyExpenses,
        incomes: dailyIncomes
      },
      recentTransactions: data.transactions.slice(0, 8),
      totalTransactionsCount: data.transactions.length
    };
  }
};
