<template>
  <main class="story-index-page">
    <section class="story-index-panel" aria-labelledby="story-index-title">
      <p class="story-index-eyebrow">Data Dance</p>
      <h1 id="story-index-title">Story Overview</h1>
      <nav class="story-links" aria-label="Story pages">
        <NuxtLink to="/story/prologue">Prologue</NuxtLink>
        <NuxtLink to="/story/act-2">Act 2</NuxtLink>
        <NuxtLink to="/story/act-3">Act 3</NuxtLink>
        <NuxtLink to="/story/act-4">Act 4</NuxtLink>
        <NuxtLink to="/story/act-5">Act 5</NuxtLink>
        <NuxtLink to="/story/epilogue">Epilogue</NuxtLink>
        <NuxtLink to="/story/stage">Story Stage Test</NuxtLink>
      </nav>
    </section>
  </main>
</template>

<style scoped>
.story-index-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #edf3ee;
  color: #17211b;
}

.story-index-panel {
  width: min(680px, 100%);
  display: grid;
  gap: 18px;
}

.story-index-eyebrow {
  margin: 0;
  color: rgba(30, 48, 38, 0.68);
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.story-index-panel h1 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.4rem);
  line-height: 1.05;
}

.story-links {
  display: grid;
  gap: 10px;
}

.story-links a {
  padding: 12px 14px;
  border: 1px solid rgba(30, 48, 38, 0.14);
  border-radius: 8px;
  background: rgba(250, 252, 249, 0.72);
  color: #26382f;
  font-weight: 650;
  text-decoration: none;
}

.story-links a:hover,
.story-links a:focus-visible {
  border-color: rgba(30, 48, 38, 0.3);
  background: #ffffff;
  outline: none;
}
</style>
