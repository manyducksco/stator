import {
  createContext,
  createElement,
  useContext,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

const EMPTY: unique symbol = Symbol();

export interface StoreProviderProps<Options> {
  options?: Options;
  children: React.ReactNode;
}

export interface StoreProviderPropsWithOptions<
  Options,
> extends StoreProviderProps<Options> {
  options: Options;
}

/**
 * Provides a single instance of a store to all its children.
 */
export type StoreProvider<Options> = React.ComponentType<
  StoreProviderProps<Options>
>;

/**
 * Provides a single instance of a store to all its children.
 * Store options are passed as props.
 */
export type StoreProviderWithOptions<Options> = React.ComponentType<
  StoreProviderPropsWithOptions<Options>
>;

/**
 * Plucks only the parts of the state this component cares about.
 */
export type Selector<Value, Selected> = (value: Value) => Selected;

/**
 * Accesses the nearest parent instance of a store.
 */
export interface StoreHook<Value> {
  (): Value;
  <Selected>(select: Selector<Value, Selected>): Selected;
}

class Store<T> {
  public value: T;
  private listeners = new Set<() => void>();

  constructor(value: T) {
    this.value = value;
  }

  update(value: T) {
    this.value = value;
  }

  notify() {
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get = () => this.value;
}

/**
 * Defines a new store, returning its provider and hook.
 */
export function createStore<Value>(
  fn: () => Value,
): [StoreProvider<undefined>, StoreHook<Value>];

/**
 * Defines a new store, returning its provider and hook.
 */
export function createStore<Value, Options>(
  fn: (options: Options) => Value,
): [StoreProviderWithOptions<Options>, StoreHook<Value>];

/**
 * Defines a new store, returning its provider and hook.
 */
export function createStore<Value, Options>(
  fn: (options?: Options) => Value,
): [StoreProviderWithOptions<Options | undefined>, StoreHook<Value>];

export function createStore<Value, Options>(
  fn: (options?: Options) => Value,
):
  | [StoreProvider<Options>, StoreHook<Value>]
  | [StoreProviderWithOptions<Options>, StoreHook<Value>] {
  const Context = createContext<Store<Value> | typeof EMPTY>(EMPTY);

  function Provider(props: StoreProviderProps<Options>) {
    const value = fn(props.options);
    const storeRef = useRef<Store<Value>>(null);

    if (!storeRef.current) {
      storeRef.current = new Store(value);
    } else {
      storeRef.current.update(value);
    }

    useLayoutEffect(() => {
      storeRef.current!.notify();
    }, [value]);

    return createElement(Context.Provider, {
      value: storeRef.current,
      children: props.children,
    });
  }

  function useStore<Selected = Value>(select?: Selector<Value, Selected>) {
    const store = useContext(Context);

    if (store === EMPTY) {
      throw new Error("Component must be wrapped with a store <Provider>");
    }

    const snapshotRef = useRef<{ root: Value; selected: Selected } | null>(
      null,
    );

    const getSnapshot = () => {
      const root = store.get();
      if (!select) return root as unknown as Selected;

      const prev = snapshotRef.current;

      if (prev && Object.is(prev.root, root)) {
        return prev.selected;
      }

      const selected = select(root);

      // If the selected values are equal, return the old reference to bail out of the render.
      if (prev && _equals(selected, prev.selected)) {
        snapshotRef.current = { root, selected: prev.selected };
        return prev.selected;
      }

      // Otherwise, cache and return the new reference.
      snapshotRef.current = { root, selected };
      return selected;
    };

    return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
  }

  return [Provider, useStore];
}

/**
 * Shallow `Object.is` comparison for selected objects and arrays.
 */
function _equals(a: any, b: any): boolean {
  // Exact match (handles identical object references and primitive matches like 1 === 1)
  if (Object.is(a, b)) return true;

  // If either is not an object (primitive, function) or is null,
  // and they failed the Object.is check above, they are definitely not equal.
  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  ) {
    return false;
  }

  // Shallow array compare
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false;
    }
    return true;
  }

  // Bail out on different types (e.g., Object vs Date)
  if (a.constructor !== b.constructor) return false;

  // Shallow object compare
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;

  const hasOwn = Object.prototype.hasOwnProperty;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!hasOwn.call(b, key) || !Object.is(a[key], b[key])) {
      return false;
    }
  }

  return true;
}
