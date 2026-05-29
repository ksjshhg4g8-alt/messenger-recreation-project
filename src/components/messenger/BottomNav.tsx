import { useNavigate, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";

const items = [
  { path: "/", icon: "MessageCircle", label: "Чаты" },
  { path: "/feed", icon: "Newspaper", label: "Лента" },
  { path: "/communities", icon: "Users", label: "Группы" },
  { path: "/profile", icon: "User", label: "Профиль" },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="shrink-0 flex items-stretch justify-around glass-strong border-t border-white/10 px-2 py-1.5 z-30">
      {items.map((item) => {
        const active = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl transition ${
              active ? "text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            <div
              className={`w-10 h-7 rounded-xl flex items-center justify-center transition ${
                active ? "bg-gradient-to-br from-violet-500 to-cyan-400" : ""
              }`}
            >
              <Icon name={item.icon} size={20} />
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
