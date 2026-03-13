export type MoodId = "stressed" | "tired" | "restless" | "lonely" | "overwhelmed" | "okay" | "peaceful";

export type MoodSuggestion = {
  text: string;
  href: "/focus" | "/music" | "/breathe" | "/gratitude" | "/compliment";
};
