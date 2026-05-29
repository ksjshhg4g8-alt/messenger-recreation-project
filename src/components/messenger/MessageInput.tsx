import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, fileToBase64 } from "@/lib/api";

const EMOJIS = ["😀","😂","😍","🥰","😎","🤔","😭","😡","👍","🙏","🔥","❤️","🎉","💯","👏","🙌","🤣","😅","😉","😴","🤗","😱","🥳","😇","🤩","😋","🫶","💔","✨","⭐"];
const STICKERS = ["🐶","🐱","🦄","🐼","🦊","🐸","🐵","🦁","🐯","🐨","🐰","🐻","🐹","🐧","🦋"];
const GIFTS = ["🎁","💐","🌹","🍰","🎂","🧸","💎","🏆","👑","🍾","🎈","💝"];

interface MessageInputProps {
  chatId: number;
  onSent: () => void;
}

type Panel = "none" | "emoji" | "sticker" | "gift" | "attach";

export default function MessageInput({ chatId, onSent }: MessageInputProps) {
  const [text, setText] = useState("");
  const [panel, setPanel] = useState<Panel>("none");
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = async (payload: Parameters<typeof api.sendMessage>[0]) => {
    await api.sendMessage(payload);
    onSent();
  };

  const sendText = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await send({ chat_id: chatId, type: "text", text: t });
  };

  const uploadAndSend = async (file: File, type: string, folder: string) => {
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      const { url } = await api.uploadMedia(b64, file.type, folder);
      await send({ chat_id: chatId, type, media_url: url, media_meta: { name: file.name, size: file.size } });
    } finally {
      setUploading(false);
      setPanel("none");
    }
  };

  return (
    <div className="border-t border-white/5 bg-black/30 backdrop-blur-xl">
      {panel === "emoji" && (
        <Grid items={EMOJIS} onPick={(e) => setText((t) => t + e)} />
      )}
      {panel === "sticker" && (
        <Grid big items={STICKERS} onPick={(s) => { send({ chat_id: chatId, type: "sticker", text: s }); setPanel("none"); }} />
      )}
      {panel === "gift" && (
        <Grid big items={GIFTS} onPick={(g) => { send({ chat_id: chatId, type: "gift", text: g }); setPanel("none"); }} />
      )}
      {panel === "attach" && (
        <div className="flex gap-3 p-4">
          <AttachBtn icon="Image" label="Фото" color="from-violet-500 to-cyan-400" onClick={() => photoRef.current?.click()} />
          <AttachBtn icon="Video" label="Видео" color="from-pink-500 to-violet-500" onClick={() => videoRef.current?.click()} />
          <AttachBtn icon="FileText" label="Файл" color="from-amber-400 to-orange-500" onClick={() => fileRef.current?.click()} />
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        <button
          onClick={() => setPanel((p) => (p === "attach" ? "none" : "attach"))}
          className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
        >
          <Icon name="Plus" size={22} />
        </button>
        <button
          onClick={() => setPanel((p) => (p === "sticker" ? "none" : "sticker"))}
          className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
          title="Стикеры"
        >
          <Icon name="Sticker" size={20} />
        </button>
        <button
          onClick={() => setPanel((p) => (p === "gift" ? "none" : "gift"))}
          className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
          title="Подарок"
        >
          <Icon name="Gift" size={20} />
        </button>

        <div className="flex-1 flex items-end bg-white/5 border border-white/10 rounded-2xl px-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
            rows={1}
            placeholder={uploading ? "Загрузка..." : "Сообщение..."}
            className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-white/30 outline-none resize-none max-h-28"
          />
          <button
            onClick={() => setPanel((p) => (p === "emoji" ? "none" : "emoji"))}
            className="py-2.5 text-white/50 hover:text-white"
          >
            <Icon name="Smile" size={20} />
          </button>
        </div>

        <button
          onClick={sendText}
          disabled={!text.trim()}
          className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 transition neon-glow"
        >
          <Icon name="Send" size={18} />
        </button>
      </div>

      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadAndSend(e.target.files[0], "image", "photos")} />
      <input ref={videoRef} type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && uploadAndSend(e.target.files[0], "video", "videos")} />
      <input ref={fileRef} type="file" hidden onChange={(e) => e.target.files?.[0] && uploadAndSend(e.target.files[0], "file", "files")} />
    </div>
  );
}

function Grid({ items, onPick, big }: { items: string[]; onPick: (s: string) => void; big?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1 p-3 max-h-44 overflow-y-auto border-b border-white/5">
      {items.map((it) => (
        <button
          key={it}
          onClick={() => onPick(it)}
          className={`hover:bg-white/10 rounded-lg transition ${big ? "text-3xl p-2" : "text-2xl p-1.5"}`}
        >
          {it}
        </button>
      ))}
    </div>
  );
}

function AttachBtn({ icon, label, color, onClick }: { icon: string; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white`}>
        <Icon name={icon} size={24} />
      </div>
      <span className="text-xs text-white/60">{label}</span>
    </button>
  );
}
