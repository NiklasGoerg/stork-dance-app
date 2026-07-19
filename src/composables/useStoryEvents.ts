import type { StoryEvent } from "~/story/types";

type StoryEventHandler = (event: StoryEvent) => void;

const storyEventHandlers = new Set<StoryEventHandler>();

export const useStoryEvents = () => {
  const emitStoryEvent = (event: StoryEvent) => {
    storyEventHandlers.forEach((handler) => handler(event));
  };

  const onStoryEvent = (handler: StoryEventHandler) => {
    storyEventHandlers.add(handler);

    return () => {
      storyEventHandlers.delete(handler);
    };
  };

  return {
    emitStoryEvent,
    onStoryEvent,
  };
};
