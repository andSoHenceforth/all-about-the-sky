/**
 * Parameters that define what the sky should look like.
 */
export type SkyParams = {
  cover: number; // cloud coverage ranging from 0 to 100
  wind: number; // wind speed from -60 to 60
  heavy: number; // cloud darkness from 0 to 100
  rain: number; // rain intensity from 0 to 100
  hour: number; // time of day from 0 to (almost) 24
};

/**
 * Current weather data brought to you by the Open-Meteo API!
 */
export type CurrentWeather = {
  cloud_cover: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  precipitation: number;
  weather_code: number;
  time: string;
};

/**
 * In the case that weather data is not available, paint a normal sky.
 */
export const DEFAULT_SKY: SkyParams = {
  cover: 45,
  wind: 20,
  heavy: 10,
  rain: 0,
  hour: 12,
};

/**
 * For my eyes only :) Different types of skies to test some numbers. The hour doesn't matter.
 */
export const PRESETS: Record<string, Omit<SkyParams, "hour">> = {
  Clear: { cover: 8, wind: 10, heavy: 0, rain: 0 },
  Fair: { cover: 40, wind: 25, heavy: 10, rain: 0 },
  Overcast: { cover: 95, wind: 15, heavy: 55, rain: 0 },
  Rainy: { cover: 90, wind: 35, heavy: 70, rain: 55 },
  Storm: { cover: 100, wind: 70, heavy: 100, rain: 100 },
};

/**
 * Retrieves the user's current time as a decimal representation
 *
 * @returns Decimal representation of user's current time
 */
export const localHour = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
};

/**
 * Restricts a value to remain in an inclusive range.
 * Prevents extreme severe weather values from producing excessive animation
 */
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Maps current weather data into real values that can be used to render the sky
 *
 * @param c Current weather data returned by the Open-Meteo API
 * @returns Normalised parameters for the sky to be rendered
 */
export function mapWeather(c: CurrentWeather): SkyParams {
  const code = c.weather_code;
  const rainy = (code >= 61 && code <= 67) || (code >= 80 && code <= 82);
  return {
    cover: Math.round(c.cloud_cover),
    wind: clamp(
      Math.round(
        c.wind_speed_10m * -Math.sin((c.wind_direction_10m * Math.PI) / 180),
      ),
      -60,
      60,
    ),
    // According to WMO codes (https://open-meteo.com/en/docs#weathervariable)
    heavy:
      code >= 95 // thunderstorm (WW 95-99)
        ? 100
        : rainy // rainy (WW 61-67, 80-82)
          ? 70
          : code >= 51 // drizzle (WW 51-57)
            ? 45
            : code === 3 // overcast (WW 3)
              ? 55
              : code >= 45 // foggy (WW 45, 48)
                ? 50
                : Math.round(c.cloud_cover * 0.25), // fallback to somewhat cloudy skies
    rain:
      code >= 95
        ? 100
        : c.precipitation > 0
          ? clamp(Math.round(30 + c.precipitation * 25), 0, 100)
          : 0,
    hour: +c.time.slice(11, 13) + +c.time.slice(14, 16) / 60,
  };
}
