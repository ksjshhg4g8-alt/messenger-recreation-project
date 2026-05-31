import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import BottomNav from "@/components/messenger/BottomNav";
import AppLayout from "@/components/messenger/AppLayout";
import { useTheme, THEMES } from "@/lib/theme";

const PRIVACY_KEY = "app_privacy";

interface Privacy {
  showOnline: boolean;
  showLastSeen: boolean;
  whoCanWrite: "all" | "contacts";
  readReceipts: boolean;
}

const DEFAULT_PRIVACY: Privacy = {
  showOnline: true,
  showLastSeen: true,
  whoCanWrite: "all",
  readReceipts: true,
};

function loadPrivacy(): Privacy {
  try {
    return { ...DEFAULT_PRIVACY, ...JSON.parse(localStorage.getItem(PRIVACY_KEY) || "{}") };
  } catch {
    return DEFAULT_PRIVACY;
  }
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-12 h-7 rounded-full transition relative shrink-0 ${
        on ? "bg-gradient-to-r from-violet-500 to-cyan-400" : "bg-white/15"
      }`}
    >
      <span
        className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
          on ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [privacy, setPrivacy] = useState<Privacy>(loadPrivacy);

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) navigate("/login");
  }, [navigate]);

  useEffect(() => {
    localStorage.setItem(PRIVACY_KEY, JSON.stringify(privacy));
  }, [privacy]);

  const set = <K extends keyof Privacy>(key: K, value: Privacy[K]) =>
    setPrivacy((p) => ({ ...p, [key]: value }));

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    navigate("/login");
  };

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 min-w-0 bg-mesh overflow-hidden font-rubik">
        <div className="shrink-0 px-5 py-4 glass-strong border-b border-white/10">
          <h1 className="font-golos font-black text-xl gradient-text">Настройки</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 max-w-xl mx-auto w-full pb-24">
          {/* Тема оформления */}
          <section className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="Palette" size={18} className="text-violet-400" />
              <h2 className="font-golos font-bold text-foreground">Оформление</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border transition ${
                    theme === t.id
                      ? "border-violet-500 bg-violet-500/15 text-foreground"
                      : "border-white/10 text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  <span className="text-xl">{t.emoji}</span>
                  <span className="text-sm font-medium">{t.label}</span>
                  {theme === t.id && (
                    <Icon name="Check" size={16} className="ml-auto text-violet-400" />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Приватность */}
          <section className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="ShieldCheck" size={18} className="text-cyan-400" />
              <h2 className="font-golos font-bold text-foreground">Приватность профиля</h2>
            </div>
            <div className="space-y-1">
              <Row
                title="Показывать, что я в сети"
                desc="Другие видят зелёный индикатор онлайн"
              >
                <Toggle on={privacy.showOnline} onClick={() => set("showOnline", !privacy.showOnline)} />
              </Row>
              <Row title="Показывать время захода" desc="«Был(а) недавно» в профиле">
                <Toggle
                  on={privacy.showLastSeen}
                  onClick={() => set("showLastSeen", !privacy.showLastSeen)}
                />
              </Row>
              <Row title="Отчёты о прочтении" desc="Собеседник видит галочки прочтения">
                <Toggle
                  on={privacy.readReceipts}
                  onClick={() => set("readReceipts", !privacy.readReceipts)}
                />
              </Row>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-foreground mb-2">Кто может мне писать</p>
              <div className="flex gap-2">
                {(["all", "contacts"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => set("whoCanWrite", opt)}
                    className={`flex-1 h-9 rounded-xl text-sm font-medium transition ${
                      privacy.whoCanWrite === opt
                        ? "bg-gradient-to-r from-violet-500 to-cyan-400 text-white"
                        : "bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {opt === "all" ? "Все" : "Только контакты"}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Аккаунт */}
          <section className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="User" size={18} className="text-pink-400" />
              <h2 className="font-golos font-bold text-foreground">Аккаунт</h2>
            </div>
            <button
              onClick={() => navigate("/profile")}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-foreground"
            >
              <span className="text-sm">Редактировать профиль</span>
              <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 p-3 rounded-xl hover:bg-destructive/10 text-destructive"
            >
              <Icon name="LogOut" size={18} />
              <span className="text-sm font-medium">Выйти из аккаунта</span>
            </button>
          </section>
        </div>

        <BottomNav />
      </div>
    </AppLayout>
  );
}

function Row({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
}
