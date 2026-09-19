// Keep microphone recognition independent of the slower coaching request.
export type SpeechResultEvent = {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
export interface SpeechEngine {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  start(): void;
  abort(): void;
}
export type SpeechConstructor = new () => SpeechEngine;
export type SpeechSupportReason = "unsupported" | "ios-non-safari";

export function speechSupport(): {
  constructor?: SpeechConstructor;
  reason?: SpeechSupportReason;
} {
  if (typeof window === "undefined") return {};
  const host = window as unknown as {
    SpeechRecognition?: SpeechConstructor;
    webkitSpeechRecognition?: SpeechConstructor;
  };
  const Engine = host.SpeechRecognition || host.webkitSpeechRecognition;
  if (!Engine) return { reason: "unsupported" };

  const ua = navigator.userAgent || "";
  const isiOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // On iOS, non-Safari browsers can expose webkitSpeechRecognition even when
  // the embedding browser cannot actually start the recognition service.
  const nonSafariIOS =
    isiOS && /(CriOS|FxiOS|EdgiOS|OPiOS|GSA)/.test(ua);
  if (nonSafariIOS) return { reason: "ios-non-safari" };

  return { constructor: Engine };
}

export function speechSupportMessage(reason?: SpeechSupportReason) {
  if (reason === "ios-non-safari")
    return "iPhone에서는 Safari에서 실시간 자막을 사용해 주세요. 현재 브라우저에서는 들려주기나 직접 입력을 이용할 수 있어요.";
  return "이 브라우저는 실시간 자막을 지원하지 않아요. 들려주기나 직접 입력을 이용해 주세요.";
}

export function speechConstructor(): SpeechConstructor | undefined {
  return speechSupport().constructor;
}
export const tailTranscript = (text: string) => text.trim().slice(-1000);

export class SpeechStream {
  private engine?: SpeechEngine;
  private active = false;
  private committed = "";
  private currentFinal = "";
  private restart?: ReturnType<typeof setTimeout>;
  private startup?: ReturnType<typeof setTimeout>;
  private restarts = 0;
  private silence?: ReturnType<typeof setTimeout>;
  constructor(
    private Engine: SpeechConstructor,
    private handlers: {
      caption: (final: string, interim: string) => void;
      state: (state: "connecting" | "listening") => void;
      error: (message: string) => void;
      notice?: (message: string) => void;
    },
    private language = "ko-KR",
  ) {}
  start() {
    this.active = true;
    this.connect();
  }
  private fail(message: string) {
    this.stop();
    this.handlers.error(message);
  }
  private connect() {
    if (!this.active) return;
    let engine: SpeechEngine;
    try {
      engine = new this.Engine();
    } catch {
      this.fail(
        "이 브라우저에서 음성 인식을 열지 못했어요. 짧게 녹음하거나 직접 입력해 주세요.",
      );
      return;
    }
    this.engine = engine;
    this.currentFinal = "";
    engine.continuous = true;
    engine.interimResults = true;
    engine.lang = this.language;
    this.handlers.state("connecting");
    this.startup = setTimeout(
      () =>
        this.fail(
          "음성 인식 연결이 지연돼요. 다시 시작하거나 짧게 녹음을 사용해 주세요.",
        ),
      12000,
    );
    engine.onstart = () => {
      if (!this.active) return;
      clearTimeout(this.startup);
      this.handlers.state("listening");
      this.silence = setTimeout(() => {
        if (this.active)
          this.handlers.notice?.(
            "아직 인식된 말이 없어요. 마이크 입력과 사이트 권한을 확인해 주세요. 계속 안 되면 짧게 녹음하거나 직접 입력할 수 있어요.",
          );
      }, 15000);
    };
    engine.onresult = (event) => {
      if (!this.active) return;
      clearTimeout(this.silence);
      this.handlers.notice?.("");
      this.restarts = 0;
      let final = "",
        interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript + " ";
        else interim += result[0].transcript;
      }
      this.currentFinal = final.trim();
      this.handlers.caption(
        tailTranscript(this.committed + " " + final),
        interim.trim().slice(-1000),
      );
    };
    engine.onerror = ({ error }) => {
      if (!this.active) return;
      if (error === "no-speech") {
        this.handlers.notice?.(
          "말소리를 인식하지 못했어요. 마이크 가까이에서 말하거나 짧게 녹음·직접 입력으로 이어가세요.",
        );
        return;
      }
      this.fail(
        error === "audio-capture"
          ? "마이크 소리를 받지 못했어요. 연결된 마이크와 브라우저의 입력 장치를 확인해 주세요."
          : error === "language-not-supported"
            ? "이 브라우저의 음성 인식에서 한국어를 사용할 수 없어요. 짧게 녹음하거나 직접 입력해 주세요."
            : error === "not-allowed" || error === "service-not-allowed"
              ? "실시간 음성 인식 권한이 필요해요. 브라우저 권한을 확인하거나 짧게 녹음을 사용해 주세요."
              : error === "network"
                ? "음성 인식 연결이 끊겼어요. 인식된 말은 남아 있어요. 연결을 확인하고 다시 시작해 주세요."
                : "이 브라우저에서 실시간 음성 인식을 시작하지 못했어요. 짧게 녹음이나 직접 입력을 사용해 주세요.",
      );
    };
    engine.onend = () => {
      clearTimeout(this.startup);
      clearTimeout(this.silence);
      if (!this.active) return;
      this.committed = tailTranscript(this.committed + " " + this.currentFinal);
      if (++this.restarts > 3) {
        this.fail(
          "음성 인식이 반복해서 종료됐어요. 다시 시작하거나 짧게 녹음을 사용해 주세요.",
        );
        return;
      }
      this.handlers.state("connecting");
      this.restart = setTimeout(() => this.connect(), 300);
    };
    try {
      engine.start();
    } catch {
      this.fail(
        "실시간 음성 인식을 시작하지 못했어요. 다시 시작하거나 짧게 녹음을 사용해 주세요.",
      );
    }
  }
  stop() {
    this.active = false;
    clearTimeout(this.silence);
    clearTimeout(this.restart);
    clearTimeout(this.startup);
    if (this.engine) {
      this.engine.onend =
        this.engine.onresult =
        this.engine.onerror =
        this.engine.onstart =
          null;
      try {
        this.engine.abort();
      } catch {
        /* already stopped */
      }
    }
  }
}

