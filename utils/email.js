const dns = require('dns')
dns.setDefaultResultOrder('ipv4first')

const nodemailer = require('nodemailer')
const fs = require('fs')
const { generateTicketPDF } = require('./generateTicket')

// ─── Transporter Gmail SMTP via IPv4 ────────────────────────────
const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    family: 4,

    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 60000,

    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },

    tls: {
      servername: 'smtp.gmail.com',
      minVersion: 'TLSv1.2'
    }
  })
}

// ─── Invoice saat order dibuat ──────────────────────────────────
const sendInvoiceEmail = async (order) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('EMAIL_USER atau EMAIL_PASS belum diset di environment variables')
    }

    if (!process.env.FRONTEND_URL) {
      throw new Error('FRONTEND_URL belum diset di environment variables')
    }

    await createTransporter().sendMail({
      from: `"EXMASI TICKET" <${process.env.EMAIL_USER}>`,
      to: order.email,
      subject: `Invoice Tiket EXMASI - ${order.order_id}`,
      html: `
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
    })

    console.log(`EMAIL SUCCESS: Invoice ${order.order_id}`)
  } catch (err) {
    console.error(`EMAIL ERROR (Invoice ${order.order_id}):`, err.message)
    throw err
  }
}

// ─── Tiket PDF saat status → verified ──────────────────────────
const sendTicketEmail = async (order) => {
  let pdfPath

  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('EMAIL_USER atau EMAIL_PASS belum diset di environment variables')
    }

    if (!process.env.FRONTEND_URL) {
      throw new Error('FRONTEND_URL belum diset di environment variables')
    }

    pdfPath = await generateTicketPDF(order)

    await createTransporter().sendMail({
      from: `"EXMASI TICKET" <${process.env.EMAIL_USER}>`,
      to: order.email,
      subject: `E-Tiket EXMASI — ${order.order_id}`,
      html: `
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
      `,
      attachments: [
        {
          filename: `tiket-${order.order_id}.pdf`,
          path: pdfPath
        }
      ]
    })

    console.log(`EMAIL SUCCESS: Ticket ${order.order_id}`)
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