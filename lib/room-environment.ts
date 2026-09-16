export const roomCities = [
  { id: "seoul", name: "서울", latitude: 37.5665, longitude: 126.978 },
  { id: "incheon", name: "인천", latitude: 37.4563, longitude: 126.7052 },
  { id: "busan", name: "부산", latitude: 35.1796, longitude: 129.0756 },
  { id: "daegu", name: "대구", latitude: 35.8714, longitude: 128.6014 },
  { id: "daejeon", name: "대전", latitude: 36.3504, longitude: 127.3845 },
  { id: "gwangju", name: "광주", latitude: 35.1595, longitude: 126.8526 },
  { id: "gangneung", name: "강릉", latitude: 37.7519, longitude: 128.8761 },
  { id: "jeju", name: "제주", latitude: 33.4996, longitude: 126.5312 },
] as const;
export type RoomCity = (typeof roomCities)[number]["id"];
export type RoomPeriod = "morning" | "afternoon" | "sunset" | "night";
export const periodNames = {
  morning: "아침",
  afternoon: "오후",
  sunset: "해 질 녘",
  night: "밤",
};
export const ROOM_SETTINGS_KEY = "ddeundeun-room-settings-v1";
export type RoomWeather = {
  city: RoomCity;
  temperature: number;
  code: number;
  time: number;
  fetchedAt: number;
};
export function weatherAppearance(code: number) {
  if ([95, 96, 99].includes(code)) return { kind: "rain", label: "뇌우" };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { kind: "snow", label: "눈" };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { kind: "rain", label: "비" };
  if ([45, 48].includes(code)) return { kind: "cloudy", label: "안개" };
  if ([2, 3].includes(code)) return { kind: "cloudy", label: "구름 많음" };
  if ([0, 1].includes(code)) return { kind: "clear", label: "맑음" };
  return { kind: "unknown", label: "날씨 정보 확인 중" };
}
export function roomClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value),
    minute = Number(parts.find((p) => p.type === "minute")?.value);
  const period: RoomPeriod =
    hour >= 6 && hour < 12
      ? "morning"
      : hour >= 12 && hour < 17
        ? "afternoon"
        : hour >= 17 && hour < 19
          ? "sunset"
          : "night";
  return {
    hour,
    minute,
    period,
    text: `${hour < 12 ? "오전" : "오후"} ${hour % 12 || 12}:${String(minute).padStart(2, "0")}`,
  };
}
export function parseRoomWeather(
  body: unknown,
  city: RoomCity,
  now = Date.now(),
): RoomWeather {
  const d = (
    body as {
      current?: {
        temperature_2m?: unknown;
        weather_code?: unknown;
        time?: unknown;
      };
    }
  )?.current;
  if (
    !d ||
    typeof d.temperature_2m !== "number" ||
    !Number.isFinite(d.temperature_2m) ||
    d.temperature_2m < -80 ||
    d.temperature_2m > 65 ||
    typeof d.weather_code !== "number" ||
    !Number.isInteger(d.weather_code) ||
    weatherAppearance(d.weather_code).kind === "unknown" ||
    typeof d.time !== "number" ||
    !Number.isFinite(d.time) ||
    now - d.time * 1000 > 90 * 60 * 1000 ||
    d.time * 1000 - now > 10 * 60 * 1000
  )
    throw new Error("invalid_weather");
  return {
    city,
    temperature: d.temperature_2m,
    code: d.weather_code,
    time: d.time * 1000,
    fetchedAt: now,
  };
}
