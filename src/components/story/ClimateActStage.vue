<template>
  <main class="climate-act-page">
    <section
      class="climate-act-context"
      :aria-label="t('story.aria.context', { title: actTitle })"
    >
      <StoryProgressSidebar />

      <div class="climate-act-context__group">
        <p class="climate-act-context__eyebrow">
          {{ t("story.acts.act5.periodEyebrow") }}
        </p>
        <h1>{{ periodLabel }}</h1>
        <p class="climate-act-context__season">{{ currentSeasonLabel }}</p>

        <SeasonClock :show-controls="false">
          <span class="climate-act-clock-date">{{ currentDate }}</span>
        </SeasonClock>

        <p class="climate-act-context__optional">{{ periodContext }}</p>
      </div>
    </section>

    <section
      class="climate-act-stage"
      :aria-label="t('story.aria.stage', { title: actTitle })"
    >
      <section
        class="climate-act-comparison"
        :aria-label="t('story.aria.support', { title: actTitle })"
      >
        <section
          class="climate-act-avatar"
          :aria-label="t('story.aria.instructor')"
        >
          <MovementStage
            :landmarks="instructorLandmarks"
            source-mode="recorded-motion"
            :source-aspect="instructorSourceAspect"
            :fill-frame="true"
          />
          <div v-if="countdownRemaining > 0" class="climate-act-countdown">
            {{ countdownRemaining }}
          </div>
        </section>

        <section
          class="climate-act-camera"
          :aria-label="t('story.aria.userMirror')"
        >
          <MovementCamera
            mode="camera"
            :fixed="false"
            :show-hands="false"
            @pose-landmarks="poseLandmarks = $event"
          />
        </section>
      </section>

      <section class="climate-act-info" :aria-label="activeSceneTitle">
        <p class="climate-act-info__eyebrow">{{ currentDate }}</p>
        <h2
          class="climate-act-info__cue"
          :class="`climate-act-info__cue--${instructionCueTone}`"
        >
          {{ instructionCueText }}
        </h2>
      </section>
    </section>

    <section
      class="climate-act-bottom-bar"
      :aria-label="t('story.aria.runtimeMetadata')"
    >
      <div class="climate-act-bottom-bar__actions">
        <button class="btn btn--primary" type="button" @click="togglePlayback">
          {{ playbackToggleLabel }}
        </button>
        <button class="btn" type="button" @click="resetCycle">
          {{ t("story.acts.act5.controls.reset") }}
        </button>
        <button
          v-if="runtimeStore.showContinueGate"
          class="btn btn--primary"
          type="button"
          @click="continueToNextAct"
        >
          {{ t("common.continue") }}
        </button>
      </div>

      <dl class="climate-act-bottom-bar__meta">
        <div>
          <dt>{{ t("story.acts.act5.status.state") }}</dt>
          <dd>{{ playbackState }}</dd>
        </div>
        <div>
          <dt>{{ t("story.acts.act5.status.season") }}</dt>
          <dd>{{ currentSeasonLabel }}</dd>
        </div>
        <div>
          <dt>{{ t("story.acts.act5.status.repetition") }}</dt>
          <dd>{{ repetitionLabel }}</dd>
        </div>
        <div>
          <dt>{{ t("story.acts.act5.status.time") }}</dt>
          <dd>{{ timeLabel }}</dd>
        </div>
      </dl>
    </section>

    <section v-if="isDebugMode" class="climate-act-debug">
      <div class="climate-act-debug__actions">
        <button
          v-for="season in debugSeasonConfigs"
          :key="season.id"
          class="btn"
          type="button"
          @click="startDebugSeason(season.id)"
        >
          {{
            t("story.acts.act5.debug.startSeason", {
              season: season.labelKey ? t(season.labelKey) : season.label,
            })
          }}
        </button>
        <button class="btn" type="button" @click="startSummerSequence">
          {{ t("story.acts.act5.debug.startSummerSequence") }}
        </button>
        <button class="btn" type="button" @click="startAutumnSequence">
          {{ t("story.acts.act5.debug.startAutumnSequence") }}
        </button>
        <button class="btn" type="button" @click="startSpringSequence">
          {{ t("story.acts.act5.debug.startSpringSequence") }}
        </button>
        <button class="btn" type="button" @click="startWinterSequence">
          {{ t("story.acts.act5.debug.startWinterSequence") }}
        </button>
      </div>

      <button
        class="btn climate-act-debug__toggle"
        type="button"
        @click="debugDiagnosticsOpen = !debugDiagnosticsOpen"
      >
        {{
          debugDiagnosticsOpen
            ? t("story.acts.act5.debug.hideDiagnostics")
            : t("story.acts.act5.debug.showDiagnostics")
        }}
      </button>

      <dl v-if="debugDiagnosticsOpen" class="climate-act-debug__grid">
        <div>
          <dt>Mode</dt>
          <dd>
            {{ summerTestMode }} / {{ autumnTestMode }} / {{ springTestMode }} /
            {{ winterTestMode }}
          </dd>
        </div>
        <div>
          <dt>Sequence phase</dt>
          <dd>
            {{ summerSequencePhase }} / {{ autumnSequencePhase }} /
            {{ springSequencePhase }} / {{ winterSequencePhase }}
          </dd>
        </div>
        <div>
          <dt>Intensity</dt>
          <dd>{{ currentSummerIntensity }}</dd>
        </div>
        <div>
          <dt>Detected intensity</dt>
          <dd>{{ summerDebug.detectedIntensityClass }}</dd>
        </div>
        <div>
          <dt>Shape passed</dt>
          <dd>{{ summerDebug.movementShapePassed ? "yes" : "no" }}</dd>
        </div>
        <div>
          <dt>Intensity matched</dt>
          <dd>{{ summerDebug.intensityMatched ? "yes" : "no" }}</dd>
        </div>
        <div>
          <dt>Avatar movement</dt>
          <dd>{{ currentSummerMovementVariant.movementKey }}</dd>
        </div>
        <div>
          <dt>Intensity pos</dt>
          <dd>{{ currentSummerIntensityIndex + 1 }} / 4</dd>
        </div>
        <div>
          <dt>Season</dt>
          <dd>{{ currentSeasonLabel }}</dd>
        </div>
        <div>
          <dt>Beat</dt>
          <dd>{{ summerDebug.currentBeat }}</dd>
        </div>
        <div>
          <dt>Repetition</dt>
          <dd>{{ debugRepetitionLabel }}</dd>
        </div>
        <div>
          <dt>Tracking</dt>
          <dd>{{ summerDebug.trackingActive ? "active" : "inactive" }}</dd>
        </div>
        <div>
          <dt>Step side</dt>
          <dd>{{ summerDebug.detectedStepSide }}</dd>
        </div>
        <div>
          <dt>Expected side</dt>
          <dd>{{ summerDebug.expectedStepSide }}</dd>
        </div>
        <div>
          <dt>Essential ok</dt>
          <dd>{{ formatCriteria(summerDebug.essentialPassed) }}</dd>
        </div>
        <div>
          <dt>Essential missing</dt>
          <dd>{{ formatCriteria(summerDebug.essentialFailed) }}</dd>
        </div>
        <div>
          <dt>Supporting ok</dt>
          <dd>{{ formatCriteria(summerDebug.supportingPassed) }}</dd>
        </div>
        <div>
          <dt>Beat score</dt>
          <dd>{{ summerDebug.beatScore.toFixed(0) }}</dd>
        </div>
        <div>
          <dt>Shape score</dt>
          <dd>{{ summerDebug.movementShapeScore.toFixed(0) }}</dd>
        </div>
        <div>
          <dt>Intensity score</dt>
          <dd>{{ summerDebug.intensityMatchScore.toFixed(0) }}</dd>
        </div>
        <div>
          <dt>Total score</dt>
          <dd>{{ summerDebug.totalScore.toFixed(0) }}</dd>
        </div>
        <div>
          <dt>Cycle results</dt>
          <dd>{{ debugCycleResultsLabel }}</dd>
        </div>
        <div>
          <dt>Current streak</dt>
          <dd>{{ summerDebug.consecutiveSuccessfulCycles }}</dd>
        </div>
        <div>
          <dt>Required streak</dt>
          <dd>{{ summerDebug.hasReachedRequiredStreak ? "yes" : "no" }}</dd>
        </div>
        <div>
          <dt>Decision</dt>
          <dd>{{ debugSummerDecisionLabel }}</dd>
        </div>
        <div>
          <dt>Feedback</dt>
          <dd>{{ summerDebug.feedbackCode ?? "none" }}</dd>
        </div>
        <div>
          <dt>Retry</dt>
          <dd>
            {{
              summerDebug.retryRequired
                ? `yes (${summerDebug.retryCount})`
                : "no"
            }}
          </dd>
        </div>
        <div>
          <dt>Amplitude</dt>
          <dd>{{ formatDebugValue(summerDebug.metrics.combinedAmplitude) }}</dd>
        </div>
        <div>
          <dt>Step amplitude</dt>
          <dd>{{ formatDebugValue(summerDebug.metrics.stepAmplitude) }}</dd>
        </div>
        <div>
          <dt>Hand raise</dt>
          <dd>
            {{ formatDebugValue(summerDebug.metrics.handRaiseAmplitude) }}
          </dd>
        </div>
        <div>
          <dt>Arm opening</dt>
          <dd>
            {{ formatDebugValue(summerDebug.metrics.normalizedArmOpening) }}
          </dd>
        </div>
        <div>
          <dt>Interlude</dt>
          <dd>{{ isSummerFeedbackInterlude ? "yes" : "no" }}</dd>
        </div>
        <div>
          <dt>Next intensity</dt>
          <dd>{{ nextSummerIntensity ?? "none" }}</dd>
        </div>
        <div>
          <dt>Autumn value</dt>
          <dd>{{ currentAutumnValue }}</dd>
        </div>
        <div>
          <dt>Next autumn value</dt>
          <dd>{{ nextAutumnValue ?? "none" }}</dd>
        </div>
        <div>
          <dt>Shoulder width</dt>
          <dd>{{ formatDebugValue(summerDebug.metrics.shoulderWidth) }}</dd>
        </div>
        <div>
          <dt>Ankles</dt>
          <dd>
            {{ formatDebugValue(summerDebug.metrics.normalizedAnkleDistance) }}
          </dd>
        </div>
        <div>
          <dt>Hands</dt>
          <dd>
            {{ formatDebugValue(summerDebug.metrics.normalizedHandDistance) }}
          </dd>
        </div>
        <div>
          <dt>Hands Y</dt>
          <dd>
            L
            {{
              formatDebugValue(summerDebug.metrics.leftHandHeightFromShoulders)
            }}
            / R
            {{
              formatDebugValue(summerDebug.metrics.rightHandHeightFromShoulders)
            }}
          </dd>
        </div>
        <div>
          <dt>Elbows</dt>
          <dd>
            L {{ formatDebugValue(summerDebug.metrics.leftElbowAngle) }} / R
            {{ formatDebugValue(summerDebug.metrics.rightElbowAngle) }}
          </dd>
        </div>
        <div>
          <dt>Average elbow</dt>
          <dd>{{ formatDebugValue(summerDebug.metrics.averageElbowAngle) }}</dd>
        </div>
        <div>
          <dt>Autumn expected</dt>
          <dd>{{ autumnDebug.expectedValueClass }}</dd>
        </div>
        <div>
          <dt>Autumn detected</dt>
          <dd>{{ autumnDebug.detectedValueClass }}</dd>
        </div>
        <div>
          <dt>Autumn direction</dt>
          <dd>{{ autumnDebug.expectedDirection }}</dd>
        </div>
        <div>
          <dt>Start side</dt>
          <dd>
            {{ autumnDebug.metrics.expectedStartSide }} /
            {{ autumnDebug.metrics.detectedStartSide }}
          </dd>
        </div>
        <div>
          <dt>Start passed</dt>
          <dd>{{ autumnDebug.metrics.startSidePassed }}</dd>
        </div>
        <div>
          <dt>Direction locked</dt>
          <dd>{{ autumnDebug.metrics.directionLocked }}</dd>
        </div>
        <div>
          <dt>Direction result</dt>
          <dd>{{ autumnDebug.metrics.directionResult }}</dd>
        </div>
        <div>
          <dt>Direction reason</dt>
          <dd>{{ autumnDebug.metrics.directionFailureReason }}</dd>
        </div>
        <div>
          <dt>Camera mirrored</dt>
          <dd>yes · 2D</dd>
        </div>
        <div>
          <dt>Expected endpoint</dt>
          <dd>{{ autumnExpectedEndpointRegion }}</dd>
        </div>
        <div>
          <dt>Detected endpoint</dt>
          <dd>{{ autumnDebug.metrics.detectedEndpointRegion }}</dd>
        </div>
        <div>
          <dt>Endpoint error</dt>
          <dd>{{ autumnDebug.metrics.endpointErrorKind }}</dd>
        </div>
        <div>
          <dt>Autumn beat</dt>
          <dd>{{ autumnDebug.currentBeat }}</dd>
        </div>
        <div>
          <dt>Autumn feedback</dt>
          <dd>{{ autumnDebug.feedbackCode ?? "none" }}</dd>
        </div>
        <div>
          <dt>Autumn cycles</dt>
          <dd>{{ debugAutumnCycleResultsLabel }}</dd>
        </div>
        <div>
          <dt>Hand progress</dt>
          <dd>
            {{ formatDebugValue(autumnDebug.metrics.handTravelProgress) }}
          </dd>
        </div>
        <div>
          <dt>Expected progress</dt>
          <dd>
            {{ formatDebugValue(autumnDebug.metrics.expectedProgressMin) }}..
            {{ formatDebugValue(autumnDebug.metrics.expectedProgressMax) }}
          </dd>
        </div>
        <div>
          <dt>Signed from Beat 1</dt>
          <dd>
            {{ formatDebugValue(autumnDebug.metrics.signedProgressFromBeat1) }}
          </dd>
        </div>
        <div>
          <dt>Progress from start</dt>
          <dd>
            {{ formatDebugValue(autumnDebug.metrics.progressFromStartingPose) }}
          </dd>
        </div>
        <div>
          <dt>Beat 1 X</dt>
          <dd>
            {{ formatDebugValue(autumnDebug.metrics.beat1HandCenterXOffset) }}
          </dd>
        </div>
        <div>
          <dt>Beat 1 wrist X</dt>
          <dd>
            {{ formatDebugValue(autumnDebug.metrics.beat1OuterWristXOffset) }}
          </dd>
        </div>
        <div>
          <dt>Hand X</dt>
          <dd>
            {{ formatDebugValue(autumnDebug.metrics.handCenterXOffset) }}
          </dd>
        </div>
        <div>
          <dt>Hand Y</dt>
          <dd>
            {{ formatDebugValue(autumnDebug.metrics.handCenterYFromShoulders) }}
          </dd>
        </div>
        <div>
          <dt>Hand radius</dt>
          <dd>
            {{ formatDebugValue(autumnDebug.metrics.handRadiusFromTorso) }}
          </dd>
        </div>
        <div>
          <dt>Outer wrist X</dt>
          <dd>
            {{ formatDebugValue(autumnDebug.metrics.outerWristXOffset) }}
          </dd>
        </div>
        <div>
          <dt>Wrist to center</dt>
          <dd>
            {{
              formatDebugValue(autumnDebug.metrics.outerWristProgressToCenter)
            }}
          </dd>
        </div>
        <div>
          <dt>Outer wrist</dt>
          <dd>
            {{
              formatDebugValue(
                autumnDebug.metrics.outerWristRelativeToOuterShoulder,
              )
            }}
          </dd>
        </div>
        <div>
          <dt>Outer elbow</dt>
          <dd>
            {{ formatDebugValue(autumnDebug.metrics.outerElbowAngle) }}
          </dd>
        </div>
        <div>
          <dt>Outer extension</dt>
          <dd>{{ autumnDebug.metrics.outerArmExtensionClass }}</dd>
        </div>
        <div>
          <dt>Outer direction</dt>
          <dd>
            X {{ formatDebugValue(autumnDebug.metrics.outerArmDirectionX) }} / Y
            {{ formatDebugValue(autumnDebug.metrics.outerArmDirectionY) }}
          </dd>
        </div>
        <div>
          <dt>Inner forearm</dt>
          <dd>
            X
            {{ formatDebugValue(autumnDebug.metrics.innerForearmDirectionX) }}
            / Y
            {{ formatDebugValue(autumnDebug.metrics.innerForearmDirectionY) }}
          </dd>
        </div>
        <div>
          <dt>Arm similarity</dt>
          <dd>
            {{ formatDebugValue(autumnDebug.metrics.armDirectionSimilarity) }}
          </dd>
        </div>
        <div>
          <dt>Torso forward</dt>
          <dd>{{ formatDebugValue(autumnDebug.metrics.torsoFacingScore) }}</dd>
        </div>
        <div>
          <dt>Autumn essential missing</dt>
          <dd>{{ formatCriteria(autumnDebug.essentialFailed) }}</dd>
        </div>
        <div>
          <dt>Calibration</dt>
          <dd>
            {{
              summerDebug.calibration
                ? `${summerDebug.calibration.sampleCount} samples`
                : "pending"
            }}
          </dd>
        </div>
        <div>
          <dt>Spring value</dt>
          <dd>{{ currentSpringValue }}</dd>
        </div>
        <div>
          <dt>Next spring value</dt>
          <dd>{{ nextSpringValue ?? "none" }}</dd>
        </div>
        <div>
          <dt>Spring beat</dt>
          <dd>{{ springDebug.currentBeat }}</dd>
        </div>
        <div>
          <dt>Spring feedback</dt>
          <dd>{{ springDebug.feedbackCode ?? "none" }}</dd>
        </div>
        <div>
          <dt>Spring cycles</dt>
          <dd>{{ debugSpringCycleResultsLabel }}</dd>
        </div>
        <div>
          <dt>Spring height region</dt>
          <dd>{{ springDebug.detectedHandHeightRegion }}</dd>
        </div>
        <div>
          <dt>Spring height range</dt>
          <dd>
            {{ formatDebugValue(springDebug.metrics.expectedHandHeightMin) }}..
            {{ formatDebugValue(springDebug.metrics.expectedHandHeightMax) }}
          </dd>
        </div>
        <div>
          <dt>Spring hands H</dt>
          <dd>
            L {{ formatDebugValue(springDebug.metrics.leftHandHeight) }} / R
            {{ formatDebugValue(springDebug.metrics.rightHandHeight) }}
          </dd>
        </div>
        <div>
          <dt>Spring avg/low H</dt>
          <dd>
            {{ formatDebugValue(springDebug.metrics.averageHandHeight) }} /
            {{ formatDebugValue(springDebug.metrics.lowerHandHeight) }}
          </dd>
        </div>
        <div>
          <dt>Spring arm opening</dt>
          <dd>{{ formatDebugValue(springDebug.metrics.handOpeningWidth) }}</dd>
        </div>
        <div>
          <dt>Spring wrist outside</dt>
          <dd>
            L
            {{ formatDebugValue(springDebug.metrics.leftWristOutsideShoulder) }}
            / R
            {{
              formatDebugValue(springDebug.metrics.rightWristOutsideShoulder)
            }}
          </dd>
        </div>
        <div>
          <dt>Spring elbows</dt>
          <dd>{{ formatDebugValue(springDebug.metrics.averageElbowAngle) }}</dd>
        </div>
        <div>
          <dt>Spring knee</dt>
          <dd>
            {{ springDebug.expectedKneeSide }} /
            {{ springDebug.detectedKneeSide }}
          </dd>
        </div>
        <div>
          <dt>Spring essential missing</dt>
          <dd>{{ formatCriteria(springDebug.essentialFailed) }}</dd>
        </div>
        <div>
          <dt>Winter value</dt>
          <dd>{{ currentWinterValue }}</dd>
        </div>
        <div>
          <dt>Next winter value</dt>
          <dd>{{ nextWinterValue ?? "none" }}</dd>
        </div>
        <div>
          <dt>Winter beat</dt>
          <dd>{{ winterDebug.currentBeat }}</dd>
        </div>
        <div>
          <dt>Winter feedback</dt>
          <dd>{{ winterDebug.feedbackCode ?? "none" }}</dd>
        </div>
        <div>
          <dt>Winter cycles</dt>
          <dd>{{ debugWinterCycleResultsLabel }}</dd>
        </div>
        <div>
          <dt>Winter contraction</dt>
          <dd>
            {{ winterDebug.expectedContractionClass }} /
            {{ winterDebug.detectedContractionClass }}
          </dd>
        </div>
        <div>
          <dt>Compactness</dt>
          <dd>
            {{ formatDebugValue(winterDebug.metrics.compactnessScore) }}
          </dd>
        </div>
        <div>
          <dt>Shoulder/hip drop</dt>
          <dd>
            H {{ formatDebugValue(winterDebug.metrics.headDrop) }} / S
            {{ formatDebugValue(winterDebug.metrics.shoulderDrop) }} / hip
            {{ formatDebugValue(winterDebug.metrics.hipDrop) }}
          </dd>
        </div>
        <div>
          <dt>Body ratio</dt>
          <dd>{{ formatDebugValue(winterDebug.metrics.bodyHeightRatio) }}</dd>
        </div>
        <div>
          <dt>Winter knees</dt>
          <dd>
            L {{ formatDebugValue(winterDebug.metrics.leftKneeAngle) }} / R
            {{ formatDebugValue(winterDebug.metrics.rightKneeAngle) }} / avg
            {{ formatDebugValue(winterDebug.metrics.averageKneeAngle) }}
          </dd>
        </div>
        <div>
          <dt>Winter hands</dt>
          <dd>
            open {{ formatDebugValue(winterDebug.metrics.handOpeningWidth) }} /
            dist
            {{ formatDebugValue(winterDebug.metrics.normalizedHandDistance) }}
          </dd>
        </div>
        <div>
          <dt>Winter arms</dt>
          <dd>
            open {{ winterDebug.metrics.armsOpenSideways }} / hug
            {{ winterDebug.metrics.selfHugDetected }} / head
            {{ winterDebug.metrics.headProtectionDetected }}
          </dd>
        </div>
        <div>
          <dt>Winter hug signals</dt>
          <dd>
            centered {{ winterDebug.metrics.handsCenteredForHug }} / compact
            {{ winterDebug.metrics.handsCompactForHug }}
          </dd>
        </div>
        <div>
          <dt>Winter return</dt>
          <dd>
            {{ winterDebug.metrics.returnToUprightDetected }} / released
            {{ winterDebug.metrics.armsReleased }}
          </dd>
        </div>
        <div>
          <dt>Winter neutral</dt>
          <dd>
            {{
              winterDebug.neutralReference
                ? `${winterDebug.neutralReference.sampleCount} samples`
                : "pending"
            }}
          </dd>
        </div>
        <div>
          <dt>Winter feedback measure</dt>
          <dd>
            {{ repetitionIndex }} /
            {{ visibleWinterMeasureFeedback?.measureIndex ?? "none" }}
          </dd>
        </div>
        <div>
          <dt>Winter essential missing</dt>
          <dd>{{ formatCriteria(winterDebug.essentialFailed) }}</dd>
        </div>
      </dl>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useAutumnMovementRecognition } from "~/composables/useAutumnMovementRecognition";
