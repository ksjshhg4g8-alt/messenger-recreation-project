import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useVkAuth } from "@/components/extensions/vk-auth/useVkAuth";

const AUTH_URL = "https://functions.poehali.dev/147fe17e-a4e2-4d6e-9e7a-e85ab2107a90";

export default function VkCallback() {
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
    auth.handleCallback().then((success) => {
      navigate(success ? "/" : "/login");
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-screen bg-mesh font-rubik gap-4">
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center shadow-xl neon-glow animate-float">
        <Icon name="Loader" size={28} className="text-white animate-spin" />
      </div>
      <p className="text-white/60 text-sm">Авторизация...</p>
    </div>
  );
}
