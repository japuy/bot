import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { processWhatsAppMessage } from './parser.js';
import {
  initWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
  addEventListener,
  broadcast
} from './whatsapp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Server-Sent Events for real-time dashboard updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial ping
  res.write(`data: ${JSON.stringify({ event: 'connected', data: { time: new Date() } })}\n\n`);

  const removeListener = addEventListener(({ event, data }) => {
    res.write(`data: ${JSON.stringify({ event, data })}\n\n`);
  });

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    removeListener();
  });
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

// Transactions list with filters & pagination
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

    broadcast('transaction_added', tx);
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
    broadcast('transaction_updated', updated);
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
    broadcast('transaction_deleted', deleted);
    res.json({ success: true, data: deleted, summary: db.getSummary() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear all transactions (Fresh reset)
app.post('/api/transactions/clear-all', (req, res) => {
  try {
    const count = db.clearAllTransactions();
    broadcast('transaction_deleted', { all: true });
    res.json({ success: true, message: `${count} transaksi berhasil dibersihkan. Data kini segar seperti baru!`, summary: db.getSummary() });
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
    broadcast('settings_updated', updated);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// WhatsApp Bot Controls & Status
app.get('/api/whatsapp/status', (req, res) => {
  res.json({ success: true, data: getWhatsAppStatus() });
});

app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    initWhatsApp();
    res.json({ success: true, message: 'Memulai koneksi WhatsApp...' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    await disconnectWhatsApp();
    res.json({ success: true, message: 'WhatsApp berhasil diputus.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// In-App WhatsApp Chat Simulator
app.post('/api/simulate-chat', (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Pesan tidak boleh kosong.' });
    }

    const result = processWhatsAppMessage(message.trim());

    broadcast('new_message', {
      sender: 'simulator@user',
      text: message,
      fromMe: false,
      result
    });

    if (result.status === 'success' && result.transaction) {
      broadcast('transaction_added', result.transaction);
    } else if (result.status === 'command' && result.deleted) {
      broadcast('transaction_deleted', result.deleted);
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: Kirim balasan via Server WhatsApp Pribadi (http://49.0.0.219:2222)
async function sendWhatsAppViaGateway(number, text) {
  const gatewayUrl = process.env.WA_SERVER_URL || 'http://49.0.0.219:2222';
  const token = process.env.WA_SERVER_TOKEN || 'acafdbe8a13b5e6177e0c3a87e512fe6';

  if (!gatewayUrl || !number || !text) return null;

  try {
    const cleanNumber = String(number).replace(/[^0-9]/g, '');
    const res = await fetch(`${gatewayUrl}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Token': token
      },
      body: JSON.stringify({
        number: cleanNumber,
        message: text
      })
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[Gateway] Balasan terkirim ke ${cleanNumber}:`, data);
    return data;
  } catch (err) {
    console.error(`[Gateway] Gagal mengirim pesan ke ${number}:`, err.message);
    return null;
  }
}

// Helper: Kirim balasan via Fonnte API
async function sendFonnte(target, replyText) {
  const settings = db.getSettings();
  const token = settings.fonnte_token || process.env.FONNTE_TOKEN || 'BfMDrng3jS2CkudCyhW9';
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

// Validasi & Simpan Token Fonnte secara Manual
app.post('/api/fonnte/validate', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || !token.trim()) {
      return res.status(400).json({ success: false, error: 'Token tidak boleh kosong' });
    }
    const cleanToken = token.trim();
    const testRes = await fetch('https://api.fonnte.com/device', {
      method: 'POST',
      headers: { 'Authorization': cleanToken }
    });
    const data = await testRes.json().catch(() => ({}));
    if (data.status === false) {
      return res.json({ success: false, error: data.reason || 'Token tidak valid' });
    }
    
    // Simpan token & info bot ke settings db
    db.updateSettings({
      fonnte_token: cleanToken,
      bot_phone: data.device || 'Terhubung',
      bot_name: data.name || 'Bot WA'
    });

    return res.json({
      success: true,
      message: 'Token berhasil divalidasi dan tersimpan!',
      device: data.device,
      name: data.name,
      status: data.device_status,
      quota: data.quota
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Webhook GET verification (wajib untuk verifikasi Fonnte & provider lain)
app.get('/api/webhook/whatsapp', (req, res) => {
  res.status(200).json({ status: 'Webhook is active and ready!', method: 'GET' });
});

// Generic WhatsApp Webhook for external providers & personal WA Server
app.post('/api/webhook/whatsapp', async (req, res) => {
  try {
    // Handle various payload structures from third-party WA providers & custom server
    let message = req.body.message || req.body.pesan || '';
    if (!message && req.body.text && req.body.text !== 'non-button message') {
      message = req.body.text;
    }
    if (!message) {
      message = req.body.body || req.body.caption || req.body.msg || '';
    }

    const sender = req.body.number || req.body.sender || req.body.pengirim || req.body.from || req.body.phone || req.body.chatId || '';

    if (!message || message.trim().length === 0) {
      return res.json({ success: true, message: 'No text found in payload' });
    }

    // Abaikan pesan balasan bot sendiri
    if (
      message.includes('CATATAN DISIMPAN') ||
      message.includes('INFORMASI SALDO') ||
      message.includes('LAPORAN KEUANGAN') ||
      message.includes('TRANSAKSI BERHASIL DIBATALKAN') ||
      message.includes('PANDUAN CATAT DUIT') ||
      message.includes('fonnte.com')
    ) {
      return res.json({ success: true, message: 'Ignored bot echo message' });
    }

    console.log(`[Webhook] Pesan masuk dari ${sender}: "${message}"`);
    const result = processWhatsAppMessage(message.trim());

    broadcast('new_message', {
      sender: sender || 'External Gateway',
      text: message,
      fromMe: false,
      result
    });

    if (result.status === 'success' && result.transaction) {
      broadcast('transaction_added', result.transaction);
    } else if (result.status === 'command' && result.deleted) {
      broadcast('transaction_deleted', result.deleted);
    }

    // Auto send reply via custom WhatsApp Server & Fonnte
    if (sender && result.reply) {
      await sendWhatsAppViaGateway(sender, result.reply);
      await sendFonnte(sender, result.reply);
    }

    // Return response in format useful for Fonnte & webhook auto-reply
    res.json({
      reply: result.reply,
      message: result.reply,
      success: true,
      status: result.status
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Express server only when running standalone (not inside Vercel serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 CatatDuit Finance Web App running!`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`📡 WA Webhook: http://localhost:${PORT}/api/webhook/whatsapp`);
    console.log(`========================================\n`);

    // Auto initialize WhatsApp manager
    initWhatsApp();
  });
}

export default app;