import { useSeasonalLearningCycle } from "~/composables/useSeasonalLearningCycle";
import { useSpringMovementRecognition } from "~/composables/useSpringMovementRecognition";
import { useSummerMovementRecognition } from "~/composables/useSummerMovementRecognition";
import { useWinterMovementRecognition } from "~/composables/useWinterMovementRecognition";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import { act5IntroCycleConfig } from "~/story/act5IntroCycle";
import type { PoseLandmarkLike } from "~/types/pose";
import { climateMovementFlowRegistry } from "~/utils/movement/acts/climate/climateMovementFlows";
import {
  AUTUMN_MOVEMENT_REFERENCE,
  getAutumnDirectionForRepetition,
  getPrioritizedAutumnProblemEvaluation,
} from "~/utils/movement/acts/climate/autumn/autumnMovementRecognition";
import {
  SPRING_MOVEMENT_REFERENCE,
  getPrioritizedSpringProblemEvaluation,
} from "~/utils/movement/acts/climate/spring/springMovementRecognition";
import { getPrioritizedWinterProblemEvaluation } from "~/utils/movement/acts/climate/winter/winterMovementRecognition";
import type {
  AutumnDirection,
  AutumnFeedbackCode,
  AutumnRecognitionMetrics,
  AutumnValueClass,
} from "~/utils/movement/acts/climate/autumn/autumnMovementRecognition";
import type {
  SpringFeedbackCode,
  SpringRecognitionMetrics,
  SpringValue,
} from "~/utils/movement/acts/climate/spring/springMovementRecognition";
import type {
  WinterFeedbackCode,
  WinterRecognitionMetrics,
  WinterValue,
} from "~/utils/movement/acts/climate/winter/winterMovementRecognition";
import type {
  SummerFeedbackCode,
  SummerIntensity,
} from "~/utils/movement/acts/climate/summer/summerMovementRecognition";
import type { SeasonalCycleSeasonId } from "~/utils/seasonalCycle";
import type { StoryAct } from "~/story/types";

const props = defineProps<{
  act: StoryAct;
}>();

type SummerTestMode = "single100" | "intensitySequence";
type AutumnTestMode = "single100" | "valueSequence";
type SpringTestMode = "single100" | "valueSequence";
type WinterTestMode = "single100" | "valueSequence";
type ValueSequencePhase =
  | "idle"
  | "intro"
  | "performing"
  | "evaluatingIntensity"
  | "feedbackInterlude"
  | "transitioningToNextIntensity"
  | "completed";
type VisibleMeasureFeedback = {
  measureIndex: number;
  text: string;
  tone: "success" | "error";
};
type MeasureFeedbackEvaluation = {
  measureIndex: number;
  result: string;
};

const summerSequenceFlow = climateMovementFlowRegistry.summerSequenceDebug;
const autumnSequenceFlow = climateMovementFlowRegistry.autumnSequenceDebug;
const springSequenceFlow = climateMovementFlowRegistry.springSequenceDebug;
const winterSequenceFlow = climateMovementFlowRegistry.winterSequenceDebug;
const summerIntensityOrder = summerSequenceFlow.values;
const autumnValueOrder = autumnSequenceFlow.values;
const springValueOrder = springSequenceFlow.values;
const winterValueOrder = winterSequenceFlow.values;
const sequenceIntroDurationMs = 4_200;

const summerMovementVariants: Record<SummerIntensity, { movementKey: string }> =
  {
    "100": { movementKey: "summer-100-percent" },
    "60": { movementKey: "summer-100-percent" }, // Temporary fallback until separate 60 movement exists.
    "30": { movementKey: "summer-100-percent" }, // Temporary fallback until separate 30 movement exists.
    "10": { movementKey: "summer-100-percent" }, // Temporary fallback until separate 10 movement exists.
  };

const summerIntensityGuidance: Record<
  SummerIntensity,
  {
    warmingLabelKey: string;
    beatInstructionKeys: Record<number, string>;
  }
