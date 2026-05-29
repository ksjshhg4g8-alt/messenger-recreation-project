import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import ChatList from "@/components/messenger/ChatList";
import Conversation from "@/components/messenger/Conversation";
import StoriesBar from "@/components/messenger/StoriesBar";
import { api, Chat, getCurrentUser } from "@/lib/api";

export default function Index() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const user = getCurrentUser();

  const loadChats = useCallback(async () => {
    try {
      const res = await api.listChats();
      setChats(res.chats);
    } catch {
      navigate("/login");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) {
      navigate("/login");
      return;
    }
    loadChats();
    const interval = setInterval(loadChats, 6000);
    return () => clearInterval(interval);
  }, [navigate, loadChats]);

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    navigate("/login");
  };

  const current = chats.find((c) => c.id === activeChat) || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-mesh">
        <Icon name="Loader" size={32} className="animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-mesh overflow-hidden font-rubik">
      <div className={`flex flex-col ${activeChat ? "hidden md:flex" : "flex"} w-full md:w-auto`}>
        <StoriesBar />
        <ChatList
          chats={chats}
          activeChat={activeChat}
          onSelect={setActiveChat}
          onChatCreated={(id) => {
            loadChats();
            setActiveChat(id);
          }}
          onLogout={logout}
          userName={user?.name || "Гость"}
        />
      </div>

      <div className={`flex-1 ${activeChat ? "flex" : "hidden md:flex"}`}>
        {current ? (
          <div className="w-full">
            <Conversation chat={current} onBack={() => setActiveChat(null)} onUpdated={loadChats} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full text-center text-white/40">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500/20 to-cyan-400/20 flex items-center justify-center mb-4">
              <Icon name="MessageCircle" size={48} className="text-violet-400/60" />
            </div>
            <h2 className="font-golos font-bold text-xl text-white/70 mb-1">Vibe Messenger</h2>
            <p className="text-sm">Выбери чат, чтобы начать общение</p>
          </div>
        )}
      </div>
    </div>
  );
}
