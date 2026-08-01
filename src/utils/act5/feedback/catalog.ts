import type {
  Act5CriterionFeedbackMetadata,
  Act5FeedbackCategory,
} from "~/types/act5";
import type { ClimateSeason } from "~/types/climate";
import type { AutumnFeedbackCode } from "~/utils/movement/acts/climate/autumn/autumnTypes";
import type { SpringFeedbackCode } from "~/utils/movement/acts/climate/spring/springTypes";
import type { SummerFeedbackCode } from "~/utils/movement/acts/climate/summer/summerTypes";
import type { WinterFeedbackCode } from "~/utils/movement/acts/climate/winter/winterTypes";

type MetadataMap = Record<string, Act5CriterionFeedbackMetadata>;

const metadata = (
  category: Act5FeedbackCategory,
  priority: number,
  options: Omit<Act5CriterionFeedbackMetadata, "category" | "priority"> = {
    bodyRegion: null,
  },
): Act5CriterionFeedbackMetadata => ({
  category,
  priority,
  ...options,
});

export const act5CommonFeedbackMetadata: MetadataMap = {
  FULL_BODY_NOT_VISIBLE: metadata("tracking", 0, { bodyRegion: "fullBody" }),
  UPPER_BODY_NOT_VISIBLE: metadata("tracking", 1, { bodyRegion: "upperBody" }),
  HANDS_NOT_VISIBLE: metadata("tracking", 2, { bodyRegion: "hands" }),
  LOWER_BODY_NOT_VISIBLE: metadata("tracking", 9, {
    bodyRegion: "lowerBody",
    optionalLowerBody: true,
  }),
  TRY_AGAIN: metadata("generic", 99, { bodyRegion: null }),
};

export const winterFeedbackMetadata: MetadataMap = {
  ...act5CommonFeedbackMetadata,
  OPEN_ARMS_WIDER: metadata("startPose", 10, { bodyRegion: "hands" }),
  RAISE_ARMS_TO_SHOULDERS: metadata("startPose", 11, {
    bodyRegion: "hands",
  }),
  STRAIGHTEN_ARMS_MORE: metadata("form", 40, { bodyRegion: "upperBody" }),
  CROSS_ARMS_IN_FRONT: metadata("startPose", 20, { bodyRegion: "hands" }),
  REACH_OPPOSITE_SHOULDERS: metadata("form", 41, { bodyRegion: "hands" }),
  KEEP_ARMS_CROSSED: metadata("form", 42, { bodyRegion: "hands" }),
  STAY_UPRIGHT: metadata("intensity", 30, { bodyRegion: "upperBody" }),
  STAY_HIGHER: metadata("intensity", 31, { bodyRegion: "upperBody" }),
  CONTRACT_MORE: metadata("intensity", 32, { bodyRegion: "upperBody" }),
  BEND_KNEES_MORE: metadata("intensity", 89, {
    bodyRegion: "lowerBody",
    optionalLowerBody: true,
  }),
  KEEP_BODY_COMPACT: metadata("form", 43, { bodyRegion: "upperBody" }),
  PROTECT_HEAD: metadata("form", 35, { bodyRegion: "hands" }),
  LOWER_BODY_AND_PROTECT_HEAD: metadata("intensity", 33, {
    bodyRegion: "upperBody",
  }),
  RETURN_TO_UPRIGHT: metadata("returnPose", 50, { bodyRegion: "upperBody" }),
  LOWER_ARMS: metadata("returnPose", 51, { bodyRegion: "hands" }),
};

