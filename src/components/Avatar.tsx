import Image from "next/image";

type Props = {
  url: string | null;
  name: string;
  size?: number;
  goldFallback?: boolean;
};

export default function Avatar({ url, name, size = 40, goldFallback = false }: Props) {
  const initial = name.trim()[0]?.toUpperCase() ?? "?";

  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  // Gold initial badge for winner display; otherwise deterministic colour from name
  const fallbackClass = goldFallback
    ? "bg-brand-gold text-white"
    : (() => {
        const colours = [
          "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-pink-500",
          "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-teal-500",
        ];
        return `${colours[name.charCodeAt(0) % colours.length]} text-white`;
      })();

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${fallbackClass} font-bold shrink-0 select-none`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  );
}
