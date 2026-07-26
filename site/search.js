export function searchIndex(entries, q) {
  const n = String(q ?? '').trim().toLowerCase();
  if (!n) return [];
  return entries.filter(
    (e) =>
      (e.summary ?? '').toLowerCase().includes(n) ||
      (e.topics ?? []).some((t) => t.toLowerCase().includes(n)) ||
      (e.companies ?? []).some((c) => c.toLowerCase().includes(n)),
  );
}

export function convMatches(conv, q) {
  const n = String(q ?? '').trim().toLowerCase();
  if (!n) return false;
  if ((conv.root?.text_plain ?? '').toLowerCase().includes(n)) return true;
  return (conv.posts ?? []).some(
    (p) =>
      (p.own_text ?? '').toLowerCase().includes(n) ||
      (p.chain ?? []).some((m) => (m.text ?? '').toLowerCase().includes(n)),
  );
}
