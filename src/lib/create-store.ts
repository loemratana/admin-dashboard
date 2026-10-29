import { useSyncExternalStore } from "react";

// A minimal in-memory store. It stands in for a backend while the app is
// frontend-only: state survives client-side navigation but resets on reload.
export type Store<T> = {
  getState: () => T;
  setState: (update: (current: T) => T) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<T>(initialState: T): Store<T> {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: (update) => {
      state = update(state);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  // The server snapshot is the seed state, so server and client render the same markup.
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
