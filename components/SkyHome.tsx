"use client";
import { useEffect, useState } from "react";
import CloudSky from "./CloudSky";
import {
  DEFAULT_SKY,
  PRESETS,
  localHour,
  mapWeather,
  type SkyParams,
} from "@/lib/sky";

/**
 * Location used for retrieving weather data
 */
type Place = { name: string; lat: number; lon: number };

/**
 * Location returned by Open-Meteo geocoding API
 */
type Hit = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

// local storage for most recent selected location
const KEY = "sky:place";

/**
 * Retrieves weather data given location.
 * Then convert it into SkyParams obj for animation of sky
 * @param p Location for retrieving weather data
 * @returns Sky data, location name
 */
async function fetchSkyData(
  p: Place,
): Promise<{ sky: SkyParams; name: string }> {
  const r = await fetch(`/api/weather?lat=${p.lat}&lon=${p.lon}`);
  if (!r.ok) throw new Error("Weather fetch failed");
  const data = await r.json();
  return { sky: mapWeather(data), name: p.name };
}

/**
 * Home page component containing interactive sky
 * @returns
 */
export default function SkyHome() {
  const [sky, setSky] = useState<SkyParams>(() => ({
    ...DEFAULT_SKY,
    hour: localHour(),
  }));
  const [place, setPlace] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

  /**
   * Load weather data for location to update sky accordingly
   * Also, if the page is reloaded or opened again, the most recent
   * location will be remembered and set.
   * @param p
   */
  async function load(p: Place) {
    setMsg("Reading the sky...");
    try {
      const result = await fetchSkyData(p);
      setSky(result.sky);
      setPlace(result.name);
      setMsg("");
      try {
        localStorage.setItem(KEY, JSON.stringify(p));
      } catch {}
    } catch {
      setSky({ ...DEFAULT_SKY, hour: localHour() });
      setMsg("Couldn't load the weather, so this is a typical sky.");
    }
  }

  /**
   * Requests geographic location of user
   */
  function locate() {
    if (!navigator.geolocation)
      return setMsg(
        "Location services are currently not available. Search for a city instead.",
      );
    setMsg("Finding you...");
    navigator.geolocation.getCurrentPosition(
      (p) =>
        load({
          name: "your location",
          lat: p.coords.latitude,
          lon: p.coords.longitude,
        }),
      () => setMsg("Location was blocked. Search for a city instead."),
      { timeout: 8000 },
    );
  }

  /**
   * Search for cities functionality.
   * Uses Open-Meteo geocoding API.
   * @param e form submission event
   */
  async function search(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!q.trim()) return;
    try {
      const r = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`,
      );
      const j = await r.json();
      setHits(j.results ?? []);
      setMsg(j.results ? "" : "No matching city found.");
    } catch {
      setMsg("City search failed. Try again.");
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function initLocation() {
      let saved: Place | null = null;
      try {
        saved = JSON.parse(localStorage.getItem(KEY) || "null");
      } catch {}

      if (saved) {
        setMsg("Reading the sky...");
        try {
          const result = await fetchSkyData(saved);
          if (isMounted) {
            setSky(result.sky);
            setPlace(result.name);
            setMsg("");
          }
        } catch {
          if (isMounted) {
            setSky({ ...DEFAULT_SKY, hour: localHour() });
            setMsg("Couldn't load the weather, so this is a typical sky.");
          }
        }
        return;
      }

      try {
        const permission = await navigator.permissions?.query({
          name: "geolocation",
        });
        if (permission?.state === "granted" && isMounted) {
          navigator.geolocation.getCurrentPosition(
            async (p) => {
              const geoPlace = {
                name: "your location",
                lat: p.coords.latitude,
                lon: p.coords.longitude,
              };
              setMsg("Reading the sky...");
              try {
                const res = await fetchSkyData(geoPlace);
                if (isMounted) {
                  setSky(res.sky);
                  setPlace(res.name);
                  setMsg("");
                }
              } catch {
                if (isMounted)
                  setMsg("Couldn't load weather for your location.");
              }
            },
            () => {},
            { timeout: 8000 },
          );
        }
      } catch {}
    }

    initLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="relative h-dvh overflow-hidden bg-slate-900 text-white">
      <CloudSky sky={sky} />
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
        <header>
          <h1 className="text-3xl font-semibold drop-shadow sm:text-5xl">
            All About the Sky
          </h1>
          <p className="mt-1 text-slate-200 drop-shadow">
            {place
              ? `The sky over ${place}`
              : "Push, drag or swipe the clouds!"}
          </p>
        </header>
        <section className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/20 bg-slate-950/60 p-3 backdrop-blur">
          <div className="flex gap-2">
            <button
              onClick={locate}
              className="shrink-0 rounded-full border border-white/30 px-3 py-1.5 text-sm hover:bg-white/10"
            >
              Use my location
            </button>
            <form onSubmit={search} className="flex min-w-0 flex-1">
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
                    onClick={() => {
                      load({ name: h.name, lat: h.latitude, lon: h.longitude });
                      setHits([]);
                      setQ("");
                    }}
                  >
                    {h.name}
                    {h.admin1 ? `, ${h.admin1}` : ""}
                    {h.country ? `, ${h.country}` : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {/** Dev-only testing */}
          {process.env.NODE_ENV === "development" && (
            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
              {Object.keys(PRESETS).map((k) => (
                <button
                  key={k}
                  onClick={() =>
                    setSky((s) => ({ ...PRESETS[k], hour: s.hour }))
                  }
                  className="rounded-full border border-white/20 px-2.5 py-1 text-xs hover:bg-white/10"
                >
                  {k}
                </button>
              ))}
              <span className="self-center text-xs text-slate-400">
                dev only
              </span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
