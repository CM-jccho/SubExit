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
export function speechConstructor(): SpeechConstructor | undefined {
  if (typeof window === "undefined") return;
  const host = window as unknown as {
    SpeechRecognition?: SpeechConstructor;
    webkitSpeechRecognition?: SpeechConstructor;
  };
  return host.SpeechRecognition || host.webkitSpeechRecognition;
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
  constructor(
    private Engine: SpeechConstructor,
    private handlers: {
      caption: (final: string, interim: string) => void;
      state: (state: "connecting" | "listening") => void;
      error: (message: string) => void;
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
    const engine = new this.Engine();
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
    };
    engine.onresult = (event) => {
      if (!this.active) return;
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
      if (!this.active || error === "no-speech") return;
      this.fail(
        error === "not-allowed" || error === "service-not-allowed"
          ? "실시간 음성 인식 권한이 필요해요. 브라우저 권한을 확인하거나 짧게 녹음을 사용해 주세요."
          : error === "network"
            ? "음성 인식 연결이 끊겼어요. 인식된 말은 남아 있어요. 연결을 확인하고 다시 시작해 주세요."
            : "이 브라우저에서 실시간 음성 인식을 시작하지 못했어요. 짧게 녹음이나 직접 입력을 사용해 주세요.",
      );
    };
    engine.onend = () => {
      clearTimeout(this.startup);
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
// requests for every partial word; keep within the existing 12/min API limit.
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
    private interval = 6000,
    private settle = 650,
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
