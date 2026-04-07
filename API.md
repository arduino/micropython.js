# micropython.js API Reference

## Exports

```js
const MicroPythonBoard = require('micropython.js')
const { MicroPythonError } = require('micropython.js')
```

---

## `MicroPythonError`

Extends `Error`. All library methods throw this type on failure.

### Properties

| Property | Type           | Description                                                              |
|----------|----------------|--------------------------------------------------------------------------|
| `message`| string         | Human-readable description                                               |
| `code`   | string         | One of the static codes listed below                                     |
| `path`   | string \| null | Target filesystem path; set only for `INSUFFICIENT_SPACE`, `null` otherwise |

### Static codes

| Code                    | When thrown                                                   |
|-------------------------|---------------------------------------------------------------|
| `INTERRUPTED_BY_RERUN`  | `run()` was called while a previous run was still in progress |
| `INTERRUPTED_BY_STOP`   | `stop()` was called while a run was in progress               |
| `INTERRUPTED_BY_RESET`  | `soft_reset()` or `hard_reset()` interrupted a run            |
| `TIMEOUT`               | A `read_until` call did not receive the expected bytes in time |
| `NO_DEVICE`             | `open()` was called without a port argument                   |
| `INSUFFICIENT_SPACE`    | Not enough storage for a filesystem write operation     |
| `INSUFFICIENT_MEMORY`   | Not enough heap RAM to compile and run a script               |
| `BOARD_ERROR`           | The board returned a Python exception (stderr non-empty)      |
| `UNEXPECTED_RESPONSE`   | The board returned data that could not be parsed              |
| `MISSING_ARGUMENT`      | A required argument was omitted                               |
| `DISCONNECTED`          | Serial port closed unexpectedly                               |
| `PORT_ERROR`            | Serial port emitted an error event                            |

---

## `MicroPythonBoard`

### Constructor

```js
const board = new MicroPythonBoard()
```

No arguments. Call `open()` before using any other method.

---

## Connection

### `list_ports()`

```js
const ports = await board.list_ports()
```

Returns a `Promise` resolving to an array of serial port descriptor objects (from `serialport`). Each object has at least `path`, `vendorId`, `productId`.

---

### `open(port)`

```js
await board.open('/dev/ttyUSB0')
```

Opens the serial port, enters raw REPL, detects the filesystem root, and exits raw REPL. Leaves the board in normal REPL mode.

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `port`    | string | yes      | Serial port path         |

Throws `NO_DEVICE` if `port` is omitted.

---

### `close()`

```js
await board.close()
```

Closes the serial port. Clears internal state (`_hasUbinascii`, `_fsRoot`, pending reads). Does not emit `DISCONNECTED`.

---

### `setDataCallback(fn)`

```js
board.setDataCallback((chunk) => process.stdout.write(chunk))
```

Registers a callback that receives raw bytes from the board. Called in two cases:

- **Idle passthrough** — when no library operation is in progress (interactive REPL output).
- **Active passthrough** — during `run()` and `get_prompt()` step 1, where bytes are forwarded to the callback while being accumulated internally.

Pass `null` to remove the callback.

---

## REPL Control

### `enter_raw_repl()`

```js
await board.enter_raw_repl()
```

Sends Ctrl-A and waits for the raw REPL prompt. Must be called before `exec_raw()`.

---

### `exit_raw_repl([passThrough])`

```js
await board.exit_raw_repl()
```

Sends Ctrl-B and waits for the normal `>>>` prompt.

| Parameter     | Type    | Default | Description                                      |
|---------------|---------|---------|--------------------------------------------------|
| `passThrough` | boolean | `false` | Forward received bytes to the data callback      |

---

### `get_prompt()`

```js
const banner = await board.get_prompt()
```

Sends Ctrl-C + Ctrl-B and waits for the `>>>` prompt. Returns the MicroPython banner string. Forwards any KeyboardInterrupt/traceback output to the data callback.

---

## Execution

### `exec_raw(cmd, [data_consumer], [passThrough])`

```js
await board.enter_raw_repl()
const output = await board.exec_raw('print(1 + 1)')
await board.exit_raw_repl()
```

