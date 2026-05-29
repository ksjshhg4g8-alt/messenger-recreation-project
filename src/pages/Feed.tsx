import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import Avatar from "@/components/messenger/Avatar";
import BottomNav from "@/components/messenger/BottomNav";
import { formatTime } from "@/components/messenger/utils";
import { api, Post, getCurrentUser, fileToBase64 } from "@/lib/api";

export default function Feed() {
  const navigate = useNavigate();
  const me = getCurrentUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [media, setMedia] = useState<string>("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.feedList();
      setPosts(res.posts);
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
    load();
  }, [navigate, load]);

  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    const up = await api.uploadMedia(b64, file.type, "posts");
    setMedia(up.url);
  };

  const publish = async () => {
    if (!text.trim() && !media) return;
    setPosting(true);
    try {
      await api.feedCreate({ text: text.trim(), media_url: media });
      setText("");
      setMedia("");
      load();
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (post: Post) => {
    const res = await api.feedLike(post.id);
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, liked: res.liked, likes: res.likes } : p))
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-mesh overflow-hidden font-rubik">
      <div className="shrink-0 px-5 py-4 glass-strong border-b border-white/10">
        <h1 className="font-golos font-black text-xl gradient-text">Лента</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto p-4 space-y-4">
          <div className="glass-strong rounded-2xl p-4 space-y-3">
            <div className="flex gap-3">
              <Avatar name={me?.name || "Я"} url={me?.avatar_url} seed={me?.id} size={40} />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Что нового?"
                className="flex-1 bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-xl resize-none min-h-[60px] p-3 text-sm outline-none focus:border-violet-500/50"
              />
            </div>
            {media && (
              <div className="relative rounded-xl overflow-hidden">
                <img src={media} alt="" className="w-full max-h-72 object-cover" />
                <button
                  onClick={() => setMedia("")}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white"
                >
                  <Icon name="X" size={16} />
                </button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <label className="cursor-pointer text-white/50 hover:text-white flex items-center gap-2 text-sm">
                <Icon name="Image" size={18} />
                Фото
                <input type="file" accept="image/*" className="hidden" onChange={pickImage} />
              </label>
              <Button
                onClick={publish}
                disabled={posting || (!text.trim() && !media)}
                className="rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 hover:opacity-90 font-bold px-6"
              >
                {posting ? <Icon name="Loader" size={16} className="animate-spin" /> : "Опубликовать"}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Icon name="Loader" size={28} className="animate-spin text-violet-400" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center text-white/40 py-10">
              <Icon name="Newspaper" size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">Пока нет публикаций. Будь первым!</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="glass-strong rounded-2xl p-4 space-y-3 animate-slide-up">
                <button
                  onClick={() => navigate(`/profile/${post.author_id}`)}
                  className="flex items-center gap-3"
                >
                  <Avatar name={post.author_name} url={post.author_avatar} seed={post.author_id} size={40} />
                  <div className="text-left">
                    <p className="text-white font-medium text-sm">{post.author_name}</p>
                    <p className="text-white/40 text-xs">{formatTime(post.created_at)}</p>
                  </div>
                </button>
                {post.text && <p className="text-white/90 text-sm whitespace-pre-wrap">{post.text}</p>}
                {post.media_url && (
                  <img src={post.media_url} alt="" className="w-full rounded-xl max-h-96 object-cover" />
                )}
                <button
                  onClick={() => toggleLike(post)}
                  className={`flex items-center gap-2 text-sm transition ${
                    post.liked ? "text-pink-400" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <Icon name={post.liked ? "Heart" : "Heart"} size={18} fallback="Heart" />
                  {post.likes > 0 && <span>{post.likes}</span>}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}