export function normalizeAddress(input) {
  if (typeof input !== "string") throw new Error("malformed wallet address");
  const raw = input.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]+$/.test(raw) || raw.length === 0 || raw.length > 64) {
    throw new Error("malformed wallet address");
  }
  return `0x${raw.padStart(64, "0")}`;
}

export function shortAddress(address) {
  const full = normalizeAddress(address);
  return `${full.slice(0, 6)}…${full.slice(-4)}`;
}
