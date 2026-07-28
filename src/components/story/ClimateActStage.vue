<template>
  <main class="climate-act-page" :style="climateActThemeStyle">
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

        <ClimateIntervalInfo
          v-if="activeClimateStep"
          :step="activeClimateStep"
          :step-index="Math.max(activeClimateStepIndex, 0)"
          :total-steps="activeClimateStepTotal"
        />
        <SeasonClock class="climate-act-season-clock" :show-controls="false">
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
            :skeleton-visual-mode="skeletonFeedbackState.mode"
            :skeleton-pulse-progress="skeletonPulseProgress"
            @pose-landmarks="poseLandmarks = $event"
          />
        </section>
      </section>

      <section class="climate-act-info" :aria-label="activeSceneTitle">
        <p
          v-if="movementTextPresentation.valueLabel"
          class="climate-act-info__eyebrow"
        >
          {{ movementTextPresentation.valueLabel }}
        </p>
        <h2
          class="climate-act-info__cue"
          :class="`climate-act-info__cue--${movementTextPresentation.tone}`"
        >
          {{ movementTextPresentation.message }}
        </h2>
        <p
          v-if="movementTextPresentation.secondaryMessage"
          class="climate-act-info__secondary"
        >
          {{ movementTextPresentation.secondaryMessage }}
        </p>
      </section>
    </section>

    <section
      class="climate-act-bottom-bar"
      :aria-label="t('story.aria.runtimeMetadata')"
    >
      <div class="climate-act-bottom-bar__actions">
        <button
          class="btn btn--primary"
          type="button"
          @click="startAct5FullFlow"
        >
          {{ t("story.acts.act5.controls.startAct5") }}
        </button>
        <button class="btn" type="button" @click="startAct5WithoutTutorial">
          {{ t("story.acts.act5.controls.startAct5WithoutTutorial") }}
        </button>
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
        <button class="btn" type="button" @click="startAct5TutorialDebug">
          {{ t("story.acts.act5.debug.startAct5Tutorial") }}
        </button>
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
        <button class="btn" type="button" @click="triggerSkeletonPulseTest">
          {{ t("story.acts.act5.debug.testSkeletonPulse") }}
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
          <dt>Act 5 phase</dt>
          <dd>{{ activeAct5Phase }}</dd>
        </div>
        <div>
          <dt>Active flow ID</dt>
          <dd>{{ activeAct5FlowId ?? "none" }}</dd>
        </div>
        <div>
          <dt>Act 5 status</dt>
          <dd>{{ activeAct5SequenceStatus }}</dd>
        </div>
        <div>
          <dt>Active target</dt>
          <dd>
            {{ activeAct5TargetIndex + 1 }} / {{ activeAct5Targets.length }}
          </dd>
        </div>
        <div>
          <dt>Active target key</dt>
          <dd>{{ activeAct5TargetKey || "none" }}</dd>
        </div>
        <div>
          <dt>Tutorial season</dt>
          <dd>{{ activeAct5DisplayTarget?.season ?? "none" }}</dd>
        </div>
        <div>
          <dt>Tutorial target</dt>
          <dd>{{ activeAct5DisplayTarget?.target ?? "none" }}</dd>
        </div>
        <div>
          <dt>Encoding dimension</dt>
          <dd>{{ activeAct5Encoding?.id ?? "none" }}</dd>
        </div>
        <div>
          <dt>Resolved tutorial minimum</dt>
          <dd>{{ resolvedAct5TutorialMinimum ?? "none" }}</dd>
        </div>
        <div>
          <dt>Preparation active</dt>
          <dd>{{ isAct5PreparationStep ? "yes" : "no" }}</dd>
        </div>
        <div>
          <dt>Recognition active</dt>
          <dd>{{ isAct5RecognitionActive ? "yes" : "no" }}</dd>
        </div>
        <div>
          <dt>Avatar preview active</dt>
          <dd>{{ isAct5AvatarPreviewActive ? "yes" : "no" }}</dd>
        </div>
        <div>
          <dt>Current season theme</dt>
          <dd>{{ currentSeasonTheme.background }}</dd>
        </div>
        <div>
          <dt>Attempt number</dt>
          <dd>{{ activeAct5AttemptNumber }}</dd>
        </div>
        <div>
          <dt>Act 5 flow completed</dt>
          <dd>{{ act5FlowCompleted ? "yes" : "no" }}</dd>
        </div>
        <div>
          <dt>Skeleton feedback</dt>
          <dd>
            {{ skeletonFeedbackState.mode }} /
            {{ skeletonPulseProgress.toFixed(2) }}
          </dd>
        </div>
        <div>
          <dt>Skeleton feedback source</dt>
          <dd>{{ skeletonFeedbackState.sourceEvaluationId ?? "none" }}</dd>
        </div>
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
          <dt>Text phase</dt>
          <dd>{{ movementTextPresentation.phase }}</dd>
        </div>
        <div>
          <dt>Text tone</dt>
          <dd>{{ movementTextPresentation.tone }}</dd>
        </div>
        <div>
          <dt>Text value label</dt>
          <dd>{{ movementTextPresentation.valueLabel ?? "none" }}</dd>
        </div>
        <div>
          <dt>Text message</dt>
          <dd>{{ movementTextPresentation.message }}</dd>
        </div>
        <div>
          <dt>Text message key</dt>
          <dd>{{ movementTextPresentation.messageKey ?? "none" }}</dd>
        </div>
        <div>
          <dt>Text source</dt>
          <dd>{{ movementTextPresentation.messageSource }}</dd>
        </div>
        <div>
          <dt>Text secondary</dt>
          <dd>{{ movementTextPresentation.secondaryMessage ?? "none" }}</dd>
        </div>
        <div>
          <dt>Intro step</dt>
          <dd>{{ getActiveSequenceIntroStep() ?? "none" }}</dd>
        </div>
        <div>
          <dt>Beat instruction key</dt>
          <dd>{{ movementTextPresentation.beatInstructionKey ?? "none" }}</dd>
        </div>
        <div>
          <dt>Latest measure</dt>
          <dd>{{ movementTextPresentation.measureId ?? "none" }}</dd>
        </div>
        <div>
          <dt>Latest measure result</dt>
          <dd>{{ movementTextPresentation.measureResult ?? "none" }}</dd>
        </div>
        <div>
          <dt>Latest primary feedback</dt>
          <dd>{{ movementTextPresentation.primaryFeedbackCode ?? "none" }}</dd>
        </div>
        <div>
          <dt>CSV loaded</dt>
          <dd>{{ isClimateCsvLoaded ? "yes" : "no" }}</dd>
        </div>
        <div>
          <dt>CSV state</dt>
          <dd>{{ climateData.loaderState }}</dd>
        </div>
        <div>
          <dt>CSV source path</dt>
          <dd>{{ climateData.sourcePath }}</dd>
        </div>
        <div>
          <dt>Climate errors</dt>
          <dd>{{ climateDebugErrors }}</dd>
        </div>
        <div>
          <dt>Active interval</dt>
          <dd>{{ activeClimateStep?.interval ?? "none" }}</dd>
        </div>
        <div>
          <dt>Interval order</dt>
          <dd>{{ activeClimateStep?.intervalOrder ?? "none" }}</dd>
        </div>
        <div>
          <dt>Interval years</dt>
          <dd>
            {{ activeClimateStep?.intervalStart ?? "none" }} /
            {{ activeClimateStep?.intervalEnd ?? "none" }}
          </dd>
        </div>
        <div>
          <dt>Climate baseline</dt>
          <dd>{{ activeClimateStep?.isBaseline ?? "none" }}</dd>
        </div>
        <div>
          <dt>Movement raw/resolved</dt>
          <dd>
            {{ activeClimateStep?.rawMovementPercent ?? "none" }} /
            {{ activeClimateStep?.movementValue ?? "none" }}
          </dd>
        </div>
        <div>
          <dt>Movement definition</dt>
          <dd>{{ activeClimateStep?.movementDefinitionId ?? "none" }}</dd>
        </div>
        <div>
          <dt>Resolution reason</dt>
          <dd>{{ activeClimateStep?.resolutionReason ?? "none" }}</dd>
        </div>
        <div>
          <dt>Climate values</dt>
          <dd>
            abs {{ activeClimateStep?.absoluteValue ?? "none" }} / display
            {{ activeClimateStep?.displayValue ?? "none" }} /
            {{ activeClimateStep?.displayValueType ?? "none" }}
          </dd>
        </div>
        <div>
          <dt>Climate unit/norm</dt>
          <dd>
            {{ activeClimateStep?.displayUnit ?? "none" }} /
            {{ activeClimateStep?.normalizedValue ?? "none" }}
          </dd>
        </div>
        <div>
          <dt>Flow step</dt>
          <dd>
            {{ activeClimateStepIndex + 1 }} / {{ activeClimateStepTotal }}
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
          <dd>
            {{ currentSummerIntensityIndex + 1 }} / {{ summerTimeline.length }}
          </dd>
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
          <dt>Cycle timing</dt>
          <dd>
            bar {{ currentBar ?? "none" }} / beat {{ currentBeat ?? "none" }} /
            {{ seasonPhase }} /
            {{ isSeasonEvaluationEnabled ? "evaluated" : "preview" }} /
            direction {{ movementDirection ?? "none" }}
          </dd>
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
          <dt>Successful measures</dt>
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
import ClimateIntervalInfo from "~/components/story/ClimateIntervalInfo.vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useAutumnMovementRecognition } from "~/composables/useAutumnMovementRecognition";
import { useClimateSeasonData } from "~/composables/useClimateSeasonData";
import { useSeasonalLearningCycle } from "~/composables/useSeasonalLearningCycle";
import { useSpringMovementRecognition } from "~/composables/useSpringMovementRecognition";
import { useSummerMovementRecognition } from "~/composables/useSummerMovementRecognition";
import { useWinterMovementRecognition } from "~/composables/useWinterMovementRecognition";
import { useSkeletonVisualFeedback } from "~/composables/useSkeletonVisualFeedback";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import { act5IntroCycleConfig } from "~/story/act5IntroCycle";
import type { PoseLandmarkLike } from "~/types/pose";
import type {
  MovementBeatEvaluationLike,
  MovementMeasureResult,
} from "~/composables/useBeatWindowMovementRecognition";
import type {
  BeatSkeletonFeedbackEvent,
  BeatSkeletonFeedbackResult,
} from "~/utils/movement/skeletonVisualFeedback";
import {
  ACT5_SEASON_ENCODING,
  ACT5_SEASON_THEMES,
  buildAct5ClimateStoryFlow,
  buildAct5FullFlow,
  buildAct5TutorialDebugFlow,
  resolveMinimumMovementValue,
  type Act5FlowId,
  type Act5Phase,
  type Act5SequenceTarget,
} from "~/utils/movement/acts/climate/act5Flow";
import { climateMovementFlowRegistry } from "~/utils/movement/acts/climate/climateMovementFlows";
import type {
  ClimateMovementFlowStep,
  ClimateSeason,
} from "~/utils/movement/acts/climate/climateSeasonData";
import { formatClimateTemperature } from "~/utils/movement/acts/climate/climateSeasonData";
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
import type {
  SeasonalCycleConfig,
  SeasonalCycleSeasonId,
} from "~/utils/seasonalCycle";
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
type MovementTextTone =
  | "neutral"
  | "instruction"
  | "excellent"
  | "success"
  | "error"
  | "warning";
