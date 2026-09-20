# 💰 CatatDuit - Web Keuangan Otomatis Terintegrasi WhatsApp

Aplikasi pencatatan keuangan pribadi modern berbasis web yang secara otomatis mencatat pengeluaran dan pemasukan langsung dari pesan WhatsApp. Dilengkapi dengan parser pesan natural bahasa Indonesia, bot auto-reply dua arah, analitik realtime (Chart.js), dan simulator interaktif langsung di dashboard.

![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg)
![WhatsApp](https://img.shields.io/badge/WhatsApp-Baileys%20MultiDevice-25D366.svg)

---

## ✨ Fitur Utama

- 🧠 **Smart Indonesian NLP Parser**:
  - Mengenali format pesan sehari-hari seperti:
    - `"beli baso 15rb"` atau `"beli maso 15000"` ➔ Otomatis dicatat sebagai **Pengeluaran Rp 15.000 (Makanan & Minuman)**.
    - `"bayar listrik 150.000"` ➔ **Pengeluaran Rp 150.000 (Tagihan & Utilitas)**.
    - `"bensin 35rb"` ➔ **Pengeluaran Rp 35.000 (Transportasi)**.
    - `"gaji bulanan 5jt"` ➔ **Pemasukan Rp 5.000.000 (Gaji & Upah)**.
    - `"dapat transfer 250rb"` ➔ **Pemasukan Rp 250.000 (Transfer & Hadiah)**.
  - Mendukung ragam variasi nominal rupiah: `15rb`, `15k`, `15.000`, `15000`, `1.5jt`, `50 ribu`, `100 rebu`.
  - Klasifikasi kategori otomatis (*Makanan & Minuman, Transportasi, Belanja, Tagihan, Hiburan, Kesehatan, Gaji, dll.*).
- 🤖 **Perintah Interaktif Bot**:
  - `saldo` / `cek saldo` : Menampilkan ringkasan saldo terkini dan arus kas harian.
  - `laporan` : Rekapitulasi bulanan, proporsi pengeluaran per kategori, dan status budget.
  - `batal` : Membatalkan / menghapus catatan transaksi terakhir jika salah kirim.
  - `bantuan` : Menampilkan petunjuk format pesan.
- 📲 **WhatsApp Gateway Dua Arah (Baileys)**:
  - Tautkan akun WhatsApp semudah scan QR Code di dashboard (seperti WhatsApp Web).
  - Bot otomatis membalas konfirmasi catatan + sisa saldo saat pesan diterima.
  - Tanpa biaya langganan API berbayar.
- 📱 **Interactive In-App WA Simulator**:
  - Tampilan simulator chat WhatsApp langsung di dashboard untuk menguji pencatatan tanpa harus scan HP.
- 🌐 **Fintech Dashboard Real-time**:
  - Metrik Utama: Total Saldo (dengan privasi toggle mata), Pemasukan, Pengeluaran, & Batas Anggaran.
  - Grafik Interaktif: Tren harian (Bar Chart) & Proporsi Belanja (Donut Chart) via Chart.js.
  - Manajemen Transaksi: Filter kategori, tipe, rentang tanggal, pencarian instan, tambah/edit manual, tombol **Reset Data**, dan **Ekspor CSV**.
  - Real-time Update via Server-Sent Events (SSE) tanpa perlu refresh browser.
- 🔌 **Webhook Eksternal**:
  - Endpoint `/api/webhook/whatsapp` siap dihubungkan ke gateway pihak ketiga (Fonnte, Twilio, UltraMsg, WAHA, dll.).

---

## 🚀 Panduan Instalasi & Menjalankan

### Prasyarat
- [Node.js](https://nodejs.org/) versi 18 atau lebih baru
- Git

### Langkah Menjalankan

1. **Clone Repositori**:
   ```bash
   git clone https://github.com/japuy/bot.git
   cd bot
   ```

2. **Instal Dependensi**:
   ```bash
   npm install
   ```

3. **Jalankan Aplikasi**:
   ```bash
   npm start
   ```
   *Atau mode pengembangan (auto-reload):*
   ```bash
   npm run dev
   ```

4. **Buka Web Dashboard**:
   Akses di browser:
   👉 `http://localhost:3000`

---

## 📖 Cara Menghubungkan WhatsApp Anda

1. Buka dashboard web di `http://localhost:3000`.
2. Di panel sebelah kanan (**WhatsApp Gateway Hub**), pilih tab **Scan QR WA**.
3. Buka aplikasi **WhatsApp** di smartphone Anda.
4. Buka menu **Titik Tiga** (Android) atau **Pengaturan** (iOS) ➔ **Perangkat Tertaut (Linked Devices)** ➔ **Tautkan Perangkat**.
5. Arahkan kamera smartphone ke QR Code yang muncul di layar dashboard.
6. Selesai! Kini setiap Anda mengirim pesan pengeluaran/pemasukan, bot akan mencatatnya otomatis ke web.

---

## 🛠️ Struktur Proyek

```
wa-finance-tracker/
├── data/
│   └── database.json          # Penyimpanan transaksi & konfigurasi (JSON persistensi)
├── public/
│   ├── css/
│   │   └── style.css          # Desain modern luxury dark fintech & glassmorphism
│   ├── js/
│   │   └── app.js             # Client-side logic, SSE listener, & Chart.js
│   └── index.html             # Tampilan dashboard web utama
├── src/
│   ├── db.js                  # Modul CRUD & query analytics database
│   ├── parser.js              # Smart Indonesian NLP Parser transaksi keuangan
│   ├── server.js              # Express server, REST API, SSE, & Webhook
│   └── whatsapp.js            # WhatsApp client Baileys & QR manager
├── package.json
└── README.md
```

---

## 📄 Lisensi
Proyek ini dibuat untuk kebutuhan personal finance tracking. Bebas dikembangkan dan dimodifikasi.
