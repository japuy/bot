// CatatDuit Frontend Application Logic
let dailyChartInstance = null;
let categoryChartInstance = null;

let isBalanceHidden = false;
let currentSummary = null;
let currentFilter = {
  type: 'all',
  category: 'all',
  search: '',
  date: '',
  limit: 20,
  offset: 0
};
let categoriesList = [];

// Initialize Lucide Icons
function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Rupiah Formatter
function formatRupiah(num) {
  if (num === null || num === undefined) return 'Rp 0';
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

// Format Date
function formatDateTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  });
}

// Show Toast Message
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Show Top Alert Banner
function showLiveAlert(title, desc, isIncome = false) {
  const banner = document.getElementById('liveAlertBanner');
  const titleEl = document.getElementById('alertTitle');
  const descEl = document.getElementById('alertDesc');
  const iconWrap = document.getElementById('alertIconWrap');

  titleEl.textContent = title;
  descEl.textContent = desc;

  if (isIncome) {
    iconWrap.className = 'alert-icon-wrap text-emerald';
    iconWrap.innerHTML = '<i data-lucide="arrow-down-left"></i>';
  } else {
    iconWrap.className = 'alert-icon-wrap text-rose';
    iconWrap.innerHTML = '<i data-lucide="arrow-up-right"></i>';
  }

  banner.classList.remove('hidden');
  refreshIcons();

  clearTimeout(banner._timer);
  banner._timer = setTimeout(() => {
    banner.classList.add('hidden');
  }, 6000);
}

// Load Categories
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const json = await res.json();
    if (json.success) {
      categoriesList = json.data;
      
      // Populate select dropdowns
      const filterSelect = document.getElementById('categoryFilterSelect');
      const formSelect = document.getElementById('txCategory');

      filterSelect.innerHTML = '<option value="all">Semua Kategori</option>';
      formSelect.innerHTML = '';

      categoriesList.forEach(cat => {
        const optFilter = document.createElement('option');
        optFilter.value = cat.name;
        optFilter.textContent = cat.name;
        filterSelect.appendChild(optFilter);

        const optForm = document.createElement('option');
        optForm.value = cat.name;
        optForm.textContent = cat.name;
        formSelect.appendChild(optForm);
      });
    }
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

// Load Summary & Update KPI Cards & Charts
async function loadSummary() {
  try {
    const res = await fetch('/api/summary');
    const json = await res.json();
    if (json.success && json.data) {
      currentSummary = json.data;
      renderKPIs(json.data);
      renderCharts(json.data);
    }
  } catch (err) {
    console.error('Failed to load summary:', err);
  }
}

// Render KPI Cards
function renderKPIs(data) {
  const balanceEl = document.getElementById('totalBalanceVal');
  const incomeEl = document.getElementById('monthIncomeVal');
  const expenseEl = document.getElementById('monthExpenseVal');
  const todayIncEl = document.getElementById('todayIncomeVal');
  const todayExpEl = document.getElementById('todayExpenseVal');
  const budgetLimitEl = document.getElementById('budgetLimitVal');
  const budgetBar = document.getElementById('budgetProgressBar');
  const budgetBadge = document.getElementById('budgetPercentageBadge');
  const budgetRemainingEl = document.getElementById('budgetRemainingText');

  if (isBalanceHidden) {
    balanceEl.textContent = 'Rp ••••••••';
  } else {
    balanceEl.textContent = formatRupiah(data.totalBalance);
  }

  incomeEl.textContent = formatRupiah(data.monthIncome);
  expenseEl.textContent = formatRupiah(data.monthExpense);
  todayIncEl.textContent = formatRupiah(data.todayIncome);
  todayExpEl.textContent = formatRupiah(data.todayExpense);

  budgetLimitEl.textContent = formatRupiah(data.monthlyBudget);
  budgetBadge.textContent = `${data.budgetUsedPercent}% Terpakai`;
  budgetBar.style.width = `${Math.min(100, data.budgetUsedPercent)}%`;

  const remainingBudget = Math.max(0, data.monthlyBudget - data.monthExpense);
  budgetRemainingEl.textContent = `Sisa kuota belanja: ${formatRupiah(remainingBudget)}`;

  if (data.budgetUsedPercent >= 90) {
    budgetBadge.className = 'badge badge-danger text-rose';
  } else if (data.budgetUsedPercent >= 70) {
    budgetBadge.className = 'badge text-amber';
  } else {
    budgetBadge.className = 'badge badge-info';
  }
}

