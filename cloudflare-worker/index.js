
export default {
  async fetch(request, env) {
    const TELEGRAM_TOKEN = env.TELEGRAM_TOKEN;
    const body = await request.json();
    const msg = body.message;
    if (!msg?.text) return new Response("no_text", { status: 200 });

    const chatId = msg.chat.id;
    const rawText = msg.text.trim();
    const lowered = rawText.toLowerCase();

    const mode = lowered.startsWith("обновить") || lowered.startsWith("изменить")
      ? "update"
      : lowered.startsWith("добавить")
      ? "add"
      : "new";

    const text = rawText.replace(/^(обновить|изменить|добавить)/i, "").trim();

    const words = text
      .replace(/(\d)([а-яa-z])/gi, "$1 $2")
      .replace(/([а-яa-z])(\d)/gi, "$1 $2")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w);

    const cheesesList = ["буррата", "страчателла", "моцарелла"];
    const cheeses = [];
    const used = new Set();

    for (let i = 0; i < words.length - 1; i++) {
      const qty = parseInt(words[i]);
      const name = words[i + 1]?.toLowerCase();
      if (!isNaN(qty) && cheesesList.includes(name)) {
        cheeses.push({ qty, name });
        used.add(i);
        used.add(i + 1);
      }
    }

    let remainingWords = words.filter((_, i) => !used.has(i));
    const deliveryDate = extractDate(remainingWords) || getNextDeliveryDate();
    const sheet = formatSheetDate(deliveryDate);

    remainingWords = remainingWords.filter((w) => !/^\d{1,2}\.\d{1,2}$/.test(w));
    const client = remainingWords.join(" ").toLowerCase().trim();

    let clients = [];
    try {
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/syrcrm/databases/(default)/documents/clients?key=${env.FIREBASE_KEY}`
      );
      const data = await res.json();
      clients = (data.documents || [])
        .map((d) => d.fields?.name?.stringValue?.toLowerCase().trim())
        .filter(Boolean);
    } catch (e) {
      await sendMsg(chatId, `❌ Ошибка при получении клиентов:\n${e}`, TELEGRAM_TOKEN);
      return new Response("error", { status: 500 });
    }

    const clientExists = clients.includes(client);
    const closest = findClosest(client, clients);

    if (!clientExists) {
      const suggestion = closest
        ? `Возможно, вы имели в виду: "${closest}"?`
        : "Проверьте написание названия клиента.";
      await sendMsg(chatId, `⚠️ Клиент "${client}" не найден.\n${suggestion}`, TELEGRAM_TOKEN);
      return new Response("client_not_found", { status: 200 });
    }

    return new Response("ok", { status: 200 });
  },
};

async function sendMsg(chatId, text, token) {
  await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    }
  );
}

function formatSheetDate(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}.${m}`;
}

function getNextDeliveryDate() {
  const today = new Date();
  const weekdays = [1, 3, 5];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    if (weekdays.includes(date.getDay())) return date;
  }
  return today;
}

function extractDate(words) {
  for (const w of words) {
    const [d, m] = w.split(".");
    if (!d || !m) continue;
    const day = parseInt(d);
    const month = parseInt(m);
    if (isNaN(day) || isNaN(month)) continue;
    const year = new Date().getFullYear();
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

function findClosest(input, list) {
  let best = null, min = Infinity;
  for (const item of list) {
    const dist = levenshtein(input, item);
    if (dist < min) {
      min = dist;
      best = item;
    }
  }
  return min <= 2 ? best : null;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
    }
  }
  return dp[m][n];
}
