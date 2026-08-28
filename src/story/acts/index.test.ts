import { describe, expect, it } from "vitest";
import en from "~/locales/en.json";
import actDebugDockSource from "~/components/story/ActDebugDock.vue?raw";
import actEntryScreenSource from "~/components/story/ActEntryScreen.vue?raw";
import act4InfoCardSource from "~/components/act4/InfoCard.vue?raw";
import climateProgressChartSource from "~/components/act4/ClimateProgressChart.vue?raw";
import migrationActInfoPanelSource from "~/components/story/MigrationActInfoPanel.vue?raw";
import migrationActStageSource from "~/components/story/MigrationActStage.vue?raw";
import migrationStoryLayoutSource from "~/components/story/MigrationStoryLayout.vue?raw";
import storyProgressSidebarSource from "~/components/story/StoryProgressSidebar.vue?raw";
import homePageSource from "~/pages/index.vue?raw";
import act3PageSource from "~/pages/story/act-3.vue?raw";
import act4PageSource from "~/pages/story/act-4.vue?raw";
import climateActStageSource from "~/components/act4/ClimateActStage.vue?raw";
import act4LegacyPageSource from "~/pages/story/act-5.vue?raw";
import act4LegacyCompactPageSource from "~/pages/story/act5.vue?raw";
import epiloguePageSource from "~/pages/story/epilogue.vue?raw";
import prologuePageSource from "~/pages/story/prologue.vue?raw";
import storyIndexPageSource from "~/pages/story/index.vue?raw";
import { getStoryAct, storyActs, storyActsById } from "~/story/acts";

