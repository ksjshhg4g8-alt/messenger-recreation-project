import { useNavigate, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";

const items = [
  { path: "/", icon: "MessageCircle", label: "Чаты" },
  { path: "/feed", icon: "Newspaper", label: "Лента" },
  { path: "/communities", icon: "Users", label: "Группы" },
  { path: "/profile", icon: "User", label: "Профиль" },
  { path: "/settings", icon: "Settings", label: "Настройки" },
];

export default function SideNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="hidden md:flex shrink-0 flex-col items-center gap-1 w-20 glass-strong border-r border-white/10 py-4 z-30">
      <button
        onClick={() => navigate("/")}
        className="w-12 h-12 mb-3 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center"
        title="Птичка"
      >
        <Icon name="MessageCircle" size={24} className="text-white" />
      </button>
      {items.map((item) => {
        const active =
          item.path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-0.5 w-16 py-2 rounded-2xl transition ${
              active
                ? "text-white bg-white/10"
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
            }`}
            title={item.label}
          >
            <Icon name={item.icon} size={22} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
