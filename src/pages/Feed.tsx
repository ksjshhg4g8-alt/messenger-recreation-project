import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import Avatar from "@/components/messenger/Avatar";
import BottomNav from "@/components/messenger/BottomNav";
import AppLayout from "@/components/messenger/AppLayout";
import CommentsSheet from "@/components/messenger/CommentsSheet";
import { formatTime } from "@/components/messenger/utils";
import { api, Post, getCurrentUser, fileToBase64 } from "@/lib/api";

const isVideo = (url: string | null) => !!url && /\.(mp4|webm|mov)$/i.test(url);

export default function Feed() {
  const navigate = useNavigate();
  const me = getCurrentUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [media, setMedia] = useState<string>("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentsFor, setCommentsFor] = useState<number | null>(null);
  const [tab, setTab] = useState<"all" | "video">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = tab === "video" ? await api.videoFeed() : await api.feedList();
      setPosts(res.posts);
    } catch {
      navigate("/login");
    } finally {
      setLoading(false);
    }
  }, [navigate, tab]);

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) {
      navigate("/login");
      return;
    }
    load();
  }, [navigate, load]);

  const [uploadingMedia, setUploadingMedia] = useState(false);

  const pickMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    try {
      const b64 = await fileToBase64(file);
      const up = await api.uploadMedia(b64, file.type, "posts");
      setMedia(up.url);
    } finally {
      setUploadingMedia(false);
    }
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
    <AppLayout>
    <div className="flex flex-col flex-1 min-w-0 bg-mesh overflow-hidden font-rubik">
      <div className="shrink-0 px-5 py-4 glass-strong border-b border-white/10 space-y-3">
        <h1 className="font-golos font-black text-xl gradient-text">Лента</h1>
        <div className="flex gap-2 p-1 bg-white/5 rounded-2xl max-w-xs">
          <button
            onClick={() => setTab("all")}
            className={`flex-1 h-8 rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5 ${
              tab === "all" ? "bg-gradient-to-r from-violet-500 to-cyan-400 text-white" : "text-white/50"
            }`}
          >
            <Icon name="Newspaper" size={15} /> Все
          </button>
          <button
            onClick={() => setTab("video")}
            className={`flex-1 h-8 rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5 ${
              tab === "video" ? "bg-gradient-to-r from-violet-500 to-cyan-400 text-white" : "text-white/50"
            }`}
          >
            <Icon name="Clapperboard" size={15} fallback="Video" /> Видео
          </button>
        </div>
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
                {isVideo(media) ? (
                  <video src={media} controls className="w-full max-h-72" />
                ) : (
                  <img src={media} alt="" className="w-full max-h-72 object-cover" />
                )}
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
                <Icon name={uploadingMedia ? "Loader" : "Image"} size={18} className={uploadingMedia ? "animate-spin" : ""} />
                Фото / Видео
                <input type="file" accept="image/*,video/*" className="hidden" onChange={pickMedia} />
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
                  isVideo(post.media_url) ? (
                    <video src={post.media_url} controls className="w-full rounded-xl max-h-96" />
                  ) : (
                    <img src={post.media_url} alt="" className="w-full rounded-xl max-h-96 object-cover" />
                  )
                )}
                <div className="flex items-center gap-5">
                  <button
                    onClick={() => toggleLike(post)}
                    className={`flex items-center gap-2 text-sm transition ${
                      post.liked ? "text-pink-400" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    <Icon name="Heart" size={18} />
                    {post.likes > 0 && <span>{post.likes}</span>}
                  </button>
                  <button
                    onClick={() => setCommentsFor(post.id)}
                    className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition"
                  >
                    <Icon name="MessageCircle" size={18} />
                    {!!post.comments && post.comments > 0 && <span>{post.comments}</span>}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {commentsFor !== null && (
        <CommentsSheet
          postId={commentsFor}
          onClose={() => setCommentsFor(null)}
          onCountChange={(count) =>
            setPosts((prev) => prev.map((p) => (p.id === commentsFor ? { ...p, comments: count } : p)))
          }
        />
      )}

      <BottomNav />
    </div>
    </AppLayout>
  );
}