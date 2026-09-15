import data from "./scenario-data.json";
export type Tone = "firm_polite" | "warm" | "cold";
export type Round = {
  id: string;
  opponent: string;
  pattern: string;
  hint: string;
  cues: Record<Tone, string>;
};
export type Scenario = {
  id: string;
  title: string;
  description: string;
  avatar: string;
  goal: string;
  rounds: Round[];
};
export const scenarios = data as Scenario[];
export const getScenario = (id: string) => scenarios.find((s) => s.id === id);
export const tones: { id: Tone; label: string }[] = [
  { id: "firm_polite", label: "단호·공손" },
  { id: "warm", label: "부드럽게" },
  { id: "cold", label: "간결하게" },
];
