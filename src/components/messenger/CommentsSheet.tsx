import { useEffect, useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import Avatar from "./Avatar";
import { formatTime } from "./utils";
import { api, Comment } from "@/lib/api";

interface CommentsSheetProps {
  postId: number;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export default function CommentsSheet({ postId, onClose, onCountChange }: CommentsSheetProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [me, setMe] = useState(0);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const res = await api.commentsList(postId);
    setComments(res.comments);
    setMe(res.me);
    setLoading(false);
    onCountChange?.(res.comments.length);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    try {
      await api.commentAdd(postId, t);
      setText("");
      await load();
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 50);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: number) => {
    await api.commentDelete(id);
    load();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="glass-strong rounded-t-3xl max-h-[80vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="font-golos font-bold text-white">Комментарии</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <Icon name="X" size={20} />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[120px]">
          {loading ? (
            <div className="flex justify-center py-6">
              <Icon name="Loader" size={24} className="animate-spin text-violet-400" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-white/40 text-sm py-6">Пока нет комментариев. Будь первым!</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3 group">
                <Avatar name={c.author_name} url={c.author_avatar} seed={c.author_id} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="bg-white/5 rounded-2xl px-3 py-2">
                    <p className="text-white text-sm font-medium">{c.author_name}</p>
                    <p className="text-white/80 text-sm whitespace-pre-wrap break-words">{c.text}</p>
                  </div>
                  <p className="text-white/30 text-[11px] mt-1 ml-1">{formatTime(c.created_at)}</p>
                </div>
                {c.author_id === me && (
                  <button
                    onClick={() => remove(c.id)}
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition self-start"
                  >
                    <Icon name="Trash2" size={15} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 p-3 border-t border-white/10">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Написать комментарий..."
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 h-11 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50"
          />
          <button
            onClick={add}
            disabled={sending || !text.trim()}
            className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white disabled:opacity-40"
          >
            <Icon name="Send" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
