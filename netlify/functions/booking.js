// netlify/functions/booking.js
// Netlify Function — handle form booking → Airtable
// API key tersimpan di environment variable Netlify, tidak kelihatan di browser

exports.handler = async (event) => {
  // Hanya terima POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Ambil environment variable dari Netlify dashboard
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
  const AIRTABLE_TABLE = 'Janji Temu';

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Konfigurasi server belum lengkap.' }),
    };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Data tidak valid.' }),
    };
  }

  // Validasi field wajib
  const required = ['nama', 'wa', 'usia', 'tipe_pasien', 'layanan', 'tanggal', 'waktu'];
  for (const field of required) {
    if (!data[field]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Field '${field}' wajib diisi.` }),
      };
    }
  }

  // Kirim ke Airtable
  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Nama Pasien':        data.nama,
            'No. WhatsApp':       data.wa,
            'Usia':               parseInt(data.usia),
            'Tipe Pasien':        data.tipe_pasien,
            'Layanan':            data.layanan,
            'Tanggal Diinginkan': data.tanggal,
            'Waktu Preferensi':   data.waktu,
            'Keluhan / Catatan':  data.catatan || '',
            'Status':             'Menunggu Konfirmasi',
            'Tgl Submit':         new Date().toISOString(),
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error?.message || 'Airtable error');
    }

    const result = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, id: result.id }),
    };

  } catch (err) {
    console.error('Airtable error:', err.message);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Gagal menyimpan data. Silakan coba lagi.' }),
    };
  }
};
