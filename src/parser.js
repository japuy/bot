import { db } from './db.js';

/**
 * Parses numeric amount from Indonesian natural language strings
 * Examples:
 * - "15rb", "15 rb", "15ribu", "15 rebu" -> 15000
 * - "15k", "15.5k" -> 15000, 15500
 * - "1.5jt", "1,5 juta", "2jt", "2 juta" -> 1500000, 2000000
 * - "15.000", "15,000", "15000", "Rp 15.000", "Rp. 15.000" -> 15000
 */
export function parseAmount(text) {
  const clean = text.toLowerCase();

  // Pattern 1: Millions (e.g., 1.5jt, 2,5 juta, 3jt, 50jt)
  const millionMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta)\b/i);
  if (millionMatch) {
    const num = parseFloat(millionMatch[1].replace(',', '.'));
    if (!isNaN(num)) {
      return {
        amount: Math.round(num * 1000000),
        rawMatch: millionMatch[0]
      };
    }
  }

  // Pattern 2: Thousands with suffix (e.g., 15rb, 15.5k, 50 rebu, 20 ribu)
  const thousandSuffixMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|k|ribu|rebu)\b/i);
  if (thousandSuffixMatch) {
    const num = parseFloat(thousandSuffixMatch[1].replace(',', '.'));
    if (!isNaN(num)) {
      return {
        amount: Math.round(num * 1000),
        rawMatch: thousandSuffixMatch[0]
      };
    }
  }

  // Pattern 3: Standard Indonesian rupiah format with dot separators (e.g., 15.000 or 1.500.000)
  const dotRupiahMatch = clean.match(/(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+)/i);
  if (dotRupiahMatch) {
    const plainNum = parseInt(dotRupiahMatch[1].replace(/\./g, ''), 10);
    if (!isNaN(plainNum) && plainNum > 0) {
      return {
        amount: plainNum,
        rawMatch: dotRupiahMatch[0]
      };
    }
  }

  // Pattern 4: Raw number preceded by Rp (e.g. Rp 15000, rp15000)
  const rpNumberMatch = clean.match(/rp\.?\s*(\d+)/i);
  if (rpNumberMatch) {
    const num = parseInt(rpNumberMatch[1], 10);
    if (!isNaN(num) && num > 0) {
      return {
        amount: num,
        rawMatch: rpNumberMatch[0]
      };
    }
  }

  // Pattern 5: Standalone number without suffix (e.g., "beli baso 15000")
  const standaloneMatch = clean.match(/\b(\d{3,9})\b/);
  if (standaloneMatch) {
    const num = parseInt(standaloneMatch[1], 10);
    if (!isNaN(num) && num > 0) {
      return {
        amount: num,
        rawMatch: standaloneMatch[0]
      };
    }
  }

  return null;
}

/**
 * Detects whether the transaction is an income or expense
 */
