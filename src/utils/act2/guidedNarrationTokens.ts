import type { StorkStoryCycleDefinition } from "~/types/stork";
import type { GuidedNarrationTokens } from "~/utils/act2/guidedNarrationCatalog";

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long" });

export const resolveGuidedNarrationTokens = (
  cycle: StorkStoryCycleDefinition | null | undefined,
): GuidedNarrationTokens => {
  const wintering =
    cycle?.wintering && cycle.wintering !== "Unknown" ? cycle.wintering : "";
  const departureDate = cycle?.events.breedingDeparture
    ? new Date(`${cycle.events.breedingDeparture}T00:00:00Z`)
    : null;

  return {
    breedingArea: "the summer breeding area in Germany",
    winteringArea: wintering || "",
    departureMonth:
      departureDate && !Number.isNaN(departureDate.getTime())
        ? monthFormatter.format(departureDate)
        : "",
    southboundRoute: "south across Europe toward the wintering area",
    northboundRoute: "back toward the breeding area",
  };
};
