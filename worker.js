// worker.js
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const body = await request.json();

      // Безопасная санитизация
      const S = (v) => String(v ?? '').replace(/[`<>\x00\r\t]/g, ' ').slice(0, 4000);

      const text =
`🆕 Новая заявка с сайта
📄 Форма: *${S(body.formName || 'Форма')}*
👤 Имя: _${S(body.name)}_
📞 Телефон: _${S(body.phone)}_
✉️ Email: _${S(body.email)}_
🗂 Тип сбора: _${S(body.collectType || 'Не указано')}_
📝 Сообщение:
\`\`\`
${S(body.message)}
\`\`\`
🔗 Страница: ${S(body.page)}
🖥 UA: ${S(body.ua)}`;

      const chatIds = String(env.TG_CHAT_IDS || '')
        .split(',')
        .map(s => Number(s.trim()))
        .filter(n => Number.isFinite(n));

      if (!env.TG_BOT_TOKEN) {
        return Response.json({ success: false, error: 'Missing TG_BOT_TOKEN' }, { status: 500 });
      }
      if (!chatIds.length) {
        return Response.json({ success: false, error: 'No TG_CHAT_IDS configured' }, { status: 500 });
      }

      const api = (method) => `https://api.telegram.org/bot${env.TG_BOT_TOKEN}/${method}`;

      // Шлём всем получателям
      for (const chat_id of chatIds) {
        await fetch(api('sendMessage'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id,
            text,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          })
        });
      }

      return Response.json({ success: true });
    } catch (e) {
      return Response.json({ success: false, error: e.message }, { status: 500 });
    }
  }
}