> = {
  "100": {
    warmingLabelKey: "story.acts.act5.summerInstructions.warming.100",
    beatInstructionKeys: {
      1: "story.acts.act5.summerInstructions.beats.1",
      2: "story.acts.act5.summerInstructions.beats.100.2",
      3: "story.acts.act5.summerInstructions.beats.100.3",
      4: "story.acts.act5.summerInstructions.beats.4",
    },
  },
  "60": {
    warmingLabelKey: "story.acts.act5.summerInstructions.warming.60",
    beatInstructionKeys: {
      1: "story.acts.act5.summerInstructions.beats.1",
      2: "story.acts.act5.summerInstructions.beats.60.2",
      3: "story.acts.act5.summerInstructions.beats.60.3",
      4: "story.acts.act5.summerInstructions.beats.4",
    },
  },
  "30": {
    warmingLabelKey: "story.acts.act5.summerInstructions.warming.30",
    beatInstructionKeys: {
      1: "story.acts.act5.summerInstructions.beats.1",
      2: "story.acts.act5.summerInstructions.beats.30.2",
      3: "story.acts.act5.summerInstructions.beats.30.3",
      4: "story.acts.act5.summerInstructions.beats.4",
    },
  },
  "10": {
    warmingLabelKey: "story.acts.act5.summerInstructions.warming.10",
    beatInstructionKeys: {
      1: "story.acts.act5.summerInstructions.beats.1",
      2: "story.acts.act5.summerInstructions.beats.10.2",
      3: "story.acts.act5.summerInstructions.beats.10.3",
      4: "story.acts.act5.summerInstructions.beats.4",
    },
  },
};

const summerBeatFallbackInstructions: Record<number, string> = {
  1: "story.acts.act5.summerInstructions.fallback.1",
  2: "story.acts.act5.summerInstructions.fallback.2",
  3: "story.acts.act5.summerInstructions.fallback.3",
  4: "story.acts.act5.summerInstructions.fallback.4",
};

const autumnBeatInstructions: Record<number, string> = {
  1: "story.acts.act5.autumnInstructions.beats.1",
  2: "story.acts.act5.autumnInstructions.beats.2",
  3: "story.acts.act5.autumnInstructions.beats.3",
  4: "story.acts.act5.autumnInstructions.beats.4",
};

const springBeatInstructions: Record<number, string> = {
  1: "story.acts.act5.springInstructions.beat1",
  2: "story.acts.act5.springInstructions.beat2",
  3: "story.acts.act5.springInstructions.beat3",
  4: "story.acts.act5.springInstructions.beat4",
};

const winterBeatInstructions: Record<number, string> = {
  1: "story.acts.act5.winterInstructions.beat1",
  2: "story.acts.act5.winterInstructions.beat2",
  3: "story.acts.act5.winterInstructions.beat3",
  4: "story.acts.act5.winterInstructions.beat4",
};

const { t, translate, getActTitle, getSceneTitle } = useStoryTranslations();
const getAutumnFeedbackCueText = (feedbackCode: AutumnFeedbackCode) =>
  t(`story.acts.act5.autumnFeedback.${feedbackCode}`);
const getSpringFeedbackCueText = (feedbackCode: SpringFeedbackCode) =>
  t(`story.acts.act5.springFeedback.${feedbackCode}`);
const getWinterFeedbackCueText = (feedbackCode: WinterFeedbackCode) =>
  t(`story.acts.act5.winterFeedback.${feedbackCode}`);
const getVisibleMeasureFeedback = (
  evaluation: MeasureFeedbackEvaluation,
  cycleFeedbackKey: string,
  getProblemCue: () => string,
): VisibleMeasureFeedback => {
  if (evaluation.result === "success") {
    return {
      measureIndex: evaluation.measureIndex,
      text: t(`${cycleFeedbackKey}.success`),
      tone: "success",
    };
  }

  if (evaluation.result === "almostCorrect") {
    return {
      measureIndex: evaluation.measureIndex,
      text: t(`${cycleFeedbackKey}.almostCorrect`),
      tone: "success",
    };
  }

  return {
    measureIndex: evaluation.measureIndex,
    text: getProblemCue(),
    tone: "error",
  };
};
const storyEngine = useStoryEngine();
const runtimeStore = useStoryRuntimeStore();
const route = useRoute();
const poseLandmarks = ref<PoseLandmarkLike[] | null>(null);
const summerRecognition = useSummerMovementRecognition();
const autumnRecognition = useAutumnMovementRecognition();
const springRecognition = useSpringMovementRecognition();
const winterRecognition = useWinterMovementRecognition();
const debugDiagnosticsOpen = ref(false);
const summerTestMode = ref<SummerTestMode>("single100");
const autumnTestMode = ref<AutumnTestMode>("single100");
const springTestMode = ref<SpringTestMode>("single100");
const winterTestMode = ref<WinterTestMode>("single100");
const summerSequencePhase = ref<ValueSequencePhase>("idle");
const autumnSequencePhase = ref<ValueSequencePhase>("idle");
const springSequencePhase = ref<ValueSequencePhase>("idle");
const winterSequencePhase = ref<ValueSequencePhase>("idle");
const currentSummerIntensityIndex = ref(0);
const currentAutumnValueIndex = ref(0);
const currentSpringValueIndex = ref(0);
const currentWinterValueIndex = ref(0);
const completedSummerIntensities = ref<SummerIntensity[]>([]);
const completedAutumnValues = ref<AutumnValueClass[]>([]);
const completedSpringValues = ref<SpringValue[]>([]);
const completedWinterValues = ref<WinterValue[]>([]);
const isSummerFeedbackInterlude = ref(false);
const isAutumnFeedbackInterlude = ref(false);
const isSpringFeedbackInterlude = ref(false);
const isWinterFeedbackInterlude = ref(false);
const visibleSummerMeasureFeedback = ref<VisibleMeasureFeedback | null>(null);
const visibleAutumnMeasureFeedback = ref<VisibleMeasureFeedback | null>(null);
const visibleSpringMeasureFeedback = ref<VisibleMeasureFeedback | null>(null);
const visibleWinterMeasureFeedback = ref<VisibleMeasureFeedback | null>(null);
const summerFeedbackInterludeBeat = ref(1);
const autumnFeedbackInterludeBeat = ref(1);
const springFeedbackInterludeBeat = ref(1);
const winterFeedbackInterludeBeat = ref(1);
const summerFeedbackInterludeText = ref("");
const autumnFeedbackInterludeText = ref("");
const springFeedbackInterludeText = ref("");
const winterFeedbackInterludeText = ref("");
const summerSequenceIntroStep = ref(0);
const autumnSequenceIntroStep = ref(0);
const springSequenceIntroStep = ref(0);
const winterSequenceIntroStep = ref(0);
const sequenceEvaluationHandledKey = ref("");
const autumnSequenceEvaluationHandledKey = ref("");
const springSequenceEvaluationHandledKey = ref("");
const winterSequenceEvaluationHandledKey = ref("");
let summerSequenceIntroTimers: Array<ReturnType<typeof setTimeout>> = [];
let autumnSequenceIntroTimers: Array<ReturnType<typeof setTimeout>> = [];
let springSequenceIntroTimers: Array<ReturnType<typeof setTimeout>> = [];
let winterSequenceIntroTimers: Array<ReturnType<typeof setTimeout>> = [];
let summerFeedbackInterludeTimer: ReturnType<typeof setInterval> | null = null;
let autumnFeedbackInterludeTimer: ReturnType<typeof setInterval> | null = null;
let springFeedbackInterludeTimer: ReturnType<typeof setInterval> | null = null;
let winterFeedbackInterludeTimer: ReturnType<typeof setInterval> | null = null;
const {
  currentDate,
  currentFrame: instructorFrame,
  currentMovementSourceAspect: instructorSourceAspect,
  currentSeason,
  countdownRemaining,
  elapsedMs,
  isCountingDown,
  isCompleted,
  isTransition,
  playbackState,
  repetitionIndex,
  seasonElapsedMs,
  showInstructorAvatar,
  totalDurationMs,
  cleanup,
  initialize,
  pause,
  play,
  queueSeasonRestart,
  reset,
  startSingleSeason,
} = useSeasonalLearningCycle(act5IntroCycleConfig);

const act = computed(() => props.act);
const actTitle = computed(() => getActTitle(act.value));
const activeScene = computed(() =>
  runtimeStore.currentActId === act.value.id
    ? (runtimeStore.currentScene ?? act.value.scenes[0] ?? null)
    : (act.value.scenes[0] ?? null),
);
const activeSceneTitle = computed(() =>
  activeScene.value ? getSceneTitle(activeScene.value) : actTitle.value,
);
const currentSeasonLabel = computed(() => {
  const season = currentSeason.value;

  return season.labelKey ? t(season.labelKey) : season.label;
});
const currentSummerIntensity = computed<SummerIntensity>(
  () => summerIntensityOrder[currentSummerIntensityIndex.value] ?? "100",
);
const nextSummerIntensity = computed<SummerIntensity | null>(
  () => summerIntensityOrder[currentSummerIntensityIndex.value + 1] ?? null,
);
const currentAutumnValue = computed<AutumnValueClass>(
  () => autumnValueOrder[currentAutumnValueIndex.value] ?? "100",
);
const nextAutumnValue = computed<AutumnValueClass | null>(
  () => autumnValueOrder[currentAutumnValueIndex.value + 1] ?? null,
);
const currentSpringValue = computed<SpringValue>(
  () => springValueOrder[currentSpringValueIndex.value] ?? "100",
);
const nextSpringValue = computed<SpringValue | null>(
  () => springValueOrder[currentSpringValueIndex.value + 1] ?? null,
);
const currentWinterValue = computed<WinterValue>(
  () => winterValueOrder[currentWinterValueIndex.value] ?? "100",
);
const nextWinterValue = computed<WinterValue | null>(
  () => winterValueOrder[currentWinterValueIndex.value + 1] ?? null,
);
const currentSummerMovementVariant = computed(
  () => summerMovementVariants[currentSummerIntensity.value],
);
const isDebugMode = computed(() => route.query.debug === "true");
const debugSeasonConfigs = computed(() =>
  (["spring", "summer", "autumn", "winter"] as SeasonalCycleSeasonId[])
    .map((seasonId) =>
      act5IntroCycleConfig.seasons.find((season) => season.id === seasonId),
    )
    .filter((season): season is (typeof act5IntroCycleConfig.seasons)[number] =>
      Boolean(season),
    ),
);
const summerDebug = computed(() => summerRecognition.debugSnapshot.value);
const springDebug = computed(() => springRecognition.debugSnapshot.value);
const winterDebug = computed(() => winterRecognition.debugSnapshot.value);
const getVisibleAutumnDirectionForRepetition = (
  currentRepetitionIndex: number | null,
): AutumnDirection =>
  getAutumnDirectionForRepetition(currentRepetitionIndex ?? 0);
const autumnDebug = computed(() => {
  const snapshot = autumnRecognition.debugSnapshot.value;
  const metrics = snapshot.metrics as AutumnRecognitionMetrics;
  const currentRepetition =
    autumnRecognition.currentRepetitionIndex.value ??
    repetitionIndex.value ??
    0;
  const currentEvaluation = autumnRecognition.currentEvaluation.value;

  return {
    ...snapshot,
    expectedValueClass: autumnRecognition.expectedValueClass.value,
    detectedValueClass: metrics.detectedValueClass,
    expectedDirection:
      currentEvaluation?.expectedDirection ??
      getVisibleAutumnDirectionForRepetition(currentRepetition),
  };
});
const autumnExpectedEndpointRegion = computed(
  () =>
    AUTUMN_MOVEMENT_REFERENCE[autumnRecognition.expectedValueClass.value]
      .endpointRegion,
);
const springExpectedMaxBeat = computed(
  () =>
    SPRING_MOVEMENT_REFERENCE[springRecognition.expectedValue.value].maxBeat,
);
const isSummerActive = computed(() => currentSeason.value.id === "summer");
const isAutumnActive = computed(() => currentSeason.value.id === "autumn");
const isSpringActive = computed(() => currentSeason.value.id === "spring");
const isWinterActive = computed(() => currentSeason.value.id === "winter");
const getSummerCueText = (
  instruction: string,
  intensity: SummerIntensity = currentSummerIntensity.value,
) => {
  const config = summerIntensityGuidance[intensity];

  return t("story.acts.act5.summerInstructions.beatCue", {
    value: intensity,
    warming: t(config.warmingLabelKey),
    instruction,
  });
};
const getSummerBeatInstruction = (beat: number) =>
  (() => {
    const intensity =
      summerTestMode.value === "intensitySequence"
        ? currentSummerIntensity.value
        : "100";
    const config = summerIntensityGuidance[intensity];

    return getSummerCueText(
      t(
        config.beatInstructionKeys[beat] ??
          summerBeatFallbackInstructions[beat] ??
          summerBeatFallbackInstructions[1],
      ),
      intensity,
    );
  })();
const getAutumnCueText = (instruction: string) => {
  const expectedDirection = getVisibleAutumnDirectionForRepetition(
    repetitionIndex.value,
  );

  return t("story.acts.act5.autumnInstructions.beatCue", {
    value: autumnRecognition.expectedValueClass.value,
    direction: t(
      `story.acts.act5.autumnInstructions.direction.${expectedDirection}`,
    ),
    instruction,
  });
};
const getAutumnBeatInstruction = (beat: number) =>
  getAutumnCueText(
    t(autumnBeatInstructions[beat] ?? autumnBeatInstructions[1]),
  );
const getSpringCueText = (instruction: string) =>
  t("story.acts.act5.springInstructions.beatCue", {
    value: springRecognition.expectedValue.value,
    instruction,
  });
