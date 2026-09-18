# Desktop home and Vercel Gemini verification — 2026-09-18

Supersedes the earlier report's `missing_key` status. The user registered the key and redeployed.

## Verified
- Production domain: https://speakcoaching-one.vercel.app
- Gemini configuration GET: HTTP 200, configured, available=true, voiceAvailable=true, model=gemini-2.5-flash, sampleOnly=true.
- One actual fictional friend-appointment coaching POST: HTTP 200, source=ai; returned an apology and proposed finding another meeting time, with no workplace context.
- Server-reported generation latency: 1,563ms. Full request from this verification environment: 18,743ms; these are different measurements.
- Existing home navigation/capability and quick-coaching automated checks: 3 passed, 0 failed. These use JSDOM/mocks, not a rendered browser.
- Production build and type checking: passed.

## Home layout correction
The full-width guidance, centered process line and independently width-limited CTA had become disconnected on desktop. Group them in one card: explanatory content left and action right at >=1000px, stacked below that breakpoint. Remove old desktop CTA width caps. Keep a single CTA and DOM reading order. Process labels now match direct entry: 상대 말 입력 → 다음 한마디 → 대화 이어가기.

## Unverified
Browser connection timed out after 20 seconds. No rendered desktop/mobile screenshot verification is claimed. Check the home at 1440px, 1024px, 768px and 360px; ensure CTA, capability text and process line fit and the CTA opens immediate help. Actual audio transcription, iPhone microphone/keyboard and other Gemini endpoints were not retested in this focused change.