// Render Chart.js
function renderCharts(data) {
  // Chart 1: Daily Trends
  const ctxDaily = document.getElementById('dailyTrendChart');
  if (ctxDaily) {
    const labels = data.dailyChart.labels.map(d => `Tgl ${d}`);
    const expenseData = data.dailyChart.expenses;
    const incomeData = data.dailyChart.incomes;

    if (dailyChartInstance) {
      dailyChartInstance.data.labels = labels;
      dailyChartInstance.data.datasets[0].data = incomeData;
      dailyChartInstance.data.datasets[1].data = expenseData;
      dailyChartInstance.update();
    } else {
      dailyChartInstance = new Chart(ctxDaily, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Pemasukan',
              data: incomeData,
              backgroundColor: 'rgba(16, 185, 129, 0.7)',
              borderColor: '#10b981',
              borderRadius: 6,
              borderWidth: 1
            },
            {
              label: 'Pengeluaran',
              data: expenseData,
              backgroundColor: 'rgba(244, 63, 94, 0.7)',
              borderColor: '#f43f5e',
              borderRadius: 6,
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } }
            },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  return `${ctx.dataset.label}: ${formatRupiah(ctx.raw)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#64748b', font: { size: 10 } }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: {
                color: '#64748b',
                font: { size: 10 },
                callback: function (val) {
                  return val >= 1000000 ? `${(val / 1000000).toFixed(1)}jt` : `${val / 1000}k`;
                }
              }
            }
          }
        }
      });
    }
  }

  // Chart 2: Category Donut
  const ctxDonut = document.getElementById('categoryDonutChart');
  const legendList = document.getElementById('categoryLegendList');
  
  if (ctxDonut) {
    const categories = data.categoryBreakdown;
    const catColors = [
      '#f59e0b', '#3b82f6', '#ec4899', '#ef4444', '#8b5cf6',
      '#10b981', '#06b6d4', '#14b8a6', '#6366f1', '#64748b'
    ];

    const chartLabels = categories.length > 0 ? categories.map(c => c.name) : ['Belum Ada Pengeluaran'];
    const chartData = categories.length > 0 ? categories.map(c => c.total) : [1];
    const chartColors = categories.length > 0 ? catColors.slice(0, categories.length) : ['#334155'];

    if (categoryChartInstance) {
      categoryChartInstance.data.labels = chartLabels;
      categoryChartInstance.data.datasets[0].data = chartData;
      categoryChartInstance.data.datasets[0].backgroundColor = chartColors;
      categoryChartInstance.update();
    } else {
      categoryChartInstance = new Chart(ctxDonut, {
        type: 'doughnut',
        data: {
          labels: chartLabels,
          datasets: [{
            data: chartData,
            backgroundColor: chartColors,
            borderColor: '#111827',
            borderWidth: 2,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  if (categories.length === 0) return 'Belum ada data';
                  return `${ctx.label}: ${formatRupiah(ctx.raw)}`;
                }
              }
            }
          }
        }
      });
    }

    // Populate Category Legend List
    legendList.innerHTML = '';
    if (categories.length === 0) {
      legendList.innerHTML = `<div class="legend-item"><span style="color:#64748b">Belum ada pengeluaran bulan ini.</span></div>`;
    } else {
      categories.forEach((cat, idx) => {
        const color = catColors[idx % catColors.length];
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
          <div class="legend-left">
            <span class="legend-dot" style="background:${color}"></span>
            <span>${cat.name}</span>
          </div>
          <span class="legend-val">${formatRupiah(cat.total)} (${cat.percentage}%)</span>
        `;
        legendList.appendChild(item);
      });
    }
  }
}

