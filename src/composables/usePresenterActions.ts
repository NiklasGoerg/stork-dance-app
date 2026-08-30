import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from "vue";

export type PresenterAction = "pageUp" | "pageDown";

type PresenterActionsOptions = {
  enabled: MaybeRefOrGetter<boolean>;
  onPageUp?: () => void;
  onPageDown?: () => void;
};

export const getPresenterActionForKey = (
  key: string,
): PresenterAction | null => {
  // Presenter invariant: PageUp activates Back/Previous, PageDown activates Continue/Next.
  if (key === "PageUp") return "pageUp";
  if (key === "PageDown") return "pageDown";
  return null;
};

export const isPresenterEditableTarget = (target: EventTarget | null) => {
  const element = target as {
    isContentEditable?: boolean;
    tagName?: string;
  } | null;

  if (!element) return false;
  if (element.isContentEditable) return true;

  const tagName = element.tagName?.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
};

export const getPresenterActionForEvent = (
  event: Pick<KeyboardEvent, "key" | "repeat" | "target">,
  enabled: boolean,
) => {
  if (!enabled || event.repeat) return null;
  if (isPresenterEditableTarget(event.target)) return null;

  return getPresenterActionForKey(event.key);
};

export const usePresenterActions = ({
  enabled,
  onPageUp,
  onPageDown,
}: PresenterActionsOptions) => {
  if (typeof window === "undefined") return;

  const handleKeydown = (event: KeyboardEvent) => {
    const action = getPresenterActionForEvent(event, toValue(enabled));
    if (!action) return;

    event.preventDefault();

    if (action === "pageUp") onPageUp?.();
    if (action === "pageDown") onPageDown?.();
  };

  const stop = watch(
    () => toValue(enabled),
    (isEnabled) => {
      if (isEnabled) window.addEventListener("keydown", handleKeydown);
      else window.removeEventListener("keydown", handleKeydown);
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    stop();
    window.removeEventListener("keydown", handleKeydown);
  });
};
