import {
  createContext,
  Ref,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  createElement,
} from "react";

const EMPTY: unique symbol = Symbol();

export interface StoreProviderProps<Value, Options> {
  options?: Options;
  ref?: Ref<Value>;
  children: React.ReactNode;
}

export interface StoreProviderPropsWithOptions<Value, Options>
  extends StoreProviderProps<Value, Options> {
  options: Options;
}

export interface Selector<Value, Selected> {
  (value: Value): Selected;
}

/**
 * Provides a single instance of a store to all its children.
 */
export type StoreProvider<Value, Options> = React.ComponentType<
  StoreProviderProps<Value, Options>
>;

export type StoreProviderWithOptionsRequired<Value, Options> =
  React.ComponentType<StoreProviderPropsWithOptions<Value, Options>>;

export interface StoreHookOptions<Value, Selected = Value> {
  /**
   * Equality function for comparing changed values.
   * Each time the store value changes, this function will run to determine if a re-render is necessary.
   */
  equals?: (currentState: Selected, nextState: Selected) => boolean;
}

export interface StoreHookOptionsWithSelector<Value, Selected>
  extends StoreHookOptions<Value, Selected> {
  select: Selector<Value, Selected>;
}

export interface StoreHookOptionsMaybeWithSelector<Value, Selected>
  extends StoreHookOptions<Value, Selected> {
  select?: Selector<Value, Selected>;
}

/**
 * Accesses the nearest parent instance of a store.
 */
export interface StoreHook<Value> {
  (): Value;
  <Selected>(select: Selector<Value, Selected>): Selected;
  <Selected>(options: StoreHookOptionsWithSelector<Value, Selected>): Selected;
  (options: StoreHookOptions<Value>): Value;
}

/**
 * Defines a new store, returning its provider and hook.
 */
export function createStore<Value, Options>(
  fn: () => Value,
): [StoreProvider<Value, Options>, StoreHook<Value>];

/**
 * Defines a new store, returning its provider and hook.
 */
export function createStore<Value, Options>(
  fn: (options: Options) => Value,
): [StoreProviderWithOptionsRequired<Value, Options>, StoreHook<Value>];

export function createStore<Value, Options>(
  fn: (options?: Options) => Value,
):
  | [StoreProvider<Value, Options>, StoreHook<Value>]
  | [StoreProviderWithOptionsRequired<Value, Options>, StoreHook<Value>] {
  const Context = createContext<Value | typeof EMPTY>(EMPTY);

  function Provider(props: StoreProviderProps<Value, Options>) {
    const value = fn(props.options);
    if (props.ref) {
      _setRef(props.ref, value);
    }
    return createElement(Context.Provider, { value, children: props.children });
  }

  function useStore<Value>(): Value;
  function useStore<Value, Selected>(
    select: Selector<Value, Selected>,
    options?: StoreHookOptions<Value, Selected>,
  ): Selected;
  function useStore<Value>(
    select: null,
    options: StoreHookOptions<Value, Value>,
  ): Value;
  function useStore<Selected = Value>(
    select?: Selector<Value, Selected> | null,
    options?: StoreHookOptions<Value, Selected>,
  ) {
    const value = useContext(Context);

    if (value === EMPTY) {
      throw new Error("Component must be wrapped with a store <Provider>");
    }

    // Optimization: Skip selector logic if no selector is passed.
    // We are assuming the argument types never change between renders.
    // Changing them will cause a React error, but would be a very weird thing to do.
    if (!select) return value;

    // Blop gets flagged on and off to trigger a re-render.
    const [blop, setBlop] = useState(false);
    const selected = useRef<Value | Selected>(
      select == null ? value : select(value),
    );

    useEffect(() => {
      if (select == null) {
        // Run no comparison; just re-render whenever the context changes.
        selected.current = value;
        setBlop((x) => !x);
      } else {
        const next = select(value);
        const equals = options?.equals ?? _checkEquality;
        if (!equals(selected.current as any, next as any)) {
          selected.current = next;
          setBlop((x) => !x);
        }
      }
    }, [value]);

    return useMemo(() => selected.current, [blop]);
  }

  return [Provider, useStore];
}

function _setRef<Value>(ref: Ref<Value>, value: Value) {
  if (ref == null) {
    return;
  } else if (typeof ref === "function") {
    ref(value);
  } else if (Object.hasOwn(ref, "current")) {
    ref.current = value;
  } else {
    throw new Error(`Unknown ref type.`);
  }
}

function _checkEquality(a: any, b: any): boolean {
  // Same object is obviously equal.
  if (a === b) return true;

  // Must be the same type.
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!_checkEquality(a[i], b[i])) return false;
    }
  } else if (typeof a === "object") {
    if (a.prototype !== b.prototype) return false;

    // Two different maps or sets are not equal.
    if (a instanceof Map) return false;
    if (a instanceof Set) return false;

    if (Object.keys(a).length !== Object.keys(b).length) return false;
    for (const key in a) {
      if (!_checkEquality(a[key], b[key])) return false;
    }
  }

  return true;
}

/**
 * Infers the type of value that this provider holds.
 */
export type InferProviderValue<T extends StoreProvider<any, any>> =
  T extends StoreProvider<infer V, any> ? V : never;

/**
 * Infers the type of value that this hook returns.
 */
export type InferHookValue<T extends StoreHook<any>> = ReturnType<T>;