export const winterCriterionFeedbackMetadata: MetadataMap = {
  "open-arms-wide": metadata("startPose", 10, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hands-shoulder-height": metadata("startPose", 11, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "arms-straight": metadata("form", 40, {
    bodyRegion: "upperBody",
    trackingCode: "UPPER_BODY_NOT_VISIBLE",
  }),
  "self-hug-crossed": metadata("startPose", 20, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "opposite-shoulders": metadata("form", 41, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "stay-upright": metadata("intensity", 30, {
    bodyRegion: "upperBody",
    trackingCode: "UPPER_BODY_NOT_VISIBLE",
  }),
  "value-contraction": metadata("intensity", 30, {
    bodyRegion: "upperBody",
    trackingCode: "UPPER_BODY_NOT_VISIBLE",
  }),
  "knee-contraction": metadata("intensity", 89, {
    bodyRegion: "lowerBody",
    trackingCode: "LOWER_BODY_NOT_VISIBLE",
    optionalLowerBody: true,
  }),
  "keep-arms-crossed": metadata("form", 42, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "head-protection": metadata("form", 35, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "return-upright": metadata("returnPose", 50, {
    bodyRegion: "upperBody",
    trackingCode: "UPPER_BODY_NOT_VISIBLE",
  }),
  "arms-released": metadata("returnPose", 51, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "feet-stable": metadata("form", 90, {
    bodyRegion: "lowerBody",
    trackingCode: "LOWER_BODY_NOT_VISIBLE",
    optionalLowerBody: true,
  }),
};

export const springFeedbackMetadata: MetadataMap = {
  ...act5CommonFeedbackMetadata,
  START_HANDS_LOW: metadata("startPose", 10, { bodyRegion: "hands" }),
  KEEP_HANDS_CLOSE_TO_BODY: metadata("startPose", 11, {
    bodyRegion: "hands",
  }),
  OPEN_ARMS_TO_BEGIN: metadata("form", 40, { bodyRegion: "hands" }),
  OPEN_ARMS_HIGHER: metadata("intensity", 30, { bodyRegion: "hands" }),
  KEEP_BLOOM_LOWER: metadata("intensity", 31, { bodyRegion: "hands" }),
  REACH_ABOVE_HEAD: metadata("form", 41, { bodyRegion: "hands" }),
  GATHER_HANDS_IN_FRONT: metadata("form", 42, { bodyRegion: "hands" }),
  LOWER_AND_RETURN: metadata("returnPose", 50, { bodyRegion: "hands" }),
  LIFT_OTHER_KNEE: metadata("form", 90, {
    bodyRegion: "lowerBody",
    optionalLowerBody: true,
  }),
  MATCH_BOTH_HANDS: metadata("form", 43, { bodyRegion: "hands" }),
};

export const springCriterionFeedbackMetadata: MetadataMap = {
  "hands-start-low": metadata("startPose", 10, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hands-close-to-body": metadata("startPose", 11, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "beat2-shoulder-chest-height": metadata("intensity", 30, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "value-hand-height": metadata("intensity", 30, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "endpoint-arm-opening": metadata("form", 40, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hands-open-side": metadata("form", 41, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "wrists-outside-shoulders": metadata("form", 42, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hands-overhead": metadata("form", 43, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hands-gathered-front": metadata("form", 44, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hands-return-prayer": metadata("returnPose", 50, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "arms-extended": metadata("form", 45, {
    bodyRegion: "upperBody",
    trackingCode: "UPPER_BODY_NOT_VISIBLE",
  }),
  "knee-pattern": metadata("form", 90, {
    bodyRegion: "lowerBody",
    trackingCode: "LOWER_BODY_NOT_VISIBLE",
    optionalLowerBody: true,
  }),
};

export const summerFeedbackMetadata: MetadataMap = {
  ...act5CommonFeedbackMetadata,
  MOVE_HANDS_TO_CENTER: metadata("startPose", 10, { bodyRegion: "hands" }),
  RAISE_ARMS_HIGHER: metadata("intensity", 30, { bodyRegion: "hands" }),
  STRAIGHTEN_ARMS: metadata("form", 40, { bodyRegion: "upperBody" }),
  STEP_WIDER: metadata("form", 90, {
    bodyRegion: "lowerBody",
    optionalLowerBody: true,
  }),
  STEP_SMALLER: metadata("form", 91, {
    bodyRegion: "lowerBody",
    optionalLowerBody: true,
  }),
  OPEN_ARMS_TO_SIDES: metadata("intensity", 31, { bodyRegion: "hands" }),
  OPEN_ARMS_LESS: metadata("intensity", 32, { bodyRegion: "hands" }),
  RETURN_FEET_TO_CENTER: metadata("returnPose", 90, {
    bodyRegion: "lowerBody",
    optionalLowerBody: true,
  }),
  LOWER_ARMS: metadata("returnPose", 50, { bodyRegion: "hands" }),
  BEND_ELBOWS_MORE: metadata("form", 41, { bodyRegion: "upperBody" }),
  MOVEMENT_TOO_LARGE: metadata("intensity", 33, { bodyRegion: "hands" }),
  MOVEMENT_TOO_SMALL: metadata("intensity", 34, { bodyRegion: "hands" }),
  ALTERNATE_STEP_SIDE: metadata("form", 92, {
    bodyRegion: "lowerBody",
    optionalLowerBody: true,
  }),
};

export const summerCriterionFeedbackMetadata: MetadataMap = {
  "feet-close": metadata("form", 90, {
    bodyRegion: "lowerBody",
    trackingCode: "LOWER_BODY_NOT_VISIBLE",
    optionalLowerBody: true,
  }),
  "one-leg-stepped-side": metadata("form", 91, {
    bodyRegion: "lowerBody",
    trackingCode: "LOWER_BODY_NOT_VISIBLE",
    optionalLowerBody: true,
  }),
  "alternate-step-side": metadata("form", 92, {
    bodyRegion: "lowerBody",
    trackingCode: "LOWER_BODY_NOT_VISIBLE",
    optionalLowerBody: true,
  }),
  "stepped-leg-remains": metadata("form", 93, {
    bodyRegion: "lowerBody",
    trackingCode: "LOWER_BODY_NOT_VISIBLE",
    optionalLowerBody: true,
  }),
  "feet-returned-close": metadata("returnPose", 90, {
    bodyRegion: "lowerBody",
    trackingCode: "LOWER_BODY_NOT_VISIBLE",
    optionalLowerBody: true,
  }),
  "returned-from-expansion": metadata("returnPose", 91, {
    bodyRegion: "lowerBody",
    trackingCode: "LOWER_BODY_NOT_VISIBLE",
    optionalLowerBody: true,
  }),
  "hands-together": metadata("startPose", 10, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hand-center-between-shoulders": metadata("startPose", 11, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hands-chest-height": metadata("startPose", 12, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hands-raised-from-prep": metadata("intensity", 30, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hands-above-head": metadata("intensity", 31, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hands-stay-compact": metadata("startPose", 13, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hand-raise-target": metadata("intensity", 32, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hands-open-sides": metadata("intensity", 33, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hands-shoulder-height": metadata("form", 40, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "arm-opening-target": metadata("intensity", 34, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "elbow-angle-target": metadata("form", 41, {
    bodyRegion: "upperBody",
    trackingCode: "UPPER_BODY_NOT_VISIBLE",
  }),
  "hands-lowered-sides": metadata("returnPose", 50, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
};

export const autumnFeedbackMetadata: MetadataMap = {
  ...act5CommonFeedbackMetadata,
  START_LEFT: metadata("startPose", 10, { bodyRegion: "hands" }),
  START_RIGHT: metadata("startPose", 11, { bodyRegion: "hands" }),
  WRONG_SWEEP_DIRECTION: metadata("direction", 20, { bodyRegion: "hands" }),
  SWEEP_LEFT: metadata("direction", 21, { bodyRegion: "hands" }),
  SWEEP_RIGHT: metadata("direction", 22, { bodyRegion: "hands" }),
  INSUFFICIENT_PROGRESS: metadata("intensity", 30, { bodyRegion: "hands" }),
  ENDPOINT_TOO_SHORT: metadata("intensity", 31, { bodyRegion: "hands" }),
  ENDPOINT_TOO_FAR: metadata("intensity", 32, { bodyRegion: "hands" }),
  ENDPOINT_REACHED_TOO_LATE: metadata("timing", 60, { bodyRegion: "hands" }),
  ENDPOINT_UNSTABLE: metadata("timing", 61, { bodyRegion: "hands" }),
  END_AT_DESTINATION_SIDE: metadata("intensity", 33, { bodyRegion: "hands" }),
  END_AT_FAR_DESTINATION_SIDE: metadata("intensity", 34, {
    bodyRegion: "hands",
  }),
  END_AT_CENTER: metadata("intensity", 35, { bodyRegion: "hands" }),
  END_BEFORE_CENTER: metadata("intensity", 36, { bodyRegion: "hands" }),
  END_AT_START_SIDE_DIAGONAL: metadata("intensity", 37, {
    bodyRegion: "hands",
  }),
  ALIGN_BOTH_ARMS: metadata("form", 40, { bodyRegion: "upperBody" }),
  EXTEND_OUTER_ARM: metadata("form", 41, { bodyRegion: "upperBody" }),
  KEEP_HANDS_AT_CHEST_HEIGHT: metadata("form", 42, { bodyRegion: "hands" }),
  KEEP_CHEST_FORWARD: metadata("form", 43, { bodyRegion: "upperBody" }),
  RETURN_HANDS_TO_CENTER: metadata("returnPose", 50, {
    bodyRegion: "hands",
  }),
  RETURN_FEET_TOGETHER: metadata("returnPose", 90, {
    bodyRegion: "lowerBody",
    optionalLowerBody: true,
  }),
  START_ON_LEFT: metadata("startPose", 10, { bodyRegion: "hands" }),
  START_ON_RIGHT: metadata("startPose", 11, { bodyRegion: "hands" }),
  MOVE_HANDS_TOGETHER: metadata("form", 40, { bodyRegion: "hands" }),
  KEEP_HANDS_CHEST_HEIGHT: metadata("form", 42, { bodyRegion: "hands" }),
  SWEEP_FARTHER: metadata("intensity", 30, { bodyRegion: "hands" }),
  SWEEP_LESS: metadata("intensity", 32, { bodyRegion: "hands" }),
};

export const autumnCriterionFeedbackMetadata: MetadataMap = {
  "hands-start-side": metadata("startPose", 10, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hands-left-start-side": metadata("direction", 20, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "progress-from-start": metadata("intensity", 30, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "endpoint-value-range": metadata("intensity", 31, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "outer-arm-extension": metadata("form", 40, {
    bodyRegion: "upperBody",
    trackingCode: "UPPER_BODY_NOT_VISIBLE",
  }),
  "outer-wrist-endpoint-side": metadata("form", 41, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "outer-arm-oriented-endpoint": metadata("form", 42, {
    bodyRegion: "upperBody",
    trackingCode: "UPPER_BODY_NOT_VISIBLE",
  }),
  "inner-forearm-oriented-endpoint": metadata("form", 43, {
    bodyRegion: "upperBody",
    trackingCode: "UPPER_BODY_NOT_VISIBLE",
  }),
  "shared-arm-direction": metadata("form", 44, {
    bodyRegion: "upperBody",
    trackingCode: "UPPER_BODY_NOT_VISIBLE",
  }),
  "hands-chest-shoulder-height": metadata("form", 45, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "hands-return-center": metadata("returnPose", 50, {
    bodyRegion: "hands",
    trackingCode: "HANDS_NOT_VISIBLE",
  }),
  "feet-close": metadata("returnPose", 90, {
    bodyRegion: "lowerBody",
    trackingCode: "LOWER_BODY_NOT_VISIBLE",
    optionalLowerBody: true,
  }),
  "torso-facing-forward": metadata("form", 46, {
    bodyRegion: "upperBody",
    trackingCode: "UPPER_BODY_NOT_VISIBLE",
  }),
};

export const getAct5FeedbackMetadata = (season: ClimateSeason) => {
  if (season === "winter") {
    return {
      codeMetadata: winterFeedbackMetadata,
      criterionMetadata: winterCriterionFeedbackMetadata,
    };
  }

  if (season === "spring") {
    return {
      codeMetadata: springFeedbackMetadata,
      criterionMetadata: springCriterionFeedbackMetadata,
    };
  }

  if (season === "summer") {
    return {
      codeMetadata: summerFeedbackMetadata,
      criterionMetadata: summerCriterionFeedbackMetadata,
    };
  }

  return {
    codeMetadata: autumnFeedbackMetadata,
    criterionMetadata: autumnCriterionFeedbackMetadata,
  };
};

export type Act5FeedbackCode =
  | AutumnFeedbackCode
  | SpringFeedbackCode
  | SummerFeedbackCode
  | WinterFeedbackCode;

export type Act5NarrationCueKey =
  | `story.acts.act5.narration.feedback.common.${string}`
  | `story.acts.act5.narration.feedback.winter.${string}`
  | `story.acts.act5.narration.feedback.spring.${string}`
  | `story.acts.act5.narration.feedback.summer.${string}`
  | `story.acts.act5.narration.feedback.autumn.${string}`;

const commonNarrationCues: Partial<
  Record<Act5FeedbackCode | string, Act5NarrationCueKey>
> = {
  FULL_BODY_NOT_VISIBLE:
    "story.acts.act5.narration.feedback.common.fullBodyNotVisible",
  UPPER_BODY_NOT_VISIBLE:
    "story.acts.act5.narration.feedback.common.upperBodyNotVisible",
  LOWER_BODY_NOT_VISIBLE:
    "story.acts.act5.narration.feedback.common.lowerBodyNotVisible",
  HANDS_NOT_VISIBLE:
    "story.acts.act5.narration.feedback.common.handsNotVisible",
  TRY_AGAIN: "story.acts.act5.narration.feedback.common.tryAgain",
};

const winterNarrationCues: Partial<
  Record<WinterFeedbackCode, Act5NarrationCueKey>
> = {
  OPEN_ARMS_WIDER: "story.acts.act5.narration.feedback.winter.openArmsWider",
  RAISE_ARMS_TO_SHOULDERS:
    "story.acts.act5.narration.feedback.winter.raiseArmsToShoulders",
  STRAIGHTEN_ARMS_MORE:
    "story.acts.act5.narration.feedback.winter.straightenArmsMore",
  CROSS_ARMS_IN_FRONT:
    "story.acts.act5.narration.feedback.winter.crossArmsInFront",
  REACH_OPPOSITE_SHOULDERS:
    "story.acts.act5.narration.feedback.winter.reachOppositeShoulders",
  KEEP_ARMS_CROSSED:
    "story.acts.act5.narration.feedback.winter.keepArmsCrossed",
  STAY_UPRIGHT: "story.acts.act5.narration.feedback.winter.stayUpright",
  STAY_HIGHER: "story.acts.act5.narration.feedback.winter.stayHigher",
  CONTRACT_MORE: "story.acts.act5.narration.feedback.winter.contractMore",
  BEND_KNEES_MORE: "story.acts.act5.narration.feedback.winter.bendKneesMore",
  KEEP_BODY_COMPACT:
    "story.acts.act5.narration.feedback.winter.keepBodyCompact",
  PROTECT_HEAD: "story.acts.act5.narration.feedback.winter.protectHead",
  LOWER_BODY_AND_PROTECT_HEAD:
    "story.acts.act5.narration.feedback.winter.lowerBodyAndProtectHead",
  RETURN_TO_UPRIGHT:
    "story.acts.act5.narration.feedback.winter.returnToUpright",
  LOWER_ARMS: "story.acts.act5.narration.feedback.winter.lowerArms",
};

const springNarrationCues: Partial<
  Record<SpringFeedbackCode, Act5NarrationCueKey>
> = {
  START_HANDS_LOW: "story.acts.act5.narration.feedback.spring.startHandsLow",
  KEEP_HANDS_CLOSE_TO_BODY:
    "story.acts.act5.narration.feedback.spring.keepHandsCloseToBody",
  OPEN_ARMS_TO_BEGIN:
    "story.acts.act5.narration.feedback.spring.openArmsToBegin",
  OPEN_ARMS_HIGHER: "story.acts.act5.narration.feedback.spring.openArmsHigher",
  KEEP_BLOOM_LOWER: "story.acts.act5.narration.feedback.spring.keepBloomLower",
  REACH_ABOVE_HEAD: "story.acts.act5.narration.feedback.spring.reachAboveHead",
  GATHER_HANDS_IN_FRONT:
    "story.acts.act5.narration.feedback.spring.gatherHandsInFront",
  LOWER_AND_RETURN: "story.acts.act5.narration.feedback.spring.lowerAndReturn",
  LIFT_OTHER_KNEE: "story.acts.act5.narration.feedback.spring.liftOtherKnee",
  MATCH_BOTH_HANDS: "story.acts.act5.narration.feedback.spring.matchBothHands",
};

const summerNarrationCues: Partial<
  Record<SummerFeedbackCode, Act5NarrationCueKey>
> = {
  MOVE_HANDS_TO_CENTER:
    "story.acts.act5.narration.feedback.summer.moveHandsToCenter",
  RAISE_ARMS_HIGHER:
    "story.acts.act5.narration.feedback.summer.raiseArmsHigher",
  STRAIGHTEN_ARMS: "story.acts.act5.narration.feedback.summer.straightenArms",
  STEP_WIDER: "story.acts.act5.narration.feedback.summer.stepWider",
  STEP_SMALLER: "story.acts.act5.narration.feedback.summer.stepSmaller",
  ALTERNATE_STEP_SIDE:
    "story.acts.act5.narration.feedback.summer.alternateStepSide",
  OPEN_ARMS_TO_SIDES:
    "story.acts.act5.narration.feedback.summer.openArmsToSides",
  OPEN_ARMS_LESS: "story.acts.act5.narration.feedback.summer.openArmsLess",
  MOVEMENT_TOO_LARGE:
    "story.acts.act5.narration.feedback.summer.movementTooLarge",
  MOVEMENT_TOO_SMALL:
    "story.acts.act5.narration.feedback.summer.movementTooSmall",
  BEND_ELBOWS_MORE: "story.acts.act5.narration.feedback.summer.bendElbowsMore",
  RETURN_FEET_TO_CENTER:
    "story.acts.act5.narration.feedback.summer.returnFeetToCenter",
  LOWER_ARMS: "story.acts.act5.narration.feedback.summer.lowerArms",
};

const autumnNarrationCues: Partial<
  Record<AutumnFeedbackCode, Act5NarrationCueKey>
> = {
  START_LEFT: "story.acts.act5.narration.feedback.autumn.startLeft",
  START_RIGHT: "story.acts.act5.narration.feedback.autumn.startRight",
  WRONG_SWEEP_DIRECTION:
    "story.acts.act5.narration.feedback.autumn.wrongSweepDirection",
  SWEEP_LEFT: "story.acts.act5.narration.feedback.autumn.sweepLeft",
  SWEEP_RIGHT: "story.acts.act5.narration.feedback.autumn.sweepRight",
  INSUFFICIENT_PROGRESS:
    "story.acts.act5.narration.feedback.autumn.insufficientProgress",
  ENDPOINT_TOO_SHORT:
    "story.acts.act5.narration.feedback.autumn.endpointTooShort",
  ENDPOINT_TOO_FAR: "story.acts.act5.narration.feedback.autumn.endpointTooFar",
  ENDPOINT_REACHED_TOO_LATE:
    "story.acts.act5.narration.feedback.autumn.endpointReachedTooLate",
  ENDPOINT_UNSTABLE:
    "story.acts.act5.narration.feedback.autumn.endpointUnstable",
  END_AT_DESTINATION_SIDE:
    "story.acts.act5.narration.feedback.autumn.endAtDestinationSide",
  END_AT_FAR_DESTINATION_SIDE:
    "story.acts.act5.narration.feedback.autumn.endAtFarDestinationSide",
  END_AT_CENTER: "story.acts.act5.narration.feedback.autumn.endAtCenter",
  END_BEFORE_CENTER:
    "story.acts.act5.narration.feedback.autumn.endBeforeCenter",
  END_AT_START_SIDE_DIAGONAL:
    "story.acts.act5.narration.feedback.autumn.endAtStartSideDiagonal",
  ALIGN_BOTH_ARMS: "story.acts.act5.narration.feedback.autumn.alignBothArms",
  EXTEND_OUTER_ARM: "story.acts.act5.narration.feedback.autumn.extendOuterArm",
  KEEP_HANDS_AT_CHEST_HEIGHT:
    "story.acts.act5.narration.feedback.autumn.keepHandsAtChestHeight",
  KEEP_CHEST_FORWARD:
    "story.acts.act5.narration.feedback.autumn.keepChestForward",
  RETURN_HANDS_TO_CENTER:
    "story.acts.act5.narration.feedback.autumn.returnHandsToCenter",
  RETURN_FEET_TOGETHER:
    "story.acts.act5.narration.feedback.autumn.returnFeetTogether",
  START_ON_LEFT: "story.acts.act5.narration.feedback.autumn.startLeft",
  START_ON_RIGHT: "story.acts.act5.narration.feedback.autumn.startRight",
  MOVE_HANDS_TOGETHER:
    "story.acts.act5.narration.feedback.autumn.alignBothArms",
  KEEP_HANDS_CHEST_HEIGHT:
    "story.acts.act5.narration.feedback.autumn.keepHandsAtChestHeight",
  SWEEP_FARTHER:
    "story.acts.act5.narration.feedback.autumn.insufficientProgress",
  SWEEP_LESS: "story.acts.act5.narration.feedback.autumn.endpointTooFar",
};

export const getAct5FeedbackTextKey = (
  season: ClimateSeason,
  feedbackCode: string | null | undefined,
) => `story.acts.act5.${season}Feedback.${feedbackCode ?? "TRY_AGAIN"}`;

export const resolveAct5FeedbackNarrationCue = (
  season: ClimateSeason,
  feedbackCode: Act5FeedbackCode | string | null | undefined,
): Act5NarrationCueKey | null => {
  if (!feedbackCode || feedbackCode === "SUCCESS") return null;

  const commonCue = commonNarrationCues[feedbackCode];

  if (commonCue) return commonCue;

  if (season === "winter") {
    return winterNarrationCues[feedbackCode as WinterFeedbackCode] ?? null;
  }

  if (season === "spring") {
    return springNarrationCues[feedbackCode as SpringFeedbackCode] ?? null;
  }

  if (season === "summer") {
    return summerNarrationCues[feedbackCode as SummerFeedbackCode] ?? null;
  }

  return autumnNarrationCues[feedbackCode as AutumnFeedbackCode] ?? null;
};

export const resolveAct5IntensityNarrationCue = resolveAct5FeedbackNarrationCue;
