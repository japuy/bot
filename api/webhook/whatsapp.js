import { processWhatsAppMessage } from '../../src/parser.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Allow GET for Fonnte Webhook verification
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'Webhook is active and ready!', method: 'GET' });
  }

  try {
    const body = req.body || {};
    const message = body.message || body.text || body.body || body.msg || '';
    const sender = body.sender || body.number || body.from || body.phone || '';

    if (!message || message.trim().length === 0) {
      return res.status(200).json({ reply: 'Pesan kosong' });
    }

    console.log(`[Vercel Webhook] Pesan dari ${sender}: "${message}"`);
    const result = processWhatsAppMessage(message.trim());

    // Response structure expected by Fonnte & other WA providers
    return res.status(200).json({
      reply: result.reply,
      message: result.reply,
      status: result.status,
      success: true
    });
  } catch (err) {
    console.error('[Vercel Webhook Error]:', err);
    return res.status(200).json({
      reply: '⚠️ Terjadi kendala saat memproses catatan keuangan.',
      error: err.message
    });
  }
}
