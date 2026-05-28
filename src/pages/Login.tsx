import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import VkLoginButton from "@/components/extensions/vk-auth/VkLoginButton";
import { useVkAuth } from "@/components/extensions/vk-auth/useVkAuth";

const AUTH_URL = "https://functions.poehali.dev/147fe17e-a4e2-4d6e-9e7a-e85ab2107a90";

export default function Login() {
  const navigate = useNavigate();
  const auth = useVkAuth({
    apiUrls: {
      authUrl: `${AUTH_URL}?action=auth-url`,
      callback: `${AUTH_URL}?action=callback`,
      refresh: `${AUTH_URL}?action=refresh`,
      logout: `${AUTH_URL}?action=logout`,
    },
  });

  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate("/");
    }
  }, [auth.isAuthenticated, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen w-screen bg-mesh font-rubik">
      <div className="w-full max-w-md mx-4 animate-slide-up">
        <div className="glass-strong rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center shadow-xl neon-glow animate-float">
              <Icon name="MessageCircle" size={36} className="text-white" />
            </div>
            <div className="text-center">
              <h1 className="font-golos font-black text-3xl gradient-text mb-1">Vibe Messenger</h1>
              <p className="text-white/50 text-sm">Войди, чтобы продолжить</p>
            </div>
          </div>

          <div className="pt-2">
            <VkLoginButton onClick={auth.login} isLoading={auth.isLoading} />
          </div>

          {auth.error && (
            <div className="text-xs text-red-400 text-center bg-red-500/10 rounded-xl p-3">
              {auth.error}
            </div>
          )}

          <p className="text-[11px] text-white/30 text-center leading-relaxed">
            Нажимая «Войти через VK», вы соглашаетесь с условиями использования и политикой конфиденциальности
          </p>
        </div>
      </div>
    </div>
  );
}
