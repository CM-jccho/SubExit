"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./CompanionUI";
import { downloadBlob, type AudioClip } from "@/lib/voice-notebook";
export const audioTime = (s: number) =>
  `${Math.floor((Number.isFinite(s) ? s : 0) / 60)}:${String(Math.floor((Number.isFinite(s) ? s : 0) % 60)).padStart(2, "0")}`;
export async function inspectAudio(
  blob: Blob,
  name = "녹음",
  maxSeconds = 120,
): Promise<AudioClip> {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    if (!Number.isFinite(buffer.duration) || buffer.duration <= 0)
      throw new Error("음성이 비어 있어요. 다시 녹음해 주세요.");
    if (buffer.duration > maxSeconds)
      throw new Error(
        `${Math.floor(maxSeconds / 60)}분 이하의 음성을 선택해 주세요.`,
      );
    const samples = buffer.getChannelData(0),
      count = 80,
      block = Math.max(1, Math.floor(samples.length / count));
    const peaks = Array.from({ length: count }, (_, i) => {
      let peak = 0;
      for (
        let j = i * block;
        j < Math.min(samples.length, (i + 1) * block);
        j++
      )
        peak = Math.max(peak, Math.abs(samples[j]));
      return peak;
    });
    const max = Math.max(...peaks, 0.01);
    return {
      blob,
      duration: buffer.duration,
      peaks: peaks.map((x) => x / max),
      name,
    };
  } finally {
    await context.close();
  }
}
export default function AudioPlayer({ clip }: { clip: AudioClip }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [nativeControls, setNativeControls] = useState(false);
  const [url, setUrl] = useState(""),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(clip.duration),
    [error, setError] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(clip.blob);
    setUrl(u);
    setTime(0);
    setDuration(clip.duration);
    setPlaying(false);
    setError("");
    return () => URL.revokeObjectURL(u);
  }, [clip.blob, clip.duration]);
  async function toggle() {
    try {
      const audio = ref.current;
      if (!audio || !url) return;
      if (audio.paused || audio.ended || audio.currentTime >= duration) {
        document.querySelectorAll("audio").forEach((a) => {
          if (a !== ref.current) a.pause();
        });
        window.speechSynthesis?.cancel();
        if (
          audio.ended ||
          (duration > 0 && audio.currentTime >= duration - 0.05)
        ) {
          audio.currentTime = 0;
          setTime(0);
        }
        audio.muted = false;
        await audio.play();
      } else audio.pause();
      setError("");
    } catch {
      setError("재생하지 못했어요. 원본을 내려받아 확인해 주세요.");
    }
  }
  return (
    <div className="vn-player">
      <audio
        ref={ref}
        src={url || undefined}
        preload="metadata"
        controls={nativeControls}
        playsInline
        onLoadedMetadata={() => {
          const d = ref.current?.duration;
          if (d && Number.isFinite(d)) setDuration(d);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
          if (ref.current) ref.current.currentTime = 0;
        }}
        onTimeUpdate={() => setTime(ref.current?.currentTime || 0)}
        onError={() =>
          setError(
            "이 브라우저에서 재생할 수 없는 음성이에요. 원본을 내려받아 주세요.",
          )
        }
      />
      <button
        type="button"
        className="vn-play"
        aria-label={playing ? "음성 일시 정지" : "음성 재생"}
        disabled={!url}
        onClick={() => void toggle()}
      >
        <Icon name={playing ? "pause" : "play"} size={20} />
      </button>
      <div className="vn-wave-control">
        {clip.peaks.length ? (
          <div className="vn-peaks" aria-hidden="true">
            {clip.peaks.map((p, i) => (
              <i
                key={i}
                className={
                  i / clip.peaks.length < time / (duration || 1) ? "played" : ""
                }
                style={{ height: Math.max(2, p * 34) }}
              />
            ))}
          </div>
        ) : (
          <div className="vn-no-peaks">음성 기록</div>
        )}
        <input
          type="range"
          min="0"
          max={duration || 1}
          step="0.1"
          value={Math.min(time, duration || 1)}
          aria-label="음성 재생 위치"
          aria-valuetext={`${audioTime(time)} / ${audioTime(duration)}`}
          disabled={!duration}
          onChange={(e) => {
            if (ref.current) ref.current.currentTime = Number(e.target.value);
            setTime(Number(e.target.value));
          }}
        />
      </div>
      <span className="vn-time">
        {audioTime(time)} / {audioTime(duration)}
      </span>
      <button
        type="button"
        className="vn-icon"
        aria-label="음성 원본 다운로드"
        onClick={() =>
          downloadBlob(
            clip.blob,
            "ddeundeun-audio." +
              (clip.blob.type.includes("mp4") || clip.blob.type.includes("m4a")
                ? "m4a"
                : clip.blob.type.includes("mpeg")
                  ? "mp3"
                  : clip.blob.type.includes("wav")
                    ? "wav"
                    : clip.blob.type.includes("ogg")
                      ? "ogg"
                      : clip.blob.type.includes("flac")
                        ? "flac"
                        : clip.blob.type.includes("aac")
                          ? "aac"
                          : "webm"),
          )
        }
      >
        <Icon name="download" size={18} />
      </button>
      {error && (
        <p className="dd-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="dd-link vn-native-toggle"
        onClick={() => setNativeControls((v) => !v)}
        aria-expanded={nativeControls}
      >
        {nativeControls
          ? "기본 재생기 접기"
          : "소리가 안 들리나요? 기본 재생기 열기"}
      </button>
    </div>
  );
}
