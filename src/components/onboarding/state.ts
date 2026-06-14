export const MIN_GENRES = 3;
export const MIN_LIKES = 10;

export type OnboardingStep = "genres" | "titles" | "finishing";

export interface OnboardingState {
  step: OnboardingStep;
  genres: Set<number>;
  likes: Set<string>;
  dislikes: Set<string>;
}

export type OnboardingAction =
  | { type: "toggleGenre"; id: number }
  | { type: "toggleLike"; key: string }
  | { type: "toggleDislike"; key: string }
  | { type: "setStep"; step: OnboardingStep };

export function initialState(): OnboardingState {
  return { step: "genres", genres: new Set(), likes: new Set(), dislikes: new Set() };
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case "toggleGenre":
      return { ...state, genres: toggle(state.genres, action.id) };
    case "toggleLike": {
      const dislikes = new Set(state.dislikes);
      dislikes.delete(action.key);
      return { ...state, likes: toggle(state.likes, action.key), dislikes };
    }
    case "toggleDislike": {
      const likes = new Set(state.likes);
      likes.delete(action.key);
      return { ...state, dislikes: toggle(state.dislikes, action.key), likes };
    }
    case "setStep":
      return { ...state, step: action.step };
  }
}

export function canProceed(state: OnboardingState): boolean {
  if (state.step === "genres") return state.genres.size >= MIN_GENRES;
  if (state.step === "titles") return state.likes.size >= MIN_LIKES;
  return false;
}
