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
          <div className="flex flex-col gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white border border-[#E4E1D8]" style={{ padding: 20 }}>
                <div className="h-5 w-40 rounded bg-[#E4E1D8] animate-pulse mb-3" />
                <div className="h-3 w-24 rounded bg-[#E4E1D8] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
