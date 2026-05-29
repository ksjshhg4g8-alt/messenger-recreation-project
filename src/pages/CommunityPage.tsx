import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import Avatar from "@/components/messenger/Avatar";
import { formatTime } from "@/components/messenger/utils";
import { api, Community, CommunityPost, getCurrentUser, fileToBase64 } from "@/lib/api";

const isVideo = (url: string | null) => !!url && /\.(mp4|webm|mov)$/i.test(url);

export default function CommunityPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const cid = Number(id);
  const me = getCurrentUser();
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [meId, setMeId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [media, setMedia] = useState("");
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [det, pr] = await Promise.all([api.communityDetail(cid), api.communityPosts(cid)]);
      setCommunity(det.community);
      setPosts(pr.posts);
      setMeId(pr.me);
    } catch {
      navigate("/communities");
    } finally {
      setLoading(false);
    }
  }, [cid, navigate]);

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) {
      navigate("/login");
      return;
    }
    load();
  }, [navigate, load]);

  const pickMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      const up = await api.uploadMedia(b64, file.type, "community-posts");
      setMedia(up.url);
    } finally {
      setUploading(false);
    }
  };

  const publish = async () => {
    if (!text.trim() && !media) return;
    setPosting(true);
    try {
      await api.communityPostCreate({ community_id: cid, text: text.trim(), media_url: media });
      setText("");
      setMedia("");
      load();
    } catch {
      alert("Не удалось опубликовать. Возможно, у вас нет прав.");
    } finally {
      setPosting(false);
    }
  };

  const removePost = async (postId: number) => {
    await api.communityPostDelete(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const toggleJoin = async () => {
    if (!community) return;
    if (community.joined) await api.communityLeave(community.id);
    else await api.communityJoin(community.id);
    setCommunity({ ...community, joined: !community.joined, members: community.members + (community.joined ? -1 : 1) });
  };

  if (loading || !community) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-mesh">
        <Icon name="Loader" size={32} className="animate-spin text-violet-400" />
      </div>
    );
  }

  const isOwner = community.owner_id === meId;
  const canPost = community.type === "channel" ? isOwner : community.joined;

  return (
    <div className="flex flex-col h-screen w-screen bg-mesh overflow-hidden font-rubik">
      <div className="shrink-0 px-4 py-4 glass-strong border-b border-white/10 flex items-center gap-3">
        <button onClick={() => navigate("/communities")} className="text-white/60 hover:text-white">
          <Icon name="ChevronLeft" size={24} />
        </button>
        <Avatar name={community.title} url={community.avatar_url} seed={community.id} size={42} />
        <div className="flex-1 min-w-0">
          <p className="font-golos font-bold text-white truncate">{community.title}</p>
          <p className="text-white/40 text-xs">
            {community.type === "channel" ? "Канал" : "Группа"} · {community.members} участн.
          </p>
        </div>
        {!isOwner && (
          <Button
            onClick={toggleJoin}
            className={`rounded-xl h-9 px-4 text-sm ${
              community.joined ? "bg-white/10 hover:bg-white/15 text-white/70" : "bg-gradient-to-br from-violet-500 to-cyan-400"
            }`}
          >
            {community.joined ? "Выйти" : community.type === "group" ? "Вступить" : "Подписаться"}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto p-4 space-y-4">
          {community.description && (
            <div className="glass-strong rounded-2xl p-4 text-white/70 text-sm">{community.description}</div>
          )}

          {canPost && (
            <div className="glass-strong rounded-2xl p-4 space-y-3">
              <div className="flex gap-3">
                <Avatar name={me?.name || "Я"} url={me?.avatar_url} seed={me?.id} size={40} />
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={community.type === "channel" ? "Новая запись в канал..." : "Поделитесь в группе..."}
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
                  <button onClick={() => setMedia("")} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white">
                    <Icon name="X" size={16} />
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className="cursor-pointer text-white/50 hover:text-white flex items-center gap-2 text-sm">
                  <Icon name={uploading ? "Loader" : "Image"} size={18} className={uploading ? "animate-spin" : ""} />
                  Фото / Видео
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={pickMedia} />
                </label>
                <Button onClick={publish} disabled={posting || (!text.trim() && !media)} className="rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 hover:opacity-90 font-bold px-6">
                  {posting ? <Icon name="Loader" size={16} className="animate-spin" /> : "Опубликовать"}
                </Button>
              </div>
            </div>
          )}

          {posts.length === 0 ? (
            <div className="text-center text-white/40 py-10">
              <Icon name="FileText" size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">Пока нет записей</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="glass-strong rounded-2xl p-4 space-y-3 animate-slide-up">
                <div className="flex items-center gap-3">
                  <Avatar name={post.author_name} url={post.author_avatar} seed={post.author_id} size={40} />
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{post.author_name}</p>
                    <p className="text-white/40 text-xs">{formatTime(post.created_at)}</p>
                  </div>
                  {(post.author_id === meId || isOwner) && (
                    <button onClick={() => removePost(post.id)} className="text-white/30 hover:text-red-400">
                      <Icon name="Trash2" size={16} />
                    </button>
                  )}
                </div>
                {post.text && <p className="text-white/90 text-sm whitespace-pre-wrap">{post.text}</p>}
                {post.media_url && (
                  isVideo(post.media_url) ? (
                    <video src={post.media_url} controls className="w-full rounded-xl max-h-96" />
                  ) : (
                    <img src={post.media_url} alt="" className="w-full rounded-xl max-h-96 object-cover" />
                  )
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
