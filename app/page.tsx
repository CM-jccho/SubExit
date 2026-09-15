import { Suspense } from "react";
import ConversationWorkspace from "@/components/ConversationWorkspace";
export default function Home() {
  return (
    <Suspense
      fallback={<main style={{ padding: 40 }}>든든콜을 준비하고 있어요.</main>}
    >
      <ConversationWorkspace />
    </Suspense>
  );
}
