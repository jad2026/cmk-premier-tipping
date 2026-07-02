export default function Loading() {
  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <section style={{ background: "#0B0E13" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "32px 32px 36px" }}>
          <div className="h-3 w-28 rounded bg-white/10 animate-pulse mb-6" />
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-white/10 animate-pulse" />
            <div>
              <div className="h-8 w-48 rounded bg-white/10 animate-pulse" />
              <div className="h-3 w-32 rounded bg-white/10 animate-pulse mt-3" />
            </div>
          </div>
        </div>
      </section>
      <section style={{ background: "#F2F0EA" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "32px 32px 70px" }}>
          <div className="h-3 w-20 rounded bg-[#E4E1D8] animate-pulse mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-[#E4E1D8] overflow-hidden">
                <div className="bg-[#0B0E13] animate-pulse" style={{ aspectRatio: "1" }} />
                <div className="bg-white" style={{ padding: "10px 12px 12px" }}>
                  <div className="h-3 w-16 rounded bg-[#E4E1D8] animate-pulse mb-2" />
                  <div className="h-4 w-24 rounded bg-[#E4E1D8] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
