import { useEffect, useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import Avatar from "./Avatar";
import { api, fileToBase64 } from "@/lib/api";

interface StoryGroup {
  user_id: number;
  name: string;
  avatar_url: string | null;
  count: number;
  latest: string;
  all_viewed: boolean;
}

interface StoryItem {
  id: number;
  type: string;
  media_url: string | null;
  caption: string | null;
  bg_color: string | null;
  created_at: string;
}

export default function StoriesBar() {
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [me, setMe] = useState(0);
  const [viewing, setViewing] = useState<StoryItem[] | null>(null);
  const [viewIdx, setViewIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await api.listStories();
      setStories(res.stories as StoryGroup[]);
      setMe(res.me);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
  }, []);

  const openStories = async (userId: number) => {
    const res = await api.userStories(userId);
    if ((res.items as StoryItem[]).length === 0) return;
    setViewing(res.items as StoryItem[]);
    setViewIdx(0);
    const first = (res.items as StoryItem[])[0];
    api.viewStory(first.id).then(load);
  };

  const addStory = async (file: File) => {
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      const { url } = await api.uploadMedia(b64, file.type, "stories");
      const type = file.type.startsWith("video") ? "video" : "image";
      await api.createStory({ type, media_url: url });
      load();
    } finally {
      setUploading(false);
    }
  };

  const myStory = stories.find((s) => s.user_id === me);
  const others = stories.filter((s) => s.user_id !== me);

  return (
    <div className="flex gap-3 px-4 py-3 overflow-x-auto border-b border-white/5 bg-black/20 w-full md:w-[360px]">
      <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-1 shrink-0">
        <div className="relative">
          <Avatar name="Я" url={myStory?.avatar_url} seed={me} size={56} ring={!!myStory && !myStory.all_viewed} />
          {uploading ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
              <Icon name="Loader" size={18} className="animate-spin text-white" />
            </span>
          ) : (
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-gradient-to-br from-violet-500 to-cyan-400 rounded-full flex items-center justify-center border-2 border-[#0a0814]">
              <Icon name="Plus" size={12} className="text-white" />
            </span>
          )}
        </div>
        <span className="text-[11px] text-white/60">Моя история</span>
      </button>

      {others.map((s) => (
        <button key={s.user_id} onClick={() => openStories(s.user_id)} className="flex flex-col items-center gap-1 shrink-0">
          <Avatar name={s.name} url={s.avatar_url} seed={s.user_id} size={56} ring={!s.all_viewed} />
          <span className="text-[11px] text-white/60 max-w-[60px] truncate">{s.name}</span>
        </button>
      ))}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => e.target.files?.[0] && addStory(e.target.files[0])}
      />

      {viewing && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => {
            if (viewIdx < viewing.length - 1) {
              const next = viewIdx + 1;
              setViewIdx(next);
              api.viewStory(viewing[next].id).then(load);
            } else {
              setViewing(null);
            }
          }}
        >
          <div className="absolute top-3 left-0 right-0 flex gap-1 px-3">
            {viewing.map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full ${i <= viewIdx ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setViewing(null); }}
            className="absolute top-6 right-4 text-white/80 z-10"
          >
            <Icon name="X" size={28} />
          </button>
          <div className="max-w-md w-full h-full flex items-center justify-center p-4">
            {viewing[viewIdx].type === "video" ? (
              <video src={viewing[viewIdx].media_url!} autoPlay controls className="max-h-full rounded-2xl" />
            ) : (
              <img src={viewing[viewIdx].media_url!} alt="" className="max-h-full rounded-2xl object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
