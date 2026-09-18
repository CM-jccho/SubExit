// Permission prompts may stay unanswered indefinitely. Release late streams after
// timeout/cancel so returning to text never starts the microphone in the background.
export const MICROPHONE_WAIT_MS = 15000;

export function requestMicrophone(
  constraints: MediaStreamConstraints,
  signal: AbortSignal,
  timeoutMs = MICROPHONE_WAIT_MS,
): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
    };
    const fail = (error: unknown) => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(error);
    };
    const cancel = () => fail(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(
      () =>
        fail(
          new Error(
            "마이크 권한 응답을 기다리다 중단했어요. 주소창의 권한을 확인한 뒤 다시 녹음하거나 직접 입력해 주세요.",
          ),
        ),
      timeoutMs,
    );
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) {
      cancel();
      return;
    }
    try {
      navigator.mediaDevices.getUserMedia(constraints).then((media) => {
        if (finished) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        finished = true;
        cleanup();
        resolve(media);
      }, fail);
    } catch (error) {
      fail(error);
    }
  });
}
