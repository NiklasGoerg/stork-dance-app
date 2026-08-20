import type { GuidedMigrationPhase } from "~/types/migrationAct";

export type GuidedNarrationTrigger =
  | { type: "phase-entry" }
  | { type: "bar"; barOffset: number; offsetMs?: number }
  | { type: "movement-success" }
  | { type: "movement-failure"; category: "noMovement" | "incomplete" }
  | { type: "tracking"; category: GuidedTrackingCategory };

export type GuidedTrackingCategory =
  "bodyNotVisible" | "feetNotVisible" | "trackingLost" | "holdPosition";

export type GuidedNarrationTokens = {
  breedingArea: string;
  winteringArea: string;
  departureMonth: string;
  southboundRoute: string;
  northboundRoute: string;
};

export type GuidedNarrationCue = {
  id: string;
  phases: readonly GuidedMigrationPhase[];
  trigger: GuidedNarrationTrigger;
  priority: number;
  display: boolean;
  speak: boolean;
  title: string;
  text: string;
  fallbackText?: string;
  enabled: boolean;
  estimatedDurationMs: number;
};

export const GUIDED_NARRATION_PRIORITY = {
  tracking: 100,
  gestureHandover: 90,
  movementHandover: 80,
  failure: 70,
  success: 60,
  context: 50,
  optional: 40,
} as const;

export const GUIDED_NARRATION_ESTIMATED_WORDS_PER_MINUTE = 180;
export const countGuidedNarrationWords = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length;
export const estimateGuidedSpeechDurationMs = (text: string) =>
  Math.round(
    (countGuidedNarrationWords(text) * 60_000) /
      GUIDED_NARRATION_ESTIMATED_WORDS_PER_MINUTE +
      150,
  );

const cue = (
  value: Omit<GuidedNarrationCue, "enabled" | "estimatedDurationMs"> & {
    enabled?: boolean;
  },
): GuidedNarrationCue => ({
  ...value,
  enabled: value.enabled ?? true,
  estimatedDurationMs: value.speak
    ? estimateGuidedSpeechDurationMs(value.text)
    : 0,
});

const p = (...phases: GuidedMigrationPhase[]) => phases;

