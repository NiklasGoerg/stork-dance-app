import type { StorkMigrationEvent, StorkMigrationPhase } from "~/types/stork";

export type MigrationActNarrationPhase =
  | StorkMigrationPhase
  | "departure-gesture"
  | "arrival-gesture"
  | "cycle-complete";

export type MigrationActNarrationTrigger =
  | { type: "phase-entry" }
  | { type: "event"; eventType: StorkMigrationEvent }
  | { type: "gesture-handover"; gesture: "departure" | "arrival" }
  | { type: "gesture-success"; gesture: "departure" | "arrival" }
  | { type: "cycle-complete" }
  | { type: "technical-feedback" }
  | { type: "movement-feedback" };

export type MigrationActNarrationCue = {
  id: string;
  phases: readonly MigrationActNarrationPhase[];
  trigger: MigrationActNarrationTrigger;
  priority: number;
  speak: boolean;
  title: string;
  text: string;
  enabled: boolean;
  placeholder: boolean;
};

export const MIGRATION_ACT_NARRATION_PRIORITY = {
  technical: 100,
  gestureFeedback: 80,
  gestureHandover: 70,
  eventContext: 60,
  phaseContext: 50,
  movementFeedback: 40,
} as const;

const cue = (
  value: Omit<MigrationActNarrationCue, "enabled" | "placeholder"> & {
    enabled?: boolean;
    placeholder?: boolean;
  },
): MigrationActNarrationCue => ({
  ...value,
  enabled: value.enabled ?? true,
  placeholder: value.placeholder ?? true,
});

const p = (...phases: MigrationActNarrationPhase[]) => phases;

export const migrationActNarrationCatalog = {
  "act4.departure.context": cue({
    id: "act4.departure.context",
    phases: p("summer_rest", "winter_rest"),
    trigger: { type: "event", eventType: "autumn_departure" },
    priority: MIGRATION_ACT_NARRATION_PRIORITY.eventContext,
    speak: true,
    title: "Departure",
    text: "Prepare for departure.",
  }),
  "act4.departure.handover": cue({
    id: "act4.departure.handover",
    phases: p("departure-gesture"),
    trigger: { type: "gesture-handover", gesture: "departure" },
    priority: MIGRATION_ACT_NARRATION_PRIORITY.gestureHandover,
    speak: true,
    title: "Departure",
    text: "Depart with the stork.",
  }),
  "act4.departure.success": cue({
    id: "act4.departure.success",
    phases: p("departure-gesture"),
    trigger: { type: "gesture-success", gesture: "departure" },
    priority: MIGRATION_ACT_NARRATION_PRIORITY.gestureFeedback,
    speak: true,
    title: "Departure complete",
    text: "Bravo! Great take-off.",
    placeholder: false,
  }),
  "act4.migration.context": cue({
    id: "act4.migration.context",
    phases: p("autumn_migration", "spring_migration"),
    trigger: { type: "phase-entry" },
    priority: MIGRATION_ACT_NARRATION_PRIORITY.phaseContext,
    speak: true,
    title: "Migration",
    text: "Migration begins.",
  }),
  "act4.arrival.context": cue({
    id: "act4.arrival.context",
    phases: p("autumn_migration", "spring_migration"),
    trigger: { type: "event", eventType: "autumn_arrival" },
    priority: MIGRATION_ACT_NARRATION_PRIORITY.eventContext,
    speak: true,
    title: "Arrival",
    text: "Prepare to land.",
  }),
  "act4.arrival.handover": cue({
    id: "act4.arrival.handover",
    phases: p("arrival-gesture"),
    trigger: { type: "gesture-handover", gesture: "arrival" },
    priority: MIGRATION_ACT_NARRATION_PRIORITY.gestureHandover,
    speak: true,
    title: "Arrival",
    text: "Land with the stork.",
  }),
  "act4.arrival.success": cue({
    id: "act4.arrival.success",
    phases: p("arrival-gesture"),
    trigger: { type: "gesture-success", gesture: "arrival" },
    priority: MIGRATION_ACT_NARRATION_PRIORITY.gestureFeedback,
    speak: true,
    title: "Arrival complete",
    text: "Good! You landed successfully.",
    placeholder: false,
  }),
  "act4.season.transition": cue({
    id: "act4.season.transition",
    phases: p("summer_rest", "winter_rest"),
    trigger: { type: "phase-entry" },
    priority: MIGRATION_ACT_NARRATION_PRIORITY.phaseContext,
    speak: true,
    title: "Season transition",
    text: "The season changes.",
  }),
  "act4.cycle.complete": cue({
    id: "act4.cycle.complete",
    phases: p("cycle-complete"),
    trigger: { type: "cycle-complete" },
    priority: MIGRATION_ACT_NARRATION_PRIORITY.eventContext,
    speak: true,
    title: "Cycle complete",
    text: "Migration cycle complete.",
  }),
  "act4.feedback.technical": cue({
    id: "act4.feedback.technical",
    phases: p(
      "summer_rest",
      "autumn_migration",
      "winter_rest",
      "spring_migration",
      "departure-gesture",
      "arrival-gesture",
    ),
    trigger: { type: "technical-feedback" },
    priority: MIGRATION_ACT_NARRATION_PRIORITY.technical,
    speak: true,
    title: "Tracking",
    text: "Adjust your position.",
  }),
  "act4.feedback.movement": cue({
    id: "act4.feedback.movement",
    phases: p(
      "summer_rest",
      "autumn_migration",
      "winter_rest",
      "spring_migration",
    ),
    trigger: { type: "movement-feedback" },
    priority: MIGRATION_ACT_NARRATION_PRIORITY.movementFeedback,
    speak: false,
    title: "Movement",
    text: "Good.",
  }),
} as const satisfies Record<string, MigrationActNarrationCue>;

export type MigrationActNarrationId = keyof typeof migrationActNarrationCatalog;

export const resolveMigrationActNarrationCue = (id: MigrationActNarrationId) =>
  migrationActNarrationCatalog[id];
