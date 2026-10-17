"use client";
import { useSky } from "./SkyProvider";
import { PRESETS } from "@/lib/sky";

export default function SkyControls() {
  const { msg, q, setQ, hits, locate, choose, setPreset } = useSky();
  return (
    <section className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/20 bg-slate-950/60 p-3 backdrop-blur">
      <div className="flex gap-2">
        <button
          onClick={locate}
          className="shrink-0 rounded-full border border-white/30 px-3 py-1.5 text-sm hover:bg-white/10"
        >
          Use my location
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (hits[0]) choose(hits[0]);
          }}
          className="flex min-w-0 flex-1"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a city"
            aria-label="Search a city"
            className="min-w-0 flex-1 rounded-full border border-white/30 bg-transparent px-3 py-1.5 text-sm placeholder:text-slate-300"
          />
        </form>
      </div>
      {msg && (
        <p role="status" className="mt-2 text-sm text-slate-200">
          {msg}
        </p>
      )}
      {hits.length > 0 && (
        <ul className="mt-2 divide-y divide-white/10 text-sm">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                className="w-full px-2 py-1.5 text-left hover:bg-white/10"
                onClick={() => choose(h)}
              >
                {h.name}
                {h.admin1 ? `, ${h.admin1}` : ""}
                {h.country ? `, ${h.country}` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
          {Object.entries(PRESETS).map(([name, p]) => (
            <button
              key={name}
              onClick={() => setPreset(p)}
              className="rounded-full border border-white/20 px-2.5 py-1 text-xs hover:bg-white/10"
            >
              {name}
            </button>
          ))}
          <span className="self-center text-xs text-slate-400">dev only</span>
        </div>
      )}
    </section>
  );
}
