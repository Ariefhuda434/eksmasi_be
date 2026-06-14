const { Resend } = require('resend')
const fs = require('fs')
const { generateTicketPDF } = require('./generateTicket')

const resend = new Resend(process.env.RESEND_API_KEY)

const validateEmailEnv = () => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY belum diset di environment variables')
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error('EMAIL_FROM belum diset di environment variables')
  }

  if (!process.env.FRONTEND_URL) {
    throw new Error('FRONTEND_URL belum diset di environment variables')
  }
}

// ─── Invoice saat order dibuat ──────────────────────────────────
const sendInvoiceEmail = async (order) => {
  try {
    validateEmailEnv()

    await resend.emails.send({
      from: process.env.EMAIL_FROM,
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
    validateEmailEnv()

    pdfPath = await generateTicketPDF(order)
    const pdfBuffer = fs.readFileSync(pdfPath)

    await resend.emails.send({
      from: process.env.EMAIL_FROM,
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
          content: pdfBuffer
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