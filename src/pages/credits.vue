<template>
  <main class="credits-page">
    <nav class="credits-nav" aria-label="Credits navigation">
      <NuxtLink class="credits-nav__link" to="/"> Back to Start </NuxtLink>
    </nav>

    <article class="credits-shell" aria-labelledby="credits-title">
      <header class="credits-header">
        <p class="credits-eyebrow">Migration in Motion</p>
        <h1 id="credits-title">Credits &amp; Sources</h1>
      </header>

      <section class="credits-section" aria-labelledby="credits-project">
        <h2 id="credits-project">Project</h2>
        <div class="credits-copy">
          <p>
            <strong>Migration in Motion</strong>
          </p>
          <p>
            Research prototype developed as part of the Master's thesis "Data
            Dance: Data Storytelling with Embodiment and Emotions" at TU
            Dresden, Interactive Media Lab Dresden.
          </p>
          <p>
            Concept, implementation, data preparation, narrative design, and
            visualisations: Niklas G&ouml;rg.
          </p>
          <p>
            Movement vocabulary: developed by Niklas G&ouml;rg with input from
            two anonymised Movement Co-Design participants.
          </p>
        </div>
      </section>

      <section class="credits-section" aria-labelledby="credits-data">
        <h2 id="credits-data">Data Sources</h2>
        <div class="credits-copy">
          <h3>White stork migration data</h3>
          <p>
            GPS tracking data are based on datasets from the Movebank Data
            Repository.
          </p>
          <p>
            The migration cycles used in the final data story originate from:
          </p>
          <ul>
            <li>
              LifeTrack White Stork &ndash; South-West Germany (2013&ndash;2023)
            </li>
            <li>LifeTrack White Stork &ndash; Bavaria (2014&ndash;2023)</li>
          </ul>
          <p>
            The original tracking data were processed, reduced, analysed, and
            curated for the prototype by Niklas G&ouml;rg.
          </p>

          <h3>Seasonal temperature data</h3>
          <p>
            Seasonal mean air temperature data for Germany were obtained through
            the UBA Data Cube. The underlying data originate from the German
            Weather Service (Deutscher Wetterdienst, DWD).
          </p>
          <p>
            The data were aggregated and prepared for the prototype by Niklas
            G&ouml;rg.
          </p>
        </div>
      </section>

      <section class="credits-section" aria-labelledby="credits-map">
        <h2 id="credits-map">Map</h2>
        <div class="credits-copy">
          <p>
            Map data and tiles:
            <a
              href="https://www.openstreetmap.org/copyright"
              rel="noopener noreferrer"
              target="_blank"
            >
              &copy; OpenStreetMap contributors </a
            >.
          </p>
          <p>Map visualisation implemented using Leaflet.</p>
        </div>
      </section>

      <section class="credits-section" aria-labelledby="credits-visuals">
        <h2 id="credits-visuals">Visual Assets</h2>
        <div class="credits-copy">
          <h3>Adobe Stock</h3>
          <p>
            "Fliegender Storch" by by-studio, Adobe Stock Asset #252251377. Used
            under the Adobe Stock Standard License.
          </p>

          <h3>Adobe Firefly</h3>
          <p>
            Three small white stork illustrations used as visual assets in the
            migration sections were generated using Adobe Firefly.
          </p>
          <p>
            All remaining custom interface graphics and data visualisations were
            created as part of the thesis by Niklas G&ouml;rg unless otherwise
            noted.
          </p>
        </div>
      </section>

      <section class="credits-section" aria-labelledby="credits-audio">
        <h2 id="credits-audio">Audio</h2>
        <div class="credits-copy">
          <h3>Seasonal music</h3>
          <p>
            Instrumental source material for the four seasonal music themes was
            generated using Suno AI.
          </p>
          <p>
            Suitable sections were subsequently selected, edited,
            tempo-adjusted, and prepared as loops by Niklas G&ouml;rg in FL
            Studio.
          </p>

          <h3>Base rhythm</h3>
          <p>
            The 60 BPM base rhythm used throughout the movement sections was
            created by Niklas G&ouml;rg in FL Studio without Generative AI.
          </p>
        </div>
      </section>
    </article>
  </main>
</template>

<style scoped>
.credits-page {
  min-height: 100vh;
  min-height: 100dvh;
  overflow-y: auto;
  padding: 28px 24px 56px;
  background:
    linear-gradient(
      180deg,
      rgba(255, 253, 246, 0.86),
      rgba(237, 243, 238, 0.96)
    ),
    #edf3ee;
  color: #17211b;
}

.credits-nav {
  width: min(920px, 100%);
  margin: 0 auto 28px;
  display: flex;
}

.credits-nav__link {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 8px 14px;
  border: 1px solid rgba(30, 48, 38, 0.14);
  border-radius: 8px;
  background: rgba(250, 252, 249, 0.78);
  color: #26382f;
  font-size: 0.92rem;
  font-weight: 650;
  text-decoration: none;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

.credits-nav__link:hover,
.credits-nav__link:focus-visible {
  border-color: rgba(30, 48, 38, 0.28);
  background: #26382f;
  color: #ffffff;
  outline: none;
}

.credits-shell {
  width: min(920px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 18px;
}

.credits-header {
  display: grid;
  gap: 8px;
  padding: 0 2px 10px;
}

.credits-eyebrow {
  margin: 0;
  color: rgba(30, 48, 38, 0.68);
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.credits-header h1 {
  margin: 0;
  color: #17211b;
  font-size: clamp(2rem, 5vw, 3.5rem);
  line-height: 1.05;
  font-weight: 760;
}

.credits-section {
  display: grid;
  grid-template-columns: minmax(160px, 0.32fr) minmax(0, 1fr);
  gap: 26px;
  padding: 24px 26px;
  border: 1px solid rgba(30, 48, 38, 0.12);
  border-radius: 8px;
  background: rgba(250, 252, 249, 0.78);
  box-shadow: 0 12px 32px rgba(24, 38, 30, 0.08);
}

.credits-section h2,
.credits-section h3,
.credits-copy p,
.credits-copy ul {
  margin: 0;
}

.credits-section h2 {
  color: rgba(30, 48, 38, 0.72);
  font-size: 0.88rem;
  font-weight: 760;
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
}

.credits-copy {
  display: grid;
  gap: 12px;
  color: #26382f;
  font-size: 1rem;
  line-height: 1.62;
}

.credits-copy h3 {
  padding-top: 6px;
  color: #17211b;
  font-size: 1.06rem;
  line-height: 1.3;
}

.credits-copy h3:first-child {
  padding-top: 0;
}

.credits-copy strong {
  font-weight: 760;
}

.credits-copy ul {
  padding-left: 1.2rem;
}

.credits-copy a {
  color: #1e5f48;
  font-weight: 650;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.credits-copy a:hover,
.credits-copy a:focus-visible {
  color: #17211b;
  outline: none;
}

@media (max-width: 760px) {
  .credits-page {
    padding: 18px 14px 38px;
  }

  .credits-nav {
    margin-bottom: 20px;
  }

  .credits-section {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 20px 18px;
  }
}
</style>