type MovementTextPhase =
  | "idle"
  | "intro"
  | "tutorialIntro"
  | "tutorialPreview"
  | "tutorialPerformance"
  | "storyIntro"
  | "preparation"
  | "seasonPreparation"
  | "seasonPerformance"
  | "instruction"
  | "measureFeedback"
  | "feedbackInterlude"
  | "intervalTransition"
  | "transition"
  | "completed"
  | "error";
type MovementTextSource =
  | "fatalError"
  | "feedbackInterlude"
  | "measureExcellent"
  | "measureSuccess"
  | "measureError"
  | "measureTracking"
  | "sequenceIntro"
  | "tutorialIntro"
  | "tutorialPreview"
  | "storyIntro"
  | "seasonPreparation"
  | "preparation"
  | "movementGuidance"
  | "transition"
  | "completed"
  | "idle";
type MovementTextPresentation = {
  valueLabel?: string;
  message: string;
  secondaryMessage?: string;
  tone: MovementTextTone;
  phase: MovementTextPhase;
  messageSource: MovementTextSource;
  messageKey?: string;
  beatInstructionKey?: string;
  measureId?: string;
  measureResult?: MovementMeasureResult;
  primaryFeedbackCode?: string;
};
type VisibleMeasureFeedback = {
  flowStepId: string;
  measureIndex: number;
  measureId: string;
  messageKey?: string;
  messageSource: MovementTextSource;
  result: MovementMeasureResult;
  primaryFeedbackCode?: string;
  text: string;
  tone: MovementTextTone;
};
type MeasureFeedbackEvaluation = {
  measureIndex: number;
  result: MovementMeasureResult;
  score?: number;
  primaryFeedbackCode?: string;
};

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
    beatInstructionKeys: Record<number, string>;
  }