Executes a Python string in raw REPL mode. Must be called between `enter_raw_repl()` and `exit_raw_repl()`.

| Parameter       | Type     | Default | Description                                         |
|-----------------|----------|---------|-----------------------------------------------------|
| `cmd`           | string   | —       | Python code to execute                              |
| `data_consumer` | function | `null`  | Called with each received chunk as a string         |
| `passThrough`   | boolean  | `false` | Forward received bytes to the data callback         |

Returns a `Promise` resolving to the raw response buffer string (`OK${stdout}\x04${stderr}\x04>`). Use `exec_raw_err()` on this buffer to check for Python-side errors before extracting stdout.

---

### `exec_raw_err(out)`

```js
const stderr = board.exec_raw_err(out)
```

Extracts the stderr portion from an `exec_raw` response buffer. Synchronous.

| Parameter | Type   | Description                      |
|-----------|--------|----------------------------------|
| `out`     | string | Raw response from `exec_raw()`   |

Returns the stderr string, or `''` if none.

---

### `execfile(filePath, [data_consumer])`

```js
const output = await board.execfile('./script.py')
```

Reads a local file and executes its contents on the board. Checks available RAM before executing.

| Parameter       | Type     | Required | Description                               |
|-----------------|----------|----------|-------------------------------------------|
| `filePath`      | string   | yes      | Path to the local `.py` file              |
| `data_consumer` | function | no       | Called with each output chunk as a string |

Throws `MISSING_ARGUMENT` if `filePath` is omitted. Throws `INSUFFICIENT_MEMORY` if RAM is insufficient.

---

### `run(code, [data_consumer], [onBeforeExec])`

```js
await board.run('print("hello")', (chunk) => process.stdout.write(chunk))
```

Enters raw REPL, checks RAM, executes code, and exits raw REPL. Output is forwarded to both `data_consumer` and the data callback (if set). If called while a previous `run()` is still in progress, the previous one is rejected with `INTERRUPTED_BY_RERUN`.

| Parameter      | Type     | Required | Description                                           |
|----------------|----------|----------|-------------------------------------------------------|
| `code`         | string   | yes      | Python code to run                                    |
| `data_consumer`| function | no       | Called with each output chunk as a string             |
| `onBeforeExec` | function | no       | Async callback invoked after RAM check, before exec   |

Returns a `Promise` resolving to the raw `exec_raw` response buffer. Use `exec_raw_err()` on it to check for Python-side errors.

Throws `INTERRUPTED_BY_STOP` if `stop()` is called during execution. Throws `INTERRUPTED_BY_RERUN` if a second `run()` preempts this one. Throws `INSUFFICIENT_MEMORY` if RAM is insufficient.

---

### `eval(k)`

```js
await board.eval('1+1\r\n')
```

Writes raw bytes to the serial port without reading a response. Intended for sending keystrokes to the normal REPL.

---

## Board Control

### `stop()`

```js
await board.stop()
```

Sends Ctrl-C to interrupt any running code. Rejects any in-progress `run()` with `INTERRUPTED_BY_STOP`. Cancels all pending reads.

---

### `soft_reset([onBeforeReset])`

```js
await board.soft_reset()
```

Resets the Python interpreter without reinitialising hardware peripherals (`machine.soft_reset()`). Rejects any in-progress `run()` with `INTERRUPTED_BY_RESET`.

| Parameter      | Type     | Required | Description                                                    |
|----------------|----------|----------|----------------------------------------------------------------|
| `onBeforeReset`| function | no       | Called after sending the reset command, before the board reboots |

---

### `hard_reset()`

```js
await board.hard_reset()
```

Performs a full microcontroller reset (`machine.reset()`). Equivalent to pressing the reset button. Rejects any in-progress `run()` with `INTERRUPTED_BY_RESET`.

---

### `mem_free()`

```js
const bytes = await board.mem_free()
```

Returns available heap memory in bytes after running `gc.collect()` twice.

---

### `reset()` _(deprecated)_

Use `soft_reset()` or `hard_reset()` instead. Still available for transition compatibility.

---

## Filesystem

