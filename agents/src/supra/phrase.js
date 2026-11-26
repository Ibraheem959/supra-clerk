function numbers(text) {
  return String(text).match(/\d[\d,]*(?:\.\d+)?/g) || [];
}

export async function phrase(facts) {
  const key = process.env.LLM_API_KEY;
  if (!key) return { text: facts, writer: "facts" };
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
          { role: "system", content: "Rewrite only the facts you are given. Do not add a number, a price, a name, or a transaction that is not already in the facts." },
          { role: "user", content: facts },
        ],
      }),
    });
    if (!response.ok) return { text: facts, writer: "facts" };
    const body = await response.json();
    const text = body?.choices?.[0]?.message?.content || "";
    if (!text) return { text: facts, writer: "facts" };
    const invented = numbers(text).some((value) => !facts.includes(value));
    if (invented) return { text: facts, writer: "rejected" };
    return { text, writer: "model", model };
  } catch {
    return { text: facts, writer: "facts" };
  }
}
