export async function readFeed(requestPage, { maxPages = 8 } = {}) {
  const rows = [];
  const seen = new Set();
  let start = "";
  let pages = 0;
  let complete = false;
  const cap = Math.max(1, Math.min(maxPages, 25));
  while (pages < cap) {
    const { body, cursor } = await requestPage(start);
    pages += 1;
    const page = Array.isArray(body) ? body : [];
    for (const tx of page) {
      const hash = tx?.hash;
      if (hash && seen.has(hash)) continue;
      if (hash) seen.add(hash);
      rows.push(tx);
    }
    const ended = cursor === undefined || cursor === null || cursor === "";
    if (ended) {
      complete = true;
      break;
    }
    if (String(cursor) === start) break;
    start = String(cursor);
  }
  return { transactions: rows, pages, records: rows.length, complete };
}