// Load Transactions Table
async function loadTransactions() {
  const tbody = document.getElementById('transactionsTableBody');
  const paginationInfo = document.getElementById('paginationInfo');
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');

  try {
    const params = new URLSearchParams();
    if (currentFilter.type !== 'all') params.append('type', currentFilter.type);
    if (currentFilter.category !== 'all') params.append('category', currentFilter.category);
    if (currentFilter.search) params.append('search', currentFilter.search);
    if (currentFilter.date) {
      params.append('startDate', currentFilter.date);
      params.append('endDate', currentFilter.date);
    }
    params.append('limit', currentFilter.limit);
    params.append('offset', currentFilter.offset);

    const res = await fetch(`/api/transactions?${params.toString()}`);
    const json = await res.json();

    if (json.success) {
      tbody.innerHTML = '';

      if (json.data.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="empty-state-cell">
              <i data-lucide="inbox" style="width:36px;height:36px;margin-bottom:8px;color:#64748b"></i>
              <p>Tidak ada transaksi yang cocok.</p>
            </td>
          </tr>
        `;
        refreshIcons();
        paginationInfo.textContent = 'Menampilkan 0 transaksi';
        btnPrev.disabled = true;
        btnNext.disabled = true;
        return;
      }

      json.data.forEach(tx => {
        const tr = document.createElement('tr');
        const isIncome = tx.type === 'income';
        const amountClass = isIncome ? 'text-emerald' : 'text-rose';
        const sign = isIncome ? '+' : '-';

        // Find category color
        const catObj = categoriesList.find(c => c.name === tx.category);
        const catColor = catObj ? catObj.color : '#64748b';

        tr.innerHTML = `
          <td>
            <span class="tx-main-desc">${escapeHtml(tx.description)}</span>
            ${tx.raw_message ? `<span class="tx-raw-badge"><i data-lucide="message-square"></i> "${escapeHtml(tx.raw_message)}"</span>` : ''}
          </td>
          <td>
            <span class="cat-chip" style="background:${catColor}20; color:${catColor}; border:1px solid ${catColor}40">
              ${escapeHtml(tx.category)}
            </span>
          </td>
          <td>
            <div class="tx-time-meta">
              <span class="tx-date-str">${formatDateTime(tx.created_at)}</span>
              <span class="source-badge ${tx.source}">
                <i data-lucide="${tx.source === 'whatsapp' ? 'message-circle' : 'globe'}"></i>
                ${tx.source === 'whatsapp' ? 'WhatsApp' : 'Web App'}
              </span>
            </div>
          </td>
          <td class="text-right">
            <span class="tx-amount-display ${amountClass}">${sign} ${formatRupiah(tx.amount)}</span>
          </td>
          <td class="text-center">
            <div class="tx-actions-group">
              <button class="btn-action-icon" onclick="editTransaction('${tx.id}')" title="Edit Transaksi">
                <i data-lucide="edit-3"></i>
              </button>
              <button class="btn-action-icon danger" onclick="deleteTransaction('${tx.id}')" title="Hapus Transaksi">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });

      refreshIcons();

      const start = currentFilter.offset + 1;
      const end = Math.min(currentFilter.offset + currentFilter.limit, json.total);
      paginationInfo.textContent = `Menampilkan ${start} - ${end} dari ${json.total} transaksi`;

      btnPrev.disabled = currentFilter.offset === 0;
      btnNext.disabled = end >= json.total;
    }
  } catch (err) {
    console.error('Failed to load transactions:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state-cell">Gagal memuat transaksi</td></tr>`;
  }
}

