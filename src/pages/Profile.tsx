import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Avatar from "@/components/messenger/Avatar";
import BottomNav from "@/components/messenger/BottomNav";
import { formatTime, lastSeen } from "@/components/messenger/utils";
import { api, Post, Profile as ProfileType, fileToBase64 } from "@/lib/api";

export default function Profile() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isMe, setIsMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", bio: "", status_text: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.profileGet(id ? Number(id) : undefined);
      setProfile(res.user);
      setPosts(res.posts);
      setIsMe(res.is_me);
      setForm({
        name: res.user.name || "",
        bio: res.user.bio || "",
        status_text: res.user.status_text || "",
      });
    } catch {
      navigate("/login");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) {
      navigate("/login");
      return;
    }
    load();
  }, [navigate, load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.profileUpdate(form);
      setProfile((p) => (p ? { ...p, ...res.user } : p));
      const stored = JSON.parse(localStorage.getItem("auth_user") || "{}");
      localStorage.setItem("auth_user", JSON.stringify({ ...stored, name: res.user.name, avatar_url: res.user.avatar_url }));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const changeAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    const up = await api.uploadMedia(b64, file.type, "avatars");
    const res = await api.profileUpdate({ avatar_url: up.url });
    setProfile((p) => (p ? { ...p, avatar_url: res.user.avatar_url } : p));
    const stored = JSON.parse(localStorage.getItem("auth_user") || "{}");
    localStorage.setItem("auth_user", JSON.stringify({ ...stored, avatar_url: res.user.avatar_url }));
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    navigate("/login");
  };

  if (loading || !profile) {
    return (
      <div className="flex flex-col h-screen w-screen bg-mesh font-rubik">
        <div className="flex-1 flex items-center justify-center">
          <Icon name="Loader" size={32} className="animate-spin text-violet-400" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-mesh overflow-hidden font-rubik">
      <div className="shrink-0 px-5 py-4 glass-strong border-b border-white/10 flex items-center justify-between">
        {id ? (
          <button onClick={() => navigate(-1)} className="text-white/60 hover:text-white flex items-center gap-1">
            <Icon name="ChevronLeft" size={20} /> Назад
          </button>
        ) : (
          <h1 className="font-golos font-black text-xl gradient-text">Профиль</h1>
        )}
        {isMe && !editing && (
          <button onClick={logout} className="text-white/50 hover:text-red-400">
            <Icon name="LogOut" size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto p-4 space-y-4">
          <div className="glass-strong rounded-2xl p-6 flex flex-col items-center text-center">
            <div className="relative">
              <Avatar name={profile.name} url={profile.avatar_url} seed={profile.id} size={96} online={profile.is_online} />
              {isMe && (
                <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center cursor-pointer">
                  <Icon name="Camera" size={15} className="text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={changeAvatar} />
                </label>
              )}
            </div>

            {editing ? (
              <div className="w-full space-y-3 mt-4">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Имя"
                  className="bg-white/5 border-white/10 text-white text-center h-11 rounded-xl"
                />
                <Input
                  value={form.status_text}
                  onChange={(e) => setForm({ ...form, status_text: e.target.value })}
                  placeholder="Статус (например: на связи)"
                  className="bg-white/5 border-white/10 text-white text-center h-11 rounded-xl"
                />
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="О себе"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-xl resize-none min-h-[70px] p-3 text-sm outline-none focus:border-violet-500/50"
                />
                <div className="flex gap-2">
                  <Button onClick={() => setEditing(false)} className="flex-1 h-11 rounded-xl bg-white/10 hover:bg-white/15">
                    Отмена
                  </Button>
                  <Button onClick={save} disabled={saving} className="flex-1 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 hover:opacity-90 font-bold">
                    {saving ? <Icon name="Loader" size={16} className="animate-spin" /> : "Сохранить"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="font-golos font-bold text-2xl text-white mt-4">{profile.name}</h2>
                {profile.login && <p className="text-white/40 text-sm">@{profile.login}</p>}
                <p className="text-emerald-400/80 text-xs mt-1">{lastSeen(profile.last_seen_at, profile.is_online)}</p>
                {profile.status_text && <p className="text-cyan-300 text-sm mt-2">{profile.status_text}</p>}
                {profile.bio && <p className="text-white/70 text-sm mt-3 whitespace-pre-wrap">{profile.bio}</p>}

                <div className="flex gap-6 mt-4 text-center">
                  <div>
                    <p className="text-white font-bold text-lg">{profile.posts_count}</p>
                    <p className="text-white/40 text-xs">публикаций</p>
                  </div>
                </div>

                {isMe ? (
                  <Button onClick={() => setEditing(true)} className="mt-4 h-10 rounded-xl bg-white/10 hover:bg-white/15 px-6">
                    <Icon name="Pencil" size={15} className="mr-2" /> Редактировать
                  </Button>
                ) : (
                  <Button
                    onClick={async () => {
                      const res = await api.createChat({ type: "private", user_id: profile.id });
                      navigate("/");
                      void res;
                    }}
                    className="mt-4 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 hover:opacity-90 px-6"
                  >
                    <Icon name="MessageCircle" size={15} className="mr-2" /> Написать
                  </Button>
                )}
              </>
            )}
          </div>

          {isMe && (
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="glass-strong rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 transition"
            >
              <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center">
                <Icon name="Apple" size={24} className="text-white" fallback="Smartphone" />
              </div>
              <div className="flex-1">
                <p className="text-white/50 text-[11px]">Загрузите в</p>
                <p className="text-white font-golos font-bold text-base">App Store</p>
              </div>
              <Icon name="ChevronRight" size={18} className="text-white/30" />
            </a>
          )}

          {posts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-white/50 text-sm font-medium px-1">Публикации</h3>
              {posts.map((post) => (
                <div key={post.id} className="glass-strong rounded-2xl p-4 space-y-2">
                  <p className="text-white/40 text-xs">{formatTime(post.created_at)}</p>
                  {post.text && <p className="text-white/90 text-sm whitespace-pre-wrap">{post.text}</p>}
                  {post.media_url && <img src={post.media_url} alt="" className="w-full rounded-xl max-h-80 object-cover" />}
                  <div className={`flex items-center gap-2 text-sm ${post.liked ? "text-pink-400" : "text-white/40"}`}>
                    <Icon name="Heart" size={16} />
                    {post.likes > 0 && <span>{post.likes}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
