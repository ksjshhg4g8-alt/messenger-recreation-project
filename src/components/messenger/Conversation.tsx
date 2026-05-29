import { useEffect, useRef, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import Avatar from "./Avatar";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import { api, Chat, Message } from "@/lib/api";

interface ConversationProps {
  chat: Chat;
  onBack: () => void;
  onUpdated: () => void;
}

export default function Conversation({ chat, onBack, onUpdated }: ConversationProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState(0);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  const load = useCallback(async (markRead = false) => {
    try {
      const res = await api.getMessages(chat.id);
      setMessages(res.messages);
      setMe(res.me);
      const last = res.messages[res.messages.length - 1];
      if (last && (markRead || last.id !== lastIdRef.current)) {
        if (last.id !== lastIdRef.current) {
          await api.markRead(chat.id, last.id);
          onUpdated();
        }
        lastIdRef.current = last.id;
      }
    } finally {
      setLoading(false);
    }
  }, [chat.id, onUpdated]);

  useEffect(() => {
    setLoading(true);
    lastIdRef.current = 0;
    load(true);
    const interval = setInterval(() => load(), 4000);
    return () => clearInterval(interval);
  }, [chat.id, load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const handleReact = async (messageId: number, emoji: string) => {
    const msg = messages.find((m) => m.id === messageId);
    const mine = msg?.reactions?.find((r) => r.user_id === me);
    await api.react(messageId, mine?.emoji === emoji ? "" : emoji);
    load();
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-transparent to-black/20">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-black/30 backdrop-blur-xl">
        <button onClick={onBack} className="md:hidden text-white/60 hover:text-white">
          <Icon name="ChevronLeft" size={24} />
        </button>
        <Avatar name={chat.title} url={chat.avatar_url} seed={chat.id} size={42} online={chat.online} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{chat.title}</p>
          <p className="text-xs text-white/40">
            {chat.type === "group" ? "Группа" : chat.online ? "в сети" : "не в сети"}
          </p>
        </div>
        <button className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10">
          <Icon name="Phone" size={18} />
        </button>
        <button className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10">
          <Icon name="Video" size={18} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-white/40">
            <Icon name="Loader" size={24} className="animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40">
            <Icon name="MessageCircle" size={40} className="mb-2 text-white/20" />
            <p className="text-sm">Начни общение — напиши первое сообщение</p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} msg={m} me={me} isGroup={chat.type === "group"} onReact={handleReact} />
          ))
        )}
      </div>

      <MessageInput chatId={chat.id} onSent={() => load()} />
    </div>
  );
}
