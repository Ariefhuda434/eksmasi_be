const puppeteer = require('puppeteer')
const path = require('path')
const fs = require('fs')

async function generateTicketPDF(order, bannerUrl) {
  const ticketsDir = path.join(__dirname, '..', 'tickets')
  if (!fs.existsSync(ticketsDir)) fs.mkdirSync(ticketsDir)

  const outputPath = path.join(ticketsDir, `ticket-${order.order_id}.pdf`)

  // Read banner as base64 so it works offline in puppeteer
  let bannerBase64 = ''
  try {
    const bannerPath = path.join(__dirname, '..', 'public', 'banner.png') // sesuaikan path
    if (fs.existsSync(bannerPath)) {
      bannerBase64 = 'data:image/png;base64,' + fs.readFileSync(bannerPath).toString('base64')
    }
  } catch (_) {}

  const bannerSrc = bannerBase64 || bannerUrl || ''

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', sans-serif;
      background: #fff;
      width: 640px;
    }

    .ticket {
      width: 600px;
      margin: 20px auto;
      background: #0a0a0a;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid #222;
    }

    /* ── BANNER ── */
    .ticket-banner {
      width: 100%;
      height: 130px;
      object-fit: cover;
      object-position: 45% 50%;
      display: block;
    }

    /* ── HEADER STRIP ── */
    .ticket-header {
      background: #111;
      border-bottom: 1px solid #1e1e1e;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ticket-brand {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 32px;
      color: #fff;
      letter-spacing: 0.08em;
      line-height: 1;
    }

    .ticket-subtitle {
      font-size: 10px;
      color: #555;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin-top: 3px;
    }

    .ticket-verified {
      background: rgba(34,197,94,0.1);
      border: 1px solid rgba(34,197,94,0.3);
      color: #22c55e;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 5px 14px;
      border-radius: 20px;
    }

    /* ── BODY ── */
    .ticket-body {
      padding: 24px;
    }

    /* Order ID row */
    .ticket-id-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #111;
      border: 1px solid #1e1e1e;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 20px;
    }

    .ticket-id-label {
      font-size: 9px;
      color: #444;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      margin-bottom: 4px;
    }

    .ticket-id-value {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 22px;
      color: #fff;
      letter-spacing: 0.08em;
    }

    .ticket-date {
      font-size: 11px;
      color: #444;
      font-family: 'DM Mono', monospace;
      text-align: right;
    }

    /* Info grid */
    .ticket-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 20px;
      margin-bottom: 20px;
    }

    .ticket-field-label {
      font-size: 9px;
      color: #444;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      margin-bottom: 4px;
    }

    .ticket-field-value {
      font-size: 13px;
      color: #ddd;
      font-weight: 500;
    }

    /* Divider */
    .ticket-divider {
      border: none;
      border-top: 1px dashed #1e1e1e;
      margin: 18px 0;
      position: relative;
    }

    /* Notch effect */
    .ticket-divider::before,
    .ticket-divider::after {
      content: '';
      position: absolute;
      top: -10px;
      width: 20px;
      height: 20px;
      background: #0a0a0a;
      border-radius: 50%;
      border: 1px solid #222;
    }
    .ticket-divider::before { left: -34px; }
    .ticket-divider::after  { right: -34px; }

    /* Footer */
    .ticket-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ticket-package {
      background: #fff;
      color: #000;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 6px 16px;
      border-radius: 20px;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 14px;
    }

    .ticket-note {
      font-size: 10px;
      color: #333;
      text-align: right;
      max-width: 200px;
      line-height: 1.6;
    }

    /* Watermark */
    .ticket-watermark {
      background: #060606;
      border-top: 1px solid #111;
      padding: 10px;
      text-align: center;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 11px;
      letter-spacing: 0.3em;
      color: #1e1e1e;
    }
  </style>
</head>
<body>
  <div class="ticket">

    <!-- BANNER -->
    ${bannerSrc ? `<img src="${bannerSrc}" class="ticket-banner" alt="Banner EXMASI" />` : `
    <div style="height:100px; background: linear-gradient(135deg,#111,#0a0a0a); display:flex; align-items:center; justify-content:center;">
      <span style="font-family:'Bebas Neue',sans-serif; font-size:48px; color:#1e1e1e; letter-spacing:.1em;">EXMASI</span>
    </div>`}

    <!-- HEADER -->
    <div class="ticket-header">
      <div>
        <div class="ticket-brand">EXMASI</div>
        <div class="ticket-subtitle">Art Exhibition · Vol III · E-Ticket Resmi</div>
      </div>
      <div class="ticket-verified">✓ Verified</div>
    </div>

    <!-- BODY -->
    <div class="ticket-body">

      <!-- ORDER ID -->
      <div class="ticket-id-row">
        <div>
          <div class="ticket-id-label">Nomor Tiket</div>
          <div class="ticket-id-value">${order.order_id}</div>
        </div>
        <div class="ticket-date">
          ${new Date(order.created_at || Date.now()).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>

      <!-- INFO GRID -->
      <div class="ticket-grid">
        <div>
          <div class="ticket-field-label">Nama Peserta</div>
          <div class="ticket-field-value">${order.name}</div>
        </div>
        <div>
          <div class="ticket-field-label">Email</div>
          <div class="ticket-field-value">${order.email}</div>
        </div>
        <div>
          <div class="ticket-field-label">No. Telepon</div>
          <div class="ticket-field-value">${order.phone}</div>
        </div>
        <div>
          <div class="ticket-field-label">Paket</div>
          <div class="ticket-field-value">${order.package_id || '—'}</div>
        </div>
        ${order.note ? `
        <div style="grid-column: span 2">
          <div class="ticket-field-label">Catatan</div>
          <div class="ticket-field-value">${order.note}</div>
        </div>` : ''}
      </div>

      <!-- DIVIDER -->
      <div class="ticket-divider"></div>

      <!-- FOOTER -->
      <div class="ticket-footer">
        <div class="ticket-package">${order.package_id || 'TICKET'}</div>
        <div class="ticket-note">
          Tunjukkan tiket ini saat<br>registrasi di lokasi acara.<br>
          <strong style="color:#555">27 June 2026 · Taman Budaya</strong>
        </div>
      </div>
    </div>

    <!-- WATERMARK -->
    <div class="ticket-watermark">
      EXMASI · OFFICIAL TICKET · ${order.order_id}
    </div>

  </div>
</body>
</html>
  `

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  await page.pdf({
    path: outputPath,
    width: '640px',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  })
  await browser.close()

  return outputPath
}

module.exports = { generateTicketPDF }