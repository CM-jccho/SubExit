export type WorkspaceView =
  | "messenger"
  | "training"
  | "daily"
  | "prompts"
  | "home"
  | "library"
  | "room"
  | "records"
  | "terms"
  | "guide"
  | "setup"
  | "detail"
  | "live"
  | "demo"
  | "voicePractice"
  | "friendChat";

// Drafts and active calls are transient. Reload returns to their saved collection.
export function workspaceSection(view: WorkspaceView): WorkspaceView {
  if (view === "prompts" || view === "training" || view === "messenger")
    return "library";
  if (view === "daily") return "home";
  if (["setup", "detail", "live"].includes(view)) return "library";
  if (["voicePractice", "friendChat"].includes(view)) return "records";
  return view;
}

export function workspaceView(search: string): WorkspaceView {
  const query = new URLSearchParams(search);
  if (query.get("tour") === "1") return "home";
  if (query.get("live") === "1") return "library";
  if (query.get("demo") === "1") return "demo";
  const view = query.get("view");
  return [
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

export function workspaceUrl(href: string, view: WorkspaceView): string {
  const url = new URL(href);
  for (const key of ["view", "tour", "live", "demo"])
    url.searchParams.delete(key);
  const section = ["prompts", "daily", "training", "messenger"].includes(view)
    ? view
    : workspaceSection(view);
  if (section !== "home") url.searchParams.set("view", section);
  url.hash = "";
  return url.pathname + url.search;
}
