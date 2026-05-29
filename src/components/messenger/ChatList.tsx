import { useState } from "react";
import Icon from "@/components/ui/icon";
import Avatar from "./Avatar";
import { Chat } from "@/lib/api";
import { formatTime, previewText } from "./utils";
import NewChatDialog from "./NewChatDialog";

interface ChatListProps {
  chats: Chat[];
  activeChat: number | null;
  onSelect: (chatId: number) => void;
  onChatCreated: (chatId: number) => void;
  onLogout: () => void;
  userName: string;
}

export default function ChatList({ chats, activeChat, onSelect, onChatCreated, onLogout, userName }: ChatListProps) {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const filtered = chats.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col w-full md:w-[360px] h-full border-r border-white/5 bg-black/30 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="font-golos font-black text-xl gradient-text">Чаты</h1>
        <div className="flex gap-1">
          <button
            onClick={() => setShowNew(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
            title="Новый чат"
          >
            <Icon name="SquarePen" size={18} />
          </button>
          <button
            onClick={onLogout}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
            title="Выйти"
          >
            <Icon name="LogOut" size={18} />
          </button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="relative">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 text-white/40">
            <Icon name="MessagesSquare" size={40} className="mb-3 text-white/20" />
            <p className="text-sm">Нет чатов. Начни новую переписку!</p>
          </div>
        )}
        {filtered.map((chat) => (
          <button
            key={chat.id}
            onClick={() => onSelect(chat.id)}
            className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl transition mb-0.5 ${
              activeChat === chat.id ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <Avatar name={chat.title} url={chat.avatar_url} seed={chat.id} online={chat.online} />
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-white truncate">{chat.title}</span>
                <span className="text-[11px] text-white/40 shrink-0">{formatTime(chat.last_time)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className="text-xs text-white/50 truncate">
                  {previewText(chat.last_type, chat.last_text) || "Нет сообщений"}
                </span>
                {chat.unread > 0 && (
                  <span className="shrink-0 min-w-[20px] h-5 px-1.5 bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full text-[11px] font-bold text-white flex items-center justify-center">
                    {chat.unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-white/5 text-xs text-white/40 truncate">
        Вы вошли как <span className="text-white/70">{userName}</span>
      </div>

      {showNew && (
        <NewChatDialog
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            onChatCreated(id);
          }}
        />
      )}
    </div>
  );
}