const getSpringBeatInstruction = (beat: number) =>
  getSpringCueText(
    t(springBeatInstructions[beat] ?? springBeatInstructions[1]),
  );
const getWinterCueText = (instruction: string) =>
  t("story.acts.act5.winterInstructions.beatCue", {
    value: winterRecognition.expectedValue.value,
    instruction,
  });
const getWinterBeatInstruction = (beat: number) =>
  getWinterCueText(
    t(winterBeatInstructions[beat] ?? winterBeatInstructions[1]),
  );
const isVisibleSummerMeasureFeedbackCurrent = computed(
  () =>
    isSummerActive.value &&
    visibleSummerMeasureFeedback.value !== null &&
    visibleSummerMeasureFeedback.value.measureIndex === repetitionIndex.value &&
    summerRecognition.currentBeat.value === 4,
);
const isSummerFeedbackVisible = computed(
  () => isVisibleSummerMeasureFeedbackCurrent.value,
);
const isVisibleAutumnMeasureFeedbackCurrent = computed(
  () =>
    isAutumnActive.value &&
    visibleAutumnMeasureFeedback.value !== null &&
    visibleAutumnMeasureFeedback.value.measureIndex === repetitionIndex.value &&
    autumnRecognition.currentBeat.value === 4,
);
const isAutumnFeedbackVisible = computed(
  () => isVisibleAutumnMeasureFeedbackCurrent.value,
);
const isVisibleSpringMeasureFeedbackCurrent = computed(
  () =>
    isSpringActive.value &&
    visibleSpringMeasureFeedback.value !== null &&
    visibleSpringMeasureFeedback.value.measureIndex === repetitionIndex.value &&
    springRecognition.currentBeat.value === 4,
);
const isSpringFeedbackVisible = computed(
  () => isVisibleSpringMeasureFeedbackCurrent.value,
);
const isVisibleWinterMeasureFeedbackCurrent = computed(
  () =>
    isWinterActive.value &&
    visibleWinterMeasureFeedback.value !== null &&
    visibleWinterMeasureFeedback.value.measureIndex === repetitionIndex.value &&
    winterRecognition.currentBeat.value === 4,
);
const isWinterFeedbackVisible = computed(
  () => isVisibleWinterMeasureFeedbackCurrent.value,
);
const getBeatProblemCue = (
  beatEvaluation: NonNullable<typeof summerRecognition.currentEvaluation.value>,
) => {
  if (beatEvaluation.trackingUnavailable) {
    return t("story.acts.act5.summerFeedback.FULL_BODY_NOT_VISIBLE");
  }

  if (beatEvaluation.feedbackCode) {
    return t(`story.acts.act5.summerFeedback.${beatEvaluation.feedbackCode}`);
  }

  const failedEssential = beatEvaluation.criteria.find(
    (criterion) =>
      criterion.importance === "essential" && criterion.status !== "passed",
  );

  if (!failedEssential) return null;

  return t(`story.acts.act5.summerCriterion.${failedEssential.id}`);
};

const getCycleProblemCue = (
  cycleEvaluation: NonNullable<
    typeof summerRecognition.currentCycleEvaluation.value
  >,
) => {
  const firstProblem = cycleEvaluation.beatEvaluations.find(
    (beatEvaluation) => !beatEvaluation.passed,
  );

  if (!firstProblem) return t("story.acts.act5.summerFeedback.TRY_AGAIN");

  const cue = getBeatProblemCue(firstProblem);

  return cue
    ? t("story.acts.act5.sequence.beatProblem", {
        beat: firstProblem.beat,
        cue,
      })
    : t("story.acts.act5.summerFeedback.TRY_AGAIN");
};

const getSummerMeasureFeedback = (
  cycleEvaluation: NonNullable<
    typeof summerRecognition.currentCycleEvaluation.value
  >,
): VisibleMeasureFeedback =>
  getVisibleMeasureFeedback(
    cycleEvaluation,
    "story.acts.act5.summerCycleFeedback",
    () => getCycleProblemCue(cycleEvaluation),
  );

const clearVisibleSummerMeasureFeedback = () => {
  visibleSummerMeasureFeedback.value = null;
};

const summerFeedbackText = computed(() => {
  if (!isSummerFeedbackVisible.value) return "";

  return visibleSummerMeasureFeedback.value?.text ?? "";
});
const getAutumnCycleProblemCue = (
  cycleEvaluation: NonNullable<
    typeof autumnRecognition.currentCycleEvaluation.value
  >,
) => {
  const firstProblem = getPrioritizedAutumnProblemEvaluation(
    cycleEvaluation.beatEvaluations,
  );

  if (!firstProblem) return getAutumnFeedbackCueText("TRY_AGAIN");

  if (
    firstProblem.feedbackCode === "START_LEFT" ||
    firstProblem.feedbackCode === "START_RIGHT" ||
    firstProblem.feedbackCode === "START_ON_LEFT" ||
    firstProblem.feedbackCode === "START_ON_RIGHT"
  ) {
    return t("story.acts.act5.sequence.beatProblem", {
      beat: firstProblem.beat,
      cue: t("story.acts.act5.autumnFeedback.directionPattern"),
    });
  }

  return firstProblem.feedbackCode
    ? t("story.acts.act5.sequence.beatProblem", {
        beat: firstProblem.beat,
        cue: getAutumnFeedbackCueText(firstProblem.feedbackCode),
      })
    : getAutumnFeedbackCueText("TRY_AGAIN");
};

const getAutumnMeasureFeedback = (
  cycleEvaluation: NonNullable<
    typeof autumnRecognition.currentCycleEvaluation.value
  >,
): VisibleMeasureFeedback =>
  getVisibleMeasureFeedback(
    cycleEvaluation,
    "story.acts.act5.autumnCycleFeedback",
    () => getAutumnCycleProblemCue(cycleEvaluation),
  );

const clearVisibleAutumnMeasureFeedback = () => {
  visibleAutumnMeasureFeedback.value = null;
};

const autumnFeedbackText = computed(() => {
  if (!isAutumnFeedbackVisible.value) return "";

  return visibleAutumnMeasureFeedback.value?.text ?? "";
});
const getSpringCycleProblemCue = (
  cycleEvaluation: NonNullable<
    typeof springRecognition.currentCycleEvaluation.value
  >,
) => {
  const firstProblem = getPrioritizedSpringProblemEvaluation(
    cycleEvaluation.beatEvaluations,
  );

  if (!firstProblem) return getSpringFeedbackCueText("TRY_AGAIN");

  return firstProblem.feedbackCode
    ? t("story.acts.act5.sequence.beatProblem", {
        beat: firstProblem.beat,
        cue: getSpringFeedbackCueText(firstProblem.feedbackCode),
      })
    : getSpringFeedbackCueText("TRY_AGAIN");
};

const getSpringMeasureFeedback = (
  cycleEvaluation: NonNullable<
    typeof springRecognition.currentCycleEvaluation.value
  >,
): VisibleMeasureFeedback =>
  getVisibleMeasureFeedback(
    cycleEvaluation,
    "story.acts.act5.springCycleFeedback",
    () => getSpringCycleProblemCue(cycleEvaluation),
  );

const clearVisibleSpringMeasureFeedback = () => {
  visibleSpringMeasureFeedback.value = null;
};

const springFeedbackText = computed(() => {
  if (!isSpringFeedbackVisible.value) return "";

  return visibleSpringMeasureFeedback.value?.text ?? "";
});
const getWinterCycleProblemCue = (
  cycleEvaluation: NonNullable<
    typeof winterRecognition.currentCycleEvaluation.value
  >,
) => {
  const firstProblem = getPrioritizedWinterProblemEvaluation(
    cycleEvaluation.beatEvaluations,
  );

  if (!firstProblem) return getWinterFeedbackCueText("TRY_AGAIN");

  return firstProblem.feedbackCode
    ? t("story.acts.act5.sequence.beatProblem", {
        beat: firstProblem.beat,
        cue: getWinterFeedbackCueText(firstProblem.feedbackCode),
      })
    : getWinterFeedbackCueText("TRY_AGAIN");
};

const getWinterMeasureFeedback = (
  cycleEvaluation: NonNullable<
    typeof winterRecognition.currentCycleEvaluation.value
  >,
): VisibleMeasureFeedback =>
  getVisibleMeasureFeedback(
    cycleEvaluation,
    "story.acts.act5.winterCycleFeedback",
    () => getWinterCycleProblemCue(cycleEvaluation),
  );

const clearVisibleWinterMeasureFeedback = () => {
  visibleWinterMeasureFeedback.value = null;
};

const winterFeedbackText = computed(() => {
  if (!isWinterFeedbackVisible.value) return "";

  return visibleWinterMeasureFeedback.value?.text ?? "";
});
const periodLabel = computed(() => {
  const scene = activeScene.value;

  return scene?.periodLabel
    ? translate(
        scene.periodLabelKey,
        scene.periodLabel,
        scene.periodLabelParams,
      )
    : t("story.acts.act5.periodPlaceholder");
});
const periodContext = computed(() => {
  const scene = activeScene.value;

  return scene?.periodContext
    ? translate(
        scene.periodContextKey,
        scene.periodContext,
        scene.periodContextParams,
      )
    : t("story.acts.act5.contextPlaceholder");
});
const mirrorLandmarksHorizontally = <T extends { x: number }>(
  landmarks: T[] | null | undefined,
): T[] | null =>
  landmarks?.map((landmark) => ({
    ...landmark,
    x: 1 - landmark.x,
  })) ?? null;

const shouldMirrorAutumnInstructor = computed(
  () =>
    currentSeason.value.id === "autumn" &&
    repetitionIndex.value !== null &&
    repetitionIndex.value >= 2,
);

const instructorLandmarks = computed(() => {
  if (!showInstructorAvatar.value) return null;

  const landmarks = instructorFrame.value?.landmarks ?? null;

  return shouldMirrorAutumnInstructor.value
    ? mirrorLandmarksHorizontally(landmarks)
    : landmarks;
});
const playbackToggleLabel = computed(() =>
  playbackState.value === "playing" || playbackState.value === "countdown"
    ? t("story.acts.act5.controls.pause")
    : t("story.acts.act5.controls.play"),
);
const instructionCueText = computed(() => {
  if (summerSequencePhase.value === "intro") {
    return getSummerCueText(
      summerSequenceIntroStep.value === 0
        ? t("story.acts.act5.sequence.summerIntroWarming")
        : t("story.acts.act5.sequence.summerIntroLarger"),
    );
  }
  if (autumnSequencePhase.value === "intro") {
    return getAutumnCueText(
      autumnSequenceIntroStep.value === 0
        ? t("story.acts.act5.sequence.autumnIntroSweep")
        : t("story.acts.act5.sequence.autumnIntroSmaller"),
    );
  }
  if (springSequencePhase.value === "intro") {
    return getSpringCueText(
      springSequenceIntroStep.value === 0
        ? t("story.acts.act5.sequence.springIntroBloom")
        : t("story.acts.act5.sequence.springIntroValues"),
    );
  }
  if (winterSequencePhase.value === "intro") {
    return getWinterCueText(
      winterSequenceIntroStep.value === 0
        ? t("story.acts.act5.sequence.winterIntroCold")
        : t("story.acts.act5.sequence.winterIntroContract"),
    );
  }
  if (isSummerFeedbackInterlude.value) {
    return summerFeedbackInterludeBeat.value >= 4
      ? getSummerCueText(t("story.acts.act5.sequence.summerRetryNext"))
      : summerFeedbackInterludeText.value;
  }
  if (isAutumnFeedbackInterlude.value) {
    return autumnFeedbackInterludeBeat.value >= 4
      ? getAutumnCueText(t("story.acts.act5.sequence.autumnNextStart"))
      : autumnFeedbackInterludeText.value;
  }
  if (isSpringFeedbackInterlude.value) {
    return springFeedbackInterludeBeat.value >= 4
      ? getSpringCueText(t("story.acts.act5.sequence.springRetryNext"))
      : springFeedbackInterludeText.value;
  }
  if (isWinterFeedbackInterlude.value) {
    return winterFeedbackInterludeBeat.value >= 4
      ? getWinterCueText(t("story.acts.act5.sequence.winterRetryNext"))
      : winterFeedbackInterludeText.value;
  }
  if (summerSequencePhase.value === "completed") {
    return t("story.acts.act5.sequence.summerCompleted");
  }
  if (autumnSequencePhase.value === "completed") {
    return t("story.acts.act5.sequence.autumnCompleted");
  }
  if (springSequencePhase.value === "completed") {
    return t("story.acts.act5.sequence.springCompleted");
  }
  if (winterSequencePhase.value === "completed") {
    return t("story.acts.act5.sequence.winterCompleted");
  }
  if (isCompleted.value) return t("story.acts.act5.instructions.completed");
  if (isCountingDown.value) {
    return t("story.acts.act5.instructions.countdown", {
      count: countdownRemaining.value,
    });
  }
  if (isSummerActive.value && summerFeedbackText.value) {
    return summerFeedbackText.value;
  }
  if (isSummerActive.value) {
    return getSummerBeatInstruction(summerDebug.value.currentBeat);
  }
  if (isAutumnActive.value && autumnFeedbackText.value) {
    return autumnFeedbackText.value;
  }
  if (isAutumnActive.value) {
    return getAutumnBeatInstruction(autumnDebug.value.currentBeat);
  }
  if (isSpringActive.value && springFeedbackText.value) {
    return springFeedbackText.value;
  }
  if (isSpringActive.value) {
    return getSpringBeatInstruction(springDebug.value.currentBeat);
  }
  if (isWinterActive.value && winterFeedbackText.value) {
    return winterFeedbackText.value;
  }
  if (isWinterActive.value) {
    return getWinterBeatInstruction(winterDebug.value.currentBeat);
  }

  if (isTransition.value) return t("story.acts.act5.instructions.transition");
  if (playbackState.value === "idle") {
    return t("story.acts.act5.instructions.ready");
  }
  if (playbackState.value === "paused") {
    return t("story.acts.act5.instructions.paused");
  }

  return t("story.acts.act5.instructions.repeat");
});
const instructionCueTone = computed(() => {
  if (
    isSummerFeedbackInterlude.value ||
    isAutumnFeedbackInterlude.value ||
    isSpringFeedbackInterlude.value ||
    isWinterFeedbackInterlude.value
  ) {
    return "error";
  }
  if (
    summerSequencePhase.value === "completed" ||
    autumnSequencePhase.value === "completed" ||
    springSequencePhase.value === "completed" ||
    winterSequencePhase.value === "completed"
  ) {
    return "success";
  }
  if (isAutumnActive.value && autumnFeedbackText.value) {
    return visibleAutumnMeasureFeedback.value?.tone ?? "error";
  }
  if (isSummerActive.value && summerFeedbackText.value) {
    return visibleSummerMeasureFeedback.value?.tone ?? "error";
  }
  if (isSpringActive.value && springFeedbackText.value) {
    return visibleSpringMeasureFeedback.value?.tone ?? "error";
  }
  if (isWinterActive.value && winterFeedbackText.value) {
    return visibleWinterMeasureFeedback.value?.tone ?? "error";
  }
  return "instruction";
});
const repetitionLabel = computed(() =>
  repetitionIndex.value === null
    ? t("story.acts.act5.status.transition")
    : t("story.acts.act5.status.repetitionCount", {
        current: repetitionIndex.value + 1,
        total: act5IntroCycleConfig.repetitionCount,
      }),
);
const timeLabel = computed(
  () =>
    `${(elapsedMs.value / 1000).toFixed(1)} / ${(totalDurationMs.value / 1000).toFixed(0)} s`,
);
const debugRepetitionLabel = computed(() =>
  repetitionIndex.value === null
    ? "transition"
    : String(repetitionIndex.value + 1),
);
const debugCycleResultsLabel = computed(() => {
  const results = Array.from({
    length: act5IntroCycleConfig.repetitionCount,
  }).map(
    (_, index) =>
      summerRecognition.cycleEvaluations.value.find(
        (evaluation) => evaluation.cycleIndex === index,
      )?.result ?? "pending",
  );

  return results.join(" | ");
});
const debugAutumnCycleResultsLabel = computed(() => {
  const results = Array.from({
    length: act5IntroCycleConfig.repetitionCount,
  }).map(
    (_, index) =>
      autumnRecognition.cycleEvaluations.value.find(
        (evaluation) => evaluation.cycleIndex === index,
      )?.result ?? "pending",
  );

  return results.join(" | ");
});
const debugSpringCycleResultsLabel = computed(() => {
  const results = Array.from({
    length: act5IntroCycleConfig.repetitionCount,
  }).map(
    (_, index) =>
      springRecognition.cycleEvaluations.value.find(
        (evaluation) => evaluation.cycleIndex === index,
      )?.result ?? "pending",
  );

  return results.join(" | ");
});
const debugWinterCycleResultsLabel = computed(() => {
  const results = Array.from({
    length: act5IntroCycleConfig.repetitionCount,
  }).map(
    (_, index) =>
      winterRecognition.cycleEvaluations.value.find(
        (evaluation) => evaluation.cycleIndex === index,
      )?.result ?? "pending",
  );

  return results.join(" | ");
});
const debugSummerDecisionLabel = computed(() => {
  const sequenceEvaluation = summerRecognition.sequenceEvaluation.value;

  if (!sequenceEvaluation) return "pending";

  return sequenceEvaluation.passed ? "continue" : "repeat";
});
const getDebugCriteriaIds = (criteria: Array<{ id: string }>) =>
  criteria.map((criterion) => criterion.id);

