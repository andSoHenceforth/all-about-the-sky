export type Hit = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

export async function searchCities(
  term: string,
  signal?: AbortSignal,
): Promise<Hit[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=5&language=en&format=json`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error("Geocoding failed");
  return (await r.json()).results ?? [];
}