> = {
  "100": {
    beatInstructionKeys: {
      1: "story.acts.act5.summerInstructions.beats.1",
      2: "story.acts.act5.summerInstructions.beats.100.2",
      3: "story.acts.act5.summerInstructions.beats.100.3",
      4: "story.acts.act5.summerInstructions.beats.4",
    },
  },
  "60": {
    beatInstructionKeys: {
      1: "story.acts.act5.summerInstructions.beats.1",
      2: "story.acts.act5.summerInstructions.beats.60.2",
      3: "story.acts.act5.summerInstructions.beats.60.3",
      4: "story.acts.act5.summerInstructions.beats.4",
    },
  },
  "30": {
    beatInstructionKeys: {
      1: "story.acts.act5.summerInstructions.beats.1",
      2: "story.acts.act5.summerInstructions.beats.30.2",
      3: "story.acts.act5.summerInstructions.beats.30.3",
      4: "story.acts.act5.summerInstructions.beats.4",
    },
  },
  "10": {
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
  getProblemCue: () => string,
  step: ClimateMovementFlowStep | null,
  fallbackFlowStepId: string,
): VisibleMeasureFeedback => {
  const flowStepId = step?.id ?? fallbackFlowStepId;
  const measureId = `${flowStepId}-${evaluation.measureIndex}`;

  if (evaluation.result === "success") {
    return {
      flowStepId,
      measureIndex: evaluation.measureIndex,
      measureId,
      messageKey: "story.acts.act5.movementText.bravo",
      messageSource: "measureExcellent",
      result: evaluation.result,
      primaryFeedbackCode: evaluation.primaryFeedbackCode,
      text: t("story.acts.act5.movementText.bravo"),
      tone: "excellent",
    };
  }

  if (evaluation.result === "almostCorrect") {
    return {
      flowStepId,
      measureIndex: evaluation.measureIndex,
      measureId,
      messageKey: "story.acts.act5.movementText.good",
      messageSource: "measureSuccess",
      result: evaluation.result,
      primaryFeedbackCode: evaluation.primaryFeedbackCode,
      text: t("story.acts.act5.movementText.good"),
      tone: "success",
    };
  }

  return {
    flowStepId,
    measureIndex: evaluation.measureIndex,
    measureId,
    messageSource:
      evaluation.result === "trackingUnavailable"
        ? "measureTracking"
        : "measureError",
    result: evaluation.result,
    primaryFeedbackCode: evaluation.primaryFeedbackCode,
    text: getProblemCue(),
    tone: evaluation.result === "trackingUnavailable" ? "warning" : "error",
  };
};
const storyEngine = useStoryEngine();
const runtimeStore = useStoryRuntimeStore();
const route = useRoute();
const climateData = useClimateSeasonData();
const poseLandmarks = ref<PoseLandmarkLike[] | null>(null);
const summerRecognition = useSummerMovementRecognition();
const autumnRecognition = useAutumnMovementRecognition();
const springRecognition = useSpringMovementRecognition();
const winterRecognition = useWinterMovementRecognition();
const {
  skeletonFeedbackState,
  pulseProgress: skeletonPulseProgress,
  triggerBeatSuccess,
  setTrackingLimited,
  resetSkeletonFeedback,
} = useSkeletonVisualFeedback();
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
const completedSummerStepIds = ref<string[]>([]);
const completedAutumnStepIds = ref<string[]>([]);
const completedSpringStepIds = ref<string[]>([]);
const completedWinterStepIds = ref<string[]>([]);
const climateDataUserError = ref("");
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
const summerRetryPreviewFeedbackText = ref("");
const autumnRetryPreviewFeedbackText = ref("");
const springRetryPreviewFeedbackText = ref("");
const winterRetryPreviewFeedbackText = ref("");
const act5RetryPreviewFeedbackText = ref("");
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
let act5FlowAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
const processedSkeletonBeatCounts: Record<ClimateSeason, number> = {
  summer: 0,
  autumn: 0,
  winter: 0,
  spring: 0,
};
const activeAct5FlowId = ref<Act5FlowId | null>(null);
const activeAct5Phase = ref<Act5Phase | "idle">("idle");
const activeAct5Targets = ref<Act5SequenceTarget[]>([]);
const activeAct5TargetIndex = ref(0);
const activeAct5PreviewTarget = ref<Act5SequenceTarget | null>(null);
const activeAct5PreviewTargetIndex = ref<number | null>(null);
const activeAct5SequenceStatus = ref<
  | "idle"
  | "performing"
  | "feedbackInterlude"
  | "previewingNext"
  | "storyIntro"
  | "completed"
>("idle");
const activeAct5AttemptNumber = ref(0);
const handledAct5TargetEvaluationKey = ref("");
const act5FlowCompleted = ref(false);
const {
  currentDate,
  currentBar,
  currentBeat,
  currentFrame: instructorFrame,
  currentMovementSourceAspect: instructorSourceAspect,
  currentSeason,
  countdownRemaining,
  elapsedMs,
  evaluationEnabled,
  isCountingDown,
  isCompleted,
  isTransition,
  movementDirection,
  playbackState,
  repetitionIndex,
  seasonElapsedMs,
  seasonPhase,
  showInstructorAvatar,
  totalDurationMs,
  cleanup,
  initialize,
  pause,
  play,
  currentSeasonIndex,
  queueSeasonIndexEndAction,
  queueSeasonIndexRestart,
  queueSeasonRestart,
  reset,
  startCustomCycle,
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
const isAct5FinalFlowActive = computed(() => activeAct5FlowId.value !== null);
const activeAct5Target = computed(
  () => activeAct5Targets.value[activeAct5TargetIndex.value] ?? null,
);
const activeAct5DisplayTarget = computed(
  () => activeAct5PreviewTarget.value ?? activeAct5Target.value,
);
const activeAct5MovementStep = computed(() =>
  activeAct5SequenceStatus.value === "performing"
    ? activeAct5Target.value
    : null,
);
const isSeasonPreviewBar = computed(
  () =>
    playbackState.value === "playing" &&
    seasonPhase.value === "preview" &&
    currentBar.value === 1 &&
    !getActiveInterlude(),
);
const isSeasonEvaluationEnabled = computed(
  () =>
    playbackState.value === "playing" &&
    evaluationEnabled.value &&
    !getActiveInterlude(),
);
const activeAct5ClimateStep = computed(
  () => activeAct5DisplayTarget.value?.climateData ?? null,
);
const getSeasonConfig = (seasonId: ClimateSeason) => {
  const season = act5IntroCycleConfig.seasons.find(
    (item) => item.id === seasonId,
  );

  if (!season) {
    throw new Error(`Unknown Act 5 season "${seasonId}".`);
  }

  return season;
};
const activeAct5SeasonConfig = computed(() =>
  activeAct5DisplayTarget.value
    ? getSeasonConfig(activeAct5DisplayTarget.value.season)
    : null,
);
const currentSeasonLabel = computed(() => {
  const season = activeAct5SeasonConfig.value ?? currentSeason.value;

  return season.labelKey ? t(season.labelKey) : season.label;
});
const getTimeline = (season: ClimateSeason) =>
  climateData.getSeasonTimeline(season);
const summerTimeline = computed(() => getTimeline("summer"));
const autumnTimeline = computed(() => getTimeline("autumn"));
const springTimeline = computed(() => getTimeline("spring"));
const winterTimeline = computed(() => getTimeline("winter"));
const getStepAt = (
  timeline: ClimateMovementFlowStep[],
  index: number,
): ClimateMovementFlowStep | null => timeline[index] ?? null;
const currentSummerStep = computed(() =>
  getStepAt(summerTimeline.value, currentSummerIntensityIndex.value),
);
const nextSummerStep = computed(() =>
  getStepAt(summerTimeline.value, currentSummerIntensityIndex.value + 1),
);
const currentAutumnStep = computed(() =>
  getStepAt(autumnTimeline.value, currentAutumnValueIndex.value),
);
const nextAutumnStep = computed(() =>
  getStepAt(autumnTimeline.value, currentAutumnValueIndex.value + 1),
);
const currentSpringStep = computed(() =>
  getStepAt(springTimeline.value, currentSpringValueIndex.value),
);
const nextSpringStep = computed(() =>
  getStepAt(springTimeline.value, currentSpringValueIndex.value + 1),
);
const currentWinterStep = computed(() =>
  getStepAt(winterTimeline.value, currentWinterValueIndex.value),
);
const nextWinterStep = computed(() =>
  getStepAt(winterTimeline.value, currentWinterValueIndex.value + 1),
);
const getStepMovementValue = <TValue extends string>(
  step: ClimateMovementFlowStep | null,
  fallback: TValue,
) => String(step?.movementValue ?? fallback) as TValue;
const activeAct5MovementValue = computed(() => {
  const target = activeAct5DisplayTarget.value;

  return target ? String(target.movementValue) : null;
});
const currentSummerIntensity = computed<SummerIntensity>(() =>
  activeAct5DisplayTarget.value?.season === "summer" &&
  activeAct5MovementValue.value
    ? (activeAct5MovementValue.value as SummerIntensity)
    : getStepMovementValue(currentSummerStep.value, "100"),
);
const nextSummerIntensity = computed<SummerIntensity | null>(() =>
  nextSummerStep.value
    ? getStepMovementValue(nextSummerStep.value, "100")
    : null,
);
const currentAutumnValue = computed<AutumnValueClass>(() =>
  activeAct5DisplayTarget.value?.season === "autumn" &&
  activeAct5MovementValue.value
    ? (activeAct5MovementValue.value as AutumnValueClass)
    : getStepMovementValue(currentAutumnStep.value, "100"),
);
const nextAutumnValue = computed<AutumnValueClass | null>(() =>
  nextAutumnStep.value
    ? getStepMovementValue(nextAutumnStep.value, "100")
    : null,
);
const currentSpringValue = computed<SpringValue>(() =>
  activeAct5DisplayTarget.value?.season === "spring" &&
  activeAct5MovementValue.value
    ? (activeAct5MovementValue.value as SpringValue)
    : getStepMovementValue(currentSpringStep.value, "100"),
);
const nextSpringValue = computed<SpringValue | null>(() =>
  nextSpringStep.value
    ? getStepMovementValue(nextSpringStep.value, "100")
    : null,
);
const currentWinterValue = computed<WinterValue>(() =>
  activeAct5DisplayTarget.value?.season === "winter" &&
  activeAct5MovementValue.value
    ? (activeAct5MovementValue.value as WinterValue)
    : getStepMovementValue(currentWinterStep.value, "100"),
);
const nextWinterValue = computed<WinterValue | null>(() =>
  nextWinterStep.value
    ? getStepMovementValue(nextWinterStep.value, "100")
    : null,
);
const activeClimateStep = computed(() => {
  if (activeAct5ClimateStep.value) return activeAct5ClimateStep.value;

  if (currentSeason.value.id === "summer") return currentSummerStep.value;
  if (currentSeason.value.id === "autumn") return currentAutumnStep.value;
  if (currentSeason.value.id === "spring") return currentSpringStep.value;
  if (currentSeason.value.id === "winter") return currentWinterStep.value;

  return null;
});
const activeClimateStepIndex = computed(() => {
  if (activeAct5ClimateStep.value) {
    return activeAct5StoryStepIndex.value;
  }

  if (currentSeason.value.id === "summer")
    return currentSummerIntensityIndex.value;
  if (currentSeason.value.id === "autumn") return currentAutumnValueIndex.value;
  if (currentSeason.value.id === "spring") return currentSpringValueIndex.value;
  if (currentSeason.value.id === "winter") return currentWinterValueIndex.value;

  return 0;
});
const activeClimateStepTotal = computed(() => {
  if (activeAct5ClimateStep.value) {
    return activeAct5Targets.value.filter((target) => target.climateData)
      .length;
  }

  if (currentSeason.value.id === "summer") return summerTimeline.value.length;
  if (currentSeason.value.id === "autumn") return autumnTimeline.value.length;
  if (currentSeason.value.id === "spring") return springTimeline.value.length;
  if (currentSeason.value.id === "winter") return winterTimeline.value.length;

  return 0;
});
const activeAct5StoryStepIndex = computed(() => {
  if (!activeAct5ClimateStep.value) return -1;

  return activeAct5Targets.value
    .filter((target) => target.climateData)
    .findIndex(
      (target) => target.climateData?.id === activeAct5ClimateStep.value?.id,
    );
});
const getAct5MovementTargetKey = (target: Act5SequenceTarget | null) => {
  if (!target) return "";

  return [target.context, target.interval, target.season, target.movementValue]
    .filter(Boolean)
    .join("-");
};
const activeAct5TargetKey = computed(() =>
  getAct5MovementTargetKey(activeAct5DisplayTarget.value),
);
const isAct5PreparationStep = computed(
  () => isAct5FinalFlowActive.value && isSeasonPreviewBar.value,
);
const isAct5RecognitionActive = computed(
  () =>
    activeAct5MovementStep.value !== null &&
    isSeasonEvaluationEnabled.value &&
    !getActiveInterlude(),
);
const isAct5AvatarPreviewActive = computed(
  () =>
    isAct5FinalFlowActive.value &&
    activeAct5DisplayTarget.value !== null &&
    activeAct5SequenceStatus.value !== "completed",
);
const currentSeasonTheme = computed(() => {
  const seasonId =
    activeAct5DisplayTarget.value?.season ?? currentSeason.value.id;

  return ACT5_SEASON_THEMES[seasonId];
});
const climateActThemeStyle = computed(() => ({
  "--act5-season-background": currentSeasonTheme.value.background,
  "--act5-season-surface": currentSeasonTheme.value.surface,
}));
const activeAct5Encoding = computed(() =>
  activeAct5DisplayTarget.value
    ? ACT5_SEASON_ENCODING[activeAct5DisplayTarget.value.season]
    : null,
);
const resolvedAct5TutorialMinimum = computed(() =>
  activeAct5DisplayTarget.value
    ? resolveMinimumMovementValue(activeAct5DisplayTarget.value.season)
    : null,
);
const sequenceIntroKeys = [
  "story.acts.act5.movementText.timelineIntro",
  "story.acts.act5.movementText.differenceIntro",
  "story.acts.act5.movementText.referenceIntro",
];
const getSequenceIntroKey = (introStep: number) =>
  sequenceIntroKeys[introStep] ?? sequenceIntroKeys[0] ?? "";
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
const activeSeasonId = computed(
  () => activeAct5DisplayTarget.value?.season ?? currentSeason.value.id,
);
const isSummerActive = computed(() => activeSeasonId.value === "summer");
const isAutumnActive = computed(() => activeSeasonId.value === "autumn");
const isSpringActive = computed(() => activeSeasonId.value === "spring");
const isWinterActive = computed(() => activeSeasonId.value === "winter");
const formatMovementPercent = (value: string | number) =>
  String(value).replace("-", "−");
const getMovementValueLabel = (step: ClimateMovementFlowStep | null) => {
  if (!step) return undefined;

  return t("story.acts.act5.movementText.valueLabel", {
    value: formatMovementPercent(step.movementValue),
  });
};
const getMovementValueLabelFromValue = (value: string | number | null) => {
  if (value === null) return undefined;

  return t("story.acts.act5.movementText.valueLabel", {
    value: formatMovementPercent(value),
  });
};
const currentMovementValueLabel = computed(
  () =>
    getMovementValueLabelFromValue(activeAct5MovementValue.value) ??
    getMovementValueLabel(activeClimateStep.value),
);
const getPreviewBeatCueKey = () => {
  const beat = currentBeat.value ?? 1;

  if (beat >= 4) return "story.acts.act5.movementText.previewBeat4";
  if (beat === 3) return "story.acts.act5.movementText.previewBeat3";
  if (beat === 2) return "story.acts.act5.movementText.previewBeat2";

  return "story.acts.act5.movementText.previewBeat1";
};
const getCurrentMovementValue = () => {
  if (activeSeasonId.value === "summer") return currentSummerIntensity.value;
  if (activeSeasonId.value === "autumn") return currentAutumnValue.value;
  if (activeSeasonId.value === "spring") return currentSpringValue.value;
  if (activeSeasonId.value === "winter") return currentWinterValue.value;

  return "100";
};
const getFallbackFlowStepId = () =>
  `${activeSeasonId.value}-${formatMovementPercent(getCurrentMovementValue())}`;
const getActiveFlowStepId = () =>
  activeAct5MovementStep.value?.id ??
  activeClimateStep.value?.id ??
  getFallbackFlowStepId();
const getCurrentBeat = () => {
  if (activeSeasonId.value === "summer") return summerDebug.value.currentBeat;
  if (activeSeasonId.value === "autumn") return autumnDebug.value.currentBeat;
  if (activeSeasonId.value === "spring") return springDebug.value.currentBeat;
  if (activeSeasonId.value === "winter") return winterDebug.value.currentBeat;

  return 1;
};
const getSummerBeatInstructionKey = (beat: number) => {
  const config = summerIntensityGuidance[currentSummerIntensity.value];

  return (
    config.beatInstructionKeys[beat] ??
    summerBeatFallbackInstructions[beat] ??
    summerBeatFallbackInstructions[1] ??
    ""
  );
};
const getCurrentBeatInstructionKey = () => {
  const beat = getCurrentBeat();

  if (activeSeasonId.value === "summer") {
    return getSummerBeatInstructionKey(beat);
  }
  if (activeSeasonId.value === "autumn") {
    return autumnBeatInstructions[beat] ?? autumnBeatInstructions[1] ?? "";
  }
  if (activeSeasonId.value === "spring") {
    return springBeatInstructions[beat] ?? springBeatInstructions[1] ?? "";
  }
  if (activeSeasonId.value === "winter") {
    return winterBeatInstructions[beat] ?? winterBeatInstructions[1] ?? "";
  }

  return "";
};
const getCurrentVisibleMeasureFeedback = () => {
  if (isSummerFeedbackVisible.value) return visibleSummerMeasureFeedback.value;
  if (isAutumnFeedbackVisible.value) return visibleAutumnMeasureFeedback.value;
  if (isSpringFeedbackVisible.value) return visibleSpringMeasureFeedback.value;
  if (isWinterFeedbackVisible.value) return visibleWinterMeasureFeedback.value;

  return null;
};
const getActiveSequenceIntroStep = () => {
  if (summerSequencePhase.value === "intro")
    return summerSequenceIntroStep.value;
  if (autumnSequencePhase.value === "intro")
    return autumnSequenceIntroStep.value;
  if (springSequencePhase.value === "intro")
    return springSequenceIntroStep.value;
  if (winterSequencePhase.value === "intro")
    return winterSequenceIntroStep.value;

  return null;
};
const getActiveCompletedMessageKey = () => {
  if (summerSequencePhase.value === "completed") {
    return "story.acts.act5.sequence.summerCompleted";
  }
  if (autumnSequencePhase.value === "completed") {
    return "story.acts.act5.sequence.autumnCompleted";
  }
  if (springSequencePhase.value === "completed") {
    return "story.acts.act5.sequence.springCompleted";
  }
  if (winterSequencePhase.value === "completed") {
    return "story.acts.act5.sequence.winterCompleted";
  }

  return null;
};
const getActiveInterlude = () => {
  if (isSummerFeedbackInterlude.value) {
    return {
      beat: summerFeedbackInterludeBeat.value,
      text: summerFeedbackInterludeText.value,
    };
  }
  if (isAutumnFeedbackInterlude.value) {
    return {
      beat: autumnFeedbackInterludeBeat.value,
      text: autumnFeedbackInterludeText.value,
    };
  }
  if (isSpringFeedbackInterlude.value) {
    return {
      beat: springFeedbackInterludeBeat.value,
      text: springFeedbackInterludeText.value,
    };
  }
  if (isWinterFeedbackInterlude.value) {
    return {
      beat: winterFeedbackInterludeBeat.value,
      text: winterFeedbackInterludeText.value,
    };
  }

  return null;
};
const getActiveRetryPreviewFeedbackText = () => {
  if (!isSeasonPreviewBar.value) return "";

  if (isAct5FinalFlowActive.value) {
    return act5RetryPreviewFeedbackText.value;
  }

  if (activeSeasonId.value === "summer") {
    return summerRetryPreviewFeedbackText.value;
  }
  if (activeSeasonId.value === "autumn") {
    return autumnRetryPreviewFeedbackText.value;
  }
  if (activeSeasonId.value === "spring") {
    return springRetryPreviewFeedbackText.value;
  }
  if (activeSeasonId.value === "winter") {
    return winterRetryPreviewFeedbackText.value;
  }

  return "";
};
type SkeletonBeatEvaluation = MovementBeatEvaluationLike<
  number,
  unknown,
  string
>;

const resetProcessedSkeletonBeatCounts = () => {
  processedSkeletonBeatCounts.summer = 0;
  processedSkeletonBeatCounts.autumn = 0;
  processedSkeletonBeatCounts.winter = 0;
  processedSkeletonBeatCounts.spring = 0;
};

const resetSkeletonBeatFeedbackState = () => {
  resetProcessedSkeletonBeatCounts();
  resetSkeletonFeedback();
};

const getSkeletonFeedbackFlowId = (season: ClimateSeason) => {
  if (activeAct5FlowId.value) return activeAct5FlowId.value;
  if (season === "summer") {
    return summerTestMode.value === "intensitySequence"
      ? climateMovementFlowRegistry.summerSequenceDebug.id
      : climateMovementFlowRegistry.summerSingleDebug.id;
  }
  if (season === "autumn") {
    return autumnTestMode.value === "valueSequence"
      ? climateMovementFlowRegistry.autumnSequenceDebug.id
      : climateMovementFlowRegistry.autumnSingleDebug.id;
  }
  if (season === "spring") {
    return springTestMode.value === "valueSequence"
      ? climateMovementFlowRegistry.springSequenceDebug.id
      : climateMovementFlowRegistry.springSingleDebug.id;
  }

  return winterTestMode.value === "valueSequence"
    ? climateMovementFlowRegistry.winterSequenceDebug.id
    : climateMovementFlowRegistry.winterSingleDebug.id;
};

const isSkeletonBeatFeedbackAllowed = (season: ClimateSeason) => {
  if (playbackState.value !== "playing") return false;
  if (getActiveInterlude()) return false;
  if (isTransition.value || repetitionIndex.value === null) return false;
  if (!isSeasonEvaluationEnabled.value) return false;

  if (isAct5FinalFlowActive.value) {
    return (
      activeAct5SequenceStatus.value === "performing" &&
      activeAct5MovementStep.value?.season === season
    );
  }

  return currentSeason.value.id === season;
};

const getActiveSkeletonEvaluation = () => {
  if (activeSeasonId.value === "summer") {
    return summerRecognition.currentEvaluation.value;
  }
  if (activeSeasonId.value === "autumn") {
    return autumnRecognition.currentEvaluation.value;
  }
  if (activeSeasonId.value === "spring") {
    return springRecognition.currentEvaluation.value;
  }
  if (activeSeasonId.value === "winter") {
    return winterRecognition.currentEvaluation.value;
  }

  return null;
};

const getBeatFeedbackResult = (
  evaluation: SkeletonBeatEvaluation,
): BeatSkeletonFeedbackResult => {
  if (evaluation.trackingUnavailable) return "notEvaluable";

  return evaluation.passed ? "passed" : "failed";
};

const createSkeletonFeedbackEvent = ({
  season,
  evaluation,
  evaluationIndex,
}: {
  season: ClimateSeason;
  evaluation: SkeletonBeatEvaluation;
  evaluationIndex: number;
}): BeatSkeletonFeedbackEvent => {
  const flowId = getSkeletonFeedbackFlowId(season);
  const flowStepId = getActiveFlowStepId();
  const measureIndex = Math.floor(evaluationIndex / 4);
  const beatIndex = Number(evaluation.beat);
  const timestamp = Math.round(evaluation.timestamp);

  return {
    evaluationId: [
      flowId,
      flowStepId,
      season,
      measureIndex,
      beatIndex,
      timestamp,
    ].join(":"),
    flowId,
    flowStepId,
    measureIndex,
    beatIndex,
    result: getBeatFeedbackResult(evaluation),
  };
};

const processSkeletonBeatEvaluations = (
  season: ClimateSeason,
  evaluations: readonly SkeletonBeatEvaluation[],
) => {
  if (evaluations.length < processedSkeletonBeatCounts[season]) {
    processedSkeletonBeatCounts[season] = 0;
  }

  if (!isSkeletonBeatFeedbackAllowed(season)) {
    processedSkeletonBeatCounts[season] = evaluations.length;
    return;
  }

  for (
    let index = processedSkeletonBeatCounts[season];
    index < evaluations.length;
    index++
  ) {
    const evaluation = evaluations[index];

    if (!evaluation) continue;

    triggerBeatSuccess(
      createSkeletonFeedbackEvent({
        season,
        evaluation,
        evaluationIndex: index,
      }),
    );
  }

  processedSkeletonBeatCounts[season] = evaluations.length;
};
const isVisibleSummerMeasureFeedbackCurrent = computed(
  () =>
    isSummerActive.value &&
    visibleSummerMeasureFeedback.value !== null &&
    visibleSummerMeasureFeedback.value.flowStepId === getActiveFlowStepId() &&
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
    visibleAutumnMeasureFeedback.value.flowStepId === getActiveFlowStepId() &&
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
    visibleSpringMeasureFeedback.value.flowStepId === getActiveFlowStepId() &&
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
    visibleWinterMeasureFeedback.value.flowStepId === getActiveFlowStepId() &&
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
    () => getCycleProblemCue(cycleEvaluation),
    activeAct5MovementStep.value?.season === "summer"
      ? null
      : currentSummerStep.value,
    activeAct5MovementStep.value?.season === "summer"
      ? activeAct5MovementStep.value.id
      : `summer-${currentSummerIntensity.value}`,
  );

const clearVisibleSummerMeasureFeedback = () => {
  visibleSummerMeasureFeedback.value = null;
};

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
    () => getAutumnCycleProblemCue(cycleEvaluation),
    activeAct5MovementStep.value?.season === "autumn"
      ? null
      : currentAutumnStep.value,
    activeAct5MovementStep.value?.season === "autumn"
      ? activeAct5MovementStep.value.id
      : `autumn-${currentAutumnValue.value}`,
  );

const clearVisibleAutumnMeasureFeedback = () => {
  visibleAutumnMeasureFeedback.value = null;
};

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
    () => getSpringCycleProblemCue(cycleEvaluation),
    activeAct5MovementStep.value?.season === "spring"
      ? null
      : currentSpringStep.value,
    activeAct5MovementStep.value?.season === "spring"
      ? activeAct5MovementStep.value.id
      : `spring-${currentSpringValue.value}`,
  );

