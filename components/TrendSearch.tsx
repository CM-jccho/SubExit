"use client";
import { useEffect, useRef, useState } from "react";
import { aiFetch } from "@/lib/ai-client";
import {
  citedParts,
  trendLanguages,
  type TrendLanguage,
  type TrendResult,
} from "@/lib/trend-search";
import { Icon } from "./CompanionUI";
import ConsentDisclosure from "./ConsentDisclosure";
import type { AIConfig } from "./VoiceComposer";
export default function TrendSearch({ config }: { config: AIConfig }) {
  const [open, setOpen] = useState(false),
    [language, setLanguage] = useState<TrendLanguage>("ko"),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<TrendResult | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function search() {
    if (abort.current) return;
    const c = new AbortController();
    abort.current = c;
    const timer = setTimeout(() => c.abort(), 50000);
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await aiFetch("/api/term-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          consent,
          adultConsent: consent,
          sampleConsent: consent,
        }),
        signal: c.signal,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult(d);
    } catch (e) {
      setError(
        c.signal.aborted
          ? "검색을 중단했어요. 다시 시도할 수 있어요."
          : e instanceof Error
            ? e.message
            : "검색하지 못했어요.",
      );
    } finally {
      clearTimeout(timer);
      abort.current = null;
      setBusy(false);
    }
  }
  return (
    <section
      className="dc-trend-search"
      aria-label="지금 유행하는 용어 알아보기"
    >
      <button
        className="dc-trend-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>
          <Icon name="search" size={19} /> 지금 유행하는 용어 알아보기
        </span>
        <small>{open ? "접기" : "출처와 함께 검색 →"}</small>
      </button>
      {open && (
        <div className="dc-trend-body">
          <p>
            최근 90일 자료를 우선 찾아 뜻·예문·사용 맥락을 알려드려요. 인기
            순위나 10대 전체의 표현으로 단정하지 않아요.
          </p>
          <label className="vn-label">
            검색할 언어
            <select
              value={language}
              disabled={busy}
              onChange={(e) => {
                setLanguage(e.target.value as TrendLanguage);
                setResult(null);
                setError("");
              }}
            >
              {Object.entries(trendLanguages).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <ConsentDisclosure
            complete={consent}
            disabled={busy}
            onRevoke={() => setConsent(false)}
          >
            <label className="vn-check">
              <input
                type="checkbox"
                checked={consent}
                disabled={busy}
                onChange={(e) => setConsent(e.target.checked)}
              />{" "}
              만 18세 이상이며, 선택한 언어의 공개 표현 검색 요청을 Google에
              전송하는 데 동의합니다. 내 대화·녹음·용어 메모는 보내지 않아요.
            </label>
          </ConsentDisclosure>
          <div className="dc-inline-actions">
            <button
              className="dd-primary"
              disabled={busy || !consent || !config.available}
              onClick={search}
            >
              {busy ? "출처를 찾아보고 있어요…" : "지금 검색하기"}
            </button>
            {busy && (
              <button
                className="dd-secondary"
                onClick={() => abort.current?.abort()}
              >
                검색 중단
              </button>
            )}
            <a
              className="dd-link"
              href={
                "https://www.google.com/search?q=" +
                encodeURIComponent(
                  `${new Date().getFullYear()} ${trendLanguages[language]} 최근 신조어 줄임말 뜻`,
                ) +
                "&tbs=qdr:m"
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              Google에서 직접 검색 ↗
            </a>
          </div>
          {!config.available && (
            <p>
              AI 검색이 연결되지 않았어요. Google에서 직접 검색할 수 있어요.
            </p>
          )}
          {error && (
            <p className="dd-error" role="alert">
              {error}
            </p>
          )}
          {result && (
            <div className="dc-trend-result">
              <p className="vn-caption">
                검색 확인: {new Date(result.searchedAt).toLocaleString("ko-KR")}{" "}
                · {trendLanguages[result.language]} · AI 검색 요약
              </p>
              <div className="dc-grounded-text">
                {citedParts(result).map((p, i) => (
                  <span key={i}>
                    {p.text}
                    {p.sources.map((s, j) => (
                      <a
                        key={s.url + j}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={"검색 근거: " + s.title}
                      >
                        {" "}
                        [{s.title}]
                      </a>
                    ))}
                  </span>
                ))}
              </div>
              <iframe
                title="Google 검색 제안"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                srcDoc={
                  "<!doctype html><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data: https://www.gstatic.com; base-uri 'none'; form-action 'none'\">" +
                  result.suggestions
                }
              />
              <p className="vn-caption">
                뜻과 쓰임은 함께 표시된 원문에서도 확인해 주세요. 검색 결과는 이
                화면에서만 표시해요. 게시일 미확인·오래된 자료는 최신 유행의
                근거로 보기 어려워요.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