All filesystem methods that accept a path will reject with `MISSING_ARGUMENT` if the path is omitted.
Board-side Python exceptions are surfaced as `BOARD_ERROR`.

---

### `fs_exists(filePath)`

```js
const exists = await board.fs_exists('/lib/mymodule.py')
```

Returns `true` if the path exists on the board (file or directory), `false` otherwise. Uses `os.stat()` internally.

---

### `fs_ls(folderPath)`

```js
const names = await board.fs_ls('/')
// ['main.py', 'lib', 'boot.py']
```

Returns an array of entry name strings in the given directory. Returns `[]` if the path does not exist.

---

### `fs_ils(folderPath)`

```js
const entries = await board.fs_ils('/')
// [['main.py', 0x8000, 0, 123], ['lib', 0x4000, 0, 0], ...]
```

Returns an array of `ilistdir` tuples: `[name, type, inode, size]`. Type `0x8000` = file, `0x4000` = directory. Returns `[]` if the path does not exist.

---

### `fs_cat(filePath)`

```js
const text = await board.fs_cat('/main.py')
```

Reads a text file from the board and returns its contents as a string. Line endings are normalised to `\n`.

---

### `fs_cat_binary(filePath, [data_consumer])`

```js
const buf = await board.fs_cat_binary('/image.jpg')
```

Reads a binary file from the board and returns a `Buffer`.

| Parameter       | Type     | Required | Description                               |
|-----------------|----------|----------|-------------------------------------------|
| `filePath`      | string   | yes      | Path on the board                         |
| `data_consumer` | function | no       | Called with `'0%'` and `'100%'` progress  |

---

### `fs_put(src, dest, [data_consumer])`

```js
await board.fs_put('./firmware/main.py', '/main.py', (pct) => console.log(pct))
```

Transfers a local file to the board. Checks available flash storage before writing. Cleans up the partial destination file if an error occurs mid-transfer.

| Parameter       | Type     | Required | Description                               |
|-----------------|----------|----------|-------------------------------------------|
| `src`           | string   | yes      | Local file path                           |
| `dest`          | string   | yes      | Destination path on the board             |
| `data_consumer` | function | no       | Called with `'0%'`…`'99%'` progress       |

Throws `INSUFFICIENT_SPACE` if flash is insufficient.

---

### `fs_save(content, dest, [data_consumer])`

```js
await board.fs_save('print("hello")', '/main.py')
```

Writes a string directly to a file on the board. Functionally identical to `fs_put` but accepts content as a string instead of a local file path.

| Parameter       | Type     | Required | Description                               |
|-----------------|----------|----------|-------------------------------------------|
| `content`       | string   | yes      | UTF-8 content to write                    |
| `dest`          | string   | yes      | Destination path on the board             |
| `data_consumer` | function | no       | Called with `'0%'`…`'99%'` progress       |

Throws `INSUFFICIENT_SPACE` if flash is insufficient.

---

### `fs_get(src, dest, [data_consumer])`

```js
await board.fs_get('/main.py', './backup/main.py')
```

Downloads a file from the board to a local path.

| Parameter       | Type     | Required | Description                               |
|-----------------|----------|----------|-------------------------------------------|
| `src`           | string   | yes      | Source path on the board                  |
| `dest`          | string   | yes      | Local destination path                    |
| `data_consumer` | function | no       | Called with `'0%'` and `'100%'` progress  |

---

### `fs_mkdir(dirPath)`

```js
await board.fs_mkdir('/lib')
```

Creates a directory on the board.

---

### `fs_rmdir(dirPath)`

```js
await board.fs_rmdir('/lib')
```

Removes an empty directory from the board.

---

### `fs_rm(filePath)`

```js
await board.fs_rm('/old_script.py')
```

Removes a file from the board.

---

### `fs_rename(oldPath, newPath)`

```js
await board.fs_rename('/temp.py', '/main.py')
```

Renames or moves a file on the board.

---

### `fs_free([dirPath])`

```js
const bytes = await board.fs_free('/')
```

Returns the number of free bytes in the filesystem at `dirPath`. Defaults to the board's filesystem root (detected at `open()` time).
