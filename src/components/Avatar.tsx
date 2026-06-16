import Image from "next/image";

type Props = {
  url: string | null;
  name: string;
  size?: number;
};

export default function Avatar({ url, name, size = 40 }: Props) {
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

  // Deterministic colour from name
  const colours = [
    "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-pink-500",
    "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-teal-500",
  ];
  const colour = colours[name.charCodeAt(0) % colours.length];

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${colour} text-white font-bold shrink-0 select-none`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  );
}
