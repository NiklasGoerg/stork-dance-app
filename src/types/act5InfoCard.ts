export type Act5InfoInstruction = {
  beat: number;
  text: string;
  active: boolean;
};

export type Act5InfoTone =
  "instruction" | "neutral" | "excellent" | "success" | "error" | "warning";

export type Act5InfoCardMode =
  "seasonPreview" | "activeMovement" | "periodTransition" | "completed";

export type Act5InfoCardModel = {
  mode: Act5InfoCardMode;
  seasonLabel: string;
  movementPercentLabel: string;
  periodLabel: string;
  temperature: {
    valueLabel: string;
    baselineLabel?: string;
    isBaseline: boolean;
  };
  instructions: Act5InfoInstruction[];
  feedback?: {
    text: string;
    tone: Act5InfoTone;
  };
  subtitle?: string;
  completion?: {
    title: string;
    subtitle?: string;
  };
  periodTransition?: {
    previousPeriod: string;
    nextPeriod: string;
  };
};
