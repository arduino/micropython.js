# micropython.js

This JavaScript library was born as a partial port of [pyboard.py](https://docs.micropython.org/en/latest/reference/pyboard.py.html) in order to be used in [Arduino Lab for MicroPython](https://github.com/arduino/lab-micropython-editor).


It can be used to interacti with a MicroPython board using Node.
In its current incarnation, it relies on Node SerialPort, although future refactoring to support other kinds of transports are in the plans.

## Basic usage

```js
const Board = require('micropython.js')
// Instantiate board class
const board = new Board()

// List available boards
const ports = await board.list_ports()
console.log('available boards', ports)

// Connect to a serial path
await board.open('/dev/ttyUSB0')

// Enter raw repl, execute command, get output and leave raw repl
await board.enter_raw_repl()
const output = await board.exec_raw("print(123)")
await board.exit_raw_repl()

// List files on the board
const rootFiles = await board.fs_ils()
console.log('files at /', rootFiles)

// Close serial
await board.close()
```

## Examples

Run all examples in sequence against a connected board:

```sh
node examples/run_all.js /dev/ttyUSB0
```

Or run a single example, passing the port as the first argument:

```sh
node examples/05_list_files.js /dev/ttyUSB0
```

## Command Line Interface (CLI)

1. Run CLI `node cli.js [ARGUMENTS]...`

[Read more](CLI.md)
