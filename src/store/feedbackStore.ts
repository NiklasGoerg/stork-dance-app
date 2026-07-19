import { defineStore } from "pinia";

export const useFeedbackStore = defineStore("feedback", {
  state: () => ({
    activeFeedbackIds: [] as string[],
    lastFeedbackId: null as string | null,
  }),
  actions: {
    showFeedback(feedbackId: string) {
      this.lastFeedbackId = feedbackId;

      if (this.activeFeedbackIds.includes(feedbackId)) return;

      this.activeFeedbackIds.push(feedbackId);
    },
    hideFeedback(feedbackId: string) {
      this.activeFeedbackIds = this.activeFeedbackIds.filter(
        (activeFeedbackId) => activeFeedbackId !== feedbackId,
      );
    },
    clearFeedback() {
      this.activeFeedbackIds = [];
      this.lastFeedbackId = null;
    },
  },
});
