export function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function avatarColor(seed: number | string): string {
  const colors = [
    "from-violet-500 to-cyan-400",
    "from-pink-500 to-violet-500",
    "from-cyan-500 to-emerald-400",
    "from-amber-400 to-orange-500",
    "from-emerald-400 to-cyan-500",
    "from-fuchsia-500 to-pink-500",
    "from-blue-500 to-violet-500",
  ];
  const n = typeof seed === "number" ? seed : seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return colors[Math.abs(n) % colors.length];
}

export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z"));
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "вчера";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export function previewText(type: string | null, text: string | null): string {
  if (type === "image") return "📷 Фото";
  if (type === "video") return "🎬 Видео";
  if (type === "circle") return "⭕ Видеосообщение";
  if (type === "voice") return "🎤 Голосовое";
  if (type === "file") return "📎 Файл";
  if (type === "sticker") return "Стикер";
  if (type === "gift") return "🎁 Подарок";
  return text || "";
}
