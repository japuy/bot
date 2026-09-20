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

// Generic WhatsApp Webhook for third-party providers (Fonnte, Twilio, Waha, etc.)
app.post('/api/webhook/whatsapp', (req, res) => {
  try {
    // Handle various payload structures from third-party WA providers
    const message = req.body.message || req.body.text || req.body.body || req.body.caption || '';
    const sender = req.body.sender || req.body.from || req.body.phone || 'External Gateway';

    if (!message) {
      return res.json({ success: true, message: 'No text found in payload' });
    }

    const result = processWhatsAppMessage(message);

    broadcast('new_message', {
      sender,
      text: message,
      fromMe: false,
      result
    });

    if (result.status === 'success' && result.transaction) {
      broadcast('transaction_added', result.transaction);
    } else if (result.status === 'command' && result.deleted) {
      broadcast('transaction_deleted', result.deleted);
    }

    // Return response in format useful for webhook auto-reply
    res.json({
      success: true,
      reply: result.reply,
      status: result.status
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Express server
const server = app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 CatatDuit Finance Web App running!`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}`);
  console.log(`📡 WA Webhook: http://localhost:${PORT}/api/webhook/whatsapp`);
  console.log(`========================================\n`);

  // Auto initialize WhatsApp manager
  initWhatsApp();
});
