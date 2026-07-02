export default function Loading() {
  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <section style={{ background: "#0B0E13" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 36px" }}>
          <div className="h-3 w-20 rounded bg-white/10 animate-pulse" style={{ marginBottom: 18 }} />
          <div className="h-12 w-48 rounded bg-white/10 animate-pulse" />
        </div>
      </section>
      <section style={{ background: "#F2F0EA" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "28px 32px 60px" }}>
          <div className="flex flex-col gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white border border-[#E4E1D8]" style={{ padding: 20 }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#E4E1D8] animate-pulse" />
                    <div className="h-4 w-28 rounded bg-[#E4E1D8] animate-pulse" />
                  </div>
                  <div className="h-3 w-8 rounded bg-[#E4E1D8] animate-pulse" />
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-28 rounded bg-[#E4E1D8] animate-pulse" />
                    <div className="w-10 h-10 rounded-full bg-[#E4E1D8] animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
