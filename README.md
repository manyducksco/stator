# Stator

Stator answers the question, "How do I share one hook's state between multiple components?" React's answer is [Context](https://react.dev/learn/passing-data-deeply-with-context). Stator makes this process even simpler.

Let's start with a familiar example:

## Example: Counter Store

```tsx
type CounterOptions = {
  initialValue?: number
}

// Write your hook code, pass it to `createStore`, and get a Provider and a hook to access the shared state.

const [CounterProvider, useCounter] = createStore((options: CounterOptions) => {
  const [value, setValue] = useState(options.initialValue);
  
  const increment = useCallback(() => {
    setCount((current) => current + 1)
  }, []);
  
  const decrement = useCallback(() => {
    setCount((current) => current - 1)
  }, []);
  
  const reset = useCallback(() => {
    setCount(0)
  }, []);
  
  return {
    value,
    increment,
    decrement,
    reset
  }
});

function MyApp() {
  return (
    // One instance of your store is created wherever you render the provider.
    <CounterProvider initialValue={0}>
      <CounterDisplay />
      <CounterControls />
    </CounterProvider>
  )
}

function CounterDisplay() {
  // And all children can access the same instance via the hook.
  const { value } = useCounter();
  
  return <p>Count is: {value}</p>
}

function CounterControls() {
  // This is the same object <CounterDisplay> is looking at.
  const { increment, decrement, reset } = useCounter();
  
  return (
    <div>
      <button onClick={increment}>+1</button>
      <button onClick={decrement}>-1</button>
      <button onClick={reset}>Reset</button>
    </div>
  )
}
````

## Optimizing with a Selector

It's common to only need part of a store's state. A component that calls `useCounter` will render every time the store's state changes, even if it's a value you don't use. You can pass a selector function to pluck out the part of the state you care about so your component will only render when you need it to.

Let's optimize the Counter components.

```tsx
function CounterDisplay() {
  // We only care about the value.
  // If we add more state to the counter store later, this component won't even notice.
  const value = useCounter((state) => state.value);
  
  return <p>Count is: {value}</p>
}

function CounterControls() {
  // We don't care about the value here. We only need the functions to modify it.
  // Because we've wrapped them in `useCallback` they will always reference the same functions.
  // Changes to the counter value will never cause this component to render.
  const [increment, decrement, reset] = useCounter((state) => [state.increment, state.decrement, state.reset]);
  
  return (
    <div>
      <button onClick={increment}>+1</button>
      <button onClick={decrement}>-1</button>
      <button onClick={reset}>Reset</button>
    </div>
  )
}
```

## Prior Art

We have been long time users of the great [unstated-next](https://github.com/jamiebuilds/unstated-next), which Stator has been created to improve upon.