export function detectType(text) {
  const lower = text.toLowerCase().trim();

  // 1. Explicit income keywords
  const incomeKeywords = [
    'gaji', 'salary', 'payroll', 'uang bulanan',
    'masuk', 'pemasukan', 'dapat', 'terima', 'diterima',
    'tf dari', 'transfer dari', 'kiriman dari',
    'omset', 'penjualan', 'laku', 'untung',
    'bonus', 'cashback', 'hadiah', 'thr', 'angpao', 'infaq masuk'
  ];

  for (const kw of incomeKeywords) {
    if (lower.includes(kw)) return 'income';
  }

  // 2. Explicit internet / customer payment keywords
  if (
    lower.includes('bayar internet') ||
    lower.includes('bayar wifi') ||
    lower.includes('iuran internet') ||
    lower.includes('iuran wifi') ||
    lower.includes('tagihan internet') ||
    lower.includes('voucher wifi') ||
    lower.includes('wifian')
  ) {
    return 'income';
  }

  // 3. Explicit personal utilities (these are personal expenses)
  const personalUtilityKeywords = [
    'listrik', 'pln', 'token', 'pdam', 'air', 'bpjs', 'sewa kos', 'kontrakan',
    'cicilan', 'utang', 'hutang', 'pulsa', 'indihome', 'biznet', 'pbb'
  ];
  for (const util of personalUtilityKeywords) {
    if (lower.includes(util)) return 'expense';
  }

  // 4. Explicit expense verbs and actions
  const explicitExpenseKeywords = [
    'beli', 'jajan', 'keluar', 'pengeluaran',
    'ongkir', 'checkout', 'bensin', 'nonton', 'ngopi',
    'sedekah', 'infak', 'tf ke', 'transfer ke', 'kirim ke'
  ];

  for (const kw of explicitExpenseKeywords) {
    if (lower.includes(kw)) return 'expense';
  }

  // 5. Pattern: Name + Nominal (Customer paying internet to user)
  // e.g. "romi 150rb", "budi 100k", "pak slamet 150rb", "romi 150.000", "romi bayar 150rb"
  const amountObj = parseAmount(text);
  if (amountObj) {
    let remainder = lower.replace(amountObj.rawMatch.toLowerCase(), '').trim();
    // Strip common connectors/words around customer payments
    remainder = remainder.replace(/\b(bayar|lunas|iuran|tagihan|bulan\s*\w+|bln\s*\w+)\b/g, '').trim();

    // Known expense items (if remainder mentions these, it's an expense like "kopi 15k", "baso 15rb", "bensin 30rb")
    const knownExpenseItems = [
      // Makanan & Minuman
      'makan', 'minum', 'baso', 'bakso', 'maso', 'mie', 'nasi', 'ayam', 'kopi', 'ngopi',
      'snack', 'roti', 'es', 'teh', 'boba', 'mcd', 'kfc', 'cafe', 'sarapan', 'lunch',
      'dinner', 'sate', 'soto', 'pecel', 'gorengan', 'martabak', 'rokok', 'cemilan',
      'jus', 'cilok', 'seblak', 'goreng', 'batagor', 'siomay', 'padang', 'warteg',
      // Transportasi
      'bensin', 'pertalite', 'pertamax', 'solar', 'grab', 'gojek', 'ojol', 'gocar',
      'goride', 'parkir', 'tol', 'kereta', 'krl', 'mrt', 'busway', 'angkot',
      'tambal ban', 'cuci motor', 'cuci mobil', 'servis', 'oli',
      // Belanja
      'belanja', 'indomaret', 'alfamart', 'supermarket', 'shopee', 'tokopedia',
      'lazada', 'tiktok', 'sabun', 'shampoo', 'odol', 'minyak', 'beras', 'telur',
      'baju', 'kaos', 'celana', 'sepatu', 'sendal', 'baterai', 'gas', 'galon', 'aqua',
      // Hiburan / Kesehatan
      'bioskop', 'game', 'steam', 'netflix', 'spotify', 'karaoke', 'obat', 'apotek',
      'dokter', 'klinik', 'vitamin', 'masker', 'buku', 'fotokopi'
    ];

    const hasExpenseItem = knownExpenseItems.some(item => {
      const re = new RegExp(`\\b${item}\\b`, 'i');
      return re.test(remainder);
    });

    if (!hasExpenseItem && remainder.length >= 2) {
      // It's a client/person's name paying internet to user!
      return 'income';
    }
  }

  // 6. Generic fallback: if it has "bayar", treat as expense
  if (lower.includes('bayar')) {
    return 'expense';
  }

  // Default to expense because daily logs are mostly expenses
  return 'expense';
}

/**
 * Determine category automatically based on keywords
 */
export function detectCategory(text, type = 'expense') {
  const categories = db.getCategories();
  const lower = text.toLowerCase();

  // Special addition for user typo/slang
  if (lower.includes('maso') || lower.includes('bakso') || lower.includes('baso')) {
    return 'Makanan & Minuman';
  }

  if (type === 'income') {
    // 1. Check if it's Gaji
    if (lower.includes('gaji') || lower.includes('salary') || lower.includes('payroll') || lower.includes('upah')) {
      return 'Gaji & Upah';
    }

    // 2. Check if it's general business / sales
    if (lower.includes('omset') || lower.includes('penjualan') || lower.includes('laku') || lower.includes('untung')) {
      return 'Bisnis & Penjualan';
    }

    // 3. Check if it's transfer / gift
    if (lower.includes('transfer') || lower.includes('tf') || lower.includes('hadiah') || lower.includes('thr') || lower.includes('bonus') || lower.includes('cashback')) {
      return 'Transfer & Hadiah';
    }

    // 4. Default for customer name payment (e.g. "romi 150rb", "pak ahmad 100k") or internet/wifi
    return 'Pembayaran Internet';
  }

  for (const cat of categories) {
    if (cat.keywords && cat.keywords.length > 0) {
      for (const kw of cat.keywords) {
        // Regex word boundary or direct inclusion
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(lower) || lower.includes(kw)) {
          return cat.name;
        }
      }
    }
  }

  return 'Lain-lain';
}

