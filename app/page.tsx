import LaunchIntro from "@/components/LaunchIntro";
import { Suspense } from "react";
import ConversationWorkspace from "@/components/ConversationWorkspace";
export default function Home() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 40 }}>스픽코칭을 준비하고 있어요.</main>
      }
    >
      <ConversationWorkspace />
      <LaunchIntro />
    </Suspense>
  );
}
