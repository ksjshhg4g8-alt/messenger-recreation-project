import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Avatar from "@/components/messenger/Avatar";
import BottomNav from "@/components/messenger/BottomNav";
import AppLayout from "@/components/messenger/AppLayout";
import { api, Community } from "@/lib/api";

export default function Communities() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"group" | "channel">("group");
  const [list, setList] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.communitiesList(tab);
      setList(res.communities);
    } catch {
      navigate("/login");
    } finally {
      setLoading(false);
    }
  }, [tab, navigate]);

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) {
      navigate("/login");
      return;
    }
    load();
  }, [navigate, load]);

  const create = async () => {
    if (newTitle.trim().length < 2) return;
    setSaving(true);
    try {
      await api.communityCreate({ type: tab, title: newTitle.trim(), description: newDesc.trim() });
      setNewTitle("");
      setNewDesc("");
      setCreating(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleJoin = async (c: Community) => {
    if (c.joined) await api.communityLeave(c.id);
    else await api.communityJoin(c.id);
    setList((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? { ...x, joined: !c.joined, members: x.members + (c.joined ? -1 : 1) }
          : x
      )
    );
  };

  return (
    <AppLayout>
    <div className="flex flex-col flex-1 min-w-0 bg-mesh overflow-hidden font-rubik">
      <div className="shrink-0 px-5 py-4 glass-strong border-b border-white/10 flex items-center justify-between">
        <h1 className="font-golos font-black text-xl gradient-text">Сообщества</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70"
        >
          <Icon name={creating ? "X" : "Plus"} size={20} />
        </button>
      </div>

      <div className="shrink-0 px-4 pt-3">
        <div className="flex gap-2 p-1 bg-white/5 rounded-2xl max-w-xl mx-auto">
          {(["group", "channel"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 h-9 rounded-xl text-sm font-medium transition ${
                tab === t ? "bg-gradient-to-r from-violet-500 to-cyan-400 text-white" : "text-white/50"
              }`}
            >
              {t === "group" ? "Группы" : "Каналы"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto p-4 space-y-3">
          {creating && (
            <div className="glass-strong rounded-2xl p-4 space-y-3 animate-slide-up">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={tab === "group" ? "Название группы" : "Название канала"}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11 rounded-xl"
              />
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Описание (необязательно)"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11 rounded-xl"
              />
              <Button
                onClick={create}
                disabled={saving || newTitle.trim().length < 2}
                className="w-full h-11 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 hover:opacity-90 font-bold"
              >
                {saving ? <Icon name="Loader" size={16} className="animate-spin" /> : `Создать ${tab === "group" ? "группу" : "канал"}`}
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10">
              <Icon name="Loader" size={28} className="animate-spin text-violet-400" />
            </div>
          ) : list.length === 0 ? (
            <div className="text-center text-white/40 py-10">
              <Icon name={tab === "group" ? "Users" : "Radio"} size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">{tab === "group" ? "Групп пока нет" : "Каналов пока нет"}. Создай первый!</p>
            </div>
          ) : (
            list.map((c) => (
              <div key={c.id} className="glass-strong rounded-2xl p-4 flex items-center gap-3 animate-slide-up">
                <button onClick={() => navigate(`/communities/${c.id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <Avatar name={c.title} url={c.avatar_url} seed={c.id} size={48} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{c.title}</p>
                    <p className="text-white/40 text-xs">
                      {c.members} {c.members === 1 ? "участник" : "участников"}
                    </p>
                    {c.description && <p className="text-white/50 text-xs truncate mt-0.5">{c.description}</p>}
                  </div>
                </button>
                <Button
                  onClick={() => toggleJoin(c)}
                  className={`rounded-xl h-9 px-4 text-sm font-medium ${
                    c.joined
                      ? "bg-white/10 hover:bg-white/15 text-white/70"
                      : "bg-gradient-to-br from-violet-500 to-cyan-400 hover:opacity-90"
                  }`}
                >
                  {c.joined ? "Выйти" : tab === "group" ? "Вступить" : "Подписаться"}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </div>
    </AppLayout>
  );
}