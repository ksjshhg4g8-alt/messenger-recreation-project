import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import Avatar from "./Avatar";
import { api, SearchUser } from "@/lib/api";

interface NewChatDialogProps {
  onClose: () => void;
  onCreated: (chatId: number) => void;
}

export default function NewChatDialog({ onClose, onCreated }: NewChatDialogProps) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"private" | "group">("private");
  const [selected, setSelected] = useState<SearchUser[]>([]);
  const [groupTitle, setGroupTitle] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.searchUsers(q);
        setUsers(res.users);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const startPrivate = async (u: SearchUser) => {
    const res = await api.createChat({ type: "private", user_id: u.id });
    onCreated(res.chat_id);
  };

  const toggleSelect = (u: SearchUser) => {
    setSelected((prev) =>
      prev.find((x) => x.id === u.id) ? prev.filter((x) => x.id !== u.id) : [...prev, u]
    );
  };

  const createGroup = async () => {
    if (!groupTitle.trim() || selected.length === 0) return;
    const res = await api.createChat({
      type: "group",
      title: groupTitle,
      members: selected.map((u) => u.id),
    });
    onCreated(res.chat_id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md mx-4 glass-strong rounded-3xl p-5 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-golos font-bold text-lg text-white">
            {mode === "private" ? "Новый чат" : "Новая группа"}
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setMode("private")}
            className={`flex-1 h-9 rounded-xl text-sm font-medium transition ${
              mode === "private" ? "bg-gradient-to-r from-violet-500 to-cyan-400 text-white" : "bg-white/5 text-white/60"
            }`}
          >
            Личный
          </button>
          <button
            onClick={() => setMode("group")}
            className={`flex-1 h-9 rounded-xl text-sm font-medium transition ${
              mode === "group" ? "bg-gradient-to-r from-violet-500 to-cyan-400 text-white" : "bg-white/5 text-white/60"
            }`}
          >
            Группа
          </button>
        </div>

        {mode === "group" && (
          <input
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
            placeholder="Название группы"
            className="w-full h-10 px-3 mb-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50"
          />
        )}

        <div className="relative mb-3">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Имя или телефон"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50"
          />
        </div>

        {mode === "group" && selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selected.map((u) => (
              <span key={u.id} className="flex items-center gap-1 px-2 py-1 rounded-full bg-violet-500/20 text-violet-200 text-xs">
                {u.name}
                <button onClick={() => toggleSelect(u)}><Icon name="X" size={12} /></button>
              </span>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading && <p className="text-center text-white/40 text-sm py-4">Поиск...</p>}
          {!loading && users.length === 0 && (
            <p className="text-center text-white/40 text-sm py-4">Никого не найдено</p>
          )}
          {users.map((u) => {
            const isSel = !!selected.find((x) => x.id === u.id);
            return (
              <button
                key={u.id}
                onClick={() => (mode === "private" ? startPrivate(u) : toggleSelect(u))}
                className={`w-full flex items-center gap-3 p-2 rounded-2xl transition ${isSel ? "bg-violet-500/20" : "hover:bg-white/5"}`}
              >
                <Avatar name={u.name} url={u.avatar_url} seed={u.id} size={40} />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-white truncate">{u.name}</p>
                  <p className="text-xs text-white/40">{u.phone}</p>
                </div>
                {mode === "group" && isSel && <Icon name="Check" size={18} className="text-violet-400" />}
              </button>
            );
          })}
        </div>

        {mode === "group" && (
          <button
            onClick={createGroup}
            disabled={!groupTitle.trim() || selected.length === 0}
            className="mt-3 h-11 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 text-white font-bold disabled:opacity-40"
          >
            Создать группу ({selected.length})
          </button>
        )}
      </div>
    </div>
  );
}
