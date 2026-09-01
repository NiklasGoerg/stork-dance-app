import { describe, expect, it } from "vitest";
import { buildMigrationActInfoPanelModel } from "~/utils/migrationActs/infoPanel";
import type { MigrationGestureEvaluationResult } from "~/types/migrationAct";

const translate = (
  key: string,
  params: Record<string, string | number> = {},
) => (Object.keys(params).length ? `${key}:${JSON.stringify(params)}` : key);

const baseArgs = {
  translate,
  movements: [],
  playbackState: "playing",
  currentPhase: "summer_rest",
  systemError: "",
  gestureState: "inactive",
  gesturePhase: "idle",
  gestureId: null,
  gestureAttempt: 0,
  gestureCueText: "",
  gestureFeedback: null,
  gestureFeedbackVisible: false,
  gestureCanContinue: false,
  movementFeedbackVisible: false,
  storyNarrationTitle: undefined,
  storyNarrationText: undefined,
  showDevActions: false,
  completed: false,
  showContinueAction: false,
} as const;

const successGestureFeedback: MigrationGestureEvaluationResult = {
  id: "feedback-1",
  status: "success",
  gestureId: "departure",
  attemptNumber: 1,
  checkpointId: null,
  failedCriteria: [],
  primaryFeedbackCode: "SUCCESS",
};

const correctiveGestureFeedback: MigrationGestureEvaluationResult = {
  id: "feedback-2",
  status: "failed",
  gestureId: "arrival",
  attemptNumber: 1,
  checkpointId: null,
  failedCriteria: ["body"],
  primaryFeedbackCode: "CROUCH_LOWER",
};

describe("buildMigrationActInfoPanelModel", () => {
  it("keeps story narration visible while specific gesture success feedback is shown separately", () => {
    const model = buildMigrationActInfoPanelModel({
      ...baseArgs,
      gestureState: "success-exit",
      gestureId: "departure",
      gestureFeedback: successGestureFeedback,
      gestureFeedbackVisible: true,
      storyNarrationTitle: "Migration timing",
      storyNarrationText: "The stork reaches the departure point.",
    });

    expect(model).toMatchObject({
      mode: "gestureFeedback",
      title: "Migration timing",
      instruction: "The stork reaches the departure point.",
      feedbackText: "story.migrationPanel.success.departure.text",
      feedbackPrimary: true,
      tone: "success",
    });
    expect(model.feedbackTitle).toBeUndefined();
  });

  it("keeps corrective gesture wording as feedback without replacing the active instruction", () => {
    const model = buildMigrationActInfoPanelModel({
      ...baseArgs,
      gestureState: "retry-scheduled",
      gestureId: "arrival",
      gestureCueText: "Follow the landing motion.",
      gestureFeedback: correctiveGestureFeedback,
      gestureFeedbackVisible: true,
    });

    expect(model).toMatchObject({
      mode: "gestureFeedback",
      instruction: "story.migrationPanel.gestures.arrival.preparation",
      detail: "Follow the landing motion.",
      feedbackTitle: "story.migrationPanel.feedback.tryAgain",
      feedbackText: "story.migrationPanel.feedback.crouchLower",
      tone: "error",
    });
  });

  it("shows passive movement feedback as a separate message over the current narration", () => {
    const model = buildMigrationActInfoPanelModel({
      ...baseArgs,
      movementFeedbackVisible: true,
      storyNarrationTitle: "Southbound route",
      storyNarrationText: "The route leads through the eastern flyway.",
    });

    expect(model).toMatchObject({
      mode: "storyNarration",
      title: "Southbound route",
      instruction: "The route leads through the eastern flyway.",
      feedbackText: "story.acts.act4.movementText.good",
      feedbackPrimary: true,
      tone: "success",
    });
  });

  it("returns to contextual movement instruction after narration ends", () => {
    const model = buildMigrationActInfoPanelModel({
      ...baseArgs,
      currentPhase: "winter_rest",
      movementFeedbackVisible: false,
      storyNarrationTitle: "",
      storyNarrationText: "",
    });

    expect(model).toMatchObject({
      mode: "phaseInstruction",
      title: "story.migrationPanel.movements.winterRest",
      instruction: "story.migrationPanel.instructions.winterRest",
      tone: "neutral",
    });
    expect(model.feedbackText).toBeUndefined();
  });
});