const getDebugCycleResults = () =>
  Array.from({ length: act5IntroCycleConfig.repetitionCount }).map(
    (_, index) =>
      summerRecognition.cycleEvaluations.value.find(
        (evaluation) => evaluation.cycleIndex === index,
      )?.result ?? "pending",
  );

const getDebugAutumnCycleResults = () =>
  Array.from({ length: act5IntroCycleConfig.repetitionCount }).map(
    (_, index) =>
      autumnRecognition.cycleEvaluations.value.find(
        (evaluation) => evaluation.cycleIndex === index,
      )?.result ?? "pending",
  );

const getDebugSpringCycleResults = () =>
  Array.from({ length: act5IntroCycleConfig.repetitionCount }).map(
    (_, index) =>
      springRecognition.cycleEvaluations.value.find(
        (evaluation) => evaluation.cycleIndex === index,
      )?.result ?? "pending",
  );

const getDebugWinterCycleResults = () =>
  Array.from({ length: act5IntroCycleConfig.repetitionCount }).map(
    (_, index) =>
      winterRecognition.cycleEvaluations.value.find(
        (evaluation) => evaluation.cycleIndex === index,
      )?.result ?? "pending",
  );

const logSummerDebugSnapshot = () => {
  if (!isDebugMode.value || currentSeason.value.id !== "summer") return;

  const snapshot = summerRecognition.debugSnapshot.value;

  console.info("[Act 5 Summer Recognition]", {
    "essential:missing": getDebugCriteriaIds(snapshot.essentialFailed),
    "essential:ok": getDebugCriteriaIds(snapshot.essentialPassed),
    cycle_results: getDebugCycleResults(),
    expected_intensity: snapshot.expectedIntensity,
    detected_intensity: snapshot.detectedIntensityClass,
    movement_shape_passed: snapshot.movementShapePassed,
    intensity_matched: snapshot.intensityMatched,
    step_amplitude: snapshot.metrics.stepAmplitude,
    hand_raise_amplitude: snapshot.metrics.handRaiseAmplitude,
    average_elbow_angle: snapshot.metrics.averageElbowAngle,
    normalized_arm_opening: snapshot.metrics.normalizedArmOpening,
    primary_feedback: snapshot.feedbackCode,
  });
};

const logAutumnDebugSnapshot = () => {
  if (!isDebugMode.value || currentSeason.value.id !== "autumn") return;

  const snapshot = autumnDebug.value;

  console.info("[Act 5 Autumn Recognition]", {
    "essential:missing": getDebugCriteriaIds(snapshot.essentialFailed),
    "essential:ok": getDebugCriteriaIds(snapshot.essentialPassed),
    cycle_results: getDebugAutumnCycleResults(),
    beat: snapshot.currentBeat,
    expected_value_class: snapshot.expectedValueClass,
    detected_value_class: snapshot.detectedValueClass,
    expected_direction: snapshot.expectedDirection,
    expected_start_side: snapshot.metrics.expectedStartSide,
    detected_start_side: snapshot.metrics.detectedStartSide,
    start_side_passed: snapshot.metrics.startSidePassed,
    direction_locked: snapshot.metrics.directionLocked,
    direction_result: snapshot.metrics.directionResult,
    direction_failure_reason: snapshot.metrics.directionFailureReason,
    camera_mirrored: true,
    coordinate_source: "2D",
    beat1_hand_center_x: snapshot.metrics.beat1HandCenterXOffset,
    beat1_outer_wrist_x: snapshot.metrics.beat1OuterWristXOffset,
    current_hand_center_x: snapshot.metrics.handCenterXOffset,
    signed_progress_from_beat1: snapshot.metrics.signedProgressFromBeat1,
    normalized_progress: snapshot.metrics.normalizedProgress,
    expected_range: [
      snapshot.metrics.expectedProgressMin,
      snapshot.metrics.expectedProgressMax,
    ],
    expected_progress_range: [
      snapshot.metrics.expectedProgressMin,
      snapshot.metrics.expectedProgressMax,
    ],
    expected_endpoint_region: autumnExpectedEndpointRegion.value,
    detected_endpoint_region: snapshot.metrics.detectedEndpointRegion,
    endpoint_spatial_result: snapshot.metrics.endpointErrorKind,
    current_measure_index: repetitionIndex.value,
    visible_feedback_measure_index:
      visibleAutumnMeasureFeedback.value?.measureIndex ?? null,
    hand_travel_progress: snapshot.metrics.handTravelProgress,
    hand_center_x: snapshot.metrics.handCenterXOffset,
    hand_center_y: snapshot.metrics.handCenterYFromShoulders,
    hand_radius: snapshot.metrics.handRadiusFromTorso,
    outer_wrist_x: snapshot.metrics.outerWristXOffset,
    outer_wrist_progress_to_center: snapshot.metrics.outerWristProgressToCenter,
    outer_wrist_relative_to_shoulder:
      snapshot.metrics.outerWristRelativeToOuterShoulder,
    feedback_code: snapshot.feedbackCode,
    primary_feedback: snapshot.feedbackCode,
  });
};

const logSpringDebugSnapshot = () => {
  if (!isDebugMode.value || currentSeason.value.id !== "spring") return;

  const snapshot = springDebug.value;
  const metrics = snapshot.metrics as SpringRecognitionMetrics;

  console.info("[Act 5 Spring Recognition]", {
    "essential:missing": getDebugCriteriaIds(snapshot.essentialFailed),
    "essential:ok": getDebugCriteriaIds(snapshot.essentialPassed),
    cycle_results: getDebugSpringCycleResults(),
    beat: snapshot.currentBeat,
    expected_value: snapshot.expectedValue,
    expected_max_beat: springExpectedMaxBeat.value,
    expected_knee: snapshot.expectedKneeSide,
    detected_knee: snapshot.detectedKneeSide,
    detected_hand_height_region: snapshot.detectedHandHeightRegion,
    expected_hand_height_range: [
      metrics.expectedHandHeightMin,
      metrics.expectedHandHeightMax,
    ],
    average_hand_height: metrics.averageHandHeight,
    lower_hand_height: metrics.lowerHandHeight,
    left_hand_height: metrics.leftHandHeight,
    right_hand_height: metrics.rightHandHeight,
    hand_height_difference: metrics.handHeightDifference,
    hand_opening_width: metrics.handOpeningWidth,
    left_wrist_outside_shoulder: metrics.leftWristOutsideShoulder,
    right_wrist_outside_shoulder: metrics.rightWristOutsideShoulder,
    average_elbow_angle: metrics.averageElbowAngle,
    hands_gathered: metrics.handsGathered,
    hands_open: metrics.handsOpen,
    opening_impulse: metrics.openingImpulse,
    current_measure_index: repetitionIndex.value,
    visible_feedback_measure_index:
      visibleSpringMeasureFeedback.value?.measureIndex ?? null,
    feedback_code: snapshot.feedbackCode,
    primary_feedback: snapshot.feedbackCode,
  });
};

const logWinterDebugSnapshot = () => {
  if (!isDebugMode.value || currentSeason.value.id !== "winter") return;

  const snapshot = winterDebug.value;
  const metrics = snapshot.metrics as WinterRecognitionMetrics;

  console.info("[Act 5 Winter Recognition]", {
    "essential:missing": getDebugCriteriaIds(snapshot.essentialFailed),
    "essential:ok": getDebugCriteriaIds(snapshot.essentialPassed),
    cycle_results: getDebugWinterCycleResults(),
    beat: snapshot.currentBeat,
    expected_value: snapshot.expectedValue,
    expected_contraction_class: snapshot.expectedContractionClass,
    detected_contraction_class: snapshot.detectedContractionClass,
    compactness_score: metrics.compactnessScore,
    head_y: metrics.headY,
    neutral_head_y: metrics.neutralHeadY,
    head_drop: metrics.headDrop,
    shoulder_drop: metrics.shoulderDrop,
    hip_drop: metrics.hipDrop,
    body_height_ratio: metrics.bodyHeightRatio,
    average_knee_angle: metrics.averageKneeAngle,
    torso_forward_lean: metrics.torsoForwardLean,
    hand_opening_width: metrics.handOpeningWidth,
    hands_at_shoulder_height: metrics.handsAtShoulderHeight,
    arms_open_sideways: metrics.armsOpenSideways,
    self_hug_detected: metrics.selfHugDetected,
    hands_centered_for_hug: metrics.handsCenteredForHug,
    hands_compact_for_hug: metrics.handsCompactForHug,
    hands_near_opposite_shoulders: metrics.handsNearOppositeShoulders,
    head_protection_expected: metrics.headProtectionExpected,
    head_protection_detected: metrics.headProtectionDetected,
    return_to_upright: metrics.returnToUprightDetected,
    arms_released: metrics.armsReleased,
    feet_stable: metrics.feetStable,
    neutral_reference_samples: snapshot.neutralReference?.sampleCount ?? 0,
    current_measure_index: repetitionIndex.value,
    visible_feedback_measure_index:
      visibleWinterMeasureFeedback.value?.measureIndex ?? null,
    feedback_code: snapshot.feedbackCode,
    primary_feedback: snapshot.feedbackCode,
  });
};

const clearSummerSequenceTimers = () => {
  summerSequenceIntroTimers.forEach((timer) => clearTimeout(timer));
  summerSequenceIntroTimers = [];

  if (summerFeedbackInterludeTimer) {
    clearInterval(summerFeedbackInterludeTimer);
    summerFeedbackInterludeTimer = null;
  }
};

const clearAutumnSequenceTimers = () => {
  autumnSequenceIntroTimers.forEach((timer) => clearTimeout(timer));
  autumnSequenceIntroTimers = [];

  if (autumnFeedbackInterludeTimer) {
    clearInterval(autumnFeedbackInterludeTimer);
    autumnFeedbackInterludeTimer = null;
  }
};

