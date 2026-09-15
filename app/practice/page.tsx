import { Suspense } from "react";
import CoachExperience from "@/components/CoachExperience";
export default function Practice() {
  return (
    <Suspense fallback={<main>연습을 준비하고 있어요.</main>}>
      <CoachExperience />
    </Suspense>
  );
}
