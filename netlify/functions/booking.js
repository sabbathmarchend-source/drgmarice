// netlify/functions/booking.js
// Netlify Function — handle form booking → Airtable
// Token & Base ID dibaca dari environment variable Netlify:
//   AIRTABLE_TOKEN  → Personal Access Token (scope: data.records:write ke base ini)
//   AIRTABLE_BASE   → Base ID (format: appXXXXXXXXXXXXXX)

const JSON_HEADERS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
  const AIRTABLE_TABLE = 'Janji Temu';

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE) {
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        error: 'Konfigurasi server belum lengkap (env var AIRTABLE_TOKEN / AIRTABLE_BASE belum di-set di Netlify).',
      }),
    };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Data tidak valid.' }),
    };
  }

  // Validasi field wajib
  const required = ['nama', 'wa', 'usia', 'tipe_pasien', 'layanan', 'tanggal', 'waktu'];
  for (const field of required) {
    if (!data[field]) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: `Field '${field}' wajib diisi.` }),
      };
    }
  }

  const usia = Number(data.usia);
  if (!Number.isFinite(usia) || usia < 0 || usia > 120) {
    return {
      statusCode: 400,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Usia tidak valid.' }),
    };
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
          // typecast: Airtable otomatis membuat opsi select baru bila belum ada
          typecast: true,
          fields: {
            'Nama Pasien':        String(data.nama).slice(0, 200),
            'No. WhatsApp':       String(data.wa).slice(0, 30),
            'Usia':               usia,
            'Tipe Pasien':        data.tipe_pasien,
            'Layanan':            data.layanan,
            'Tanggal Diinginkan': data.tanggal,
            'Waktu Preferensi':   data.waktu,
            'Keluhan / Catatan':  String(data.catatan || '').slice(0, 1000),
            'Status':             'Menunggu Konfirmasi',
            'Tgl Submit':         new Date().toISOString(),
          },
        }),
      }
    );

    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Teruskan pesan error asli Airtable supaya mudah didiagnosis
      // (mis. nama field tidak cocok, tipe field salah, token tanpa akses)
      const detail =
        result?.error?.message ||
        (typeof result?.error === 'string' ? result.error : '') ||
        `Airtable HTTP ${res.status}`;
      console.error('Airtable error:', detail);
      return {
        statusCode: 502,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: `Gagal menyimpan ke Airtable: ${detail}` }),
      };
    }

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ success: true, id: result.id }),
    };

  } catch (err) {
    console.error('Function error:', err.message);
    return {
      statusCode: 502,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Gagal menghubungi Airtable. Silakan coba lagi.' }),
    };
  }
};
