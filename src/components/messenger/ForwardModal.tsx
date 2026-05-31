import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import Avatar from "./Avatar";
import { api, Chat, Message } from "@/lib/api";

interface ForwardModalProps {
  message: Message;
  currentChatId: number;
  onClose: () => void;
  onDone: () => void;
}

export default function ForwardModal({ message, currentChatId, onClose, onDone }: ForwardModalProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [sending, setSending] = useState<number | null>(null);

  useEffect(() => {
    api.listChats().then((r) => setChats(r.chats.filter((c) => c.id !== currentChatId)));
  }, [currentChatId]);

  const forward = async (chatId: number) => {
    setSending(chatId);
    try {
      await api.sendMessage({
        chat_id: chatId,
        type: message.type,
        text: message.text || undefined,
        media_url: message.media_url || undefined,
        media_meta: message.media_meta || undefined,
      });
      onDone();
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-[#15102a] border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-golos font-bold text-white">Переслать в чат</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <Icon name="X" size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {chats.length === 0 ? (
            <p className="text-center text-white/40 text-sm py-8">Нет других чатов</p>
          ) : (
            chats.map((c) => (
              <button
                key={c.id}
                onClick={() => forward(c.id)}
                disabled={sending !== null}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition disabled:opacity-50"
              >
                <Avatar name={c.title} url={c.avatar_url} seed={c.id} size={40} online={c.online} />
                <span className="flex-1 text-left text-white font-medium truncate">{c.title}</span>
                {sending === c.id ? (
                  <Icon name="Loader" size={18} className="animate-spin text-violet-400" />
                ) : (
                  <Icon name="Send" size={16} className="text-white/30" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