const clearSpringSequenceTimers = () => {
  springSequenceIntroTimers.forEach((timer) => clearTimeout(timer));
  springSequenceIntroTimers = [];

  if (springFeedbackInterludeTimer) {
    clearInterval(springFeedbackInterludeTimer);
    springFeedbackInterludeTimer = null;
  }
};

const clearWinterSequenceTimers = () => {
  winterSequenceIntroTimers.forEach((timer) => clearTimeout(timer));
  winterSequenceIntroTimers = [];

  if (winterFeedbackInterludeTimer) {
    clearInterval(winterFeedbackInterludeTimer);
    winterFeedbackInterludeTimer = null;
  }
};

const resetSummerSequenceState = () => {
  clearSummerSequenceTimers();
  clearVisibleSummerMeasureFeedback();
  summerSequencePhase.value = "idle";
  currentSummerIntensityIndex.value = 0;
  completedSummerIntensities.value = [];
  isSummerFeedbackInterlude.value = false;
  summerFeedbackInterludeBeat.value = 1;
  summerFeedbackInterludeText.value = "";
  summerSequenceIntroStep.value = 0;
  sequenceEvaluationHandledKey.value = "";
};

const resetAutumnSequenceState = () => {
  clearAutumnSequenceTimers();
  clearVisibleAutumnMeasureFeedback();
  autumnSequencePhase.value = "idle";
  currentAutumnValueIndex.value = 0;
  completedAutumnValues.value = [];
  isAutumnFeedbackInterlude.value = false;
  autumnFeedbackInterludeBeat.value = 1;
  autumnFeedbackInterludeText.value = "";
  autumnSequenceIntroStep.value = 0;
  autumnSequenceEvaluationHandledKey.value = "";
};

const resetSpringSequenceState = () => {
  clearSpringSequenceTimers();
  clearVisibleSpringMeasureFeedback();
  springSequencePhase.value = "idle";
  currentSpringValueIndex.value = 0;
  completedSpringValues.value = [];
  isSpringFeedbackInterlude.value = false;
  springFeedbackInterludeBeat.value = 1;
  springFeedbackInterludeText.value = "";
  springSequenceIntroStep.value = 0;
  springSequenceEvaluationHandledKey.value = "";
};

const resetWinterSequenceState = () => {
  clearWinterSequenceTimers();
  clearVisibleWinterMeasureFeedback();
  winterSequencePhase.value = "idle";
  currentWinterValueIndex.value = 0;
  completedWinterValues.value = [];
  isWinterFeedbackInterlude.value = false;
  winterFeedbackInterludeBeat.value = 1;
  winterFeedbackInterludeText.value = "";
  winterSequenceIntroStep.value = 0;
  winterSequenceEvaluationHandledKey.value = "";
};

