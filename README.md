# flushable

`flushable` is useful in situations where you want to schedule a future operation that might be executed immediately or cancelled. Think `setTimeout` with a way of executing the callback immediately.

## Installation

```
yarn add flushable
```

## Usage

Create a pending operation by passing `flushable` a callback function and a delay. It returns an object that can be used to check the status of the operation, cancel the operation or execute the operation immediately.

```js
import flushable from "flushable";

// prints a message to the console after 1 second
const operation = flushable(flushed => {
  console.log(`I completed ${flushed ? "early" : "on time"}`);
}, 1000);

// true if the callback has not been executed
operation.pending();

// stops the callback from being executed
operation.cancel();

// immediately executes the callback
operation.flush();
```

## Reference

```js
type Flushable = (
  (flushed: boolean) => any,
  delay: number
) => {
  cancel: () => void,
  flush: () => void,
  pending: () => boolean
};
```