/**
 * Clean description string
 */
export function cleanDescription(rawText, rawAmountMatch) {
  let desc = rawText;
  if (rawAmountMatch) {
    desc = desc.replace(rawAmountMatch, '');
  }

  // Clean trailing punctuation and multiple spaces
  desc = desc.replace(/[.,:;!?]+$/, '').trim();
  desc = desc.replace(/\s+/g, ' ');

  // If empty after stripping amount, provide fallback
  if (!desc || desc.length < 2) {
    return 'Transaksi';
  }

  // Capitalize first letter of words
  return desc.charAt(0).toUpperCase() + desc.slice(1);
}

/**
 * Format currency to Indonesian Rupiah
 */
export function formatRupiah(num) {
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

/**
 * Parse WhatsApp message and route to command or transaction creation
 */
export function processWhatsAppMessage(messageText) {
  const trimmed = (messageText || '').trim();
  const lower = trimmed.toLowerCase();

  // Check for commands
  if (lower === 'saldo' || lower === 'cek saldo' || lower === 'info saldo') {
    const summary = db.getSummary();
    const reply = `📊 *INFORMASI SALDO TERKINI*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `💳 *Total Saldo*: ${formatRupiah(summary.totalBalance)}\n` +
      `📈 *Pemasukan Hari Ini*: ${formatRupiah(summary.todayIncome)}\n` +
      `📉 *Pengeluaran Hari Ini*: ${formatRupiah(summary.todayExpense)}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📅 *Bulan Ini*:\n` +
      `• Pemasukan: ${formatRupiah(summary.monthIncome)}\n` +
      `• Pengeluaran: ${formatRupiah(summary.monthExpense)}\n` +
      `• Tabungan Bersih: ${formatRupiah(summary.netSavings)}\n\n` +
      `_💡 Kirim format seperti "beli baso 15rb" atau "gaji 5jt" untuk mencatat._`;
    return { status: 'command', command: 'balance', reply };
  }

  if (lower === 'laporan' || lower === 'rekap' || lower === 'rekap bulan ini') {
    const summary = db.getSummary();
    const categoriesText = summary.categoryBreakdown.length > 0
      ? summary.categoryBreakdown.slice(0, 5).map(c => `• ${c.name}: ${formatRupiah(c.total)} (${c.percentage}%)`).join('\n')
      : '• Belum ada pengeluaran bulan ini.';

    const reply = `📑 *LAPORAN KEUANGAN BULAN INI*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🟢 *Pemasukan*: ${formatRupiah(summary.monthIncome)}\n` +
      `🔴 *Pengeluaran*: ${formatRupiah(summary.monthExpense)}\n` +
      `💰 *Sisa Saldo*: ${formatRupiah(summary.totalBalance)}\n` +
      `🎯 *Budget*: ${formatRupiah(summary.monthlyBudget)} (${summary.budgetUsedPercent}% terpakai)\n\n` +
      `📁 *Top Pengeluaran Kategori*:\n${categoriesText}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `_Buka dashboard web Anda untuk melihat grafik lengkap!_`;
    return { status: 'command', command: 'report', reply };
  }

  if (lower === 'batal' || lower === 'undo' || lower === 'hapus terakhir') {
    const deleted = db.deleteLastTransaction();
    if (!deleted) {
      return { status: 'command', command: 'undo', reply: `⚠️ Tidak ada transaksi terakhir yang dapat dibatalkan.` };
    }
    const summary = db.getSummary();
    const reply = `🗑️ *TRANSAKSI BERHASIL DIBATALKAN*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `Transaksi *"${deleted.description}"* sebesar ${formatRupiah(deleted.amount)} telah dihapus.\n\n` +
      `💳 *Saldo sekarang*: ${formatRupiah(summary.totalBalance)}`;
    return { status: 'command', command: 'undo', reply, deleted };
  }

  if (lower === 'reset' || lower === 'reset saldo' || lower === 'reset data' || lower === 'hapus semua' || lower === 'clear') {
    const count = db.clearAllTransactions();
    const reply = `🧹 *DATA & SALDO BERHASIL DIRESET!*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `Seluruh riwayat transaksi (${count} transaksi) telah dihapus.\n\n` +
      `💳 *Saldo sekarang*: Rp 0\n` +
      `_Catatan keuangan Anda kini bersih dan siap digunakan kembali._`;
    return { status: 'command', command: 'reset', reply };
  }

  if (lower === 'bantuan' || lower === 'help' || lower === 'menu' || lower === 'panduan') {
    const reply = `🤖 *PANDUAN CATAT DUIT BOT*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `Catat keuangan semudah chat di WhatsApp!\n\n` +
      `💸 *Catat Pengeluaran*:\n` +
      `• "beli baso 15rb"\n` +
      `• "beli maso 15000"\n` +
      `• "bensin 30rb"\n` +
      `• "bayar listrik 150k"\n` +
      `• "jajan es kopi 22rb"\n\n` +
      `💰 *Catat Pemasukan*:\n` +
      `• "romi 150rb" (Bayar internet/pelanggan)\n` +
      `• "pak slamet 150k"\n` +
      `• "gaji bulanan 5jt"\n` +
      `• "dapat transfer 250rb"\n` +
      `• "omset jualan 750k"\n\n` +
      `⚙️ *Perintah Khusus*:\n` +
      `• *saldo* : Cek saldo & ringkasan harian\n` +
      `• *laporan* : Ringkasan bulanan & kategori\n` +
      `• *batal* : Menghapus catatan transaksi terakhir\n` +
      `• *bantuan* : Menampilkan menu ini`;
    return { status: 'command', command: 'help', reply };
  }

  // Parse transaction
  const amountObj = parseAmount(trimmed);
  if (!amountObj) {
    return {
      status: 'error',
      reply: `❓ *Pesan Tidak Dikenali*\n` +
        `Sertakan nominal rupiah ya. Contoh:\n` +
        `• *"beli baso 15rb"*\n` +
        `• *"bayar bensin 30.000"*\n` +
        `• *"gaji 5jt"*\n\n` +
        `Ketik *bantuan* untuk panduan lengkap.`
    };
  }

  const type = detectType(trimmed);
  const category = detectCategory(trimmed, type);
  const description = cleanDescription(trimmed, amountObj.rawMatch);

  // If customer internet payment with shorthand amount (e.g. "Lisa 120" -> 120.000, "Romi 150" -> 150.000)
  let finalAmount = amountObj.amount;
  if (type === 'income' && category === 'Pembayaran Internet' && finalAmount >= 10 && finalAmount < 1000) {
    finalAmount *= 1000;
  }

  // Save to DB
  const newTx = db.addTransaction({
    type,
    amount: finalAmount,
    description,
    category,
    raw_message: trimmed,
    source: 'whatsapp'
  });

  const summary = db.getSummary();
  const typeLabel = type === 'income' ? '🟢 Pemasukan' : '🔴 Pengeluaran';
  const typeIcon = type === 'income' ? '💰' : '💸';

  const reply = `✅ *CATATAN DISIMPAN!*\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `${typeIcon} *Jenis*: ${typeLabel}\n` +
    `💵 *Nominal*: ${formatRupiah(newTx.amount)}\n` +
    `📝 *Ket*: ${newTx.description}\n` +
    `📁 *Kategori*: ${newTx.category}\n` +
    `🕒 *Waktu*: ${new Date(newTx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `💳 *Saldo Terkini*: *${formatRupiah(summary.totalBalance)}*\n` +
    `_Ketik 'batal' jika ingin menghapus._`;

  return {
    status: 'success',
    transaction: newTx,
    reply,
    summary
  };
}
