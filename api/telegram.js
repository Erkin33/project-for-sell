// Vercel serverless: /api/telegram.js
export default async function handler(req, res) {
  const allow = process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || ['*'];
  const reqOrigin = req.headers.origin || '';
  const corsOrigin = allow.includes('*') ? '*' : (allow.includes(reqOrigin) ? reqOrigin : 'null');

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(s => s.trim()).filter(Boolean);

  if (!TOKEN || CHAT_IDS.length === 0) {
    return res.status(500).json({ ok: false, error: 'Misconfigured env' });
  }

  try {
    const body = req.body || await readJson(req);
    // простая антибот-проверка (honeypot)
    if (body.honeypot) return res.status(200).json({ ok: true, skipped: true });

    const S = v => String(v ?? '').replace(/[`<>\r\t]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    const clip = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

    const formName    = S(body.form || 'Форма заявки');
    const name        = S(body.username || body.name);
    const phone       = S(body.phone   || body.tel);
    const email       = S(body.email   || body.useremail);
    const collectType = S(body.collectType || 'Не указано');
    const msg         = S(body.message || body.comment);

    const metaUrl = S(body.page || body.url);
    const ua      = S(body.ua);

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

    const tgPayload = (chat_id) => ({
      chat_id,
      text,
      disable_web_page_preview: true
    });

    // Шлём во все chat_id (если перечислены)
    const results = [];
    for (const chatId of CHAT_IDS) {
      const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tgPayload(chatId))
      });
      const j = await r.json();
      if (!j.ok) {
        results.push({ chatId, ok: false, error: j.description || 'telegram error' });
      } else {
        results.push({ chatId, ok: true });
      }
    }

    const allOk = results.every(r => r.ok);
    return res.status(allOk ? 200 : 502).json({ ok: allOk, results });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'Unknown error' });
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8') || '{}';
  try { return JSON.parse(raw); } catch { return {}; }
}