describe("story acts registry", () => {
  it("uses the public three-act story order", () => {
    expect(storyActs.map((act) => act.id)).toEqual([
      "prologue",
      "act-2",
      "act-3",
      "act-4",
      "epilogue",
    ]);
  });

  it("maps public Act 3 to migration change and public Act 4 to climate", () => {
    expect(storyActsById["act-3"]).toMatchObject({
      id: "act-3",
      layout: "migration-stage",
      titleKey: "story.acts.act3.title",
    });
    expect(storyActsById["act-4"]).toMatchObject({
      id: "act-4",
      layout: "climate-stage",
      titleKey: "story.acts.act4.title",
    });
  });

  it("progresses from Guided Migration to Migration Change to Climate", () => {
    expect(getStoryAct("prologue").nextActId).toBe("act-2");
    expect(getStoryAct("act-2").nextActId).toBe("act-3");
    expect(getStoryAct("act-3").nextActId).toBe("act-4");
    expect(getStoryAct("act-4").nextActId).toBe("epilogue");
  });

  it("routes Prologue through the cinematic map sequence", () => {
    expect(getStoryAct("prologue")).toMatchObject({
      id: "prologue",
      layout: "fullscreen",
      nextActId: "act-2",
    });
    expect(prologuePageSource).not.toContain("StoryActRuntimePlaceholder");
    expect(prologuePageSource).toContain('from "~/components/map/BirdMap.vue"');
    expect(prologuePageSource).toContain('data-source="story"');
    expect(prologuePageSource).toContain('playback-source="story-playback"');
    expect(prologuePageSource).toContain(':show-controls="false"');
    expect(prologuePageSource).toContain(':show-map-navigation="false"');
    expect(prologuePageSource).toContain(':show-story-marker="false"');
    expect(prologuePageSource).toContain("StoryProgressSidebar");
    expect(prologuePageSource).toContain('navigateTo("/story/act-2")');
    expect(prologuePageSource).not.toContain("Ready to begin the journey?");
    expect(prologuePageSource).not.toContain("Begin Journey");
  });

  it("keeps Act II behind an entry screen until guided migration starts", () => {
    expect(migrationActStageSource).toContain("ActEntryScreen");
    expect(migrationActStageSource).toContain("MigrationStageMode");
    expect(migrationActStageSource).toContain("isEntryVisible");
    expect(migrationActStageSource).toContain("story.acts.act2.entry.title");
    expect(migrationActStageSource).toContain("story.acts.act2.entry.subtitle");
    expect(migrationActStageSource).toContain("story.acts.act2.entry.continue");
    expect(migrationActStageSource).toContain("story.acts.act2.entry.back");
    expect(migrationActStageSource).toContain('stageMode.value !== "entry"');
    expect(migrationActStageSource).toContain(
      "guidedController.startGuidedJourney()",
    );
    expect(migrationActStageSource).toContain(
      "if (isGatedMigrationAct.value) return;",
    );
    expect(migrationActStageSource).toContain(
      'await navigateTo("/story/prologue")',
    );
    expect(en.story.acts.act2.entry).toMatchObject({
      title: "The Stork's Journey",
      subtitle: "A Guided Migration",
      continue: "Start guided journey",
      back: "Back",
    });
  });

  it("keeps Act III behind the shared entry screen", () => {
    expect(migrationActStageSource).toContain('props.act.id === "act-3"');
    expect(migrationActStageSource).toContain("story.acts.act3.entry.title");
    expect(migrationActStageSource).toContain("story.acts.act3.entry.subtitle");
    expect(migrationActStageSource).toContain(
      "story.acts.act3.entry.description",
    );
    expect(migrationActStageSource).toContain("await controller.startStory()");
    expect(migrationActStageSource).toContain(
      'await navigateTo("/story/act-2")',
    );
    expect(en.story.acts.act3.entry).toMatchObject({
      title: "Migration Change over Time",
      continue: "Continue",
      back: "Back",
    });
  });

  it("uses the shared home photo as the default entry background", () => {
    expect(homePageSource).toContain("stork_stock.jpeg");
    expect(actEntryScreenSource).toContain("stork_stock.jpeg");
    expect(actEntryScreenSource).toContain(
      "props.backgroundImage ?? defaultEntryBackgroundImage",
    );
    expect(migrationActStageSource).not.toContain("storkStockImage");
    expect(migrationActStageSource).not.toContain("storkFlyingImage");
    expect(migrationActStageSource).not.toContain("stork_flying");
  });

  it("uses shared presenter actions for entry screens", () => {
    expect(actEntryScreenSource).toContain("usePresenterActions");
    expect(actEntryScreenSource).toContain("onPageUp: emitBack");
    expect(actEntryScreenSource).toContain("onPageDown: emitContinue");
    expect(actEntryScreenSource).not.toContain("ArrowUp");
    expect(actEntryScreenSource).not.toContain("ArrowDown");
  });

  it("moves migration debug actions into the debug dock", () => {
    expect(migrationActStageSource).toContain(
      "const showBottomControls = computed(",
    );
    expect(migrationActStageSource).toContain("!isGatedMigrationAct.value &&");
    expect(migrationActStageSource).toContain("ActDebugDock");
    expect(migrationActStageSource).toContain("canShowStoryProgress");
    expect(migrationActStageSource).toContain("handleStoryProgress");
    expect(migrationActStageSource).toContain(
      'handlePanelAction("forceCompleteGuidedStep")',
    );
    expect(migrationActStageSource).toContain(
      "getMigrationCycleButtonLabel(cycle)",
    );
    expect(migrationActStageSource).toContain("controller.toggleAutoProgress");
    expect(migrationActStageSource).toContain(
      "story.acts.act2.controls.storyProgress",
    );
    expect(migrationStoryLayoutSource).toContain('<slot name="overlay" />');
    expect(actDebugDockSource).toContain("<slot />");
    expect(en.story.acts.act2.controls.storyProgress).toBe("Story Progress");
  });

  it("keeps Act II and Act III migration guidance focused on narration and temporary feedback", () => {
    expect(migrationActInfoPanelSource).not.toContain(
      "migration-info-panel__movements",
    );
    expect(migrationActInfoPanelSource).not.toContain(
      "migration-info-panel__movement-state",
    );
    expect(migrationActInfoPanelSource).not.toContain(
      "getMovementStateLabel",
    );
    expect(migrationActInfoPanelSource).not.toContain(
      "migration-info-panel__status",
    );
    expect(migrationActInfoPanelSource).not.toContain(
      "migration-info-panel__title",
    );
    expect(migrationActInfoPanelSource).not.toContain(
      "migration-info-panel__detail",
    );
    expect(migrationActInfoPanelSource).not.toContain("showTitle");
    expect(migrationActInfoPanelSource).not.toContain("showFeedbackTitle");
    expect(migrationActInfoPanelSource).not.toContain("feedbackTitle");
    expect(migrationActInfoPanelSource).toContain(
      "migration-info-panel__content",
    );
    expect(migrationActInfoPanelSource).toContain("visibleNarrationText");
    expect(migrationActInfoPanelSource).toContain(
      "migration-info-panel__feedback",
    );
    expect(migrationActInfoPanelSource).toContain(
      "migration-info-panel__progress",
    );
    expect(migrationActInfoPanelSource).toContain(
      "migration-info-panel__progress-dot",
    );
    expect(migrationActInfoPanelSource).toContain(
      "migration-info-panel__progress-title",
    );
    expect(migrationActInfoPanelSource).toContain(
      "story.migrationPanel.practiceProgress.title",
    );
    expect(migrationActInfoPanelSource).toContain(
      "story.migrationPanel.practiceProgress.ariaLabel",
    );
    expect(migrationActInfoPanelSource).toContain(
      "const progressDotIndexes = [0, 1, 2] as const;",
    );
    expect(migrationActInfoPanelSource).toContain("width: 56px;");
    expect(migrationActInfoPanelSource).toContain("height: 56px;");
    expect(migrationActInfoPanelSource).not.toContain(
      "migration-info-panel__progress-caption",
    );
    expect(migrationActInfoPanelSource).toContain("position: absolute;");
    expect(migrationActInfoPanelSource).toContain("bottom: 0;");
    expect(migrationActInfoPanelSource).toContain("z-index: 3;");
    expect(migrationActInfoPanelSource).toContain("model.feedbackPrimary");
    expect(migrationActInfoPanelSource).toContain("model.feedbackText");
    expect(migrationActStageSource).toContain("activeCyclePeriodLabel");
    expect(migrationActStageSource).toContain("formatMigrationCyclePeriod");
    expect(migrationActStageSource).toContain(
      "migration-map__period-indicator",
    );
    expect(en.story.migrationPanel.practiceProgress.title).toBe(
      "Practice progress",
    );
    expect(en.story.migrationPanel.practiceProgress.ariaLabel).toBe(
      "Movement practice progress: {current} of {total} successful",
    );
  });

  it("keeps Climate movement, data, narration, and chart period context visible", () => {
    expect(act4InfoCardSource).toContain("act4-info-card__season");
    expect(act4InfoCardSource).toContain("act4-info-card__movement");
    expect(act4InfoCardSource).toContain("act4-info-card__data-content");
    expect(act4InfoCardSource).toContain("act4-info-card__narration");
    expect(act4InfoCardSource).toContain("act4-info-card__feedback");
    expect(act4InfoCardSource).toContain("act4-info-card__period-transition");
    expect(act4InfoCardSource).toContain("act4-info-card__completion-subtitle");
    expect(act4InfoCardSource).toContain("model.mode === 'narration'");
    expect(act4InfoCardSource).not.toContain("act4-info-card__instructions");
    expect(act4InfoCardSource).not.toContain("model.instructions");
    expect(act4InfoCardSource).toContain("model.seasonLabel");
    expect(act4InfoCardSource).toContain("model.movementPercentLabel");
    expect(act4InfoCardSource).toContain("model.temperature.valueLabel");
    expect(act4InfoCardSource).toContain("model.temperature.contextLabel");
    expect(climateActStageSource).toContain("activeClimatePeriodLabel");
    expect(climateActStageSource).toContain("formatDelimitedPeriod");
    expect(climateActStageSource).toContain("formatPeriodTransition");
    expect(climateActStageSource).toContain(
      ':period-label="activeClimatePeriodLabel"',
    );
    expect(climateProgressChartSource).toContain(
      "act4-climate-chart__period-indicator",
    );
  });

  it("keeps Climate behind an entry screen until the full tutorial flow starts", () => {
    expect(climateActStageSource).toContain("ActEntryScreen");
    expect(climateActStageSource).toContain("ClimateStageMode");
    expect(climateActStageSource).toContain("isClimateEntryVisible");
    expect(climateActStageSource).toContain("story.acts.act4.entry.title");
    expect(climateActStageSource).toContain("story.acts.act4.entry.subtitle");
    expect(climateActStageSource).toContain(
      "story.acts.act4.entry.description",
    );
    expect(climateActStageSource).toContain(
      'if (climateStageMode.value !== "entry") return;',
    );
    expect(climateActStageSource).toContain("await controller.initialize()");
    expect(climateActStageSource).toContain("await controller.startFullFlow()");
    expect(climateActStageSource).toContain('await navigateTo("/story/act-3")');
    expect(climateActStageSource).not.toContain("onMounted");
    expect(en.story.acts.act4.entry).toMatchObject({
      title: "Climate Data",
      subtitle: "Changing Conditions",
      continue: "Continue",
      back: "Back",
    });
  });

  it("runs Epilogue as a gated reflective map recap", () => {
    expect(epiloguePageSource).toContain("ActEntryScreen");
    expect(epiloguePageSource).not.toContain("StoryActRuntimePlaceholder");
    expect(epiloguePageSource).toContain('from "~/components/map/BirdMap.vue"');
    expect(epiloguePageSource).toContain('data-source="story"');
    expect(epiloguePageSource).toContain('playback-source="story-playback"');
    expect(epiloguePageSource).toContain(':show-controls="false"');
    expect(epiloguePageSource).toContain(':show-map-navigation="false"');
    expect(epiloguePageSource).toContain(':show-story-marker="false"');
    expect(epiloguePageSource).toContain(':single-story-cycle-mode="false"');
    expect(epiloguePageSource).toContain(
      ':story-cycle-definitions="migrationStoryCycleDefinitions"',
    );
    expect(epiloguePageSource).toContain("CinematicSubtitle");
    expect(epiloguePageSource).toContain("epilogueNarrationCueKeys");
    expect(epiloguePageSource).toContain("epilogueRouteLegend");
    expect(epiloguePageSource).toContain('v-if="isEntryVisible"');
    expect(epiloguePageSource).toContain("EpilogueStageMode");
    expect(epiloguePageSource).toContain("narration.speakText");
    expect(epiloguePageSource).toContain(
      'behavior: index === 0 ? "replace" : "queue"',
    );
    expect(epiloguePageSource).toContain("stopEpilogue");
    expect(epiloguePageSource).toContain("clearPauseTimer");
    expect(epiloguePageSource).toContain("usePresenterActions");
    expect(epiloguePageSource).toContain('await navigateTo("/")');
    expect(epiloguePageSource).toContain('epilogueStageMode.value = "running"');
    expect(epiloguePageSource).toContain('await navigateTo("/story/act-4")');
    expect(epiloguePageSource).toContain("story.acts.epilogue.entry.title");
    expect(epiloguePageSource).toContain(
      "story.acts.epilogue.completion.title",
    );
    expect(en.story.acts.epilogue.entry).toMatchObject({
      title: "An Uncertain Future",
      subtitle: "Epilogue",
      continue: "Continue",
      back: "Back",
    });
    expect(en.story.acts.epilogue.completion.returnHome).toBe("Return Home");
  });

  it("restores the Climate debug bar as a gated layout row", () => {
    expect(climateActStageSource).not.toContain("ActDebugDock");
    expect(climateActStageSource).toContain("climate-act-debug-button");
    expect(climateActStageSource).toContain(":not(.climate-act-debug-button)");
    expect(climateActStageSource).toContain('@click="controller.toggleDebug"');
    expect(climateActStageSource).toContain('v-if="isDebugMode"');
    expect(climateActStageSource).toContain("climate-act-page--debug-open");
    expect(climateActStageSource).toContain(
      "grid-template-rows: minmax(0, 1fr);",
    );
    expect(climateActStageSource).toContain(
      "grid-template-rows: minmax(0, 1fr) var(--climate-act-bottom-bar-height);",
    );
    expect(climateActStageSource).toContain("controller.startFullFlow");
    expect(climateActStageSource).toContain("controller.startStoryFlow");
    expect(climateActStageSource).toContain("togglePlayback");
    expect(climateActStageSource).toContain("controller.reset");
    expect(climateActStageSource).toContain("controller.startTutorialFlow");
    expect(climateActStageSource).toContain("controller.toggleAutoProgress");
    expect(climateActStageSource).toContain("triggerSkeletonPulseTest");
    expect(climateActStageSource).toContain("controller.playDebugOutro");
    expect(climateActStageSource).toContain("controller.startDebugSeason");
  });

  it("routes public Act 3 to migration change and public Act 4 to climate", () => {
    expect(act3PageSource).toContain('from "~/story/acts/act3"');
    expect(act4PageSource).toContain('from "~/story/acts/act4"');
    expect(act4LegacyPageSource).toContain('navigateTo("/story/act-4"');
    expect(act4LegacyCompactPageSource).toContain('navigateTo("/story/act-4"');
  });

  it("keeps visible navigation on three numbered acts", () => {
    for (const source of [
      homePageSource,
      storyIndexPageSource,
      storyProgressSidebarSource,
    ]) {
      expect(source).toContain("/story/act-2");
      expect(source).toContain("/story/act-3");
      expect(source).toContain("/story/act-4");
      expect(source).not.toContain("/story/act-5");
    }

    expect(en.home.nav).toMatchObject({
      act2: "Act 2",
      act3: "Act 3",
      act4: "Act 4",
    });
    expect(en.home.nav).not.toHaveProperty("act5");
    expect(en.story.progress.act3.title).toBe("Act III - Changing Cycles");
    expect(en.story.progress.act4.title).toBe("Act IV - Climate Data");
    expect(en.story.progress).not.toHaveProperty("act5");
  });

  it("keeps Home separate from the centered story progress items", () => {
    expect(storyProgressSidebarSource).toContain("story-progress__home");
    expect(storyProgressSidebarSource).toContain("story-progress__acts");
    expect(storyProgressSidebarSource).toContain("mdiHomeOutline");
    expect(storyProgressSidebarSource).toContain('navigateTo("/")');
    expect(storyProgressSidebarSource).toContain("story.progress.home.label");
    expect(en.story.progress.home.label).toBe("Home");
  });
});
