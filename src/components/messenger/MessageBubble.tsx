import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Message } from "@/lib/api";
import { formatTime } from "./utils";

const QUICK_EMOJI = ["❤️", "😂", "👍", "🔥", "😮", "😢", "🎉"];

interface MessageBubbleProps {
  msg: Message;
  me: number;
  isGroup: boolean;
  onReact: (messageId: number, emoji: string) => void;
  onEdit?: (msg: Message) => void;
  onDelete?: (messageId: number) => void;
}

export default function MessageBubble({ msg, me, isGroup, onReact, onEdit, onDelete }: MessageBubbleProps) {
  const [showReact, setShowReact] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const mine = msg.sender_id === me;
  const reactions = msg.reactions || [];

  const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  const renderContent = () => {
    if (msg.type === "image") {
      return <img src={msg.media_url!} alt="" className="rounded-xl max-w-full max-h-72 object-cover" />;
    }
    if (msg.type === "video") {
      return <video src={msg.media_url!} controls className="rounded-xl max-w-full max-h-72" />;
    }
    if (msg.type === "circle") {
      return <video src={msg.media_url!} controls className="rounded-full w-48 h-48 object-cover" />;
    }
    if (msg.type === "voice") {
      return <audio src={msg.media_url!} controls className="max-w-[220px]" />;
    }
    if (msg.type === "sticker") {
      return <span className="text-6xl">{msg.text}</span>;
    }
    if (msg.type === "gift") {
      return (
        <div className="flex flex-col items-center gap-1 py-2 px-4">
          <span className="text-5xl">{msg.text || "🎁"}</span>
          <span className="text-xs text-white/70">Подарок</span>
        </div>
      );
    }
    if (msg.type === "file") {
      return (
        <a href={msg.media_url!} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm underline">
          <Icon name="Paperclip" size={16} /> Файл
        </a>
      );
    }
    return <span className="whitespace-pre-wrap break-words">{msg.text}</span>;
  };

  const plain = msg.type === "sticker" || msg.type === "gift";

  return (
    <div className={`group flex flex-col ${mine ? "items-end" : "items-start"} mb-2`}>
      <div className={`flex items-end gap-1.5 max-w-[78%] ${mine ? "flex-row-reverse" : ""}`}>
        <div
          className={`relative px-3 py-2 text-sm ${
            plain
              ? "bg-transparent"
              : mine
              ? "bg-gradient-to-br from-violet-600 to-violet-500 text-white rounded-2xl rounded-br-md"
              : "bg-white/10 text-white rounded-2xl rounded-bl-md"
          }`}
        >
          {isGroup && !mine && !plain && (
            <p className="text-[11px] font-semibold gradient-text mb-0.5">{msg.sender_name}</p>
          )}
          {renderContent()}
          {!plain && (
            <div className={`flex items-center gap-1 mt-0.5 ${mine ? "justify-end" : ""}`}>
              {msg.edited_at && <span className="text-[10px] text-white/40 italic">изм.</span>}
              <span className="text-[10px] text-white/50">{formatTime(msg.created_at)}</span>
              {mine && (
                <Icon
                  name={msg.read_count > 0 ? "CheckCheck" : "Check"}
                  size={13}
                  className={msg.read_count > 0 ? "text-cyan-300" : "text-white/50"}
                />
              )}
            </div>
          )}
        </div>

        <div className="relative flex items-center">
          <button
            onClick={() => setShowReact((v) => !v)}
            className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-white transition shrink-0"
          >
            <Icon name="SmilePlus" size={16} />
          </button>
          {mine && (onEdit || onDelete) && (
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-white transition shrink-0 ml-1"
            >
              <Icon name="EllipsisVertical" size={16} fallback="MoreVertical" />
            </button>
          )}
          {showMenu && (
            <div className={`absolute z-20 top-6 ${mine ? "right-0" : "left-0"} bg-[#1a1430] border border-white/10 rounded-xl py-1 shadow-xl min-w-[140px]`}>
              {msg.type === "text" && onEdit && (
                <button
                  onClick={() => { onEdit(msg); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/5 flex items-center gap-2"
                >
                  <Icon name="Pencil" size={15} /> Редактировать
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => { onDelete(msg.id); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-white/5 flex items-center gap-2"
                >
                  <Icon name="Trash2" size={15} /> Удалить
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {Object.keys(grouped).length > 0 && (
        <div className={`flex gap-1 mt-1 ${mine ? "flex-row-reverse" : ""}`}>
          {Object.entries(grouped).map(([emoji, count]) => (
            <span key={emoji} className="text-xs bg-white/10 rounded-full px-2 py-0.5">
              {emoji} {count > 1 ? count : ""}
            </span>
          ))}
        </div>
      )}

      {showReact && (
        <div className={`flex gap-1 mt-1 bg-black/80 backdrop-blur rounded-full px-2 py-1 ${mine ? "self-end" : "self-start"}`}>
          {QUICK_EMOJI.map((e) => (
            <button
              key={e}
              onClick={() => {
                onReact(msg.id, e);
                setShowReact(false);
              }}
              className="text-lg hover:scale-125 transition"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}