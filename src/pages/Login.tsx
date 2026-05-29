import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AUTH_URL = "https://functions.poehali.dev/fb5f08dd-1ca0-4e74-9ab7-eea1b2889a88";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register" | "recover">("login");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [recQuestion, setRecQuestion] = useState("");
  const [recAnswer, setRecAnswer] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // восстановление: step 1 — логин, step 2 — ответ + новый пароль
  const [recStep, setRecStep] = useState(1);
  const [recFoundQuestion, setRecFoundQuestion] = useState("");

  useEffect(() => {
    if (localStorage.getItem("auth_token")) navigate("/");
  }, [navigate]);

  const saveAndGo = (data: { token: string; user: unknown }) => {
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));
    navigate("/");
  };

  const callAuth = async (action: string, body: Record<string, unknown>) => {
    const res = await fetch(`${AUTH_URL}?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 402) {
      return { ok: false, data: { error: "Сервис временно недоступен. Попробуйте позже." } };
    }
    let data: { error?: string; [k: string]: unknown } = {};
    try {
      data = await res.json();
    } catch {
      data = { error: "Сервер сейчас недоступен. Попробуйте позже." };
    }
    return { ok: res.ok, data };
  };

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const body =
        mode === "register"
          ? { login, password, name, recovery_question: recQuestion, recovery_answer: recAnswer }
          : { login, password };
      const { ok, data } = await callAuth(mode, body);
      if (!ok) {
        setError(data.error || "Ошибка входа");
        return;
      }
      saveAndGo(data);
    } catch {
      setError(
        !navigator.onLine
          ? "Нет подключения к интернету. Проверьте сеть и повторите."
          : "Не удалось связаться с сервером. Нажмите «Повторить»."
      );
    } finally {
      setLoading(false);
    }
  };

  const recoverFindQuestion = async () => {
    setError("");
    setLoading(true);
    try {
      const { ok, data } = await callAuth("recover-question", { login });
      if (!ok) {
        setError(data.error || "Не удалось найти аккаунт");
        return;
      }
      setRecFoundQuestion(data.question);
      setRecStep(2);
    } catch {
      setError(
        !navigator.onLine
          ? "Нет подключения к интернету. Проверьте сеть и повторите."
          : "Не удалось связаться с сервером. Нажмите «Повторить»."
      );
    } finally {
      setLoading(false);
    }
  };

  const recoverReset = async () => {
    setError("");
    setLoading(true);
    try {
      const { ok, data } = await callAuth("recover-reset", {
        login,
        recovery_answer: recAnswer,
        new_password: password,
      });
      if (!ok) {
        setError(data.error || "Ошибка восстановления");
        return;
      }
      saveAndGo(data);
    } catch {
      setError(
        !navigator.onLine
          ? "Нет подключения к интернету. Проверьте сеть и повторите."
          : "Не удалось связаться с сервером. Нажмите «Повторить»."
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: "login" | "register" | "recover") => {
    setMode(m);
    setError("");
    setRecStep(1);
    setRecFoundQuestion("");
  };

  const canSubmit =
    login.trim().length >= 3 &&
    password.length >= (mode === "register" ? 6 : 1);

  return (
    <div className="flex items-start sm:items-center justify-center min-h-screen w-screen bg-mesh font-rubik overflow-y-auto py-6">
      <div className="w-full max-w-md mx-4 animate-slide-up">
        <div className="glass-strong rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center shadow-xl neon-glow animate-float">
              <Icon name="MessageCircle" size={36} className="text-white" />
            </div>
            <div className="text-center">
              <h1 className="font-golos font-black text-3xl gradient-text mb-1">ПтичкаMax</h1>
              <p className="text-white/50 text-sm">
                {mode === "login" && "Вход по логину и паролю"}
                {mode === "register" && "Создай новый аккаунт"}
                {mode === "recover" && "Восстановление пароля"}
              </p>
            </div>
          </div>

          {mode !== "recover" && (
            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl">
              <button
                onClick={() => switchMode("login")}
                className={`flex-1 h-9 rounded-xl text-sm font-medium transition ${
                  mode === "login" ? "bg-gradient-to-r from-violet-500 to-cyan-400 text-white" : "text-white/50"
                }`}
              >
                Вход
              </button>
              <button
                onClick={() => switchMode("register")}
                className={`flex-1 h-9 rounded-xl text-sm font-medium transition ${
                  mode === "register" ? "bg-gradient-to-r from-violet-500 to-cyan-400 text-white" : "text-white/50"
                }`}
              >
                Регистрация
              </button>
            </div>
          )}

          {mode !== "recover" ? (
            <div className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="text-xs text-white/50 mb-2 block">Имя (необязательно)</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Как тебя зовут?"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-white/50 mb-2 block">Логин</label>
                <Input
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Придумай логин"
                  autoComplete="username"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-2 block">Пароль</label>
                <div className="relative">
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && canSubmit && submit()}
                    type={showPass ? "text" : "password"}
                    placeholder={mode === "register" ? "Минимум 6 символов" : "Введи пароль"}
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <Icon name={showPass ? "EyeOff" : "Eye"} size={18} />
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <>
                  <div>
                    <label className="text-xs text-white/50 mb-2 block">Секретный вопрос (для восстановления)</label>
                    <Input
                      value={recQuestion}
                      onChange={(e) => setRecQuestion(e.target.value)}
                      placeholder="Например: кличка первого питомца?"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-2 block">Ответ на секретный вопрос</label>
                    <Input
                      value={recAnswer}
                      onChange={(e) => setRecAnswer(e.target.value)}
                      placeholder="Запомни этот ответ"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl"
                    />
                  </div>
                </>
              )}

              <Button
                onClick={submit}
                disabled={loading || !canSubmit}
                className="w-full h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 hover:opacity-90 font-bold"
              >
                {loading ? (
                  <Icon name="Loader" size={20} className="animate-spin" />
                ) : mode === "login" ? (
                  "Войти"
                ) : (
                  "Зарегистрироваться"
                )}
              </Button>

              {mode === "login" && (
                <button
                  onClick={() => switchMode("recover")}
                  className="w-full text-center text-white/50 hover:text-white text-xs"
                >
                  Забыли пароль?
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-2 block">Логин</label>
                <Input
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Ваш логин"
                  disabled={recStep === 2}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl disabled:opacity-60"
                />
              </div>

              {recStep === 1 ? (
                <Button
                  onClick={recoverFindQuestion}
                  disabled={loading || login.trim().length < 3}
                  className="w-full h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 hover:opacity-90 font-bold"
                >
                  {loading ? <Icon name="Loader" size={20} className="animate-spin" /> : "Продолжить"}
                </Button>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-white/50 mb-2 block">Секретный вопрос</label>
                    <p className="text-white text-sm bg-white/5 rounded-xl px-3 py-3">{recFoundQuestion}</p>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-2 block">Ваш ответ</label>
                    <Input
                      value={recAnswer}
                      onChange={(e) => setRecAnswer(e.target.value)}
                      placeholder="Ответ на вопрос"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-2 block">Новый пароль</label>
                    <Input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showPass ? "text" : "password"}
                      placeholder="Минимум 6 символов"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl"
                    />
                  </div>
                  <Button
                    onClick={recoverReset}
                    disabled={loading || recAnswer.trim().length < 1 || password.length < 6}
                    className="w-full h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 hover:opacity-90 font-bold"
                  >
                    {loading ? <Icon name="Loader" size={20} className="animate-spin" /> : "Сменить пароль и войти"}
                  </Button>
                </>
              )}

              <button
                onClick={() => switchMode("login")}
                className="w-full text-center text-white/50 hover:text-white text-xs"
              >
                ← Вернуться ко входу
              </button>
            </div>
          )}

          {error && (
            <div className="space-y-2 bg-red-500/10 rounded-xl p-3">
              <div className="text-xs text-red-400 text-center">{error}</div>
              {/(сервер|интернет|сеть|позже)/i.test(error) && (
                <button
                  onClick={() => {
                    if (mode !== "recover") {
                      submit();
                    } else if (recStep === 1) {
                      recoverFindQuestion();
                    } else {
                      recoverReset();
                    }
                  }}
                  disabled={loading}
                  className="w-full h-9 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition"
                >
                  <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
                  Повторить
                </button>
              )}
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