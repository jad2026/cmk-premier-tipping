"use client";

import { usePathname } from "next/navigation";

const IMAGES = ["/brands/heritage-1.jpg", "/brands/heritage-2.jpg", "/brands/heritage-3.jpg", "/brands/heritage-4.jpg"];

// Each row starts on a different photo so the rows don't line up.
const ROWS = [
  { order: [0, 1, 2, 3], duration: 90, reverse: false, offset: 0 },
  { order: [2, 3, 0, 1], duration: 120, reverse: true, offset: -300 },
  { order: [1, 3, 0, 2], duration: 105, reverse: false, offset: 0 },
];

const CSS = `
.heritage-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
}
.heritage-row {
  display: flex;
  gap: 18px;
  width: max-content;
  animation: heritage-scroll linear infinite;
}
.heritage-img {
  height: max(36vh, 220px);
  width: auto;
  flex-shrink: 0;
  filter: grayscale(1) sepia(.25);
  opacity: .12;
  mix-blend-mode: multiply;
  border-radius: 4px;
}
.heritage-fade {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(242,240,234,.55) 0%, rgba(242,240,234,0) 70%);
}
@keyframes heritage-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
@media (max-width: 639px) {
  .heritage-img { height: max(28vh, 160px); }
}
@media (prefers-reduced-motion: reduce) {
  .heritage-row { animation: none; }
}
/* Let the photos show through the full-width cream sections and the auth
   pages' full-page cream wrapper. White cards and dark sections stay solid. */
html[data-heritage-bg] section[style*="#F2F0EA" i],
html[data-heritage-bg] section[style*="rgb(242, 240, 234)"],
html[data-heritage-bg] .auth-page-bg {
  background: transparent !important;
}
`;

export default function HeritageBackground() {
  const pathname = usePathname();
  if (pathname === "/hub") return null;

  return (
    <div className="heritage-bg" aria-hidden="true">
      <style>{CSS}</style>
      {ROWS.map((row, r) => (
        <div
          key={r}
          className="heritage-row"
          style={{
            animationDuration: `${row.duration}s`,
            animationDirection: row.reverse ? "reverse" : "normal",
            marginLeft: row.offset,
          }}
        >
          {/* The 4 photos twice, so translating by -50% loops seamlessly. */}
          {[...row.order, ...row.order].map((idx, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={IMAGES[idx]} alt="" loading="lazy" className="heritage-img" />
          ))}
        </div>
      ))}
      <div className="heritage-fade" />
    </div>
  );
}
