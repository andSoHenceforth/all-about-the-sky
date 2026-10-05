import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(1)}&longitude=${lon.toFixed(1)}` +
    `&current=cloud_cover,wind_speed_10m,wind_direction_10m,precipitation,weather_code&timezone=auto`;
  try {
    const r = await fetch(url, { next: { revalidate: 900 } });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    return NextResponse.json(j.current, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Weather unavailable" }, { status: 502 });
  }
}
