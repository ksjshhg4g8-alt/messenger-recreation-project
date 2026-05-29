import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

const VK_AUTH_URL = "https://functions.poehali.dev/a86a2e10-be82-4415-81cd-9887738a3175";

function base64url(bytes: Uint8Array) {
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(hash));
}

function randomString(len = 64) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const redirectUri = `${window.location.origin}/login`;

  useEffect(() => {
    if (localStorage.getItem("auth_token")) {
      navigate("/");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const vkError = params.get("error");
    const vkErrorDesc = params.get("error_description");
    if (vkError) {
      setError(`VK: ${vkErrorDesc || vkError}`);
      window.history.replaceState({}, "", "/login");
      return;
    }
    const code = params.get("code");
    const deviceId = params.get("device_id");
    const returnedState = params.get("state");
    if (code && deviceId) {
      handleCallback(code, deviceId, returnedState || "");
    }
  }, [navigate]);

  const handleCallback = async (code: string, deviceId: string, returnedState: string) => {
    setLoading(true);
    setError("");
    try {
      const savedState = sessionStorage.getItem("vk_state");
      const codeVerifier = sessionStorage.getItem("vk_code_verifier") || "";
      if (savedState && returnedState && savedState !== returnedState) {
        setError("Ошибка проверки безопасности. Попробуй ещё раз.");
        return;
      }
      const res = await fetch(`${VK_AUTH_URL}?action=callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          device_id: deviceId,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось войти через VK");
        window.history.replaceState({}, "", "/login");
        return;
      }
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      sessionStorage.removeItem("vk_state");
      sessionStorage.removeItem("vk_code_verifier");
      navigate("/");
    } catch {
      setError("Сеть недоступна");
    } finally {
      setLoading(false);
    }
  };

  const loginWithVK = async () => {
    setError("");
    setLoading(true);
    try {
      const cfg = await fetch(`${VK_AUTH_URL}?action=config`).then((r) => r.json());
      const clientId = cfg.client_id;
      if (!clientId) {
        setError("Вход через VK ещё не настроен");
        setLoading(false);
        return;
      }
      const codeVerifier = randomString(64);
      const codeChallenge = await sha256(codeVerifier);
      const state = randomString(16);
      sessionStorage.setItem("vk_code_verifier", codeVerifier);
      sessionStorage.setItem("vk_state", state);

      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "s256",
        scope: "email",
      });
      window.location.href = `https://id.vk.com/authorize?${params.toString()}`;
    } catch {
      setError("Не удалось начать вход через VK");
      setLoading(false);
    }
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
              <p className="text-white/50 text-sm">Войди через ВКонтакте</p>
            </div>
          </div>

          <Button
            onClick={loginWithVK}
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-[#0077FF] hover:bg-[#0066DD] text-white font-bold text-base flex items-center justify-center gap-3"
          >
            {loading ? (
              <Icon name="Loader" size={22} className="animate-spin" />
            ) : (
              <>
                <Icon name="AtSign" size={22} />
                Войти через VK ID
              </>
            )}
          </Button>

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