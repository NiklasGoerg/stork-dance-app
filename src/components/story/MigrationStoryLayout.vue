<template>
  <main
    class="migration-layout"
    :class="`migration-layout--${season}`"
    :aria-label="stageAriaLabel"
  >
    <section class="migration-layout__map" :aria-label="mapAriaLabel">
      <slot name="map" />
    </section>

    <section class="migration-layout__workspace">
      <section class="migration-layout__cell migration-layout__cell--visual">
        <slot name="avatar" />
      </section>

      <section class="migration-layout__cell migration-layout__cell--visual">
        <slot name="camera" />
      </section>

      <section class="migration-layout__cell migration-layout__cell--clock">
        <slot name="clock" />
      </section>

      <section class="migration-layout__cell migration-layout__cell--guidance">
        <slot name="guidance" />
      </section>
    </section>

    <footer
      v-if="showControls && $slots.controls"
      class="migration-layout__controls"
      :aria-label="controlsAriaLabel"
    >
      <slot name="controls" />
    </footer>
  </main>
</template>

<script setup lang="ts">
import type { StorySeasonId } from "~/utils/storyCycle";

withDefaults(
  defineProps<{
    season: StorySeasonId;
    mapAriaLabel?: string;
    stageAriaLabel?: string;
    controlsAriaLabel?: string;
    showControls?: boolean;
  }>(),
  {
    mapAriaLabel: undefined,
    stageAriaLabel: undefined,
    controlsAriaLabel: undefined,
    showControls: true,
  },
);
</script>

<style scoped>
.migration-layout {
  --migration-season-background: var(--act5-season-transition-background);
  --migration-season-surface: var(--act5-season-transition-surface);

  width: 100vw;
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) auto;
  gap: var(--space-3);
  overflow: hidden;
  padding: var(--space-3);
  background: color-mix(
    in srgb,
    var(--migration-season-background) 28%,
    var(--migration-season-surface)
  );
  color: var(--act5-color-text);
  transition: background 400ms ease;
}

.migration-layout--winter {
  --migration-season-background: var(--act5-season-winter-background);
  --migration-season-surface: var(--act5-season-winter-surface);
}

.migration-layout--spring {
  --migration-season-background: var(--act5-season-spring-background);
  --migration-season-surface: var(--act5-season-spring-surface);
}

.migration-layout--summer {
  --migration-season-background: var(--act5-season-summer-background);
  --migration-season-surface: var(--act5-season-summer-surface);
}

.migration-layout--autumn {
  --migration-season-background: var(--act5-season-autumn-background);
  --migration-season-surface: var(--act5-season-autumn-surface);
}

.migration-layout__map,
.migration-layout__workspace,
.migration-layout__cell {
  min-width: 0;
  min-height: 0;
}

.migration-layout__map {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid var(--act5-color-border);
  border-radius: var(--radius-xl);
  background: #dce7dd;
  box-shadow: var(--act5-shadow-panel);
}

.migration-layout__workspace {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.migration-layout__cell {
  position: relative;
  overflow: hidden;
}

.migration-layout__cell--visual {
  background: #121714;
}

.migration-layout__cell--clock {
  display: grid;
  place-items: center;
  padding: var(--space-2);
  border: 1px solid var(--act5-color-border);
  border-radius: var(--radius-md);
  background: color-mix(
    in srgb,
    var(--migration-season-surface) 24%,
    var(--act5-color-card)
  );
}

.migration-layout__cell--guidance {
  overflow: auto;
  padding: var(--space-5);
  border: 1px solid var(--act5-color-border);
  border-radius: var(--radius-md);
  background: var(--act5-color-card);
}

.migration-layout__controls {
  grid-column: 1 / -1;
  min-width: 0;
  min-height: 52px;
  padding: 7px var(--space-3);
  border: 1px solid var(--act5-color-border);
  border-radius: var(--radius-md);
  background: rgba(248, 251, 247, 0.96);
  box-shadow: var(--act5-shadow-bottom-bar);
  backdrop-filter: blur(12px);
}

@media (max-width: 1100px) {
  .migration-layout {
    gap: var(--space-2);
    padding: var(--space-2);
  }
}

@media (max-width: 860px) {
  .migration-layout {
    height: auto;
    min-height: 100dvh;
    grid-template-columns: 1fr;
    grid-template-rows: minmax(460px, 62dvh) minmax(720px, auto) auto;
    overflow: visible;
  }

  .migration-layout__workspace {
    grid-template-rows: repeat(2, minmax(330px, 1fr));
  }

  .migration-layout__controls {
    grid-column: 1;
  }
}

@media (max-width: 560px) {
  .migration-layout__workspace {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(4, minmax(300px, auto));
  }
}
</style>
