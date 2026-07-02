export default function Loading() {
  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <section style={{ background: "#0B0E13" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 36px" }}>
          <div className="h-3 w-24 rounded bg-white/10 animate-pulse" style={{ marginBottom: 18 }} />
          <div className="h-12 w-56 rounded bg-white/10 animate-pulse" />
        </div>
      </section>
      <section style={{ background: "#F2F0EA" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "30px 32px 70px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
            {[...Array(14)].map((_, i) => (
              <div
                key={i}
                className="w-[calc(50%-7px)] sm:w-[calc(33.333%-10px)] lg:w-[calc(25%-11px)] rounded-2xl bg-white border border-[#E4E1D8] flex flex-col items-center"
                style={{ padding: "28px 16px 22px" }}
              >
                <div className="w-[72px] h-[72px] rounded-full bg-[#E4E1D8] animate-pulse" />
                <div className="h-4 w-24 rounded bg-[#E4E1D8] animate-pulse mt-4" />
                <div className="h-3 w-16 rounded bg-[#E4E1D8] animate-pulse mt-2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