const clearVisibleSpringMeasureFeedback = () => {
  visibleSpringMeasureFeedback.value = null;
};

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
    () => getWinterCycleProblemCue(cycleEvaluation),
    activeAct5MovementStep.value?.season === "winter"
      ? null
      : currentWinterStep.value,
    activeAct5MovementStep.value?.season === "winter"
      ? activeAct5MovementStep.value.id
      : `winter-${currentWinterValue.value}`,
  );

const clearVisibleWinterMeasureFeedback = () => {
  visibleWinterMeasureFeedback.value = null;
};

const periodLabel = computed(() => {
  if (activeAct5Phase.value === "tutorial") {
    return t("story.acts.act5.tutorial.general.title");
  }

  if (activeAct5ClimateStep.value) return activeAct5ClimateStep.value.interval;

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
  const target = activeAct5DisplayTarget.value;

  if (
    target?.context === "tutorial" &&
    activeAct5SequenceStatus.value !== "performing"
  ) {
    return t(target.encoding.tutorialTitleKey);
  }

  if (target?.context === "tutorial") {
    return t(target.encoding.actionNounKey);
  }

  if (activeAct5ClimateStep.value) {
    return activeAct5ClimateStep.value.isBaseline
      ? t("story.acts.act5.story.preparation.referencePeriod")
      : t("story.acts.act5.story.preparation.changedPeriod");
  }

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
    activeSeasonId.value === "autumn" &&
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
const movementTextPresentation = computed<MovementTextPresentation>(() => {
  const valueLabel = currentMovementValueLabel.value;

  if (climateDataUserError.value) {
    return {
      message: climateDataUserError.value,
      tone: "error",
      phase: "error",
      messageSource: "fatalError",
      messageKey: "story.acts.act5.climateData.loadError",
    };
  }

  const interlude = getActiveInterlude();

  if (interlude) {
    const messageKey =
      interlude.beat >= 4 ? "story.acts.act5.movementText.tryAgain" : undefined;

    return {
      valueLabel,
      message:
        interlude.beat >= 4
          ? t("story.acts.act5.movementText.tryAgain")
          : interlude.text,
      tone: interlude.beat >= 4 ? "instruction" : "error",
      phase: "feedbackInterlude",
      messageSource: "feedbackInterlude",
      messageKey,
    };
  }

  const retryPreviewFeedbackText = getActiveRetryPreviewFeedbackText();

  if (retryPreviewFeedbackText) {
    return {
      valueLabel,
      message: retryPreviewFeedbackText,
      secondaryMessage: t(getPreviewBeatCueKey()),
      tone: "error",
      phase: "feedbackInterlude",
      messageSource: "feedbackInterlude",
    };
  }

  const measureFeedback = getCurrentVisibleMeasureFeedback();

  if (measureFeedback) {
    return {
      valueLabel,
      message: measureFeedback.text,
      tone: measureFeedback.tone,
      phase: "measureFeedback",
      messageSource: measureFeedback.messageSource,
      messageKey: measureFeedback.messageKey,
      measureId: measureFeedback.measureId,
      measureResult: measureFeedback.result,
      primaryFeedbackCode: measureFeedback.primaryFeedbackCode,
    };
  }

  if (activeAct5SequenceStatus.value === "completed") {
    const messageKey =
      activeAct5FlowId.value === "act5TutorialDebug"
        ? "story.acts.act5.tutorial.general.completed"
        : "story.acts.act5.story.completed";

    return {
      message: t(messageKey),
      tone: "success",
      phase: "completed",
      messageSource: "completed",
      messageKey,
    };
  }

  const act5Target = activeAct5DisplayTarget.value;

  if (
    act5Target?.context === "tutorial" &&
    (isCountingDown.value || isAct5PreparationStep.value)
  ) {
    const explanationKey =
      act5Target.target === "maximum"
        ? act5Target.encoding.maximumExplanationKey
        : act5Target.encoding.minimumExplanationKey;

    return {
      valueLabel,
      message: t(act5Target.encoding.tutorialExplanationKey),
      secondaryMessage: isCountingDown.value
        ? t("story.acts.act5.instructions.countdown", {
            count: countdownRemaining.value,
          })
        : t(getPreviewBeatCueKey()),
      tone: "instruction",
      phase: "tutorialPreview",
      messageSource: "tutorialPreview",
      messageKey: act5Target.encoding.tutorialExplanationKey,
      beatInstructionKey: isCountingDown.value ? undefined : explanationKey,
    };
  }

  if (
    act5Target?.context === "climateStory" &&
    activeAct5SequenceStatus.value === "storyIntro"
  ) {
    return {
      message: t("story.acts.act5.story.intro.title"),
      secondaryMessage: t("story.acts.act5.story.intro.reference"),
      tone: "neutral",
      phase: "storyIntro",
      messageSource: "storyIntro",
      messageKey: "story.acts.act5.story.intro.title",
    };
  }

  if (
    act5Target?.context === "climateStory" &&
    (isCountingDown.value || isAct5PreparationStep.value) &&
    act5Target.climateData
  ) {
    const temperature = formatClimateTemperature({
      value: act5Target.climateData.displayValue,
      type: act5Target.climateData.displayValueType,
      unit: act5Target.climateData.displayUnit,
    });

    return {
      valueLabel,
      message: t("story.acts.act5.story.preparation.title", {
        season: currentSeasonLabel.value,
        interval: act5Target.interval,
        value: formatMovementPercent(act5Target.movementValue),
      }),
      secondaryMessage: isCountingDown.value
        ? t(
            act5Target.climateData.isBaseline
              ? "story.acts.act5.story.temperatureComparison.baseline"
              : "story.acts.act5.story.temperatureComparison.change",
            {
              temperature,
            },
          )
        : t(getPreviewBeatCueKey()),
      tone: "instruction",
      phase: "seasonPreparation",
      messageSource: "seasonPreparation",
      messageKey: "story.acts.act5.story.preparation.title",
    };
  }

  const introStep = getActiveSequenceIntroStep();

  if (introStep !== null) {
    const messageKey = getSequenceIntroKey(introStep);

    return {
      valueLabel: introStep >= 2 ? valueLabel : undefined,
      message: t(messageKey),
      tone: "neutral",
      phase: "intro",
      messageSource: "sequenceIntro",
      messageKey,
    };
  }

  const completedMessageKey = getActiveCompletedMessageKey();

  if (completedMessageKey) {
    return {
      message: t(completedMessageKey),
      tone: "success",
      phase: "completed",
      messageSource: "completed",
      messageKey: completedMessageKey,
    };
  }

  if (isCompleted.value) {
    return {
      message: t("story.acts.act5.instructions.completed"),
      tone: "success",
      phase: "completed",
      messageSource: "completed",
      messageKey: "story.acts.act5.instructions.completed",
    };
  }

  if (isCountingDown.value) {
    return {
      valueLabel,
      message: t("story.acts.act5.movementText.baselinePrep"),
      secondaryMessage: t("story.acts.act5.instructions.countdown", {
        count: countdownRemaining.value,
      }),
      tone: "instruction",
      phase: "preparation",
      messageSource: "preparation",
      messageKey: "story.acts.act5.movementText.baselinePrep",
    };
  }

  if (isSeasonPreviewBar.value) {
    return {
      valueLabel,
      message: t("story.acts.act5.movementText.baselinePrep"),
      secondaryMessage: t(getPreviewBeatCueKey()),
      tone: "instruction",
      phase: "preparation",
      messageSource: "preparation",
      messageKey: "story.acts.act5.movementText.baselinePrep",
    };
  }

  if (isTransition.value) {
    return {
      valueLabel,
      message: t("story.acts.act5.movementText.nextPeriod"),
      tone: "neutral",
      phase: "transition",
      messageSource: "transition",
      messageKey: "story.acts.act5.movementText.nextPeriod",
    };
  }

  if (playbackState.value === "idle") {
    return {
      message: t("story.acts.act5.movementText.ready"),
      tone: "neutral",
      phase: "idle",
      messageSource: "idle",
      messageKey: "story.acts.act5.movementText.ready",
    };
  }
  if (playbackState.value === "paused") {
    return {
      valueLabel,
      message: t("story.acts.act5.instructions.paused"),
      tone: "neutral",
      phase: "idle",
      messageSource: "idle",
      messageKey: "story.acts.act5.instructions.paused",
    };
  }

  if (
    isSummerActive.value ||
    isAutumnActive.value ||
    isSpringActive.value ||
    isWinterActive.value
  ) {
    const beatInstructionKey = getCurrentBeatInstructionKey();

    return {
      valueLabel,
      message: t(beatInstructionKey),
      tone: "instruction",
      phase:
        activeAct5MovementStep.value?.context === "tutorial"
          ? "tutorialPerformance"
          : activeAct5MovementStep.value?.context === "climateStory"
            ? "seasonPerformance"
            : "instruction",
      messageSource: "movementGuidance",
      messageKey: beatInstructionKey,
      beatInstructionKey,
    };
  }

  return {
    valueLabel,
    message: t("story.acts.act5.instructions.repeat"),
    tone: "instruction",
    phase: "instruction",
    messageSource: "movementGuidance",
    messageKey: "story.acts.act5.instructions.repeat",
  };
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
const isClimateCsvLoaded = computed(() => climateData.csvLoaded.value);
const climateDebugErrors = computed(() => {
  if (climateData.error.value) return climateData.error.value;
  if (!climateData.validationErrors.value.length) return "none";

  return climateData.validationErrors.value
    .map((errorItem) => errorItem.message)
    .join(" | ");
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
  completedSummerStepIds.value = [];
  isSummerFeedbackInterlude.value = false;
  summerFeedbackInterludeBeat.value = 1;
  summerFeedbackInterludeText.value = "";
  summerRetryPreviewFeedbackText.value = "";
  summerSequenceIntroStep.value = 0;
  sequenceEvaluationHandledKey.value = "";
};

const resetAutumnSequenceState = () => {
  clearAutumnSequenceTimers();
  clearVisibleAutumnMeasureFeedback();
  autumnSequencePhase.value = "idle";
  currentAutumnValueIndex.value = 0;
  completedAutumnStepIds.value = [];
  isAutumnFeedbackInterlude.value = false;
  autumnFeedbackInterludeBeat.value = 1;
  autumnFeedbackInterludeText.value = "";
  autumnRetryPreviewFeedbackText.value = "";
  autumnSequenceIntroStep.value = 0;
  autumnSequenceEvaluationHandledKey.value = "";
};

const resetSpringSequenceState = () => {
  clearSpringSequenceTimers();
  clearVisibleSpringMeasureFeedback();
  springSequencePhase.value = "idle";
  currentSpringValueIndex.value = 0;
  completedSpringStepIds.value = [];
  isSpringFeedbackInterlude.value = false;
  springFeedbackInterludeBeat.value = 1;
  springFeedbackInterludeText.value = "";
  springRetryPreviewFeedbackText.value = "";
  springSequenceIntroStep.value = 0;
  springSequenceEvaluationHandledKey.value = "";
};

const resetWinterSequenceState = () => {
  clearWinterSequenceTimers();
  clearVisibleWinterMeasureFeedback();
  winterSequencePhase.value = "idle";
  currentWinterValueIndex.value = 0;
  completedWinterStepIds.value = [];
  isWinterFeedbackInterlude.value = false;
  winterFeedbackInterludeBeat.value = 1;
  winterFeedbackInterludeText.value = "";
  winterRetryPreviewFeedbackText.value = "";
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

const stopFeedbackInterlude = () => {
  if (summerFeedbackInterludeTimer) {
    clearInterval(summerFeedbackInterludeTimer);
    summerFeedbackInterludeTimer = null;
  }

  isSummerFeedbackInterlude.value = false;
  summerFeedbackInterludeBeat.value = 1;
  summerFeedbackInterludeText.value = "";
};

const stopAutumnFeedbackInterlude = () => {
  if (autumnFeedbackInterludeTimer) {
    clearInterval(autumnFeedbackInterludeTimer);
    autumnFeedbackInterludeTimer = null;
  }

  isAutumnFeedbackInterlude.value = false;
  autumnFeedbackInterludeBeat.value = 1;
  autumnFeedbackInterludeText.value = "";
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

const stopWinterFeedbackInterlude = () => {
  if (winterFeedbackInterludeTimer) {
    clearInterval(winterFeedbackInterludeTimer);
    winterFeedbackInterludeTimer = null;
  }

  isWinterFeedbackInterlude.value = false;
  winterFeedbackInterludeBeat.value = 1;
  winterFeedbackInterludeText.value = "";
};

const clearAct5FlowAdvanceTimer = () => {
  if (!act5FlowAdvanceTimer) return;

  clearTimeout(act5FlowAdvanceTimer);
  act5FlowAdvanceTimer = null;
};

const getAct5RecognitionRules = (target: Act5SequenceTarget) => ({
  measuresPerValue: Math.max(target.rules.measuresPerStep - 1, 1),
  requiredSuccessfulMeasures: target.rules.requiredSuccessfulMeasures,
});

const startAct5RecognitionForTarget = (
  target: Act5SequenceTarget,
  keepCalibration = false,
  manual = false,
) => {
  const rules = getAct5RecognitionRules(target);

  if (target.season === "summer") {
    summerRecognition.start({
      intensity: String(target.movementValue) as SummerIntensity,
      keepCalibration,
      manual,
      rules,
    });
  }
  if (target.season === "autumn") {
    autumnRecognition.start({
      valueClass: String(target.movementValue) as AutumnValueClass,
      rules,
    });
  }
  if (target.season === "spring") {
    springRecognition.start({
      value: String(target.movementValue) as SpringValue,
      rules,
    });
  }
  if (target.season === "winter") {
    winterRecognition.start({
      value: String(target.movementValue) as WinterValue,
      rules,
    });
  }
};

const buildAct5TargetsCycleConfig = (
  targets: Act5SequenceTarget[],
): SeasonalCycleConfig => ({
  ...act5IntroCycleConfig,
  seasons: targets.map((target) => getSeasonConfig(target.season)),
  seasonDurationMs:
    act5IntroCycleConfig.repetitionCount * act5IntroCycleConfig.barDurationMs,
  repetitionCount: act5IntroCycleConfig.repetitionCount,
  countdownDurationMs: act5IntroCycleConfig.countdownDurationMs,
  seasonalAudioEnabled: true,
});

const setAct5PhaseForTarget = (target: Act5SequenceTarget | null) => {
  if (!target) {
    activeAct5Phase.value = "idle";
    return;
  }

  if (target.context === "tutorial") {
    activeAct5Phase.value = "tutorial";
    return;
  }

  activeAct5Phase.value = "climateStory";
};

const clearAct5VisibleMeasureFeedback = () => {
  clearVisibleSummerMeasureFeedback();
  clearVisibleAutumnMeasureFeedback();
  clearVisibleSpringMeasureFeedback();
  clearVisibleWinterMeasureFeedback();
};

const startAct5TargetRecognition = (
  targetIndex: number,
  {
    keepCalibration = true,
    manual = false,
  }: {
    keepCalibration?: boolean;
    manual?: boolean;
  } = {},
) => {
  clearAct5FlowAdvanceTimer();

  const target = activeAct5Targets.value[targetIndex] ?? null;

  if (!target) {
    completeAct5Flow();
    return;
  }

  activeAct5TargetIndex.value = targetIndex;
  activeAct5PreviewTarget.value = null;
  activeAct5PreviewTargetIndex.value = null;
  activeAct5SequenceStatus.value = "performing";
  activeAct5AttemptNumber.value++;
  handledAct5TargetEvaluationKey.value = "";
  setAct5PhaseForTarget(target);
  stopAct5FeedbackInterlude();
  clearAct5VisibleMeasureFeedback();
  resetSkeletonFeedback({ clearHandledEvents: false });
  startAct5RecognitionForTarget(target, keepCalibration, manual);
};

const stopAct5FeedbackInterlude = () => {
  stopFeedbackInterlude();
  stopAutumnFeedbackInterlude();
  stopSpringFeedbackInterlude();
  stopWinterFeedbackInterlude();
};

const resetAct5FlowState = () => {
  clearAct5FlowAdvanceTimer();
  activeAct5FlowId.value = null;
  activeAct5Phase.value = "idle";
  activeAct5Targets.value = [];
  activeAct5TargetIndex.value = 0;
  activeAct5PreviewTarget.value = null;
  activeAct5PreviewTargetIndex.value = null;
  activeAct5SequenceStatus.value = "idle";
  activeAct5AttemptNumber.value = 0;
  handledAct5TargetEvaluationKey.value = "";
  act5FlowCompleted.value = false;
  act5RetryPreviewFeedbackText.value = "";
  stopAct5FeedbackInterlude();
  resetSkeletonBeatFeedbackState();
};

const getAct5InterludeFeedbackText = (season: ClimateSeason) => {
  if (season === "summer") return getInterludeFeedbackText();
  if (season === "autumn") return getAutumnInterludeFeedbackText();
  if (season === "spring") return getSpringInterludeFeedbackText();

  return getWinterInterludeFeedbackText();
};

const completeAct5Flow = () => {
  clearAct5FlowAdvanceTimer();
  activeAct5PreviewTarget.value = null;
  activeAct5PreviewTargetIndex.value = null;
  activeAct5SequenceStatus.value = "completed";
  activeAct5Phase.value = "completed";
  act5FlowCompleted.value = true;
  act5RetryPreviewFeedbackText.value = "";
  clearAct5VisibleMeasureFeedback();
  stopAct5FeedbackInterlude();

  if (
    activeAct5FlowId.value === "act5Full" ||
    activeAct5FlowId.value === "act5Story"
  ) {
    runtimeStore.completeAct();
  }
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
  resetSkeletonFeedback({ clearHandledEvents: false });
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
  resetSkeletonFeedback({ clearHandledEvents: false });
  autumnRecognition.start({ valueClass: currentAutumnValue.value });
  autumnSequencePhase.value = "performing";
};

const startCurrentSpringValueRecognition = () => {
  stopSpringFeedbackInterlude();
  clearVisibleSpringMeasureFeedback();
  springSequenceEvaluationHandledKey.value = "";
  resetSkeletonFeedback({ clearHandledEvents: false });
  springRecognition.start({ value: currentSpringValue.value });
  springSequencePhase.value = "performing";
};

const startCurrentWinterValueRecognition = () => {
  stopWinterFeedbackInterlude();
  clearVisibleWinterMeasureFeedback();
  winterSequenceEvaluationHandledKey.value = "";
  resetSkeletonFeedback({ clearHandledEvents: false });
  winterRecognition.start({ value: currentWinterValue.value });
  winterSequencePhase.value = "performing";
};

const markCurrentIntensityComplete = () => {
  const stepId = currentSummerStep.value?.id;

  if (!stepId || completedSummerStepIds.value.includes(stepId)) {
    return;
  }

  completedSummerStepIds.value = [...completedSummerStepIds.value, stepId];
};

const markCurrentAutumnValueComplete = () => {
  const stepId = currentAutumnStep.value?.id;

  if (!stepId || completedAutumnStepIds.value.includes(stepId)) {
    return;
  }

  completedAutumnStepIds.value = [...completedAutumnStepIds.value, stepId];
};

const markCurrentSpringValueComplete = () => {
  const stepId = currentSpringStep.value?.id;

  if (!stepId || completedSpringStepIds.value.includes(stepId)) {
    return;
  }

  completedSpringStepIds.value = [...completedSpringStepIds.value, stepId];
};

const markCurrentWinterValueComplete = () => {
  const stepId = currentWinterStep.value?.id;

  if (!stepId || completedWinterStepIds.value.includes(stepId)) {
    return;
  }

  completedWinterStepIds.value = [...completedWinterStepIds.value, stepId];
};

const handleSummerSequenceEvaluation = () => {
  const evaluation = summerRecognition.sequenceEvaluation.value;

  if (!evaluation || summerTestMode.value !== "intensitySequence") return;

  const handledKey = `${currentSummerStep.value?.id ?? "none"}-${summerRecognition.retryCount.value}-${evaluation.resultState}`;

  if (sequenceEvaluationHandledKey.value === handledKey) return;

  sequenceEvaluationHandledKey.value = handledKey;

  if (evaluation.passed) {
    markCurrentIntensityComplete();

    if (!nextSummerStep.value) {
      summerRetryPreviewFeedbackText.value = "";
      summerSequencePhase.value = "completed";
      return;
    }

    summerSequencePhase.value = "transitioningToNextIntensity";
    queueSeasonRestart("summer", false, () => {
      summerRetryPreviewFeedbackText.value = "";
      currentSummerIntensityIndex.value += 1;
      startCurrentSummerIntensityRecognition({ keepCalibration: true });
    });
    return;
  }

  summerSequencePhase.value = "evaluatingIntensity";
  const retryFeedbackText = getInterludeFeedbackText();

  queueSeasonRestart("summer", false, () => {
    summerRetryPreviewFeedbackText.value = retryFeedbackText;
    summerRecognition.markRetryConsumed();
    startCurrentSummerIntensityRecognition({ keepCalibration: true });
  });
};

const handleAutumnSequenceEvaluation = () => {
  const evaluation = autumnRecognition.sequenceEvaluation.value;

  if (!evaluation || autumnTestMode.value !== "valueSequence") return;

  const handledKey = `${currentAutumnStep.value?.id ?? "none"}-${evaluation.resultState}-${evaluation.totalScore.toFixed(1)}`;

  if (autumnSequenceEvaluationHandledKey.value === handledKey) return;

  autumnSequenceEvaluationHandledKey.value = handledKey;

  if (evaluation.passed) {
    markCurrentAutumnValueComplete();

    if (!nextAutumnStep.value) {
      autumnRetryPreviewFeedbackText.value = "";
      autumnSequencePhase.value = "completed";
      return;
    }

    autumnSequencePhase.value = "transitioningToNextIntensity";
    queueSeasonRestart("autumn", false, () => {
      autumnRetryPreviewFeedbackText.value = "";
      currentAutumnValueIndex.value += 1;
      startCurrentAutumnValueRecognition();
    });
    return;
  }

  autumnSequencePhase.value = "evaluatingIntensity";
  const retryFeedbackText = getAutumnInterludeFeedbackText();

  queueSeasonRestart("autumn", false, () => {
    autumnRetryPreviewFeedbackText.value = retryFeedbackText;
    startCurrentAutumnValueRecognition();
  });
};

const handleSpringSequenceEvaluation = () => {
  const evaluation = springRecognition.sequenceEvaluation.value;

  if (!evaluation || springTestMode.value !== "valueSequence") return;

  const handledKey = `${currentSpringStep.value?.id ?? "none"}-${evaluation.resultState}-${evaluation.totalScore.toFixed(1)}`;

  if (springSequenceEvaluationHandledKey.value === handledKey) return;

  springSequenceEvaluationHandledKey.value = handledKey;

  if (evaluation.passed) {
    markCurrentSpringValueComplete();

    if (!nextSpringStep.value) {
      springRetryPreviewFeedbackText.value = "";
      springSequencePhase.value = "completed";
      return;
    }

    springSequencePhase.value = "transitioningToNextIntensity";
    queueSeasonRestart("spring", false, () => {
      springRetryPreviewFeedbackText.value = "";
      currentSpringValueIndex.value += 1;
      startCurrentSpringValueRecognition();
    });
    return;
  }

  springSequencePhase.value = "evaluatingIntensity";
  const retryFeedbackText = getSpringInterludeFeedbackText();

  queueSeasonRestart("spring", false, () => {
    springRetryPreviewFeedbackText.value = retryFeedbackText;
    startCurrentSpringValueRecognition();
  });
};

const handleWinterSequenceEvaluation = () => {
  const evaluation = winterRecognition.sequenceEvaluation.value;

  if (!evaluation || winterTestMode.value !== "valueSequence") return;

  const handledKey = `${currentWinterStep.value?.id ?? "none"}-${evaluation.resultState}-${evaluation.totalScore.toFixed(1)}`;

  if (winterSequenceEvaluationHandledKey.value === handledKey) return;

  winterSequenceEvaluationHandledKey.value = handledKey;

  if (evaluation.passed) {
    markCurrentWinterValueComplete();

    if (!nextWinterStep.value) {
      winterRetryPreviewFeedbackText.value = "";
      winterSequencePhase.value = "completed";
      return;
    }

    winterSequencePhase.value = "transitioningToNextIntensity";
    queueSeasonRestart("winter", false, () => {
      winterRetryPreviewFeedbackText.value = "";
      currentWinterValueIndex.value += 1;
      startCurrentWinterValueRecognition();
    });
    return;
  }

  winterSequencePhase.value = "evaluatingIntensity";
  const retryFeedbackText = getWinterInterludeFeedbackText();

  queueSeasonRestart("winter", false, () => {
    winterRetryPreviewFeedbackText.value = retryFeedbackText;
    startCurrentWinterValueRecognition();
  });
};

const scheduleAct5SuccessTransition = () => {
  const nextTargetIndex = activeAct5TargetIndex.value + 1;
  const nextTarget = activeAct5Targets.value[nextTargetIndex] ?? null;

  if (nextTarget) {
    act5RetryPreviewFeedbackText.value = "";
    return;
  }

  queueSeasonIndexEndAction(activeAct5TargetIndex.value, () => {
    completeAct5Flow();
  });
};

const scheduleAct5Retry = (target: Act5SequenceTarget) => {
  const retryFeedbackText = getAct5InterludeFeedbackText(target.season);

  queueSeasonIndexRestart(activeAct5TargetIndex.value, false, () => {
    stopAct5FeedbackInterlude();
    act5RetryPreviewFeedbackText.value = retryFeedbackText;
    activeAct5SequenceStatus.value = "performing";
    startAct5TargetRecognition(activeAct5TargetIndex.value, {
      keepCalibration: true,
    });
  });
};

const handleAct5TargetEvaluation = ({
  target,
  passed,
  resultState,
  totalScore,
}: {
  target: Act5SequenceTarget;
  passed: boolean;
  resultState: string;
  totalScore: number;
}) => {
  if (!isAct5FinalFlowActive.value) return;
  if (activeAct5SequenceStatus.value !== "performing") return;
  if (activeAct5MovementStep.value?.id !== target.id) return;

  const handledKey = [
    target.id,
    activeAct5AttemptNumber.value,
    resultState,
    totalScore.toFixed(1),
  ].join("-");

  if (handledAct5TargetEvaluationKey.value === handledKey) return;

  handledAct5TargetEvaluationKey.value = handledKey;

  if (passed) {
    scheduleAct5SuccessTransition();
    return;
  }

  scheduleAct5Retry(target);
};

const ensureClimateDataReady = async () => {
  const loadedDataset = await climateData.loadClimateSeasonData();
  const hasValidationErrors = climateData.validationErrors.value.length > 0;

  if (!loadedDataset || hasValidationErrors) {
    climateDataUserError.value = t("story.acts.act5.climateData.loadError");

    if (isDebugMode.value) {
      console.error("[Act 5 Climate Data]", {
        sourcePath: climateData.sourcePath,
        error: climateData.error.value,
        validationErrors: climateData.validationErrors.value,
      });
    }

    return false;
  }

  climateDataUserError.value = "";
  return true;
};

const resetClimateDebugFlowState = () => {
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
};

const startAct5FinalFlow = async (
  flowId: Act5FlowId,
  targets: Act5SequenceTarget[],
) => {
  if (!(await ensureClimateDataReady())) return;

  if (!targets.length) {
    completeAct5Flow();
    return;
  }

  storyEngine.startAct(act.value.id);
  resetAct5FlowState();
  resetClimateDebugFlowState();
  await reset();

  activeAct5FlowId.value = flowId;
  activeAct5Targets.value = targets;
  activeAct5TargetIndex.value = 0;
  activeAct5AttemptNumber.value = 0;
  act5FlowCompleted.value = false;

  startAct5TargetRecognition(0, {
    keepCalibration: false,
    manual: true,
  });
  await startCustomCycle(buildAct5TargetsCycleConfig(targets), true);
};

const startAct5FullFlow = async () => {
  if (!(await ensureClimateDataReady())) return;

  const dataset = climateData.dataset.value;

  if (!dataset) return;

  await startAct5FinalFlow(
    climateMovementFlowRegistry.act5Full.id,
    buildAct5FullFlow(dataset),
  );
};

const startAct5WithoutTutorial = async () => {
  if (!(await ensureClimateDataReady())) return;

  const dataset = climateData.dataset.value;

  if (!dataset) return;

  await startAct5FinalFlow(
    climateMovementFlowRegistry.act5Story.id,
    buildAct5ClimateStoryFlow(dataset),
  );
};

const startAct5TutorialDebug = async () => {
  await startAct5FinalFlow(
    climateMovementFlowRegistry.act5TutorialDebug.id,
    buildAct5TutorialDebugFlow(),
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
  climateDataUserError.value = "";
  resetAct5FlowState();
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
  if (!(await ensureClimateDataReady())) return;

  resetAct5FlowState();
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
  if (!(await ensureClimateDataReady())) return;

  resetAct5FlowState();
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

  startCurrentSummerIntensityRecognition({
    manual: true,
    keepCalibration: false,
  });
  await startSingleSeason("summer");
};

const startAutumnSequence = async () => {
  if (!(await ensureClimateDataReady())) return;

  resetAct5FlowState();
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

  startCurrentAutumnValueRecognition();
  await startSingleSeason("autumn");
};

const startSpringSequence = async () => {
  if (!(await ensureClimateDataReady())) return;

  resetAct5FlowState();
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

  startCurrentSpringValueRecognition();
  await startSingleSeason("spring");
};

const startWinterSequence = async () => {
  if (!(await ensureClimateDataReady())) return;

  resetAct5FlowState();
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

  startCurrentWinterValueRecognition();
  await startSingleSeason("winter");
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

const triggerSkeletonPulseTest = () => {
  triggerBeatSuccess({
    evaluationId: `debug-skeleton-pulse-${Math.round(performance.now())}`,
    flowId: "debug",
    flowStepId: "debug-skeleton-pulse",
    measureIndex: 0,
    beatIndex: 1,
    result: "passed",
  });
};

const continueToNextAct = async () => {
  const nextActId = runtimeStore.currentAct?.nextActId;

  storyEngine.continueFromGate();

  if (!nextActId) return;

  await navigateTo(`/story/${nextActId}`);
};

onMounted(() => {
  storyEngine.startAct(act.value.id);
  void climateData.loadClimateSeasonData().then((loadedDataset) => {
    if (!loadedDataset) {
      climateDataUserError.value = t("story.acts.act5.climateData.loadError");
    }
  });
  void initialize();
});

watch(
  [
    poseLandmarks,
    playbackState,
    () => currentSeason.value.id,
    () => activeAct5DisplayTarget.value?.id,
    seasonElapsedMs,
    repetitionIndex,
    isTransition,
    isSeasonEvaluationEnabled,
    isSummerFeedbackInterlude,
    isAutumnFeedbackInterlude,
    isSpringFeedbackInterlude,
    isWinterFeedbackInterlude,
  ],
  () => {
    const recognitionSuppressed =
      activeAct5SequenceStatus.value === "feedbackInterlude";
    const recognitionPlaybackState = recognitionSuppressed
      ? "idle"
      : playbackState.value;
    const recognitionSeasonId = recognitionSuppressed
      ? "act5-preview"
      : (activeAct5Target.value?.season ?? currentSeason.value.id);
    const recognitionRepetitionIndex = recognitionSuppressed
      ? null
      : repetitionIndex.value;
    const recognitionIsTransition = recognitionSuppressed
      ? false
      : isTransition.value;

    summerRecognition.updateFrame({
      landmarks: poseLandmarks.value,
      playbackState: recognitionPlaybackState,
      seasonId: isSummerFeedbackInterlude.value
        ? "summer-feedback-interlude"
        : recognitionSeasonId,
      seasonElapsedMs: seasonElapsedMs.value,
      repetitionIndex: recognitionRepetitionIndex,
      isTransition: recognitionIsTransition,
      evaluationEnabled: isSeasonEvaluationEnabled.value,
    });
    autumnRecognition.updateFrame({
      landmarks: mirrorLandmarksHorizontally(poseLandmarks.value),
      playbackState: recognitionPlaybackState,
      seasonId: isAutumnFeedbackInterlude.value
        ? "autumn-feedback-interlude"
        : recognitionSeasonId,
      seasonElapsedMs: seasonElapsedMs.value,
      repetitionIndex: recognitionRepetitionIndex,
      isTransition: recognitionIsTransition,
      evaluationEnabled: isSeasonEvaluationEnabled.value,
    });
    springRecognition.updateFrame({
      landmarks: poseLandmarks.value,
      playbackState: recognitionPlaybackState,
      seasonId: isSpringFeedbackInterlude.value
        ? "spring-feedback-interlude"
        : recognitionSeasonId,
      seasonElapsedMs: seasonElapsedMs.value,
      repetitionIndex: recognitionRepetitionIndex,
      isTransition: recognitionIsTransition,
      evaluationEnabled: isSeasonEvaluationEnabled.value,
    });
    winterRecognition.updateFrame({
      landmarks: poseLandmarks.value,
      playbackState: recognitionPlaybackState,
      seasonId: isWinterFeedbackInterlude.value
        ? "winter-feedback-interlude"
        : recognitionSeasonId,
      seasonElapsedMs: seasonElapsedMs.value,
      repetitionIndex: recognitionRepetitionIndex,
      isTransition: recognitionIsTransition,
      evaluationEnabled: isSeasonEvaluationEnabled.value,
    });
  },
  { immediate: true },
);

watch(
  currentSeasonIndex,
  (nextIndex) => {
    if (!isAct5FinalFlowActive.value) return;
    if (activeAct5SequenceStatus.value !== "performing") return;
    if (nextIndex === activeAct5TargetIndex.value) return;

    const target = activeAct5Targets.value[nextIndex] ?? null;

    if (!target) return;

    startAct5TargetRecognition(nextIndex, {
      keepCalibration: true,
    });
  },
  { flush: "post" },
);

watch(
  () => summerRecognition.sequenceEvaluation.value,
  (evaluation) => {
    if (!evaluation) return;
    if (
      isAct5FinalFlowActive.value &&
      activeAct5MovementStep.value?.season === "summer"
    ) {
      handleAct5TargetEvaluation({
        target: activeAct5MovementStep.value,
        passed: evaluation.passed,
        resultState: evaluation.resultState,
        totalScore: evaluation.totalScore,
      });
      return;
    }
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
    if (
      isAct5FinalFlowActive.value &&
      activeAct5MovementStep.value?.season === "autumn"
    ) {
      handleAct5TargetEvaluation({
        target: activeAct5MovementStep.value,
        passed: evaluation.passed,
        resultState: evaluation.resultState,
        totalScore: evaluation.totalScore,
      });
      return;
    }
    if (autumnTestMode.value === "valueSequence") {
      handleAutumnSequenceEvaluation();
    }
  },
);

watch(
  () => springRecognition.sequenceEvaluation.value,
  (evaluation) => {
    if (!evaluation) return;
    if (
      isAct5FinalFlowActive.value &&
      activeAct5MovementStep.value?.season === "spring"
    ) {
      handleAct5TargetEvaluation({
        target: activeAct5MovementStep.value,
        passed: evaluation.passed,
        resultState: evaluation.resultState,
        totalScore: evaluation.totalScore,
      });
      return;
    }
    if (springTestMode.value === "valueSequence") {
      handleSpringSequenceEvaluation();
    }
  },
);

watch(
  () => winterRecognition.sequenceEvaluation.value,
  (evaluation) => {
    if (!evaluation) return;
    if (
      isAct5FinalFlowActive.value &&
      activeAct5MovementStep.value?.season === "winter"
    ) {
      handleAct5TargetEvaluation({
        target: activeAct5MovementStep.value,
        passed: evaluation.passed,
        resultState: evaluation.resultState,
        totalScore: evaluation.totalScore,
      });
      return;
    }
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
  [
    () => currentSeason.value.id,
    repetitionIndex,
    () => activeClimateStep.value?.id,
  ],
  ([seasonId, currentMeasureIndex, currentFlowStepId]) => {
    const summerFeedbackMeasureIndex =
      visibleSummerMeasureFeedback.value?.measureIndex ?? null;
    const summerFeedbackFlowStepId =
      visibleSummerMeasureFeedback.value?.flowStepId ?? null;
    const feedbackMeasureIndex =
      visibleAutumnMeasureFeedback.value?.measureIndex ?? null;
    const feedbackFlowStepId =
      visibleAutumnMeasureFeedback.value?.flowStepId ?? null;
    const springFeedbackMeasureIndex =
      visibleSpringMeasureFeedback.value?.measureIndex ?? null;
    const springFeedbackFlowStepId =
      visibleSpringMeasureFeedback.value?.flowStepId ?? null;
    const winterFeedbackMeasureIndex =
      visibleWinterMeasureFeedback.value?.measureIndex ?? null;
    const winterFeedbackFlowStepId =
      visibleWinterMeasureFeedback.value?.flowStepId ?? null;

    if (
      seasonId !== "summer" ||
      summerFeedbackMeasureIndex === null ||
      summerFeedbackMeasureIndex !== currentMeasureIndex ||
      summerFeedbackFlowStepId !== currentFlowStepId
    ) {
      clearVisibleSummerMeasureFeedback();
    }

    if (
      seasonId !== "autumn" ||
      feedbackMeasureIndex === null ||
      feedbackMeasureIndex !== currentMeasureIndex ||
      feedbackFlowStepId !== currentFlowStepId
    ) {
      clearVisibleAutumnMeasureFeedback();
    }

    if (
      seasonId !== "spring" ||
      springFeedbackMeasureIndex === null ||
      springFeedbackMeasureIndex !== currentMeasureIndex ||
      springFeedbackFlowStepId !== currentFlowStepId
    ) {
      clearVisibleSpringMeasureFeedback();
    }

    if (
      seasonId !== "winter" ||
      winterFeedbackMeasureIndex === null ||
      winterFeedbackMeasureIndex !== currentMeasureIndex ||
      winterFeedbackFlowStepId !== currentFlowStepId
    ) {
      clearVisibleWinterMeasureFeedback();
    }
  },
);

watch(
  [
    () => summerRecognition.finalizedBeatEvaluations.value,
    () => autumnRecognition.finalizedBeatEvaluations.value,
    () => springRecognition.finalizedBeatEvaluations.value,
    () => winterRecognition.finalizedBeatEvaluations.value,
  ],
  ([
    summerEvaluations,
    autumnEvaluations,
    springEvaluations,
    winterEvaluations,
  ]) => {
    processSkeletonBeatEvaluations("summer", summerEvaluations);
    processSkeletonBeatEvaluations("autumn", autumnEvaluations);
    processSkeletonBeatEvaluations("spring", springEvaluations);
    processSkeletonBeatEvaluations("winter", winterEvaluations);
  },
);

watch(
  [
    poseLandmarks,
    playbackState,
    () => activeSeasonId.value,
    () => activeAct5SequenceStatus.value,
    () => activeAct5MovementStep.value?.id,
    isTransition,
    repetitionIndex,
    isSummerFeedbackInterlude,
    isAutumnFeedbackInterlude,
    isSpringFeedbackInterlude,
    isWinterFeedbackInterlude,
    () => summerRecognition.currentEvaluation.value,
    () => autumnRecognition.currentEvaluation.value,
    () => springRecognition.currentEvaluation.value,
    () => winterRecognition.currentEvaluation.value,
  ],
  () => {
    if (!isSkeletonBeatFeedbackAllowed(activeSeasonId.value)) {
      setTrackingLimited(false);
      return;
    }

    if (!poseLandmarks.value?.length) {
      setTrackingLimited(true);
      return;
    }

    setTrackingLimited(
      getActiveSkeletonEvaluation()?.trackingUnavailable === true,
    );
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
  resetAct5FlowState();
  clearSummerSequenceTimers();
  clearAutumnSequenceTimers();
  clearSpringSequenceTimers();
  clearWinterSequenceTimers();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();
  resetSkeletonBeatFeedbackState();
  cleanup();
  storyEngine.stopStoryEngine();
});
</script>

<style scoped>
.climate-act-page {
  --climate-act-bottom-bar-height: clamp(64px, 8dvh, 84px);
  --climate-act-comparison-size: 25vw;
  --climate-act-clock-size: clamp(300px, 32vw, 430px);
  --act5-season-background: #edf2ef;
  --act5-season-surface: #f4f8f5;

  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-columns: 50% 50%;
  overflow: hidden;
  background: var(--act5-season-background);
  transition: background 500ms ease;
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
      rgba(255, 255, 255, 0.68)
    ),
    var(--act5-season-background);
  color: #26382f;
  transition: background 500ms ease;
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

.climate-act-context .climate-interval-info + :deep(.season-clock),
.climate-act-season-clock {
  width: min(var(--climate-act-clock-size), 300px);
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
      rgba(255, 255, 255, 0.74)
    ),
    var(--act5-season-background);
  transition: background 500ms ease;
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
      rgba(255, 255, 255, 0.78)
    ),
    var(--act5-season-surface);
  color: #26382f;
  transition: background 500ms ease;
}

.climate-act-info__eyebrow {
  margin: 0;
  color: rgba(31, 49, 39, 0.58);
  font-size: clamp(1.15rem, 1.7vw, 1.7rem);
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

.climate-act-info__cue--neutral {
  color: #26382f;
}

.climate-act-info__cue--excellent,
.climate-act-info__cue--success {
  color: #237245;
}

.climate-act-info__cue--error {
  color: #b42b2b;
}

.climate-act-info__cue--warning {
  color: #9b6a16;
}

.climate-act-info__secondary {
  width: min(100%, 760px);
  margin: 0;
  color: rgba(31, 49, 39, 0.62);
  font-size: clamp(1rem, 1.5vw, 1.35rem);
  font-weight: 800;
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
