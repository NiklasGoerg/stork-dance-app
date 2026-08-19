import { describe, expect, it } from "vitest";
import en from "~/locales/en.json";
import storyProgressSidebarSource from "~/components/story/StoryProgressSidebar.vue?raw";
import homePageSource from "~/pages/index.vue?raw";
import act3PageSource from "~/pages/story/act-3.vue?raw";
import act4PageSource from "~/pages/story/act-4.vue?raw";
import act4LegacyPageSource from "~/pages/story/act-5.vue?raw";
import act4LegacyCompactPageSource from "~/pages/story/act5.vue?raw";
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
});