export const guidedNarrationCatalog = {
  "act2.introduction.title": cue({
    id: "act2.introduction.title",
    phases: p("idle", "journey-introduction"),
    trigger: { type: "phase-entry" },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: false,
    title: "The Stork's Journey",
    text: "A Guided Migration",
  }),
  "act2.introduction.annualJourney": cue({
    id: "act2.introduction.annualJourney",
    phases: p("journey-introduction"),
    trigger: { type: "bar", barOffset: 0 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "The Stork's Journey",
    text: "Let's follow one white stork through a full year.",
  }),
  "act2.introduction.summerBreeding": cue({
    id: "act2.introduction.summerBreeding",
    phases: p("summer-demonstration"),
    trigger: { type: "bar", barOffset: 1 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Summer in Germany",
    text: "We begin in Germany, where storks breed and raise their young.",
  }),
  "act2.summer.context": cue({
    id: "act2.summer.context",
    phases: p("summer-demonstration"),
    trigger: { type: "bar", barOffset: 1 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Summer Stay",
    text: "The journey begins in its summer breeding area in Germany.",
  }),
  "act2.summer.instruction": cue({
    id: "act2.summer.instruction",
    phases: p("summer-demonstration"),
    trigger: { type: "bar", barOffset: 2 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Summer Movement",
    text: "Learn the summer movement: tap right, return, tap left, return.",
  }),
  "act2.summer.handover": cue({
    id: "act2.summer.handover",
    phases: p("summer-practice-prompt"),
    trigger: { type: "bar", barOffset: 3 },
    priority: GUIDED_NARRATION_PRIORITY.movementHandover,
    display: true,
    speak: true,
    title: "Your Turn",
    text: "Now it's your turn. Follow the avatar.",
  }),
  "act2.summer.progress": cue({
    id: "act2.summer.progress",
    phases: p("summer-practice"),
    trigger: { type: "phase-entry" },
    priority: GUIDED_NARRATION_PRIORITY.optional,
    display: true,
    speak: false,
    title: "Summer movement",
    text: "Follow the avatar and move with the beat.",
  }),
  "act2.summer.failure.noMovement": cue({
    id: "act2.summer.failure.noMovement",
    phases: p("summer-practice"),
    trigger: { type: "movement-failure", category: "noMovement" },
    priority: GUIDED_NARRATION_PRIORITY.failure,
    display: true,
    speak: true,
    enabled: false,
    title: "Summer movement",
    text: "The summer rhythm has not started yet. Follow the avatar and move with the beat.",
  }),
  "act2.summer.failure.incomplete": cue({
    id: "act2.summer.failure.incomplete",
    phases: p("summer-practice"),
    trigger: { type: "movement-failure", category: "incomplete" },
    priority: GUIDED_NARRATION_PRIORITY.failure,
    display: true,
    speak: true,
    enabled: false,
    title: "Summer movement",
    text: "The summer rhythm is not complete yet. Tap out, then bring each foot back.",
  }),
  "act2.summer.success": cue({
    id: "act2.summer.success",
    phases: p("summer-success"),
    trigger: { type: "movement-success" },
    priority: GUIDED_NARRATION_PRIORITY.success,
    display: true,
    speak: true,
    title: "Summer movement learned",
    text: "Great job. You found the summer rhythm. Keep moving as the season passes.",
  }),
  "act2.summer.story.breeding": cue({
    id: "act2.summer.story.breeding",
    phases: p("summer-story-transition"),
    trigger: { type: "bar", barOffset: 0 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Summer breeding season",
    text: "In summer, storks stay near nests and raise their young.",
  }),
  "act2.summer.story.embodiedMeaning": cue({
    id: "act2.summer.story.embodiedMeaning",
    phases: p("summer-story-transition"),
    trigger: { type: "bar", barOffset: 1 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Movement and time",
    text: "Your movement represents staying, while the timeline shows the passing season.",
  }),
  "act2.summer.story.departureApproaches": cue({
    id: "act2.summer.story.departureApproaches",
    phases: p("summer-story-transition"),
    trigger: { type: "bar", barOffset: 2 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Departure approaches",
    text: "By {{departureMonth}}, the journey south begins.",
    fallbackText: "As summer ends, the journey south begins.",
  }),
  "act2.departure.context": cue({
    id: "act2.departure.context",
    phases: p("autumn-departure-demonstration"),
    trigger: { type: "bar", barOffset: 0 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Autumn Departure",
    text: "Before the journey begins, the stork prepares to take off.",
  }),
  "act2.departure.instruction": cue({
    id: "act2.departure.instruction",
    phases: p("autumn-departure-demonstration"),
    trigger: { type: "bar", barOffset: 1 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Departure Gesture",
    text: "Crouch, rise with your hands overhead, then open your arms.",
  }),
  "act2.departure.handover": cue({
    id: "act2.departure.handover",
    phases: p("autumn-departure-practice-prompt"),
    trigger: { type: "bar", barOffset: 2 },
    priority: GUIDED_NARRATION_PRIORITY.gestureHandover,
    display: true,
    speak: true,
    title: "Departure Gesture",
    text: "During the countdown, move into a crouch so you're ready on count one.",
  }),
  "act2.departure.success": cue({
    id: "act2.departure.success",
    phases: p("autumn-departure-success"),
    trigger: { type: "movement-success" },
    priority: GUIDED_NARRATION_PRIORITY.success,
    display: true,
    speak: true,
    title: "Departure complete",
    text: "Great job. The stork is airborne, and the journey south can begin.",
  }),
  "act2.autumnMigration.context": cue({
    id: "act2.autumnMigration.context",
    phases: p("autumn-migration-context"),
    trigger: { type: "bar", barOffset: 0 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Autumn Migration",
    text: "The stork is beginning its journey toward the wintering area.",
  }),
  "act2.autumnMigration.instruction": cue({
    id: "act2.autumnMigration.instruction",
    phases: p("autumn-migration-demonstration"),
    trigger: { type: "bar", barOffset: 1 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Migration movement",
    text: "Open arms and step out. Lower them and close your feet.",
  }),
  "act2.autumnMigration.handover": cue({
    id: "act2.autumnMigration.handover",
    phases: p("autumn-migration-practice-prompt"),
    trigger: { type: "bar", barOffset: 2 },
    priority: GUIDED_NARRATION_PRIORITY.movementHandover,
    display: true,
    speak: true,
    title: "Autumn Migration",
    text: "Now it's your turn. Join the journey south.",
  }),
  "act2.autumnMigration.progress": cue({
    id: "act2.autumnMigration.progress",
    phases: p("autumn-migration-practice"),
    trigger: { type: "phase-entry" },
    priority: GUIDED_NARRATION_PRIORITY.optional,
    display: true,
    speak: false,
    title: "Migration movement",
    text: "Follow the avatar and move with the beat.",
  }),
  "act2.autumnMigration.failure.noMovement": cue({
    id: "act2.autumnMigration.failure.noMovement",
    phases: p("autumn-migration-practice"),
    trigger: { type: "movement-failure", category: "noMovement" },
    priority: GUIDED_NARRATION_PRIORITY.failure,
    display: true,
    speak: true,
    enabled: false,
    title: "Migration movement",
    text: "The journey has not started moving yet. Follow the avatar and move with the beat.",
  }),
  "act2.autumnMigration.failure.incomplete": cue({
    id: "act2.autumnMigration.failure.incomplete",
    phases: p("autumn-migration-practice"),
    trigger: { type: "movement-failure", category: "incomplete" },
    priority: GUIDED_NARRATION_PRIORITY.failure,
    display: true,
    speak: true,
    enabled: false,
    title: "Migration movement",
    text: "The flight rhythm is incomplete. Open your arms and step out, then close your arms and feet.",
  }),
  "act2.autumnMigration.success": cue({
    id: "act2.autumnMigration.success",
    phases: p("autumn-migration-success"),
    trigger: { type: "movement-success" },
    priority: GUIDED_NARRATION_PRIORITY.success,
    display: true,
    speak: true,
    title: "Migration movement learned",
    text: "Well done. The journey has found its rhythm. Keep moving south.",
  }),
  "act2.autumnMigration.story.mapAndBody": cue({
    id: "act2.autumnMigration.story.mapAndBody",
    phases: p("autumn-migration-story"),
    trigger: { type: "bar", barOffset: 0 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Movement and map",
    text: "Your movement represents migration; the map shows where the stork travels.",
  }),
  "act2.autumnMigration.story.route": cue({
    id: "act2.autumnMigration.story.route",
    phases: p("autumn-migration-story"),
    trigger: { type: "bar", barOffset: 1 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Southbound route",
    text: "The route leads {{southboundRoute}}.",
  }),
  "act2.autumnMigration.story.arrivalApproaches": cue({
    id: "act2.autumnMigration.story.arrivalApproaches",
    phases: p("autumn-migration-story"),
    trigger: { type: "bar", barOffset: 2 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Arrival approaches",
    text: "The wintering area is close. Prepare to land.",
  }),
  "act2.arrival.context": cue({
    id: "act2.arrival.context",
    phases: p("autumn-arrival-demonstration"),
    trigger: { type: "bar", barOffset: 0 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Autumn Arrival",
    text: "The stork has reached the end of its southbound journey.",
  }),
  "act2.arrival.instruction": cue({
    id: "act2.arrival.instruction",
    phases: p("autumn-arrival-demonstration"),
    trigger: { type: "bar", barOffset: 1 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Arrival Gesture",
    text: "Open your arms, lower your body, and complete the landing.",
  }),
  "act2.arrival.handover": cue({
    id: "act2.arrival.handover",
    phases: p("autumn-arrival-practice-prompt"),
    trigger: { type: "bar", barOffset: 2 },
    priority: GUIDED_NARRATION_PRIORITY.gestureHandover,
    display: true,
    speak: true,
    title: "Arrival Gesture",
    text: "Get ready with your arms open. On count one, begin the landing with the avatar.",
  }),
  "act2.arrival.success": cue({
    id: "act2.arrival.success",
    phases: p("autumn-arrival-success"),
    trigger: { type: "movement-success" },
    priority: GUIDED_NARRATION_PRIORITY.success,
    display: true,
    speak: true,
    title: "Arrival complete",
    text: "Great landing. The stork has safely reached {{winteringArea}}.",
    fallbackText:
      "Great landing. The stork has safely reached its wintering area.",
  }),
  "act2.winter.context": cue({
    id: "act2.winter.context",
    phases: p("winter-context"),
    trigger: { type: "bar", barOffset: 0 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Winter Stay",
    text: "The stork now remains in its wintering area.",
  }),
  "act2.winter.instruction": cue({
    id: "act2.winter.instruction",
    phases: p("winter-demonstration"),
    trigger: { type: "bar", barOffset: 1 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Winter movement",
    text: "Step right and close, then step left and close.",
  }),
  "act2.winter.handover": cue({
    id: "act2.winter.handover",
    phases: p("winter-practice-prompt"),
    trigger: { type: "bar", barOffset: 2 },
    priority: GUIDED_NARRATION_PRIORITY.movementHandover,
    display: true,
    speak: true,
    title: "Winter Movement",
    text: "Now it's your turn. Follow the winter movement.",
  }),
  "act2.winter.progress": cue({
    id: "act2.winter.progress",
    phases: p("winter-practice"),
    trigger: { type: "phase-entry" },
    priority: GUIDED_NARRATION_PRIORITY.optional,
    display: true,
    speak: false,
    title: "Winter movement",
    text: "Follow the avatar and move with the beat.",
  }),
  "act2.winter.failure.noMovement": cue({
    id: "act2.winter.failure.noMovement",
    phases: p("winter-practice"),
    trigger: { type: "movement-failure", category: "noMovement" },
    priority: GUIDED_NARRATION_PRIORITY.failure,
    display: true,
    speak: true,
    enabled: false,
    title: "Winter movement",
    text: "The winter rhythm has not started yet. Follow the avatar and move with the beat.",
  }),
  "act2.winter.failure.incomplete": cue({
    id: "act2.winter.failure.incomplete",
    phases: p("winter-practice"),
    trigger: { type: "movement-failure", category: "incomplete" },
    priority: GUIDED_NARRATION_PRIORITY.failure,
    display: true,
    speak: true,
    enabled: false,
    title: "Winter movement",
    text: "The winter rhythm is not complete yet. Step out, close, then change sides.",
  }),
  "act2.winter.success": cue({
    id: "act2.winter.success",
    phases: p("winter-success"),
    trigger: { type: "movement-success" },
    priority: GUIDED_NARRATION_PRIORITY.success,
    display: true,
    speak: true,
    title: "Winter movement learned",
    text: "Well done. You found the winter rhythm. Keep moving as winter passes.",
  }),
  "act2.winter.story.behavior": cue({
    id: "act2.winter.story.behavior",
    phases: p("winter-story-transition"),
    trigger: { type: "bar", barOffset: 0 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Winter behavior",
    text: "In the wintering area, the stork continues to search for food.",
  }),
  "act2.winter.story.conditions": cue({
    id: "act2.winter.story.conditions",
    phases: p("winter-story-transition"),
    trigger: { type: "bar", barOffset: 1 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Seasonal conditions",
    text: "Farther north, colder conditions would make food harder to find.",
  }),
  "act2.winter.story.returnApproaches": cue({
    id: "act2.winter.story.returnApproaches",
    phases: p("winter-story-transition"),
    trigger: { type: "bar", barOffset: 2 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Return approaches",
    text: "Spring approaches. It is time to journey north again.",
  }),
  "act2.springDeparture.handover": cue({
    id: "act2.springDeparture.handover",
    phases: p("spring-departure-practice-prompt"),
    trigger: { type: "bar", barOffset: 0 },
    priority: GUIDED_NARRATION_PRIORITY.gestureHandover,
    display: true,
    speak: true,
    title: "Spring Departure",
    text: "Depart with the stork and begin the journey north.",
  }),
  "act2.springDeparture.success": cue({
    id: "act2.springDeparture.success",
    phases: p("spring-departure-success"),
    trigger: { type: "movement-success" },
    priority: GUIDED_NARRATION_PRIORITY.success,
    display: true,
    speak: true,
    title: "Departure complete",
    text: "Great job. The stork is airborne again, and the return journey has begun.",
  }),
  "act2.springMigration.context": cue({
    id: "act2.springMigration.context",
    phases: p("spring-migration-context"),
    trigger: { type: "bar", barOffset: 0 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Spring Migration",
    text: "The stork follows the route back to its breeding area.",
  }),
  "act2.springMigration.instruction": cue({
    id: "act2.springMigration.instruction",
    phases: p("spring-migration-demonstration"),
    trigger: { type: "bar", barOffset: 1 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Return movement",
    text: "Open arms and step out. Lower them and close your feet.",
  }),
  "act2.springMigration.handover": cue({
    id: "act2.springMigration.handover",
    phases: p("spring-migration-practice-prompt"),
    trigger: { type: "bar", barOffset: 2 },
    priority: GUIDED_NARRATION_PRIORITY.movementHandover,
    display: true,
    speak: true,
    title: "Spring Migration",
    text: "Now it's your turn. Join the journey north.",
  }),
  "act2.springMigration.progress": cue({
    id: "act2.springMigration.progress",
    phases: p("spring-migration-practice"),
    trigger: { type: "phase-entry" },
    priority: GUIDED_NARRATION_PRIORITY.optional,
    display: true,
    speak: false,
    title: "Return movement",
    text: "Follow the avatar and move with the beat.",
  }),
  "act2.springMigration.failure.noMovement": cue({
    id: "act2.springMigration.failure.noMovement",
    phases: p("spring-migration-practice"),
    trigger: { type: "movement-failure", category: "noMovement" },
    priority: GUIDED_NARRATION_PRIORITY.failure,
    display: true,
    speak: true,
    enabled: false,
    title: "Return movement",
    text: "The return journey has not started moving yet. Follow the avatar and move with the beat.",
  }),
  "act2.springMigration.failure.incomplete": cue({
    id: "act2.springMigration.failure.incomplete",
    phases: p("spring-migration-practice"),
    trigger: { type: "movement-failure", category: "incomplete" },
    priority: GUIDED_NARRATION_PRIORITY.failure,
    display: true,
    speak: true,
    enabled: false,
    title: "Return movement",
    text: "The return rhythm is incomplete. Open your arms and step out, then close your arms and feet.",
  }),
  "act2.springMigration.success": cue({
    id: "act2.springMigration.success",
    phases: p("spring-migration-success"),
    trigger: { type: "movement-success" },
    priority: GUIDED_NARRATION_PRIORITY.success,
    display: true,
    speak: true,
    title: "Return movement learned",
    text: "Well done. The return journey has found its rhythm. Keep moving north.",
  }),
  "act2.springMigration.story.route": cue({
    id: "act2.springMigration.story.route",
    phases: p("spring-migration-story"),
    trigger: { type: "bar", barOffset: 0 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Northbound route",
    text: "The map now traces the route {{northboundRoute}}.",
  }),
  "act2.springMigration.story.embodiedMeaning": cue({
    id: "act2.springMigration.story.embodiedMeaning",
    phases: p("spring-migration-story"),
    trigger: { type: "bar", barOffset: 1 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Movement over time",
    text: "Repeated movement represents the stork's journey north over time.",
  }),
  "act2.springMigration.story.arrivalApproaches": cue({
    id: "act2.springMigration.story.arrivalApproaches",
    phases: p("spring-migration-story"),
    trigger: { type: "bar", barOffset: 2 },
    priority: GUIDED_NARRATION_PRIORITY.context,
    display: true,
    speak: true,
    title: "Final arrival approaches",
    text: "The breeding area is close. Prepare to complete the journey.",
  }),
  "act2.springArrival.handover": cue({
    id: "act2.springArrival.handover",
    phases: p("spring-arrival-practice-prompt"),
    trigger: { type: "bar", barOffset: 0 },
    priority: GUIDED_NARRATION_PRIORITY.gestureHandover,
    display: true,
    speak: true,
    title: "Spring Arrival",
    text: "Get ready with your arms open. On count one, land with the stork.",
  }),
  "act2.springArrival.success": cue({
    id: "act2.springArrival.success",
    phases: p("spring-arrival-success"),
    trigger: { type: "movement-success" },
    priority: GUIDED_NARRATION_PRIORITY.success,
    display: true,
    speak: true,
    title: "Arrival complete",
    text: "Great landing. The stork has returned to its summer breeding area.",
  }),
  "act2.completion.journeyComplete": cue({
    id: "act2.completion.journeyComplete",
    phases: p("cycle-complete"),
    trigger: { type: "bar", barOffset: 0 },
    priority: GUIDED_NARRATION_PRIORITY.success,
    display: true,
    speak: true,
    title: "Annual journey complete",
    text: "Excellent work. You completed one full annual migration cycle.",
  }),
  "act2.completion.movementSummary": cue({
    id: "act2.completion.movementSummary",
    phases: p("cycle-complete"),
    trigger: { type: "bar", barOffset: 1 },
    priority: GUIDED_NARRATION_PRIORITY.success,
    display: true,
    speak: true,
    title: "What your movement represented",
    text: "Your movements represented the stork's summer, migration, winter, and return.",
  }),
  "act2.completion.title": cue({
    id: "act2.completion.title",
    phases: p("cycle-complete"),
    trigger: { type: "phase-entry" },
    priority: GUIDED_NARRATION_PRIORITY.success,
    display: true,
    speak: false,
    title: "Tutorial complete",
    text: "You followed the stork from its summer breeding area to its wintering area and back again.",
  }),
  "act2.feedback.bodyNotVisible": cue({
    id: "act2.feedback.bodyNotVisible",
    phases: p(
      "summer-practice",
      "autumn-migration-practice",
      "winter-practice",
      "spring-migration-practice",
    ),
    trigger: { type: "tracking", category: "bodyNotVisible" },
    priority: GUIDED_NARRATION_PRIORITY.tracking,
    display: true,
    speak: true,
    title: "Camera tracking",
    text: "Step back until your full body is visible.",
  }),
  "act2.feedback.feetNotVisible": cue({
    id: "act2.feedback.feetNotVisible",
    phases: p(
      "summer-practice",
      "autumn-migration-practice",
      "winter-practice",
      "spring-migration-practice",
    ),
    trigger: { type: "tracking", category: "feetNotVisible" },
    priority: GUIDED_NARRATION_PRIORITY.tracking,
    display: true,
    speak: true,
    title: "Camera tracking",
    text: "Make sure both feet are visible to the camera.",
  }),
  "act2.feedback.trackingLost": cue({
    id: "act2.feedback.trackingLost",
    phases: p(
      "summer-practice",
      "autumn-migration-practice",
      "winter-practice",
      "spring-migration-practice",
    ),
    trigger: { type: "tracking", category: "trackingLost" },
    priority: GUIDED_NARRATION_PRIORITY.tracking,
    display: true,
    speak: true,
    title: "Camera tracking",
    text: "I lost sight of you. Return to the camera frame.",
  }),
  "act2.feedback.holdPosition": cue({
    id: "act2.feedback.holdPosition",
    phases: p(
      "summer-practice",
      "autumn-migration-practice",
      "winter-practice",
      "spring-migration-practice",
    ),
    trigger: { type: "tracking", category: "holdPosition" },
    priority: GUIDED_NARRATION_PRIORITY.tracking,
    display: true,
    speak: true,
    title: "Camera tracking",
    text: "Hold still briefly so I can see the movement.",
  }),
} as const satisfies Record<string, GuidedNarrationCue>;

export type GuidedNarrationId = keyof typeof guidedNarrationCatalog;

export const resolveGuidedNarrationText = (
  id: GuidedNarrationId,
  tokens: GuidedNarrationTokens,
) => {
  const cueValue = guidedNarrationCatalog[id];
  const unresolved = [...cueValue.text.matchAll(/{{(\w+)}}/g)].map(
    (match) => match[1] as keyof GuidedNarrationTokens,
  );
  if (unresolved.some((token) => !tokens[token])) {
    return cueValue.fallbackText ?? cueValue.text.replace(/{{\w+}}/g, "");
  }
  return cueValue.text.replace(
    /{{(\w+)}}/g,
    (_, token: keyof GuidedNarrationTokens) => tokens[token] ?? "",
  );
};

export const guidedNarrationTimingAnalysis = Object.values(
  guidedNarrationCatalog,
).map((item) => ({
  id: item.id,
  phases: item.phases,
  trigger: item.trigger,
  words: countGuidedNarrationWords(item.text),
  estimatedDurationMs: item.estimatedDurationMs,
  availableWindowMs: item.speak ? 4_000 : 0,
  action: !item.enabled
    ? "catalog-only"
    : !item.speak
      ? "display-only"
      : item.estimatedDurationMs <= 3_800
        ? "keep"
        : item.estimatedDurationMs <= 4_000
          ? "keep-tight"
          : item.priority >= GUIDED_NARRATION_PRIORITY.success
            ? "protected-window"
            : "skip-if-busy",
  priority: item.priority,
  enabled: item.enabled,
  speak: item.speak,
}));
