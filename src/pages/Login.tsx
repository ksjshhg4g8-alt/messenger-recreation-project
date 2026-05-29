import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

const MAX_AUTH_URL = "https://functions.poehali.dev/fb5f08dd-1ca0-4e74-9ab7-eea1b2889a88";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (localStorage.getItem("auth_token")) navigate("/");
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [navigate]);

  const finishLogin = (data: { token: string; user: unknown }) => {
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));
    if (pollRef.current) clearInterval(pollRef.current);
    navigate("/");
  };

  const startMaxLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${MAX_AUTH_URL}?action=start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Вход через MAX недоступен");
        return;
      }
      setLink(data.link);
      setWaiting(true);
      if (data.link) window.open(data.link, "_blank");

      pollRef.current = setInterval(async () => {
        try {
          const pr = await fetch(`${MAX_AUTH_URL}?action=poll&payload=${encodeURIComponent(data.payload)}`);
          const pd = await pr.json();
          if (pd.status === "confirmed" && pd.token) finishLogin(pd);
        } catch {
          /* keep polling */
        }
      }, 2500);
    } catch {
      setError("Сеть недоступна");
    } finally {
      setLoading(false);
    }
  };

  const cancelWaiting = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setWaiting(false);
    setLink("");
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-screen bg-mesh font-rubik">
      <div className="w-full max-w-md mx-4 animate-slide-up">
        <div className="glass-strong rounded-3xl p-8 space-y-8 shadow-2xl">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center shadow-xl neon-glow animate-float">
              <Icon name="MessageCircle" size={36} className="text-white" />
            </div>
            <div className="text-center">
              <h1 className="font-golos font-black text-3xl gradient-text mb-1">Vibe Messenger</h1>
              <p className="text-white/50 text-sm">Войди через мессенджер MAX</p>
            </div>
          </div>

          {!waiting ? (
            <Button
              onClick={startMaxLogin}
              disabled={loading}
              className="w-full h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 hover:opacity-90 text-white font-bold text-base flex items-center justify-center gap-3"
            >
              {loading ? (
                <Icon name="Loader" size={22} className="animate-spin" />
              ) : (
                <>
                  <Icon name="Send" size={22} />
                  Войти через MAX
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-4 text-center">
              <div className="flex flex-col items-center gap-3 bg-white/5 rounded-2xl p-6">
                <Icon name="Loader" size={32} className="animate-spin text-cyan-300" />
                <p className="text-white/70 text-sm">
                  Открой бота в MAX и нажми «Начать». После подтверждения вход произойдёт автоматически.
                </p>
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-300 hover:text-cyan-200 text-sm font-medium underline"
                  >
                    Открыть бота MAX снова
                  </a>
                )}
              </div>
              <button onClick={cancelWaiting} className="text-white/50 hover:text-white text-xs">
                Отмена
              </button>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 text-center bg-red-500/10 rounded-xl p-3">{error}</div>
          )}

          <p className="text-[11px] text-white/30 text-center leading-relaxed">
            Продолжая, ты соглашаешься с условиями использования и политикой конфиденциальности
          </p>
        </div>
      </div>
    </div>
  );
}
