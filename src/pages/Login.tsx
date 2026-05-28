import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AUTH_URL = "https://functions.poehali.dev/5fd254ac-b084-4d77-b335-521d7c4031b2";

export default function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (localStorage.getItem("auth_token")) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    if (!digits) return "";
    const d = digits.startsWith("8") ? "7" + digits.slice(1) : digits;
    const parts = ["+7"];
    if (d.length >= 4) parts.push(" (" + d.slice(1, 4) + ")");
    else if (d.length > 1) parts.push(" (" + d.slice(1, 4));
    if (d.length >= 5) parts.push(" " + d.slice(4, 7));
    if (d.length >= 8) parts.push("-" + d.slice(7, 9));
    if (d.length >= 10) parts.push("-" + d.slice(9, 11));
    return parts.join("");
  };

  const sendCode = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${AUTH_URL}?action=send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка отправки");
        return;
      }
      setStep("code");
      setResendIn(60);
    } catch {
      setError("Сеть недоступна");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${AUTH_URL}?action=verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка проверки");
        return;
      }
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      navigate("/");
    } catch {
      setError("Сеть недоступна");
    } finally {
      setLoading(false);
    }
  };

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
              <p className="text-white/50 text-sm">
                {step === "phone" ? "Войди по номеру телефона" : "Введи код из SMS"}
              </p>
            </div>
          </div>

          {step === "phone" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-2 block">Имя (необязательно)</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Как тебя зовут?"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-2 block">Номер телефона</label>
                <Input
                  value={formatPhone(phone)}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="+7 (___) ___-__-__"
                  inputMode="tel"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl text-lg"
                />
              </div>
              <Button
                onClick={sendCode}
                disabled={loading || phone.replace(/\D/g, "").length < 11}
                className="w-full h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 hover:opacity-90 font-bold"
              >
                {loading ? (
                  <Icon name="Loader" size={20} className="animate-spin" />
                ) : (
                  <>Получить код <Icon name="ArrowRight" size={18} className="ml-2" /></>
                )}
              </Button>
            </div>
          )}

          {step === "code" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-2 block">
                  Код отправлен на {formatPhone(phone)}
                </label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="______"
                  inputMode="numeric"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-14 rounded-xl text-2xl text-center tracking-[0.5em] font-bold"
                />
              </div>
              <Button
                onClick={verifyCode}
                disabled={loading || code.length < 4}
                className="w-full h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 hover:opacity-90 font-bold"
              >
                {loading ? <Icon name="Loader" size={20} className="animate-spin" /> : "Войти"}
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button
                  onClick={() => { setStep("phone"); setCode(""); setError(""); }}
                  className="text-white/50 hover:text-white flex items-center gap-1"
                >
                  <Icon name="ChevronLeft" size={14} /> Изменить номер
                </button>
                <button
                  onClick={sendCode}
                  disabled={resendIn > 0 || loading}
                  className="text-cyan-300 hover:text-cyan-200 disabled:text-white/30"
                >
                  {resendIn > 0 ? `Отправить заново (${resendIn})` : "Отправить заново"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 text-center bg-red-500/10 rounded-xl p-3">
              {error}
            </div>
          )}

          <p className="text-[11px] text-white/30 text-center leading-relaxed">
            Продолжая, ты соглашаешься с условиями использования и политикой конфиденциальности
          </p>
        </div>
      </div>
    </div>
  );
}
