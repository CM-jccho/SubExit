import { Suspense } from "react";
import CoachExperience from "@/components/CoachExperience";
export default function Home() {
  return (
    <Suspense
      fallback={<main style={{ padding: 40 }}>든든콜을 준비하고 있어요.</main>}
    >
      <CoachExperience />
    </Suspense>
  );
}
