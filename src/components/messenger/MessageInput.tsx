import { useRef, useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { api, fileToBase64 } from "@/lib/api";

const EMOJIS = ["😀","😂","😍","🥰","😎","🤔","😭","😡","👍","🙏","🔥","❤️","🎉","💯","👏","🙌","🤣","😅","😉","😴","🤗","😱","🥳","😇","🤩","😋","🫶","💔","✨","⭐"];
const STICKERS = ["🐶","🐱","🦄","🐼","🦊","🐸","🐵","🦁","🐯","🐨","🐰","🐻","🐹","🐧","🦋"];

interface EditTarget {
  id: number;
  text: string;
}

interface MessageInputProps {
  chatId: number;
  onSent: () => void;
  editing?: EditTarget | null;
  onCancelEdit?: () => void;
}

type Panel = "none" | "emoji" | "sticker" | "attach";

export default function MessageInput({ chatId, onSent, editing, onCancelEdit }: MessageInputProps) {
  const [text, setText] = useState("");
  const [panel, setPanel] = useState<Panel>("none");
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setText(editing.text);
  }, [editing]);

  const send = async (payload: Parameters<typeof api.sendMessage>[0]) => {
    await api.sendMessage(payload);
    onSent();
  };

  const sendText = async () => {
    const t = text.trim();
    if (!t) return;
    if (editing) {
      setText("");
      await api.editMessage(editing.id, t);
      onCancelEdit?.();
      onSent();
      return;
    }
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

  const [circle, setCircle] = useState<{ recording: boolean; seconds: number }>({ recording: false, seconds: 0 });
  const circlePreviewRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startCircle = async () => {
    setPanel("none");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorderRef.current = rec;
      rec.start();
      setCircle({ recording: true, seconds: 0 });
      timerRef.current = setInterval(() => setCircle((c) => ({ ...c, seconds: c.seconds + 1 })), 1000);
      setTimeout(() => {
        if (circlePreviewRef.current) circlePreviewRef.current.srcObject = stream;
      }, 100);
    } catch {
      alert("Не удалось получить доступ к камере");
    }
  };

  const stopCircle = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    rec.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const file = new File([blob], `circle-${Date.now()}.webm`, { type: "video/webm" });
      stopStream();
      setCircle({ recording: false, seconds: 0 });
      await uploadAndSend(file, "circle", "circles");
    };
    rec.stop();
  };

  const cancelCircle = () => {
    recorderRef.current?.stop();
    stopStream();
    setCircle({ recording: false, seconds: 0 });
  };

  useEffect(() => () => stopStream(), []);

  return (
    <div className="border-t border-white/5 bg-black/30 backdrop-blur-xl">
      {editing && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-violet-500/10">
          <Icon name="Pencil" size={15} className="text-violet-300" />
          <span className="flex-1 text-xs text-white/60 truncate">Редактирование: {editing.text}</span>
          <button onClick={() => { setText(""); onCancelEdit?.(); }} className="text-white/40 hover:text-white">
            <Icon name="X" size={16} />
          </button>
        </div>
      )}
      {panel === "emoji" && (
        <Grid items={EMOJIS} onPick={(e) => setText((t) => t + e)} />
      )}
      {panel === "sticker" && (
        <Grid big items={STICKERS} onPick={(s) => { send({ chat_id: chatId, type: "sticker", text: s }); setPanel("none"); }} />
      )}
      {panel === "attach" && (
        <div className="flex gap-3 p-4">
          <AttachBtn icon="Image" label="Фото" color="from-violet-500 to-cyan-400" onClick={() => photoRef.current?.click()} />
          <AttachBtn icon="Video" label="Видео" color="from-pink-500 to-violet-500" onClick={() => videoRef.current?.click()} />
          <AttachBtn icon="Circle" label="Кружок" color="from-cyan-500 to-emerald-400" onClick={startCircle} />
          <AttachBtn icon="FileText" label="Файл" color="from-amber-400 to-orange-500" onClick={() => fileRef.current?.click()} />
        </div>
      )}

      {circle.recording && (
        <div className="flex flex-col items-center gap-3 p-4 border-b border-white/5">
          <video ref={circlePreviewRef} autoPlay muted playsInline className="w-44 h-44 rounded-full object-cover ring-4 ring-cyan-400/50" />
          <div className="flex items-center gap-3">
            <span className="text-red-400 text-sm flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Запись {circle.seconds}с
            </span>
            <button onClick={stopCircle} className="px-4 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-white text-sm font-medium">
              Отправить
            </button>
            <button onClick={cancelCircle} className="px-4 h-9 rounded-xl bg-white/10 text-white/70 text-sm">
              Отмена
            </button>
          </div>
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