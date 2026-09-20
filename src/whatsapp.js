import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { processWhatsAppMessage } from './parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.join(__dirname, '..', 'data', 'auth_info_baileys');

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let sock = null;
let currentQR = null;
let connectionState = {
  status: 'disconnected', // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
  userPhone: null,
  userName: null,
  lastUpdated: new Date().toISOString()
};

const listeners = [];

export function addEventListener(listener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export function broadcast(event, data) {
  listeners.forEach(fn => {
    try {
      fn({ event, data });
    } catch (e) {
      console.error('Error in SSE listener:', e);
    }
  });
}

export function getWhatsAppStatus() {
  return {
    ...connectionState,
    qrCodeDataUrl: currentQR
  };
}

export async function initWhatsApp() {
  try {
    const baileysModule = await import('@whiskeysockets/baileys');
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileysModule;
    const pino = (await import('pino')).default;

    console.log('[WA] Starting WhatsApp connection manager...');
    connectionState.status = 'connecting';
    connectionState.lastUpdated = new Date().toISOString();
    broadcast('status_update', getWhatsAppStatus());

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    let version = [2, 3000, 1015901307];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v && v.version) version = v.version;
    } catch (e) {
      // fallback to default version
    }

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['CatatDuit Finance', 'Chrome', '120.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('[WA] QR Code received');
        try {
          currentQR = await QRCode.toDataURL(qr, { margin: 2, scale: 7 });
          connectionState.status = 'qr_ready';
          connectionState.lastUpdated = new Date().toISOString();
          broadcast('status_update', getWhatsAppStatus());
        } catch (err) {
          console.error('[WA] Failed to generate QR data URL:', err);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log('[WA] Connection closed, reason code:', statusCode, 'shouldReconnect:', shouldReconnect);
        
        currentQR = null;
        connectionState.status = 'disconnected';
        connectionState.userPhone = null;
        connectionState.userName = null;
        connectionState.lastUpdated = new Date().toISOString();
        broadcast('status_update', getWhatsAppStatus());

        if (shouldReconnect) {
          setTimeout(() => initWhatsApp(), 5000);
        }
      } else if (connection === 'open') {
        console.log('[WA] Connection opened successfully!');
        currentQR = null;
        connectionState.status = 'connected';
        connectionState.userPhone = sock?.user?.id?.split(':')[0] || 'Unknown';
        connectionState.userName = sock?.user?.name || 'My WhatsApp';
        connectionState.lastUpdated = new Date().toISOString();
        broadcast('status_update', getWhatsAppStatus());
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        // Skip status broadcast
        if (msg.key.remoteJid === 'status@broadcast') continue;

        // Extract message text from various types
        const messageContent = msg.message;
        if (!messageContent) continue;

        const text =
          messageContent.conversation ||
          messageContent.extendedTextMessage?.text ||
          messageContent.imageMessage?.caption ||
          '';

        if (!text || text.trim().length === 0) continue;

        console.log(`[WA] Incoming message from ${msg.key.remoteJid}: "${text}"`);

        // Process message with NLP Parser
        const result = processWhatsAppMessage(text);

        // Broadcast to dashboard frontend
        broadcast('new_message', {
          sender: msg.key.remoteJid,
          text,
          fromMe: msg.key.fromMe,
          result
        });

        if (result.status === 'success' && result.transaction) {
          broadcast('transaction_added', result.transaction);
        } else if (result.status === 'command' && result.deleted) {
          broadcast('transaction_deleted', result.deleted);
        }

        // Send reply back via WhatsApp if socket is open
        if (sock && connectionState.status === 'connected' && result.reply) {
          try {
            await sock.sendMessage(msg.key.remoteJid, { text: result.reply }, { quoted: msg });
            console.log(`[WA] Reply sent to ${msg.key.remoteJid}`);
          } catch (err) {
            console.error('[WA] Failed to send reply message:', err);
          }
        }
      }
    });

  } catch (error) {
    console.error('[WA] Error initializing WhatsApp module:', error);
    connectionState.status = 'disconnected';
    connectionState.lastUpdated = new Date().toISOString();
    broadcast('status_update', getWhatsAppStatus());
  }
}

export async function disconnectWhatsApp() {
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      // ignore
    }
    sock = null;
  }
  // Clear auth directory
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    console.error('Failed to clear auth dir:', e);
  }
  currentQR = null;
  connectionState = {
    status: 'disconnected',
    userPhone: null,
    userName: null,
    lastUpdated: new Date().toISOString()
  };
  broadcast('status_update', getWhatsAppStatus());
  return true;
}
