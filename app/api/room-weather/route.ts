import { NextResponse } from "next/server";
import { roomCities, parseRoomWeather } from "@/lib/room-environment";
export const runtime = "nodejs";
export const maxDuration = 15;
export async function GET(request: Request) {
  const city = roomCities.find(
    (c) => c.id === (new URL(request.url).searchParams.get("city") || "seoul"),
  );
  if (!city)
    return NextResponse.json(
      { error: "날씨 지역을 확인해 주세요." },
      { status: 400 },
    );
  try {
    const params = new URLSearchParams({
      latitude: String(city.latitude),
      longitude: String(city.longitude),
      current: "temperature_2m,weather_code",
      timezone: "Asia/Seoul",
      timeformat: "unixtime",
      forecast_days: "1",
    });
    const fetchOptions = {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(7000),
    } as RequestInit & { next: { revalidate: number } };
    const response = await fetch(
      "https://api.open-meteo.com/v1/forecast?" + params,
      fetchOptions,
    );
    if (!response.ok) throw new Error("weather_unavailable");
    const weather = parseRoomWeather(await response.json(), city.id);
    return NextResponse.json(weather, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "날씨를 불러오지 못했어요. 시간에 맞는 방 분위기는 계속 유지돼요.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
