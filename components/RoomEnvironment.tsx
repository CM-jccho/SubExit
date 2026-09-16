"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./CompanionUI";
import {
  roomCities,
  roomClock,
  weatherAppearance,
  periodNames,
  ROOM_SETTINGS_KEY,
  parseRoomWeather,
  type RoomCity,
  type RoomPeriod,
  type RoomWeather,
} from "@/lib/room-environment";
export default function RoomEnvironment({ children }: { children: ReactNode }) {
  const [now, setNow] = useState<Date | null>(null),
    [city, setCity] = useState<RoomCity>("seoul"),
    [motion, setMotion] = useState(true),
    [ready, setReady] = useState(false),
    [preview, setPreview] = useState<RoomPeriod | "auto">("auto"),
    [weather, setWeather] = useState<RoomWeather | null>(null),
    [loading, setLoading] = useState(true),
    [weatherError, setWeatherError] = useState(""),
    [settingsError, setSettingsError] = useState("");
  useEffect(() => {
    setNow(new Date());
    try {
      const raw = localStorage.getItem(ROOM_SETTINGS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.version === 1) {
          if (roomCities.some((c) => c.id === d.city)) setCity(d.city);
          if (typeof d.motion === "boolean") setMotion(d.motion);
        }
      }
    } catch {
      setSettingsError("방 설정을 읽지 못했어요. 기본 지역은 서울이에요.");
    }
    setReady(true);
    const tick = () => setNow(new Date()),
      timer = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    let controller: AbortController | null = null;
    let running = false;
    async function update() {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      setLoading(true);
      const request = new AbortController();
      controller = request;
      const timeout = setTimeout(() => request.abort(), 12000);
      try {
        const r = await fetch(`/api/room-weather?city=${city}`, {
          signal: request.signal,
        });
        const d = await r.json();
        if (!r.ok || d?.city !== city) throw new Error();
        const checked = parseRoomWeather(
          {
            current: {
              temperature_2m: d.temperature,
              weather_code: d.code,
              time: d.time / 1000,
            },
          },
          city,
        );
        if (alive) {
          setWeather(checked);
          setWeatherError("");
        }
      } catch {
        if (alive) {
          setWeather(null);
          setWeatherError("날씨 연결이 잠시 어려워요");
        }
      } finally {
        clearTimeout(timeout);
        running = false;
        if (alive) setLoading(false);
      }
    }
    setWeather(null);
    setWeatherError("");
    void update();
    const timer = setInterval(() => void update(), 1800000);
    const visible = () => {
      if (document.visibilityState === "visible") void update();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [city, ready]);
  function save(nextCity: RoomCity, nextMotion: boolean) {
    setCity(nextCity);
    setMotion(nextMotion);
    try {
      localStorage.setItem(
        ROOM_SETTINGS_KEY,
        JSON.stringify({ version: 1, city: nextCity, motion: nextMotion }),
      );
      setSettingsError("");
    } catch {
      setSettingsError("설정을 저장하지 못했어요. 이번 화면에서만 적용돼요.");
    }
  }
  const clock = now ? roomClock(now) : null,
    period = preview !== "auto" ? preview : clock?.period || "afternoon";
  const current =
    weather &&
    now &&
    weather.city === city &&
    now.getTime() - weather.time <= 90 * 60000
      ? weather
      : null;
  const appearance = current
    ? weatherAppearance(current.code)
    : { kind: "unknown", label: "" };
  return (
    <>
      <div className="dc-room-weatherbar">
        <div>
          <strong>{roomCities.find((c) => c.id === city)?.name} 기준</strong>
          <time>{clock?.text || "시간 확인 중"}</time>
          <span role="status">
            {current
              ? `${appearance.label} · ${Math.round(current.temperature)}°C`
              : loading
                ? "날씨 불러오는 중"
                : weatherError || "날씨 갱신을 기다리고 있어요"}
          </span>
        </div>
        <details className="dc-room-settings">
          <summary>
            <Icon name="edit" size={15} />방 설정
          </summary>
          <div>
            <label>
              날씨 지역
              <select
                value={city}
                onChange={(e) => save(e.target.value as RoomCity, motion)}
              >
                {roomCities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              방 분위기
              <select
                value={preview}
                onChange={(e) =>
                  setPreview(e.target.value as RoomPeriod | "auto")
                }
              >
                <option value="auto">현재 시간에 맞추기</option>
                {Object.entries(periodNames).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label} 미리보기
                  </option>
                ))}
              </select>
            </label>
            <label className="dc-room-motion-toggle">
              <input
                type="checkbox"
                checked={motion}
                onChange={(e) => save(city, e.target.checked)}
              />
              친구와 소품 움직임
            </label>
            <small>
              지역 중심의 날씨와 한국 시간을 사용해요. 기기의 움직임 줄이기
              설정도 적용돼요.
            </small>
          </div>
        </details>
      </div>
      {settingsError && (
        <p className="vn-caption" role="status">
          {settingsError}
        </p>
      )}
      <section
        className="dc-room-stage dc-room-environment"
        aria-label="캐릭터가 모여 있는 AI 대화 상대 공간"
        data-period={period}
        data-weather={appearance.kind}
        data-motion={motion ? "on" : "off"}
        style={
          {
            "--clock-hour": `${((clock?.hour || 0) % 12) * 30 + (clock?.minute || 0) / 2}deg`,
            "--clock-minute": `${(clock?.minute || 0) * 6}deg`,
          } as CSSProperties
        }
      >
        <div className="dc-room-window" aria-hidden="true">
          <span className="dc-room-cloud" />
          <span className="dc-room-precipitation">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <i key={i} style={{ "--drop": i } as CSSProperties} />
            ))}
          </span>
        </div>
        <div className="dc-room-sunbeam" aria-hidden="true" />
        <div className="dc-room-clock" aria-hidden="true">
          <i />
          <b />
        </div>
        <div className="dc-room-shelf" aria-hidden="true">
          <i />
          <i />
          <i />
          <span />
        </div>
        <div className="dc-room-lamp" aria-hidden="true">
          <i />
        </div>
        <div className="dc-room-plant" aria-hidden="true">
          <i />
          <b />
        </div>
        <div className="dc-room-sign">
          {preview !== "auto"
            ? `${periodNames[preview]} 분위기 미리보기`
            : period === "night"
              ? "오늘도 수고했어요"
              : period === "morning"
                ? "가볍게 한마디부터"
                : period === "sunset"
                  ? "잠깐 쉬어가도 좋아요"
                  : "이야기하기 좋은 오후"}
        </div>
        {children}
        <span className="dc-room-rug" aria-hidden="true" />
      </section>
      <p className="dc-room-weather-source">
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          날씨 · Open-Meteo
        </a>
        {current
          ? ` · ${roomClock(new Date(current.time)).text} 기준 모델 날씨`
          : " · 날씨가 없을 때는 시간만 반영해요"}
      </p>
    </>
  );
}
