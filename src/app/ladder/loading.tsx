export default function Loading() {
  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <section style={{ background: "#0B0E13" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 36px" }}>
          <div className="h-3 w-20 rounded bg-white/10 animate-pulse" style={{ marginBottom: 18 }} />
          <div className="h-12 w-52 rounded bg-white/10 animate-pulse" />
        </div>
      </section>
      <section style={{ background: "#F2F0EA" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "28px 32px 60px" }}>
          <div className="rounded-2xl bg-white border border-[#E4E1D8] overflow-hidden">
            {[...Array(14)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-[#F0EDE5]" style={{ padding: "12px 22px" }}>
                <div className="h-4 w-6 rounded bg-[#E4E1D8] animate-pulse" />
                <div className="w-8 h-8 rounded-full bg-[#E4E1D8] animate-pulse" />
                <div className="h-4 w-32 rounded bg-[#E4E1D8] animate-pulse flex-1" />
                <div className="h-3 w-8 rounded bg-[#E4E1D8] animate-pulse" />
                <div className="h-3 w-8 rounded bg-[#E4E1D8] animate-pulse" />
                <div className="h-3 w-8 rounded bg-[#E4E1D8] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