// Escape HTML utility
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Delete Transaction
window.deleteTransaction = async function(id) {
  if (!confirm('Yakin ingin menghapus catatan transaksi ini?')) return;
  try {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Transaksi berhasil dihapus.');
      loadSummary();
      loadTransactions();
    } else {
      showToast(json.error || 'Gagal menghapus transaksi', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan server', 'error');
  }
};

// Edit Transaction
window.editTransaction = async function(id) {
  try {
    const res = await fetch(`/api/transactions?limit=100`);
    const json = await res.json();
    const tx = json.data.find(t => t.id === id);
    if (!tx) return;

    document.getElementById('editTxId').value = tx.id;
    document.getElementById('modalTitle').textContent = 'Edit Transaksi';
    document.getElementById('txAmount').value = tx.amount;
    document.getElementById('txDescription').value = tx.description;
    document.getElementById('txCategory').value = tx.category;

    if (tx.created_at) {
      const d = new Date(tx.created_at);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      document.getElementById('txDate').value = d.toISOString().slice(0, 16);
    }

    const typeRadios = document.getElementsByName('txType');
    for (const r of typeRadios) {
      if (r.value === tx.type) r.checked = true;
    }

    document.getElementById('modalAddTransaction').classList.remove('hidden');
    refreshIcons();
  } catch (err) {
    console.error('Error editing tx:', err);
  }
};

// WhatsApp Connection & Status Manager
async function checkWhatsAppStatus() {
  try {
    const res = await fetch('/api/whatsapp/status');
    const json = await res.json();
    if (json.success) {
      updateWhatsAppUI(json.data);
    }
  } catch (err) {
    console.error('Failed to check WA status:', err);
  }
}

function updateWhatsAppUI(data) {
  const navPill = document.getElementById('waNavPill');
  const navText = document.getElementById('waNavStatusText');
  const qrFrame = document.getElementById('qrCodeFrame');
  const qrImage = document.getElementById('qrCodeImage');
  const qrLoading = document.getElementById('qrLoading');
  const qrBadge = document.getElementById('qrBadgeState');
  const waAccountInfo = document.getElementById('waAccountInfo');
  const btnConnect = document.getElementById('btnConnectWA');
  const btnDisconnect = document.getElementById('btnDisconnectWA');
  const connectedName = document.getElementById('waConnectedName');
  const connectedPhone = document.getElementById('waConnectedPhone');

  navPill.className = `wa-status-pill ${data.status}`;

  if (data.status === 'connected') {
    navText.textContent = `WA Terhubung (${data.userName || 'Aktif'})`;
    qrBadge.className = 'badge text-emerald';
    qrBadge.textContent = '🟢 Terhubung';
    qrFrame.classList.add('hidden');
    waAccountInfo.classList.remove('hidden');
    connectedName.textContent = data.userName || 'WhatsApp Aktif';
    connectedPhone.textContent = data.userPhone ? `+${data.userPhone}` : 'Nomor Handphone Terhubung';
    btnConnect.classList.add('hidden');
    btnDisconnect.classList.remove('hidden');
  } else if (data.status === 'qr_ready' && data.qrCodeDataUrl) {
    navText.textContent = 'Siap Scan QR WA';
    qrBadge.className = 'badge text-amber';
    qrBadge.textContent = '🟡 Silakan Scan QR Code';
    qrFrame.classList.remove('hidden');
    qrLoading.classList.add('hidden');
    qrImage.classList.remove('hidden');
    qrImage.src = data.qrCodeDataUrl;
    waAccountInfo.classList.add('hidden');
    btnConnect.classList.remove('hidden');
    btnDisconnect.classList.add('hidden');
  } else if (data.status === 'connecting') {
    navText.textContent = 'Menghubungkan WA...';
    qrBadge.className = 'badge badge-info';
    qrBadge.textContent = '🔵 Mempersiapkan Koneksi...';
    qrFrame.classList.remove('hidden');
    qrLoading.classList.remove('hidden');
    qrImage.classList.add('hidden');
    waAccountInfo.classList.add('hidden');
    btnConnect.classList.remove('hidden');
    btnDisconnect.classList.add('hidden');
  } else {
    navText.textContent = 'WA Belum Terhubung';
    qrBadge.className = 'badge text-rose';
    qrBadge.textContent = '🔴 Terputus';
    qrFrame.classList.remove('hidden');
    qrLoading.classList.remove('hidden');
    document.getElementById('qrLoadingText').textContent = 'Klik tombol di bawah untuk memuat QR Code';
    qrImage.classList.add('hidden');
    waAccountInfo.classList.add('hidden');
    btnConnect.classList.remove('hidden');
    btnDisconnect.classList.add('hidden');
  }
  refreshIcons();
}

// Server-Sent Events (SSE) Real-Time Synchronization
function initSSE() {
  const evtSource = new EventSource('/api/events');

  evtSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (!payload || !payload.event) return;

      if (payload.event === 'transaction_added') {
        const tx = payload.data;
        const isIncome = tx.type === 'income';
        showLiveAlert(
          isIncome ? 'Pemasukan Baru Dicatat!' : 'Pengeluaran Baru Dicatat!',
          `${tx.description} (${formatRupiah(tx.amount)})`,
          isIncome
        );
        loadSummary();
        loadTransactions();
      } else if (payload.event === 'transaction_deleted') {
        loadSummary();
        loadTransactions();
      } else if (payload.event === 'status_update') {
        updateWhatsAppUI(payload.data);
      } else if (payload.event === 'new_message') {
        // If message comes from external WA, render in chat mockup if simulator open
        if (payload.data.sender !== 'simulator@user') {
          appendChatMessage(payload.data.text, false);
          if (payload.data.result?.reply) {
            appendChatMessage(payload.data.result.reply, true);
          }
        }
      }
    } catch (e) {
      console.error('SSE message parse error:', e);
    }
  };

  evtSource.onerror = () => {
    console.warn('SSE connection lost, reconnecting...');
  };
}

