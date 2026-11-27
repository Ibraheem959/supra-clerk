function numbers(text) {
  return String(text).match(/\d[\d,]*(?:\.\d+)?/g) || [];
}

function known(value, facts) {
  const plain = value.replace(/,/g, "");
  return facts.includes(value) || facts.includes(plain);
}

export async function phrase(facts) {
  const key = process.env.LLM_API_KEY;
  if (!key) return { text: facts, writer: "facts", reason: "No key is set." };
  const base = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: "Rewrite only the facts you are given. Do not add a number, a price, a name, or a transaction that is not already in the facts. Keep every figure exactly as written." },
          { role: "user", content: facts },
        ],
      }),
    });
    if (!response.ok) {
      let message = "";
      try {
        const body = await response.json();
        message = String(body?.error?.message || body?.error || "").slice(0, 160);
      } catch { /* a non-JSON error still has a status */ }
      message = message.replace(/sk-[a-z0-9_-]+/gi, "[key]");
      return { text: facts, writer: "facts", reason: `The model call failed (${response.status}${message ? `: ${message}` : ""}).` };
    }
    const body = await response.json();
    const text = body?.choices?.[0]?.message?.content || "";
    if (!text) return { text: facts, writer: "facts", reason: "The model returned an empty reply." };
    const invented = numbers(text).filter((value) => !known(value, facts));
    if (invented.length) return { text: facts, writer: "rejected", reason: "The model added a figure that was not in the facts. That draft was discarded." };
    return { text, writer: "model", model };
  } catch {
    return { text: facts, writer: "facts", reason: "The model host did not answer." };
  }
}
