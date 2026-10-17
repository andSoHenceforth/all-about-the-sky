"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import CloudSky from "./CloudSky";
import { DEFAULT_SKY, localHour, mapWeather, type SkyParams } from "@/lib/sky";
import { searchCities, type Hit } from "@/lib/geocoding";

type Place = { name: string; lat: number; lon: number };
type SkyContextValue = {
  place: string | null;
  clock: string;
  msg: string;
  q: string;
  setQ: (v: string) => void;
  hits: Hit[];
  locate: () => void;
  choose: (h: Hit) => void;
  setPreset: (p: Omit<SkyParams, "hour">) => void;
};

const KEY = "sky:place";
const SkyContext = createContext<SkyContextValue | null>(null);

export function useSky() {
  const ctx = useContext(SkyContext);
  if (!ctx) throw new Error("useSky must be used inside <SkyProvider>");
  return ctx;
}

function hourIn(tz: string | null, d: Date) {
  if (!tz) return d.getHours() + d.getMinutes() / 60;
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    timeZone: tz,
  }).formatToParts(d);
  const h = +parts.find((p) => p.type === "hour")!.value;
  const m = +parts.find((p) => p.type === "minute")!.value;
  return h + m / 60;
}

export default function SkyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sky, setSky] = useState<SkyParams>(() => ({
    ...DEFAULT_SKY,
    hour: localHour(),
  }));
  const [tz, setTz] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [place, setPlace] = useState<string | null>(null);
  const [loc, setLoc] = useState<Place | null>(null);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

  const load = useCallback(async (p: Place, quiet = false) => {
    if (!quiet) setMsg("Reading the sky...");
    try {
      const r = await fetch(`/api/weather?lat=${p.lat}&lon=${p.lon}`);
      if (!r.ok) throw new Error();
      const c = await r.json();
      setSky(mapWeather(c));
      setTz(c.timezone ?? null);
      setPlace(p.name);
      setLoc(p);
      setMsg("");
      try {
        localStorage.setItem(KEY, JSON.stringify(p));
      } catch {}
    } catch {
      if (!quiet)
        setMsg("Couldn't load the weather, so this is a typical sky.");
    }
  }, []);

  const locate = useCallback(() => {
    if (!navigator.geolocation)
      return setMsg("Location isn't available. Search for a city instead.");
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
  }, [load]);

  const choose = useCallback(
    (h: Hit) => {
      load({ name: h.name, lat: h.latitude, lon: h.longitude });
      setHits([]);
      setQ("");
    },
    [load],
  );

  useEffect(() => {
    let saved: Place | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {}
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load(saved);
      return;
    }
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((s) => {
        if (s.state === "granted") locate();
      })
      .catch(() => {});
  }, [load, locate]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // cache every 15 mins
  useEffect(() => {
    if (!loc) return;
    const id = setInterval(() => load(loc, true), 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [loc, load]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await searchCities(term, ctrl.signal);
        setHits(results);
        setMsg(results.length ? "" : "No matching city found.");
      } catch (e) {
        if ((e as Error).name !== "AbortError")
          setMsg("City search failed. Try again.");
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  const liveSky = useMemo(
    () => ({ ...sky, hour: hourIn(tz, now) }),
    [sky, tz, now],
  );
  const clock =
    tz && place
      ? new Intl.DateTimeFormat(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "numeric",
          minute: "2-digit",
          timeZone: tz,
        }).format(now)
      : "";

  const value: SkyContextValue = {
    place,
    clock,
    msg,
    q,
    setQ,
    hits: q.trim().length < 2 ? [] : hits,
    locate,
    choose,
    setPreset: (p) => setSky((s) => ({ ...p, hour: s.hour })),
  };

  return (
    <SkyContext.Provider value={value}>
      <CloudSky sky={liveSky} interactive={pathname === "/"} />
      <div
        className={`relative ${pathname === "/" ? "pointer-events-none" : ""}`}
      >
        {children}
      </div>
    </SkyContext.Provider>
  );
}
