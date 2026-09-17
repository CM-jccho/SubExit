export type WorkspaceView =
  | "more"
  | "messenger"
  | "training"
  | "daily"
  | "prompts"
  | "home"
  | "library"
  | "room"
  | "recording"
  | "records"
  | "terms"
  | "guide"
  | "setup"
  | "detail"
  | "live"
  | "demo"
  | "voicePractice"
  | "friendChat";

export type WorkspacePurpose = "live" | "practice";
export function workspacePurpose(search: string): WorkspacePurpose {
  const query = new URLSearchParams(search);
  return query.get("purpose") === "live" || query.get("live") === "1"
    ? "live"
    : "practice";
}

// The three primary destinations are independent of saved deep-link destinations.
export function workspaceSection(view: WorkspaceView): WorkspaceView {
  if (
    [
      "messenger",
      "daily",
      "room",
      "terms",
      "guide",
      "more",
      "friendChat",
    ].includes(view)
  )
    return "more";
  if (view === "records" || view === "recording") return "records";
  return "home";
}
export function workspaceView(search: string): WorkspaceView {
  const query = new URLSearchParams(search);
  if (query.get("tour") === "1" || query.get("live") === "1") return "library";
  if (query.get("demo") === "1") return "demo";
  const view = query.get("view");
  return [
    "more",
    "messenger",
    "training",
    "daily",
    "prompts",
    "home",
    "library",
    "room",
    "records",
    "terms",
    "guide",
    "demo",
  ].includes(view || "")
    ? (view as WorkspaceView)
    : "home";
}
export function workspaceUrl(
  href: string,
  view: WorkspaceView,
  purpose: WorkspacePurpose = workspacePurpose(new URL(href).search),
): string {
  const url = new URL(href);
  for (const key of ["view", "tour", "live", "demo", "purpose"])
    url.searchParams.delete(key);
  // Drafts and active calls reload into their saved collection, never an empty call.
  const destination = ["setup", "detail", "live"].includes(view)
    ? "library"
    : ["voicePractice", "friendChat", "recording"].includes(view)
      ? "records"
      : view;
  if (destination !== "home") url.searchParams.set("view", destination);
  if (purpose === "live" && destination === "library")
    url.searchParams.set("purpose", "live");
  url.hash = "";
  return url.pathname + url.search;
}
