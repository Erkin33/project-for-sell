// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// ---- CORS ----
const allow = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(s => s.trim());
const corsOpts = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl/postman
    if (allow.includes('*') || allow.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'), false);
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
};
app.use(cors(corsOpts));

// ---- body ----
app.use(express.json({ limit: '200kb' }));

// ---- helpers ----
const S = v => String(v ?? '').replace(/[`<>\r\t]/g, ' ').replace(/\s{2,}/g, ' ').trim();
const clip = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

// ---- endpoint ----
app.post('/api/telegram', async (req, res) => {
  try {
    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    if (!TOKEN || CHAT_IDS.length === 0) {
      return res.status(500).json({ ok: false, error: 'Misconfigured env' });
    }

    const body = req.body || {};
    if (body.honeypot) return res.json({ ok: true, skipped: true });

    const formName    = S(body.form || 'Форма заявки');
    const name        = S(body.username || body.name);
    const phone       = S(body.phone || body.tel);
    const email       = S(body.email || body.useremail);
    const collectType = S(body.collectType || 'Не указано');
    const msg         = S(body.message || body.comment);
    const metaUrl     = S(body.page || body.url);
    const ua          = S(body.ua);

    const text = clip([
      '🆕 Новая заявка с сайта',
      `📄 Форма: ${formName}`,
      name  ? `👤 Имя: ${name}` : '',
      phone ? `📞 Телефон: ${phone}` : '',
      email ? `✉️ Email: ${email}` : '',
      `🗂 Тип сбора: ${collectType}`,
      msg ? ['📝 Сообщение:', msg].join('\n') : '',
      metaUrl ? `🔗 Страница: ${metaUrl}` : '',
      ua ? `🖥 UA: ${ua}` : ''
    ].filter(Boolean).join('\n'), 3500);

    const results = [];
    for (const chat_id of CHAT_IDS) {
      const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, disable_web_page_preview: true })
      });
      const j = await r.json();
      results.push({ chatId: chat_id, ok: j.ok, error: j.ok ? undefined : (j.description || 'telegram error') });
    }
    const allOk = results.every(r => r.ok);
    res.status(allOk ? 200 : 502).json({ ok: allOk, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'Unknown error' });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log('TG bridge listening on :' + port);
});
