import { initials, avatarColor } from "./utils";

interface AvatarProps {
  name: string;
  url?: string | null;
  seed?: number | string;
  size?: number;
  online?: boolean;
  ring?: boolean;
}

export default function Avatar({ name, url, seed, size = 48, online, ring }: AvatarProps) {
  const dim = { width: size, height: size };
  return (
    <div className="relative shrink-0" style={dim}>
      <div
        className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br ${avatarColor(
          seed ?? name
        )} ${ring ? "ring-2 ring-offset-2 ring-offset-transparent ring-violet-500" : ""}`}
      >
        {url ? (
          <img src={url} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white font-golos font-bold" style={{ fontSize: size * 0.36 }}>
            {initials(name)}
          </span>
        )}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#0a0814] rounded-full" />
      )}
    </div>
  );
}