const getInterludeFeedbackText = () => {
  const cycleEvaluations = summerRecognition.cycleEvaluations.value;

  if (
    cycleEvaluations.some((cycleEvaluation) =>
      cycleEvaluation.beatEvaluations.some(
        (beatEvaluation) => beatEvaluation.trackingUnavailable,
      ),
    )
  ) {
    return t("story.acts.act5.summerFeedback.FULL_BODY_NOT_VISIBLE");
  }

  const feedbackCounts = new Map<SummerFeedbackCode, number>();

  cycleEvaluations.forEach((cycleEvaluation) => {
    const feedbackCode = cycleEvaluation.primaryFeedbackCode;

    if (!feedbackCode || feedbackCode === "SUCCESS") return;

    feedbackCounts.set(
      feedbackCode,
      (feedbackCounts.get(feedbackCode) ?? 0) + 1,
    );
  });

  const mostFrequentFeedback = [...feedbackCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

  if (mostFrequentFeedback) {
    return t(`story.acts.act5.summerFeedback.${mostFrequentFeedback}`);
  }

  return currentSummerIntensity.value === "100"
    ? t("story.acts.act5.sequence.summerInterludeDefault100")
    : t("story.acts.act5.sequence.summerInterludeDefaultScaled");
};

const getAutumnInterludeFeedbackText = () => {
  const cycleEvaluations = autumnRecognition.cycleEvaluations.value;

  if (
    cycleEvaluations.some((cycleEvaluation) =>
      cycleEvaluation.beatEvaluations.some(
        (beatEvaluation) => beatEvaluation.trackingUnavailable,
      ),
    )
  ) {
    return getAutumnFeedbackCueText("FULL_BODY_NOT_VISIBLE");
  }

  const feedbackCounts = new Map<AutumnFeedbackCode, number>();

  cycleEvaluations.forEach((cycleEvaluation) => {
    const feedbackCode = cycleEvaluation.primaryFeedbackCode;

    if (!feedbackCode || feedbackCode === "SUCCESS") return;

    feedbackCounts.set(
      feedbackCode,
      (feedbackCounts.get(feedbackCode) ?? 0) + 1,
    );
  });

  const mostFrequentFeedback = [...feedbackCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

  if (
    mostFrequentFeedback === "START_LEFT" ||
    mostFrequentFeedback === "START_RIGHT" ||
    mostFrequentFeedback === "START_ON_LEFT" ||
    mostFrequentFeedback === "START_ON_RIGHT"
  ) {
    return t("story.acts.act5.autumnFeedback.directionPattern");
  }

  return mostFrequentFeedback
    ? getAutumnFeedbackCueText(mostFrequentFeedback)
    : getAutumnFeedbackCueText("TRY_AGAIN");
};

const getSpringInterludeFeedbackText = () => {
  const cycleEvaluations = springRecognition.cycleEvaluations.value;

  if (
    cycleEvaluations.some((cycleEvaluation) =>
      cycleEvaluation.beatEvaluations.some(
        (beatEvaluation) => beatEvaluation.trackingUnavailable,
      ),
    )
  ) {
    return getSpringFeedbackCueText("FULL_BODY_NOT_VISIBLE");
  }

  const feedbackCounts = new Map<SpringFeedbackCode, number>();

  cycleEvaluations.forEach((cycleEvaluation) => {
    const feedbackCode = cycleEvaluation.primaryFeedbackCode;

    if (!feedbackCode || feedbackCode === "SUCCESS") return;

    feedbackCounts.set(
      feedbackCode,
      (feedbackCounts.get(feedbackCode) ?? 0) + 1,
    );
  });

  const mostFrequentFeedback = [...feedbackCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

  return mostFrequentFeedback
    ? getSpringFeedbackCueText(mostFrequentFeedback)
    : t("story.acts.act5.sequence.springInterludeDefault");
};

const getWinterInterludeFeedbackText = () => {
  const cycleEvaluations = winterRecognition.cycleEvaluations.value;

  if (
    cycleEvaluations.some((cycleEvaluation) =>
      cycleEvaluation.beatEvaluations.some(
        (beatEvaluation) => beatEvaluation.trackingUnavailable,
      ),
    )
  ) {
    return getWinterFeedbackCueText("FULL_BODY_NOT_VISIBLE");
  }

  const feedbackCounts = new Map<WinterFeedbackCode, number>();

  cycleEvaluations.forEach((cycleEvaluation) => {
    const feedbackCode = cycleEvaluation.primaryFeedbackCode;

    if (!feedbackCode || feedbackCode === "SUCCESS") return;

    feedbackCounts.set(
      feedbackCode,
      (feedbackCounts.get(feedbackCode) ?? 0) + 1,
    );
  });

  const mostFrequentFeedback = [...feedbackCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

  return mostFrequentFeedback
    ? getWinterFeedbackCueText(mostFrequentFeedback)
    : t("story.acts.act5.sequence.winterInterludeDefault");
};

const startFeedbackInterlude = (feedbackText: string) => {
  if (summerFeedbackInterludeTimer) {
    clearInterval(summerFeedbackInterludeTimer);
  }

  isSummerFeedbackInterlude.value = true;
  summerSequencePhase.value = "feedbackInterlude";
  summerFeedbackInterludeText.value = feedbackText;
  summerFeedbackInterludeBeat.value = 1;

  const startedAt = performance.now();

  summerFeedbackInterludeTimer = setInterval(() => {
    summerFeedbackInterludeBeat.value = Math.min(
      Math.floor((performance.now() - startedAt) / 1000) + 1,
      4,
    );
  }, 80);
};

const stopFeedbackInterlude = () => {
  if (summerFeedbackInterludeTimer) {
    clearInterval(summerFeedbackInterludeTimer);
    summerFeedbackInterludeTimer = null;
  }

  isSummerFeedbackInterlude.value = false;
  summerFeedbackInterludeBeat.value = 1;
  summerFeedbackInterludeText.value = "";
};

const startAutumnFeedbackInterlude = (feedbackText: string) => {
  if (autumnFeedbackInterludeTimer) {
    clearInterval(autumnFeedbackInterludeTimer);
  }

  isAutumnFeedbackInterlude.value = true;
  autumnSequencePhase.value = "feedbackInterlude";
  autumnFeedbackInterludeText.value = feedbackText;
  autumnFeedbackInterludeBeat.value = 1;

  const startedAt = performance.now();

  autumnFeedbackInterludeTimer = setInterval(() => {
    autumnFeedbackInterludeBeat.value = Math.min(
      Math.floor((performance.now() - startedAt) / 1000) + 1,
      4,
    );
  }, 80);
};

const stopAutumnFeedbackInterlude = () => {
  if (autumnFeedbackInterludeTimer) {
    clearInterval(autumnFeedbackInterludeTimer);
    autumnFeedbackInterludeTimer = null;
  }

  isAutumnFeedbackInterlude.value = false;
  autumnFeedbackInterludeBeat.value = 1;
};

const startSpringFeedbackInterlude = (feedbackText: string) => {
  if (springFeedbackInterludeTimer) {
    clearInterval(springFeedbackInterludeTimer);
  }

  isSpringFeedbackInterlude.value = true;
  springSequencePhase.value = "feedbackInterlude";
  springFeedbackInterludeText.value = feedbackText;
  springFeedbackInterludeBeat.value = 1;

  const startedAt = performance.now();

  springFeedbackInterludeTimer = setInterval(() => {
    springFeedbackInterludeBeat.value = Math.min(
      Math.floor((performance.now() - startedAt) / 1000) + 1,
      4,
    );
  }, 80);
};

const stopSpringFeedbackInterlude = () => {
  if (springFeedbackInterludeTimer) {
    clearInterval(springFeedbackInterludeTimer);
    springFeedbackInterludeTimer = null;
  }

  isSpringFeedbackInterlude.value = false;
  springFeedbackInterludeBeat.value = 1;
  springFeedbackInterludeText.value = "";
};

const startWinterFeedbackInterlude = (feedbackText: string) => {
  if (winterFeedbackInterludeTimer) {
    clearInterval(winterFeedbackInterludeTimer);
  }

  isWinterFeedbackInterlude.value = true;
  winterSequencePhase.value = "feedbackInterlude";
  winterFeedbackInterludeText.value = feedbackText;
  winterFeedbackInterludeBeat.value = 1;

  const startedAt = performance.now();

  winterFeedbackInterludeTimer = setInterval(() => {
    winterFeedbackInterludeBeat.value = Math.min(
      Math.floor((performance.now() - startedAt) / 1000) + 1,
      4,
    );
  }, 80);
};

const stopWinterFeedbackInterlude = () => {
  if (winterFeedbackInterludeTimer) {
    clearInterval(winterFeedbackInterludeTimer);
    winterFeedbackInterludeTimer = null;
  }

  isWinterFeedbackInterlude.value = false;
  winterFeedbackInterludeBeat.value = 1;
  winterFeedbackInterludeText.value = "";
};

const startCurrentSummerIntensityRecognition = ({
  manual = false,
  keepCalibration = true,
}: {
  manual?: boolean;
  keepCalibration?: boolean;
} = {}) => {
  stopFeedbackInterlude();
  clearVisibleSummerMeasureFeedback();
  sequenceEvaluationHandledKey.value = "";
  summerRecognition.start({
    manual,
    keepCalibration,
    intensity: currentSummerIntensity.value,
  });
  summerSequencePhase.value = "performing";
};

const startCurrentAutumnValueRecognition = () => {
  stopAutumnFeedbackInterlude();
  clearVisibleAutumnMeasureFeedback();
  autumnSequenceEvaluationHandledKey.value = "";
  autumnRecognition.start({ valueClass: currentAutumnValue.value });
  autumnSequencePhase.value = "performing";
};

const startCurrentSpringValueRecognition = () => {
  stopSpringFeedbackInterlude();
  clearVisibleSpringMeasureFeedback();
  springSequenceEvaluationHandledKey.value = "";
  springRecognition.start({ value: currentSpringValue.value });
  springSequencePhase.value = "performing";
};

const startCurrentWinterValueRecognition = () => {
  stopWinterFeedbackInterlude();
  clearVisibleWinterMeasureFeedback();
  winterSequenceEvaluationHandledKey.value = "";
  winterRecognition.start({ value: currentWinterValue.value });
  winterSequencePhase.value = "performing";
};

const markCurrentIntensityComplete = () => {
  if (completedSummerIntensities.value.includes(currentSummerIntensity.value)) {
    return;
  }

  completedSummerIntensities.value = [
    ...completedSummerIntensities.value,
    currentSummerIntensity.value,
  ];
};

const markCurrentAutumnValueComplete = () => {
  if (completedAutumnValues.value.includes(currentAutumnValue.value)) {
    return;
  }

  completedAutumnValues.value = [
    ...completedAutumnValues.value,
    currentAutumnValue.value,
  ];
};

const markCurrentSpringValueComplete = () => {
  if (completedSpringValues.value.includes(currentSpringValue.value)) {
    return;
  }

  completedSpringValues.value = [
    ...completedSpringValues.value,
    currentSpringValue.value,
  ];
};

const markCurrentWinterValueComplete = () => {
  if (completedWinterValues.value.includes(currentWinterValue.value)) {
    return;
  }

  completedWinterValues.value = [
    ...completedWinterValues.value,
    currentWinterValue.value,
  ];
};

const handleSummerSequenceEvaluation = () => {
  const evaluation = summerRecognition.sequenceEvaluation.value;

  if (!evaluation || summerTestMode.value !== "intensitySequence") return;

  const handledKey = `${currentSummerIntensity.value}-${summerRecognition.retryCount.value}-${evaluation.resultState}`;

  if (sequenceEvaluationHandledKey.value === handledKey) return;

  sequenceEvaluationHandledKey.value = handledKey;

  if (evaluation.passed) {
    markCurrentIntensityComplete();

    if (!nextSummerIntensity.value) {
      summerSequencePhase.value = "completed";
      return;
    }

    summerSequencePhase.value = "transitioningToNextIntensity";
    queueSeasonRestart("summer", false, () => {
      currentSummerIntensityIndex.value += 1;
      startCurrentSummerIntensityRecognition({ keepCalibration: true });
    });
    return;
  }

  summerSequencePhase.value = "evaluatingIntensity";
  const interludeFeedbackText = getInterludeFeedbackText();

  queueSeasonRestart(
    "summer",
    false,
    () => {
      summerRecognition.markRetryConsumed();
      startCurrentSummerIntensityRecognition({ keepCalibration: true });
    },
    {
      interludeDurationMs: summerSequenceFlow.feedbackInterludeDurationMs,
      onInterludeStart: () => {
        startFeedbackInterlude(interludeFeedbackText);
      },
    },
  );
};

const handleAutumnSequenceEvaluation = () => {
  const evaluation = autumnRecognition.sequenceEvaluation.value;

  if (!evaluation || autumnTestMode.value !== "valueSequence") return;

  const handledKey = `${currentAutumnValue.value}-${evaluation.resultState}-${evaluation.totalScore.toFixed(1)}`;

  if (autumnSequenceEvaluationHandledKey.value === handledKey) return;

  autumnSequenceEvaluationHandledKey.value = handledKey;

  if (evaluation.passed) {
    markCurrentAutumnValueComplete();

    if (!nextAutumnValue.value) {
      autumnSequencePhase.value = "completed";
      return;
    }

    autumnSequencePhase.value = "transitioningToNextIntensity";
    queueSeasonRestart("autumn", false, () => {
      currentAutumnValueIndex.value += 1;
      startCurrentAutumnValueRecognition();
    });
    return;
  }

  autumnSequencePhase.value = "evaluatingIntensity";
  const interludeFeedbackText = getAutumnInterludeFeedbackText();

  queueSeasonRestart(
    "autumn",
    false,
    () => {
      startCurrentAutumnValueRecognition();
    },
    {
      interludeDurationMs: autumnSequenceFlow.feedbackInterludeDurationMs,
      onInterludeStart: () => {
        startAutumnFeedbackInterlude(interludeFeedbackText);
      },
    },
  );
};

const handleSpringSequenceEvaluation = () => {
  const evaluation = springRecognition.sequenceEvaluation.value;

  if (!evaluation || springTestMode.value !== "valueSequence") return;

  const handledKey = `${currentSpringValue.value}-${evaluation.resultState}-${evaluation.totalScore.toFixed(1)}`;

  if (springSequenceEvaluationHandledKey.value === handledKey) return;

  springSequenceEvaluationHandledKey.value = handledKey;

  if (evaluation.passed) {
    markCurrentSpringValueComplete();

    if (!nextSpringValue.value) {
      springSequencePhase.value = "completed";
      return;
    }

    springSequencePhase.value = "transitioningToNextIntensity";
    queueSeasonRestart("spring", false, () => {
      currentSpringValueIndex.value += 1;
      startCurrentSpringValueRecognition();
    });
    return;
  }

  springSequencePhase.value = "evaluatingIntensity";
  const interludeFeedbackText = getSpringInterludeFeedbackText();

  queueSeasonRestart(
    "spring",
    false,
    () => {
      startCurrentSpringValueRecognition();
    },
    {
      interludeDurationMs: springSequenceFlow.feedbackInterludeDurationMs,
      onInterludeStart: () => {
        startSpringFeedbackInterlude(interludeFeedbackText);
      },
    },
  );
};

const handleWinterSequenceEvaluation = () => {
  const evaluation = winterRecognition.sequenceEvaluation.value;

  if (!evaluation || winterTestMode.value !== "valueSequence") return;

  const handledKey = `${currentWinterValue.value}-${evaluation.resultState}-${evaluation.totalScore.toFixed(1)}`;

  if (winterSequenceEvaluationHandledKey.value === handledKey) return;

  winterSequenceEvaluationHandledKey.value = handledKey;

  if (evaluation.passed) {
    markCurrentWinterValueComplete();

    if (!nextWinterValue.value) {
      winterSequencePhase.value = "completed";
      return;
    }

    winterSequencePhase.value = "transitioningToNextIntensity";
    queueSeasonRestart("winter", false, () => {
      currentWinterValueIndex.value += 1;
      startCurrentWinterValueRecognition();
    });
    return;
  }

  winterSequencePhase.value = "evaluatingIntensity";
  const interludeFeedbackText = getWinterInterludeFeedbackText();

  queueSeasonRestart(
    "winter",
    false,
    () => {
      startCurrentWinterValueRecognition();
    },
    {
      interludeDurationMs: winterSequenceFlow.feedbackInterludeDurationMs,
      onInterludeStart: () => {
        startWinterFeedbackInterlude(interludeFeedbackText);
      },
    },
  );
};

const togglePlayback = async () => {
  if (
    playbackState.value === "playing" ||
    playbackState.value === "countdown"
  ) {
    pause();
    return;
  }

  await play();
};
const resetCycle = async () => {
  summerTestMode.value = "single100";
  autumnTestMode.value = "single100";
  springTestMode.value = "single100";
  winterTestMode.value = "single100";
  resetSummerSequenceState();
  resetAutumnSequenceState();
  resetSpringSequenceState();
  resetWinterSequenceState();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();
  await reset();
};

const startDebugSeason = async (seasonId: SeasonalCycleSeasonId) => {
  summerTestMode.value = "single100";
  autumnTestMode.value = "single100";
  springTestMode.value = "single100";
  winterTestMode.value = "single100";
  resetSummerSequenceState();
  resetAutumnSequenceState();
  resetSpringSequenceState();
  resetWinterSequenceState();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();

  if (seasonId === "summer") {
    summerRecognition.start({ manual: true, intensity: "100" });
  }
  if (seasonId === "autumn") {
    autumnRecognition.start({ valueClass: "100" });
  }
  if (seasonId === "spring") {
    springRecognition.start({ value: "100" });
  }
  if (seasonId === "winter") {
    winterRecognition.start({ value: "100" });
  }

  await startSingleSeason(seasonId);
};

const startSummerSequence = async () => {
  summerTestMode.value = "intensitySequence";
  autumnTestMode.value = "single100";
  springTestMode.value = "single100";
  winterTestMode.value = "single100";
  resetSummerSequenceState();
  resetAutumnSequenceState();
  resetSpringSequenceState();
  resetWinterSequenceState();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();
  await reset();

  summerSequencePhase.value = "intro";
  summerSequenceIntroStep.value = 0;

  summerSequenceIntroTimers = [
    setTimeout(
      () => {
        summerSequenceIntroStep.value = 1;
      },
      Math.floor(sequenceIntroDurationMs / 2),
    ),
    setTimeout(() => {
      startCurrentSummerIntensityRecognition({
        manual: true,
        keepCalibration: false,
      });
      void startSingleSeason("summer");
    }, sequenceIntroDurationMs),
  ];
};

const startAutumnSequence = async () => {
  summerTestMode.value = "single100";
  autumnTestMode.value = "valueSequence";
  springTestMode.value = "single100";
  winterTestMode.value = "single100";
  resetSummerSequenceState();
  resetAutumnSequenceState();
  resetSpringSequenceState();
  resetWinterSequenceState();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();
  await reset();

  autumnSequencePhase.value = "intro";
  autumnSequenceIntroStep.value = 0;

  autumnSequenceIntroTimers = [
    setTimeout(
      () => {
        autumnSequenceIntroStep.value = 1;
      },
      Math.floor(sequenceIntroDurationMs / 2),
    ),
    setTimeout(() => {
      startCurrentAutumnValueRecognition();
      void startSingleSeason("autumn");
    }, sequenceIntroDurationMs),
  ];
};

const startSpringSequence = async () => {
  summerTestMode.value = "single100";
  autumnTestMode.value = "single100";
  springTestMode.value = "valueSequence";
  winterTestMode.value = "single100";
  resetSummerSequenceState();
  resetAutumnSequenceState();
  resetSpringSequenceState();
  resetWinterSequenceState();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();
  await reset();

  springSequencePhase.value = "intro";
  springSequenceIntroStep.value = 0;

  springSequenceIntroTimers = [
    setTimeout(
      () => {
        springSequenceIntroStep.value = 1;
      },
      Math.floor(sequenceIntroDurationMs / 2),
    ),
    setTimeout(() => {
      startCurrentSpringValueRecognition();
      void startSingleSeason("spring");
    }, sequenceIntroDurationMs),
  ];
};

const startWinterSequence = async () => {
  summerTestMode.value = "single100";
  autumnTestMode.value = "single100";
  springTestMode.value = "single100";
  winterTestMode.value = "valueSequence";
  resetSummerSequenceState();
  resetAutumnSequenceState();
  resetSpringSequenceState();
  resetWinterSequenceState();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();
  await reset();

  winterSequencePhase.value = "intro";
  winterSequenceIntroStep.value = 0;

  winterSequenceIntroTimers = [
    setTimeout(
      () => {
        winterSequenceIntroStep.value = 1;
      },
      Math.floor(sequenceIntroDurationMs / 2),
    ),
    setTimeout(() => {
      startCurrentWinterValueRecognition();
      void startSingleSeason("winter");
    }, sequenceIntroDurationMs),
  ];
};

const formatDebugValue = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }

  return Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(2);
};

const formatCriteria = (criteria: Array<{ id: string; label: string }>) => {
  if (!criteria.length) return "none";

  return criteria.map((criterion) => criterion.id).join(", ");
};

const continueToNextAct = async () => {
  const nextActId = runtimeStore.currentAct?.nextActId;

  storyEngine.continueFromGate();

  if (!nextActId) return;

  await navigateTo(`/story/${nextActId}`);
};

onMounted(() => {
  storyEngine.startAct(act.value.id);
  void initialize();
});

watch(
  [
    poseLandmarks,
    playbackState,
    () => currentSeason.value.id,
    seasonElapsedMs,
    repetitionIndex,
    isTransition,
    isSummerFeedbackInterlude,
    isAutumnFeedbackInterlude,
    isSpringFeedbackInterlude,
    isWinterFeedbackInterlude,
  ],
  () => {
    summerRecognition.updateFrame({
      landmarks: poseLandmarks.value,
      playbackState: playbackState.value,
      seasonId: isSummerFeedbackInterlude.value
        ? "summer-feedback-interlude"
        : currentSeason.value.id,
      seasonElapsedMs: seasonElapsedMs.value,
      repetitionIndex: repetitionIndex.value,
      isTransition: isTransition.value,
    });
    autumnRecognition.updateFrame({
      landmarks: mirrorLandmarksHorizontally(poseLandmarks.value),
      playbackState: playbackState.value,
      seasonId: isAutumnFeedbackInterlude.value
        ? "autumn-feedback-interlude"
        : currentSeason.value.id,
      seasonElapsedMs: seasonElapsedMs.value,
      repetitionIndex: repetitionIndex.value,
      isTransition: isTransition.value,
    });
    springRecognition.updateFrame({
      landmarks: poseLandmarks.value,
      playbackState: playbackState.value,
      seasonId: isSpringFeedbackInterlude.value
        ? "spring-feedback-interlude"
        : currentSeason.value.id,
      seasonElapsedMs: seasonElapsedMs.value,
      repetitionIndex: repetitionIndex.value,
      isTransition: isTransition.value,
    });
    winterRecognition.updateFrame({
      landmarks: poseLandmarks.value,
      playbackState: playbackState.value,
      seasonId: isWinterFeedbackInterlude.value
        ? "winter-feedback-interlude"
        : currentSeason.value.id,
      seasonElapsedMs: seasonElapsedMs.value,
      repetitionIndex: repetitionIndex.value,
      isTransition: isTransition.value,
    });
  },
  { immediate: true },
);

watch(
  () => summerRecognition.sequenceEvaluation.value,
  (evaluation) => {
    if (!evaluation) return;
    if (summerTestMode.value === "intensitySequence") {
      handleSummerSequenceEvaluation();
      return;
    }
    if (!summerRecognition.canRetryAutomatically.value) return;
    if (currentSeason.value.id !== "summer") return;

    queueSeasonRestart("summer", false, () => {
      clearVisibleSummerMeasureFeedback();
      summerRecognition.markRetryConsumed();
      summerRecognition.start({ keepCalibration: true });
    });
  },
);

watch(
  () => autumnRecognition.sequenceEvaluation.value,
  (evaluation) => {
    if (!evaluation) return;
    if (autumnTestMode.value === "valueSequence") {
      handleAutumnSequenceEvaluation();
    }
  },
);

watch(
  () => springRecognition.sequenceEvaluation.value,
  (evaluation) => {
    if (!evaluation) return;
    if (springTestMode.value === "valueSequence") {
      handleSpringSequenceEvaluation();
    }
  },
);

watch(
  () => winterRecognition.sequenceEvaluation.value,
  (evaluation) => {
    if (!evaluation) return;
    if (winterTestMode.value === "valueSequence") {
      handleWinterSequenceEvaluation();
    }
  },
);

watch(
  () => summerRecognition.currentCycleEvaluation.value,
  (cycleEvaluation) => {
    if (!cycleEvaluation) {
      clearVisibleSummerMeasureFeedback();
      return;
    }

    visibleSummerMeasureFeedback.value =
      getSummerMeasureFeedback(cycleEvaluation);
  },
);

watch(
  () => autumnRecognition.currentCycleEvaluation.value,
  (cycleEvaluation) => {
    if (!cycleEvaluation) {
      clearVisibleAutumnMeasureFeedback();
      return;
    }

    visibleAutumnMeasureFeedback.value =
      getAutumnMeasureFeedback(cycleEvaluation);
  },
);

watch(
  () => springRecognition.currentCycleEvaluation.value,
  (cycleEvaluation) => {
    if (!cycleEvaluation) {
      clearVisibleSpringMeasureFeedback();
      return;
    }

    visibleSpringMeasureFeedback.value =
      getSpringMeasureFeedback(cycleEvaluation);
  },
);

watch(
  () => winterRecognition.currentCycleEvaluation.value,
  (cycleEvaluation) => {
    if (!cycleEvaluation) {
      clearVisibleWinterMeasureFeedback();
      return;
    }

    visibleWinterMeasureFeedback.value =
      getWinterMeasureFeedback(cycleEvaluation);
  },
);

watch(
  [() => currentSeason.value.id, repetitionIndex],
  ([seasonId, currentMeasureIndex]) => {
    const summerFeedbackMeasureIndex =
      visibleSummerMeasureFeedback.value?.measureIndex ?? null;
    const feedbackMeasureIndex =
      visibleAutumnMeasureFeedback.value?.measureIndex ?? null;
    const springFeedbackMeasureIndex =
      visibleSpringMeasureFeedback.value?.measureIndex ?? null;
    const winterFeedbackMeasureIndex =
      visibleWinterMeasureFeedback.value?.measureIndex ?? null;

    if (
      seasonId !== "summer" ||
      summerFeedbackMeasureIndex === null ||
      summerFeedbackMeasureIndex !== currentMeasureIndex
    ) {
      clearVisibleSummerMeasureFeedback();
    }

    if (
      seasonId !== "autumn" ||
      feedbackMeasureIndex === null ||
      feedbackMeasureIndex !== currentMeasureIndex
    ) {
      clearVisibleAutumnMeasureFeedback();
    }

    if (
      seasonId !== "spring" ||
      springFeedbackMeasureIndex === null ||
      springFeedbackMeasureIndex !== currentMeasureIndex
    ) {
      clearVisibleSpringMeasureFeedback();
    }

    if (
      seasonId !== "winter" ||
      winterFeedbackMeasureIndex === null ||
      winterFeedbackMeasureIndex !== currentMeasureIndex
    ) {
      clearVisibleWinterMeasureFeedback();
    }
  },
);

watch(
  [
    () => summerRecognition.currentEvaluation.value,
    () => summerRecognition.cycleEvaluations.value,
    () => autumnRecognition.currentEvaluation.value,
    () => autumnRecognition.cycleEvaluations.value,
    () => springRecognition.currentEvaluation.value,
    () => springRecognition.cycleEvaluations.value,
    () => winterRecognition.currentEvaluation.value,
    () => winterRecognition.cycleEvaluations.value,
  ],
  () => {
    logSummerDebugSnapshot();
    logAutumnDebugSnapshot();
    logSpringDebugSnapshot();
    logWinterDebugSnapshot();
  },
);

onBeforeUnmount(() => {
  clearSummerSequenceTimers();
  clearAutumnSequenceTimers();
  clearSpringSequenceTimers();
  clearWinterSequenceTimers();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();
  cleanup();
  storyEngine.stopStoryEngine();
});
</script>

<style scoped>
.climate-act-page {
  --climate-act-bottom-bar-height: clamp(64px, 8dvh, 84px);
  --climate-act-comparison-size: 25vw;
  --climate-act-clock-size: clamp(300px, 32vw, 430px);

  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-columns: 50% 50%;
  overflow: hidden;
  background: #edf2ef;
}

.climate-act-context,
.climate-act-stage,
.climate-act-comparison,
.climate-act-avatar,
.climate-act-camera,
.climate-act-info,
.climate-act-bottom-bar {
  min-width: 0;
  min-height: 0;
}

.climate-act-context {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: clamp(28px, 5vw, 72px);
  padding-bottom: calc(var(--climate-act-bottom-bar-height) + 28px);
  padding-left: clamp(96px, 10vw, 132px);
  border-right: 1px solid rgba(36, 54, 42, 0.16);
  background:
    linear-gradient(
      180deg,
      rgba(252, 253, 248, 0.72),
      rgba(237, 242, 239, 0.94)
    ),
    #edf2ef;
  color: #26382f;
}

.climate-act-context__group {
  width: min(100%, 520px);
  display: grid;
  justify-items: center;
  gap: clamp(8px, 1.4dvh, 16px);
  text-align: center;
}

.climate-act-context__eyebrow,
.climate-act-context__optional {
  margin: 0;
  color: rgba(31, 49, 39, 0.58);
  font-size: clamp(0.72rem, 0.85vw, 0.9rem);
  font-weight: 800;
  text-transform: uppercase;
}

.climate-act-context h1 {
  max-width: 100%;
  margin: 0;
  overflow-wrap: anywhere;
  color: #17241c;
  font-size: clamp(2.35rem, 5vw, 5.25rem);
  line-height: 0.98;
}

.climate-act-context__season {
  margin: 0 0 clamp(4px, 0.8dvh, 10px);
  color: #26382f;
  font-size: clamp(1.2rem, 2vw, 2rem);
  font-weight: 750;
}

.climate-act-context :deep(.season-clock) {
  width: var(--climate-act-clock-size);
  max-width: min(
    100%,
    calc(100dvh - var(--climate-act-bottom-bar-height) - 260px)
  );
  gap: 8px;
  padding: clamp(10px, 1.4vw, 16px);
  background: rgba(250, 253, 248, 0.9);
  box-shadow: 0 12px 32px rgba(31, 49, 39, 0.12);
}

.climate-act-clock-date {
  color: #26382f;
  font-size: clamp(0.72rem, 0.8vw, 0.84rem);
  font-weight: 800;
}

.climate-act-stage {
  display: grid;
  grid-template-rows: var(--climate-act-comparison-size) minmax(0, 1fr);
  padding-bottom: var(--climate-act-bottom-bar-height);
  background:
    linear-gradient(
      180deg,
      rgba(252, 253, 248, 0.96),
      rgba(232, 240, 235, 0.92)
    ),
    #eef3ef;
}

.climate-act-comparison {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-bottom: 1px solid rgba(36, 54, 42, 0.14);
}

.climate-act-avatar,
.climate-act-camera {
  position: relative;
  overflow: hidden;
}

.climate-act-avatar {
  border-right: 1px solid rgba(36, 54, 42, 0.14);
}

.climate-act-countdown {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(23, 36, 28, 0.84);
  font-size: clamp(3.6rem, 8vw, 7rem);
  font-weight: 850;
  line-height: 1;
  pointer-events: none;
  text-shadow: 0 2px 18px rgba(248, 251, 247, 0.86);
}

.climate-act-camera {
  background: #121714;
}

.climate-act-camera :deep(.container) {
  border-radius: 0;
}

.climate-act-camera :deep(.video),
.climate-act-camera :deep(.canvas) {
  object-fit: cover;
}

.climate-act-info {
  display: grid;
  align-content: start;
  gap: 10px;
  overflow: auto;
  padding: clamp(18px, 2.1vw, 28px);
  background:
    linear-gradient(
      180deg,
      rgba(249, 252, 248, 0.96),
      rgba(240, 246, 242, 0.94)
    ),
    #f4f8f5;
  color: #26382f;
}

.climate-act-info__eyebrow {
  margin: 0;
  color: rgba(31, 49, 39, 0.58);
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
}

.climate-act-info__cue {
  width: min(100%, 760px);
  min-height: clamp(128px, 18dvh, 190px);
  display: grid;
  align-items: center;
  margin: 0;
  overflow-wrap: anywhere;
  color: #17241c;
  font-size: clamp(2rem, 4.6vw, 4.8rem);
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.02;
}

.climate-act-info__cue--instruction {
  color: #17241c;
}

.climate-act-info__cue--success {
  color: #237245;
}

.climate-act-info__cue--error {
  color: #b42b2b;
}

.climate-act-sequence {
  display: grid;
  gap: 6px;
  width: min(100%, 760px);
}

.climate-act-sequence__steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.climate-act-sequence__steps span {
  min-width: 0;
  padding: 4px 8px;
  border: 1px solid rgba(31, 49, 39, 0.14);
  border-radius: 999px;
  color: rgba(31, 49, 39, 0.64);
  font-size: 0.68rem;
  font-weight: 850;
}

.climate-act-sequence__steps .climate-act-sequence__step--active {
  border-color: rgba(35, 114, 69, 0.36);
  background: rgba(227, 244, 232, 0.9);
  color: #17241c;
}

.climate-act-sequence__steps .climate-act-sequence__step--complete {
  border-color: rgba(35, 114, 69, 0.22);
  background: rgba(35, 114, 69, 0.1);
  color: #237245;
}

.climate-act-sequence p {
  margin: 0;
  color: rgba(31, 49, 39, 0.66);
  font-size: 0.72rem;
  font-weight: 800;
}

.climate-act-bottom-bar {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(220px, max-content) minmax(0, 1fr);
  align-items: center;
  gap: clamp(12px, 2vw, 24px);
  height: var(--climate-act-bottom-bar-height);
  padding: 8px clamp(14px, 2vw, 24px);
  border-top: 1px solid rgba(31, 49, 39, 0.16);
  background: rgba(248, 251, 247, 0.96);
  color: #26382f;
  box-shadow: 0 -10px 28px rgba(32, 50, 40, 0.1);
  backdrop-filter: blur(10px);
}

.climate-act-bottom-bar__actions {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.climate-act-bottom-bar__actions .btn {
  min-height: 30px;
  padding: 5px 10px;
  font-size: 0.72rem;
}

.climate-act-bottom-bar__actions .btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.climate-act-bottom-bar__meta {
  display: flex;
  gap: clamp(14px, 3vw, 34px);
  min-width: 0;
  max-height: 100%;
  margin: 0;
  overflow: auto hidden;
  font-size: 0.72rem;
}

.climate-act-bottom-bar__meta div {
  flex: 0 0 auto;
  min-width: 0;
  max-width: min(34vw, 360px);
}

.climate-act-bottom-bar__meta dt {
  color: rgba(31, 49, 39, 0.58);
  font-size: 0.64rem;
  font-weight: 800;
  text-transform: uppercase;
}

.climate-act-bottom-bar__meta dd {
  margin: 2px 0 0;
  overflow: hidden;
  color: #26382f;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.climate-act-debug {
  position: absolute;
  right: 14px;
  bottom: calc(var(--climate-act-bottom-bar-height) + 14px);
  z-index: 30;
  width: min(720px, calc(50vw - 28px));
  max-height: min(48dvh, 460px);
  display: grid;
  gap: 8px;
  overflow: auto;
  padding: 10px;
  border: 1px solid rgba(31, 49, 39, 0.16);
  border-radius: 8px;
  background: rgba(248, 251, 247, 0.94);
  color: #26382f;
  box-shadow: 0 14px 36px rgba(31, 49, 39, 0.16);
  backdrop-filter: blur(10px);
}

.climate-act-debug__actions {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

.climate-act-debug__actions .btn {
  min-height: 28px;
  padding: 4px 7px;
  font-size: 0.68rem;
  line-height: 1.15;
}

.climate-act-debug__toggle {
  min-height: 28px;
  justify-self: start;
  padding: 4px 8px;
  font-size: 0.68rem;
}

.climate-act-debug__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
  font-size: 0.64rem;
}

.climate-act-debug__grid div {
  min-width: 0;
  padding: 5px 6px;
  border: 1px solid rgba(31, 49, 39, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.56);
}

.climate-act-debug__grid dt {
  color: rgba(31, 49, 39, 0.58);
  font-size: 0.56rem;
  font-weight: 800;
  text-transform: uppercase;
}

.climate-act-debug__grid dd {
  margin: 1px 0 0;
  overflow: hidden;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1180px) {
  .climate-act-page {
    --climate-act-clock-size: clamp(260px, 34vw, 360px);
  }

  .climate-act-bottom-bar {
    grid-template-columns: minmax(180px, max-content) minmax(0, 1fr);
  }
}

@media (max-width: 860px) {
  .climate-act-page {
    --climate-act-bottom-bar-height: 84px;
    --climate-act-clock-size: clamp(220px, 36vw, 300px);
  }

  .climate-act-context {
    padding: 20px;
    padding-bottom: calc(var(--climate-act-bottom-bar-height) + 18px);
    padding-left: 86px;
  }

  .climate-act-context h1 {
    font-size: clamp(1.85rem, 6vw, 3.2rem);
  }

  .climate-act-bottom-bar {
    grid-template-columns: 1fr;
    align-content: center;
    overflow: auto hidden;
  }

  .climate-act-debug {
    right: 10px;
    left: 10px;
    width: auto;
  }

  .climate-act-debug__actions,
  .climate-act-debug__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
