const { google } = require('googleapis')
const fs = require('fs')
const path = require('path')
const { generateTicketPDF } = require('./generateTicket')

// ─── Validate Env ───────────────────────────────────────────────
const validateEmailEnv = () => {
  const required = [
    'EMAIL_USER',
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN',
    'FRONTEND_URL'
  ]

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`${key} belum diset di environment variables`)
    }
  }
}

// ─── Gmail API Client ───────────────────────────────────────────
const getGmailClient = () => {
  validateEmailEnv()

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  )

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
  })

  return google.gmail({
    version: 'v1',
    auth: oauth2Client
  })
}

// ─── Encode base64url ───────────────────────────────────────────
const encodeBase64Url = (input) => {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

const encodeBufferBase64 = (buffer) => {
  return buffer.toString('base64')
}

// ─── Escape Subject / Header Safety ─────────────────────────────
const sanitizeHeader = (value = '') => {
  return String(value).replace(/[\r\n]/g, ' ').trim()
}

// ─── Send HTML Email without Attachment ─────────────────────────
const sendGmailHtml = async ({ to, subject, html }) => {
  const gmail = getGmailClient()

  const from = `EXMASI TICKET <${process.env.EMAIL_USER}>`

  const message = [
    `From: ${from}`,
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${sanitizeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html
  ].join('\r\n')

  const raw = encodeBase64Url(message)

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw
    }
  })

  return result.data
}

// ─── Send HTML Email with PDF Attachment ────────────────────────
const sendGmailHtmlWithAttachment = async ({ to, subject, html, attachmentPath, attachmentName }) => {
  const gmail = getGmailClient()

  const from = `EXMASI TICKET <${process.env.EMAIL_USER}>`
  const boundary = `exmasi_boundary_${Date.now()}`
  const pdfBuffer = fs.readFileSync(attachmentPath)
  const pdfBase64 = encodeBufferBase64(pdfBuffer)

  const message = [
    `From: ${from}`,
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${sanitizeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    html,
    '',
    `--${boundary}`,
    'Content-Type: application/pdf',
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${sanitizeHeader(attachmentName)}"`,
    '',
    pdfBase64.match(/.{1,76}/g)?.join('\r\n') || pdfBase64,
    '',
    `--${boundary}--`
  ].join('\r\n')

  const raw = encodeBase64Url(message)

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw
    }
  })

  return result.data
}

// ─── Invoice saat order dibuat ──────────────────────────────────
const sendInvoiceEmail = async (order) => {
  try {
    const html = `
      <div style="font-family: Arial; padding: 20px; max-width: 600px">
        <h2 style="color: #b91c1c">Invoice Pemesanan Tiket EXMASI</h2>

        <p>Halo <b>${order.name}</b>,</p>
        <p>Terima kasih sudah memesan! Berikut detail pesananmu:</p>

        <hr/>

        <table style="width:100%; border-collapse:collapse; font-size:14px">
          <tr>
            <td style="padding:6px 0"><b>Order ID</b></td>
            <td>${order.order_id}</td>
          </tr>
          <tr>
            <td style="padding:6px 0"><b>Paket</b></td>
            <td>${order.package_id}</td>
          </tr>
          <tr>
            <td style="padding:6px 0"><b>Nama</b></td>
            <td>${order.name}</td>
          </tr>
          <tr>
            <td style="padding:6px 0"><b>WhatsApp</b></td>
            <td>${order.phone}</td>
          </tr>
          <tr>
            <td style="padding:6px 0"><b>Status</b></td>
            <td style="color:orange"><b>PENDING</b></td>
          </tr>
        </table>

        <hr/>

        <p><b>Langkah selanjutnya:</b></p>
        <ol>
          <li>Lakukan pembayaran</li>
          <li>Upload bukti bayar di halaman order</li>
          <li>Tunggu konfirmasi admin</li>
        </ol>

        <a href="${process.env.FRONTEND_URL}/order/${order.order_id}"
           style="display:inline-block; margin-top:12px; background:#b91c1c;
                  color:white; padding:10px 24px; border-radius:20px;
                  text-decoration:none; font-weight:bold">
          Lihat Detail Order →
        </a>

        <p style="color:gray; font-size:11px; margin-top:20px">
          Email ini otomatis dikirim oleh sistem EXMASI
        </p>
      </div>
    `

    const result = await sendGmailHtml({
      to: order.email,
      subject: `Invoice Tiket EXMASI - ${order.order_id}`,
      html
    })

    console.log(`EMAIL SUCCESS: Invoice ${order.order_id}`, result)
  } catch (err) {
    console.error(`EMAIL ERROR (Invoice ${order.order_id}):`, err.message)
    throw err
  }
}

// ─── Tiket PDF saat status → verified ──────────────────────────
const sendTicketEmail = async (order) => {
  let pdfPath

  try {
    pdfPath = await generateTicketPDF(order)

    const html = `
      <div style="font-family: Arial; padding: 20px; max-width: 600px">
        <h2 style="color: #16a34a">Pembayaran Terverifikasi!</h2>

        <p>Halo <b>${order.name}</b>,</p>
        <p>Pembayaranmu sudah kami verifikasi. E-Tiket resmi terlampir di email ini.</p>

        <hr/>

        <table style="width:100%; border-collapse:collapse; font-size:14px">
          <tr>
            <td style="padding:6px 0"><b>Nomor Tiket</b></td>
            <td style="color:#d97706; font-weight:bold">${order.order_id}</td>
          </tr>
          <tr>
            <td style="padding:6px 0"><b>Nama</b></td>
            <td>${order.name}</td>
          </tr>
          <tr>
            <td style="padding:6px 0"><b>Paket</b></td>
            <td>${order.package_id}</td>
          </tr>
          <tr>
            <td style="padding:6px 0"><b>Status</b></td>
            <td style="color:#16a34a"><b>✓ VERIFIED</b></td>
          </tr>
        </table>

        <hr/>

        <p style="background:#f0fdf4; border-left:4px solid #16a34a; padding:12px; border-radius:4px; font-size:14px">
          Tunjukkan file PDF terlampir saat registrasi di lokasi acara.
        </p>

        <a href="${process.env.FRONTEND_URL}/order/${order.order_id}"
           style="display:inline-block; margin-top:16px; background:#16a34a;
                  color:white; padding:10px 24px; border-radius:20px;
                  text-decoration:none; font-weight:bold">
          Lihat Status Order →
        </a>

        <p style="color:gray; font-size:11px; margin-top:20px">
          Email ini otomatis dikirim oleh sistem EXMASI
        </p>
      </div>
    `

    const result = await sendGmailHtmlWithAttachment({
      to: order.email,
      subject: `E-Tiket EXMASI — ${order.order_id}`,
      html,
      attachmentPath: pdfPath,
      attachmentName: `tiket-${order.order_id}.pdf`
    })

    console.log(`EMAIL SUCCESS: Ticket ${order.order_id}`, result)
  } catch (err) {
    console.error(`EMAIL ERROR (Ticket ${order.order_id}):`, err.message)
    throw err
  } finally {
    if (pdfPath && fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath)
    }
  }
}

module.exports = { sendInvoiceEmail, sendTicketEmail }