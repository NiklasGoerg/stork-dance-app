import type { MigrationGestureFeedbackCode } from "~/types/migrationAct";

export type MigrationGestureFeedbackCatalogEntry = {
  titleKey: string;
  textKey: string;
  narrationKey: string;
};

export const migrationGestureFeedbackCatalog: Record<
  Exclude<MigrationGestureFeedbackCode, "SUCCESS">,
  MigrationGestureFeedbackCatalogEntry
> = {
  CHECKPOINT_NOT_EVALUABLE: {
    titleKey: "story.migrationPanel.feedback.notEvaluable.title",
    textKey: "story.migrationPanel.feedback.notEvaluable.text",
    narrationKey: "story.migrationPanel.narration.notEvaluable",
  },
  CROUCH_LOWER: {
    titleKey: "story.migrationPanel.feedback.tryAgain",
    textKey: "story.migrationPanel.feedback.crouchLower",
    narrationKey: "story.migrationPanel.narration.crouchLower",
  },
  RISE_UP: {
    titleKey: "story.migrationPanel.feedback.tryAgain",
    textKey: "story.migrationPanel.feedback.riseUp",
    narrationKey: "story.migrationPanel.narration.riseUp",
  },
  HANDS_UP: {
    titleKey: "story.migrationPanel.feedback.tryAgain",
    textKey: "story.migrationPanel.feedback.handsUp",
    narrationKey: "story.migrationPanel.narration.handsUp",
  },
  ARMS_OUT: {
    titleKey: "story.migrationPanel.feedback.tryAgain",
    textKey: "story.migrationPanel.feedback.armsOut",
    narrationKey: "story.migrationPanel.narration.armsOut",
  },
  LOWER_ARMS: {
    titleKey: "story.migrationPanel.feedback.tryAgain",
    textKey: "story.migrationPanel.feedback.lowerArms",
    narrationKey: "story.migrationPanel.narration.lowerArms",
  },
  TRY_AGAIN: {
    titleKey: "story.migrationPanel.feedback.tryAgain",
    textKey: "story.migrationPanel.feedback.genericRetry",
    narrationKey: "story.migrationPanel.narration.genericRetry",
  },
};

export const getMigrationGestureFeedbackCatalogEntry = (
  code: MigrationGestureFeedbackCode,
) => (code === "SUCCESS" ? null : migrationGestureFeedbackCatalog[code]);
