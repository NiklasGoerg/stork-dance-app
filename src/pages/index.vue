<template>
  <main class="home-page">
    <nav class="home-nav" aria-label="Prototype navigation">
      <NuxtLink to="/story/prologue">Prologue</NuxtLink>
      <NuxtLink to="/story/act-2">Act 2</NuxtLink>
      <NuxtLink to="/story/act-3">Act 3</NuxtLink>
      <NuxtLink to="/story/act-4">Act 4</NuxtLink>
      <NuxtLink to="/story/act-5">Act 5</NuxtLink>
      <NuxtLink to="/story/epilogue">Epilogue</NuxtLink>
      <NuxtLink to="/story/stage">Story Stage Test</NuxtLink>
      <NuxtLink to="/record">Record</NuxtLink>
      <NuxtLink to="/movement-camera-test">Movement Camera Test</NuxtLink>
    </nav>

    <section class="home-hero" aria-labelledby="home-title">
      <p class="home-eyebrow">Data Dance</p>
      <h1 id="home-title">Data Storytelling with Embodiment and Emotions</h1>
      <NuxtLink class="start-link" to="/story/prologue">Start</NuxtLink>
    </section>
  </main>
</template>

<style scoped>
.home-page {
  position: relative;
  width: 100vw;
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 84px 24px 32px;
  background: #edf3ee;
  color: #17211b;
}

.home-page::before {
  position: absolute;
  inset: 0;
  background-image: url("~/assets/images/stork_stock.jpeg");
  background-position: left center;
  background-repeat: no-repeat;
  background-size: auto 100%;
  content: "";
}

.home-page::after {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      90deg,
      rgba(237, 243, 238, 0.14),
      rgba(237, 243, 238, 0.68) 48%,
      rgba(237, 243, 238, 0.94)
    ),
    linear-gradient(180deg, rgba(247, 250, 246, 0.34), rgba(226, 236, 228, 0.5));
  content: "";
}

.home-nav {
  position: fixed;
  top: 18px;
  left: 50%;
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  width: min(920px, calc(100vw - 32px));
  padding: 8px;
  border: 1px solid rgba(30, 48, 38, 0.14);
  border-radius: 8px;
  background: rgba(250, 252, 249, 0.78);
  backdrop-filter: blur(12px);
  transform: translateX(-50%);
}

.home-nav a {
  padding: 5px 9px;
  border-radius: 6px;
  color: rgba(28, 43, 34, 0.72);
  font-size: 0.82rem;
  font-weight: 650;
  text-decoration: none;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

.home-nav a:hover,
.home-nav a:focus-visible {
  background: #26382f;
  color: #ffffff;
  outline: none;
}

.home-hero {
  position: relative;
  z-index: 1;
  width: min(720px, 100%);
  display: grid;
  justify-items: center;
  gap: 22px;
  text-align: center;
}

.home-eyebrow {
  margin: 0;
  color: rgba(30, 48, 38, 0.68);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.home-hero h1 {
  max-width: 660px;
  margin: 0;
  font-size: clamp(2.15rem, 6vw, 4.8rem);
  line-height: 1.02;
  font-weight: 760;
}

.start-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 180px;
  min-height: 58px;
  padding: 14px 34px;
  border-radius: 8px;
  background: #26382f;
  color: #ffffff;
  font-size: 1.18rem;
  font-weight: 750;
  text-decoration: none;
  box-shadow: 0 14px 36px rgba(24, 38, 30, 0.18);
  transition:
    background 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.start-link:hover,
.start-link:focus-visible {
  background: #18251f;
  box-shadow: 0 18px 44px rgba(24, 38, 30, 0.22);
  outline: none;
  transform: translateY(-1px);
}

@media (max-width: 760px) {
  .home-page {
    padding-top: 124px;
  }

  .home-nav {
    top: 10px;
  }
}
</style>