// One in-flight request and one replaceable pending snapshot. Never accumulate
// requests for every partial word; keep within the quick-coach 24/min API limit.
export class LatestCoachQueue<T> {
  private pending = "";
  private lastSent = "";
  private lastStarted = 0;
  private inFlight = false;
  private active = true;
  private timer?: ReturnType<typeof setTimeout>;
  private abort?: AbortController;
  constructor(
    private handlers: {
      generate: (text: string, signal: AbortSignal) => Promise<T>;
      result: (result: T, text: string) => void;
      busy: (busy: boolean) => void;
      error: (error: unknown) => void;
    },
    private interval = 3000,
    private settle = 350,
  ) {}
  update(text: string) {
    const next = tailTranscript(text);
    if (
      !this.active ||
      next.length < 2 ||
      next === this.lastSent ||
      next === this.pending
    )
      return;
    this.pending = next;
    this.schedule();
  }
  private schedule() {
    if (!this.active || this.inFlight || !this.pending) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => void this.run(),
      Math.max(this.settle, this.lastStarted + this.interval - Date.now()),
    );
  }
  private async run() {
    if (!this.active || this.inFlight || !this.pending) return;
    const text = this.pending;
    this.pending = "";
    this.lastSent = text;
    this.lastStarted = Date.now();
    this.inFlight = true;
    this.abort = new AbortController();
    const timeout = setTimeout(() => this.abort?.abort(), 25000);
    this.handlers.busy(true);
    try {
      const result = await this.handlers.generate(text, this.abort.signal);
      if (this.active) this.handlers.result(result, text);
    } catch (error) {
      if (this.active) {
        this.active = false; // no hidden quota retries; captions can continue
        this.pending = "";
        this.handlers.error(error);
      }
    } finally {
      clearTimeout(timeout);
      this.inFlight = false;
      this.handlers.busy(false);
      this.schedule();
    }
  }
  cancel() {
    this.active = false;
    this.pending = "";
    clearTimeout(this.timer);
    this.abort?.abort();
  }
}
