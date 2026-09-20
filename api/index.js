import express from 'express';
import cors from 'cors';
import { db } from '../src/db.js';
import { processWhatsAppMessage } from '../src/parser.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SSE placeholder for Vercel (serverless doesn't support long-running SSE)
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(`data: ${JSON.stringify({ event: 'connected', data: { time: new Date() } })}\n\n`);
  res.end();
});

// Summary & KPI analytics
app.get('/api/summary', (req, res) => {
  try {
    const { month, year } = req.query;
    const summary = db.getSummary(month, year);
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Transactions list
app.get('/api/transactions', (req, res) => {
  try {
    const { type, category, search, startDate, endDate, limit, offset } = req.query;
    const result = db.getTransactions({ type, category, search, startDate, endDate, limit, offset });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Manual transaction creation
app.post('/api/transactions', (req, res) => {
  try {
    const { type, amount, description, category, created_at } = req.body;
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ success: false, error: 'Nominal tidak valid.' });
    }

    const tx = db.addTransaction({
      type,
      amount,
      description,
      category,
      raw_message: `${type === 'income' ? 'Pemasukan' : 'Pengeluaran'} manual: ${description}`,
      source: 'web',
      created_at
    });

    res.json({ success: true, data: tx, summary: db.getSummary() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update transaction
app.put('/api/transactions/:id', (req, res) => {
  try {
    const updated = db.updateTransaction(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan.' });
    }
    res.json({ success: true, data: updated, summary: db.getSummary() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete transaction
app.delete('/api/transactions/:id', (req, res) => {
  try {
    const deleted = db.deleteTransaction(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan.' });
    }
    res.json({ success: true, data: deleted, summary: db.getSummary() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear all transactions
app.post('/api/transactions/clear-all', (req, res) => {
  try {
    const count = db.clearAllTransactions();
    res.json({ success: true, message: `${count} transaksi berhasil dibersihkan.`, summary: db.getSummary() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Categories & Settings
app.get('/api/categories', (req, res) => {
  res.json({ success: true, data: db.getCategories() });
});

app.get('/api/settings', (req, res) => {
  res.json({ success: true, data: db.getSettings() });
});

app.put('/api/settings', (req, res) => {
  try {
    const updated = db.updateSettings(req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// In-App Simulator
app.post('/api/simulate-chat', (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Pesan tidak boleh kosong.' });
    }

    const result = processWhatsAppMessage(message.trim());
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// WhatsApp Status for Vercel
app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'connected',
      userName: 'Fonnte Cloud Gateway',
      userPhone: '089639386199',
      qrCodeDataUrl: null
    }
  });
});

// Helper: Kirim pesan balasan via Fonnte API
async function sendFonnte(target, replyText) {
  const token = process.env.FONNTE_TOKEN || 'BfMDrng3jS2CkudCyhW9';
  if (!target || !replyText) return null;
  try {
    const cleanTarget = String(target).replace(/[^0-9]/g, '');
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target: cleanTarget,
        message: replyText
      })
    });
    const data = await res.json().catch(() => ({}));
    console.log(`[Fonnte Auto-Reply to ${cleanTarget}]:`, data);
    return data;
  } catch (err) {
    console.error(`[Fonnte Auto-Reply Error to ${target}]:`, err.message);
    return null;
  }
}

// Webhook GET & POST
app.get('/api/webhook/whatsapp', (req, res) => {
  res.status(200).json({ status: 'Webhook is active and ready!', method: 'GET' });
});

app.post('/api/webhook/whatsapp', async (req, res) => {
  try {
    // Fonnte payload: { message: "beli baso 15rb", pesan: "beli baso 15rb", sender: "628...", pengirim: "628..." }
    let message = req.body.message || req.body.pesan || '';
    if (!message && req.body.text && req.body.text !== 'non-button message') {
      message = req.body.text;
    }
    if (!message) {
      message = req.body.body || req.body.caption || req.body.msg || '';
    }

    const sender = req.body.sender || req.body.number || req.body.pengirim || req.body.from || req.body.phone || '';

    if (!message || message.trim().length === 0) {
      return res.json({ reply: 'Pesan tidak ditemukan' });
    }

    console.log(`[Webhook Incoming] from ${sender}: "${message}"`);
    const result = processWhatsAppMessage(message.trim());

    // Send WhatsApp Reply via Fonnte API
    if (sender && result.reply) {
      await sendFonnte(sender, result.reply);
    }

    // Return format for Fonnte
    res.json({
      reply: result.reply,
      message: result.reply,
      status: result.status,
      success: true
    });
  } catch (err) {
    console.error('[Webhook Error]:', err);
    res.status(500).json({ reply: 'Terjadi kesalahan sistem' });
  }
});

export default app;