// Append Chat Bubble to Simulator Phone
function appendChatMessage(text, isBot = false) {
  const body = document.getElementById('simulatorChatBody');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${isBot ? 'bot-bubble' : 'user-bubble'}`;

  const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  // Convert markdown bold to strong and newlines to br
  const formattedText = text
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

  bubble.innerHTML = `
    <div class="bubble-text">${formattedText}</div>
    <span class="bubble-time">${nowStr}</span>
  `;

  body.appendChild(bubble);
  body.scrollTop = body.scrollHeight;
}

// Setup Event Listeners
function setupEventListeners() {
  // Current Date Display
  const dateDisplay = document.getElementById('currentDateDisplay');
  if (dateDisplay) {
    const now = new Date();
    dateDisplay.textContent = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  // Toggle Balance Visibility
  document.getElementById('toggleBalanceVisibility').addEventListener('click', () => {
    isBalanceHidden = !isBalanceHidden;
    const eyeIcon = document.getElementById('eyeIcon');
    if (isBalanceHidden) {
      eyeIcon.setAttribute('data-lucide', 'eye-off');
    } else {
      eyeIcon.setAttribute('data-lucide', 'eye');
    }
    if (currentSummary) renderKPIs(currentSummary);
    refreshIcons();
  });

  // Close Live Alert Banner
  document.getElementById('btnCloseAlert').addEventListener('click', () => {
    document.getElementById('liveAlertBanner').classList.add('hidden');
  });

  // Type Filters
  document.querySelectorAll('.type-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter.type = btn.dataset.type;
      currentFilter.offset = 0;
      loadTransactions();
    });
  });

  // Category Filter Select
  document.getElementById('categoryFilterSelect').addEventListener('change', (e) => {
    currentFilter.category = e.target.value;
    currentFilter.offset = 0;
    loadTransactions();
  });

  // Date Filter Input
  document.getElementById('dateFilterInput').addEventListener('change', (e) => {
    currentFilter.date = e.target.value;
    currentFilter.offset = 0;
    loadTransactions();
  });

  // Search Input with Debounce
  let searchDebounce;
  document.getElementById('txSearchInput').addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      currentFilter.search = e.target.value.trim();
      currentFilter.offset = 0;
      loadTransactions();
    }, 300);
  });

  // Refresh Button
  document.getElementById('btnRefreshTx').addEventListener('click', () => {
    loadSummary();
    loadTransactions();
    showToast('Data transaksi dimuat ulang.');
  });

  // Clear All / Reset Button
  const btnClearAll = document.getElementById('btnClearAllTx');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', async () => {
      const confirmReset = confirm('⚠️ PERINGATAN: Apakah Anda yakin ingin menghapus SELURUH transaksi dan membuat data fresh seperti baru? Tindakan ini tidak dapat dibatalkan.');
      if (!confirmReset) return;

      try {
        const res = await fetch('/api/transactions/clear-all', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          showToast('Seluruh transaksi berhasil dihapus. Data kini fresh seperti baru!');
          loadSummary();
          loadTransactions();
        } else {
          showToast(json.error || 'Gagal mereset data', 'error');
        }
      } catch (err) {
        showToast('Terjadi kesalahan jaringan', 'error');
      }
    });
  }

  // Pagination Controls
  document.getElementById('btnPrevPage').addEventListener('click', () => {
    if (currentFilter.offset > 0) {
      currentFilter.offset = Math.max(0, currentFilter.offset - currentFilter.limit);
      loadTransactions();
    }
  });

  document.getElementById('btnNextPage').addEventListener('click', () => {
    currentFilter.offset += currentFilter.limit;
    loadTransactions();
  });

  // Export CSV
  document.getElementById('btnExportCSV').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/transactions?limit=1000');
      const json = await res.json();
      if (!json.success || json.data.length === 0) {
        showToast('Tidak ada data untuk diekspor', 'error');
        return;
      }

      let csv = 'ID,Jenis,Nominal,Kategori,Keterangan,Pesan Asli,Sumber,Waktu\n';
      json.data.forEach(t => {
        csv += `"${t.id}","${t.type}","${t.amount}","${t.category}","${(t.description || '').replace(/"/g, '""')}","${(t.raw_message || '').replace(/"/g, '""')}","${t.source}","${t.created_at}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `catatduit_transaksi_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('File CSV berhasil diunduh.');
    } catch (err) {
      showToast('Gagal mengekspor CSV', 'error');
    }
  });

  // Hub Tabs
  document.querySelectorAll('.hub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.hub-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const targetPane = document.getElementById(tab.dataset.target);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Simulator Chat Form Submit
  const simulatorForm = document.getElementById('simulatorForm');
  const simulatorInput = document.getElementById('simulatorInput');

  async function handleSendChat(text) {
    if (!text || !text.trim()) return;
    appendChatMessage(text, false);
    simulatorInput.value = '';

    try {
      const res = await fetch('/api/simulate-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const json = await res.json();
      if (json.reply) {
        setTimeout(() => {
          appendChatMessage(json.reply, true);
        }, 300);
      }
      if (json.status === 'success') {
        showToast('Catatan disimpan ke database!', 'success');
      }
    } catch (err) {
      appendChatMessage('⚠️ Terjadi gangguan koneksi server simulator.', true);
    }
  }

  simulatorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendChat(simulatorInput.value);
  });

  // Quick prompt chips
  document.querySelectorAll('.quick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      handleSendChat(chip.dataset.msg);
    });
  });

  // WA Reconnect / Disconnect Buttons
  document.getElementById('btnConnectWA').addEventListener('click', async () => {
    showToast('Menghubungkan ke WhatsApp Baileys...');
    document.getElementById('qrLoadingText').textContent = 'Meminta QR Code baru...';
    await fetch('/api/whatsapp/connect', { method: 'POST' });
    checkWhatsAppStatus();
  });

  document.getElementById('btnDisconnectWA').addEventListener('click', async () => {
    if (!confirm('Putuskan koneksi WhatsApp? Anda perlu scan QR ulang untuk menghubungkan kembali.')) return;
    await fetch('/api/whatsapp/disconnect', { method: 'POST' });
    showToast('Koneksi WhatsApp diputus.');
    checkWhatsAppStatus();
  });

  // Copy Webhook URL
  document.getElementById('btnCopyWebhook').addEventListener('click', () => {
    const input = document.getElementById('webhookUrlInput');
    // Set actual origin
    input.value = `${window.location.origin}/api/webhook/whatsapp`;
    input.select();
    navigator.clipboard.writeText(input.value);
    showToast('Webhook URL disalin ke clipboard!');
  });

  // Set default webhook origin
  document.getElementById('webhookUrlInput').value = `${window.location.origin}/api/webhook/whatsapp`;

  // Add Manual Transaction Modal Controls
  const modalAdd = document.getElementById('modalAddTransaction');
  document.getElementById('btnOpenAddModal').addEventListener('click', () => {
    document.getElementById('editTxId').value = '';
    document.getElementById('modalTitle').textContent = 'Tambah Transaksi Manual';
    document.getElementById('formAddTransaction').reset();
    
    // Set current date & time
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('txDate').value = now.toISOString().slice(0, 16);

    modalAdd.classList.remove('hidden');
    refreshIcons();
  });

  document.getElementById('btnCloseAddModal').addEventListener('click', () => modalAdd.classList.add('hidden'));
  document.getElementById('btnCancelAdd').addEventListener('click', () => modalAdd.classList.add('hidden'));

  // Submit Add/Edit Transaction Form
  document.getElementById('formAddTransaction').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editTxId').value;
    const type = document.querySelector('input[name="txType"]:checked').value;
    const amount = Number(document.getElementById('txAmount').value);
    const description = document.getElementById('txDescription').value.trim();
    const category = document.getElementById('txCategory').value;
    const txDate = document.getElementById('txDate').value;

    const payload = {
      type,
      amount,
      description,
      category,
      created_at: txDate ? new Date(txDate).toISOString() : new Date().toISOString()
    };

    try {
      let res;
      if (editId) {
        res = await fetch(`/api/transactions/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const json = await res.json();
      if (json.success) {
        showToast(editId ? 'Transaksi berhasil diperbarui.' : 'Transaksi berhasil ditambahkan.');
        modalAdd.classList.add('hidden');
        loadSummary();
        loadTransactions();
      } else {
        showToast(json.error || 'Gagal menyimpan transaksi', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  });

  // Budget Modal Controls
  const modalBudget = document.getElementById('modalBudget');
  document.getElementById('btnOpenBudgetModal').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (json.success && json.data.monthly_budget) {
        document.getElementById('inputBudgetLimit').value = json.data.monthly_budget;
      }
    } catch (e) {}
    modalBudget.classList.remove('hidden');
    refreshIcons();
  });

  document.getElementById('btnCloseBudgetModal').addEventListener('click', () => modalBudget.classList.add('hidden'));
  document.getElementById('btnCancelBudget').addEventListener('click', () => modalBudget.classList.add('hidden'));

  document.getElementById('formBudget').addEventListener('submit', async (e) => {
    e.preventDefault();
    const budget = Number(document.getElementById('inputBudgetLimit').value);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly_budget: budget })
      });
      const json = await res.json();
      if (json.success) {
        showToast('Target anggaran berhasil disimpan.');
        modalBudget.classList.add('hidden');
        loadSummary();
      }
    } catch (err) {
      showToast('Gagal menyimpan target budget', 'error');
    }
  });

  // Token Modal Controls
  const modalToken = document.getElementById('modalToken');
  const btnOpenToken = document.getElementById('btnOpenTokenModal');
  const inputFonnteToken = document.getElementById('inputFonnteToken');
  const inputTabToken = document.getElementById('inputTabToken');

  async function loadTokenSettings() {
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (json.success && json.data) {
        const token = json.data.fonnte_token || 'BfMDrng3jS2CkudCyhW9';
        const phone = json.data.bot_phone || '089639386199';
        if (inputFonnteToken) inputFonnteToken.value = token;
        if (inputTabToken) inputTabToken.value = token;
        const phoneEl = document.getElementById('tabTokenPhone');
        if (phoneEl) phoneEl.textContent = phone;
        const modalPhoneEl = document.getElementById('modalTokenPhone');
        if (modalPhoneEl) modalPhoneEl.textContent = phone;
      }
    } catch (e) {}
  }

  if (btnOpenToken) {
    btnOpenToken.addEventListener('click', async () => {
      await loadTokenSettings();
      modalToken.classList.remove('hidden');
      refreshIcons();
    });
  }

  const btnCloseToken = document.getElementById('btnCloseTokenModal');
  const btnCancelToken = document.getElementById('btnCancelToken');
  if (btnCloseToken) btnCloseToken.addEventListener('click', () => modalToken.classList.add('hidden'));
  if (btnCancelToken) btnCancelToken.addEventListener('click', () => modalToken.classList.add('hidden'));

  async function handleSaveToken(tokenValue) {
    if (!tokenValue || !tokenValue.trim()) {
      showToast('Token tidak boleh kosong', 'error');
      return;
    }
    showToast('Memvalidasi token ke server Fonnte...');
    try {
      const res = await fetch('/api/fonnte/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenValue.trim() })
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Token valid! Bot terhubung ke ${json.device || 'WhatsApp'}`);
        if (modalToken) modalToken.classList.add('hidden');
        if (inputFonnteToken) inputFonnteToken.value = tokenValue.trim();
        if (inputTabToken) inputTabToken.value = tokenValue.trim();
        
        const phoneEl = document.getElementById('tabTokenPhone');
        if (phoneEl) phoneEl.textContent = json.device || 'Aktif';
        const quotaEl = document.getElementById('tabTokenQuota');
        if (quotaEl) quotaEl.textContent = json.quota || '-';

        const modalPhoneEl = document.getElementById('modalTokenPhone');
        if (modalPhoneEl) modalPhoneEl.textContent = json.device || 'Aktif';
        const modalQuotaEl = document.getElementById('modalTokenQuota');
        if (modalQuotaEl) modalQuotaEl.textContent = `Sisa Kuota: ${json.quota || '-'} pesan`;
      } else {
        showToast(json.error || 'Token tidak valid. Pastikan token Fonnte benar.', 'error');
      }
    } catch (err) {
      showToast('Gagal memvalidasi token', 'error');
    }
  }

  const formToken = document.getElementById('formToken');
  if (formToken) {
    formToken.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSaveToken(inputFonnteToken.value);
    });
  }

  const btnSaveTabToken = document.getElementById('btnSaveTabToken');
  if (btnSaveTabToken) {
    btnSaveTabToken.addEventListener('click', () => {
      handleSaveToken(inputTabToken.value);
    });
  }
}

// Bootstrap Application
document.addEventListener('DOMContentLoaded', async () => {
  refreshIcons();
  setupEventListeners();
  await loadCategories();
  await loadSummary();
  await loadTransactions();
  await checkWhatsAppStatus();
  initSSE();

  // Load token settings on startup
  try {
    const res = await fetch('/api/settings');
    const json = await res.json();
    if (json.success && json.data) {
      const token = json.data.fonnte_token || 'BfMDrng3jS2CkudCyhW9';
      const phone = json.data.bot_phone || '089639386199';
      const inputTab = document.getElementById('inputTabToken');
      if (inputTab) inputTab.value = token;
      const phoneEl = document.getElementById('tabTokenPhone');
      if (phoneEl) phoneEl.textContent = phone;
    }
  } catch (e) {}

  // Periodic WA status poll
  setInterval(checkWhatsAppStatus, 8000);

  // Auto poll for transactions & summary so WhatsApp messages sync in real-time
  setInterval(() => {
    loadSummary();
    loadTransactions();
  }, 12000);
});
