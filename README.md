# micropython.js

This is an partial port of [pyboard.py](https://docs.micropython.org/en/latest/reference/pyboard.py.html) to javascript.

## Basic usage

```js
const Board = require('micropython.js')
// Instantiate board class
const board = new Board()

// List available boards
const ports = await board.listPorts()
console.log('available boards', ports)

// Connect to a serial path
await board.open('/dev/ttyUSB0')

// Enter raw repl, execute command, get output and leave raw repl
await board.enter_raw_repl()
const output = await board.exec_raw({ command: "print(123)" })
await board.exit_raw_repl()

// List files on the board
const rootFiles = await board.fs_ils()
console.log('files at /', rootFiles)

// Close serial
await board.close()
```

## Examples

1. Navigate to example folder `cd examples`
2. Execute files with `PORT` environment variable: `PORT=/dev/tty.SLAB_USBtoUART node 05_list_files.js`

## Command Line Interface (CLI)

1. Run CLI `node cli.js [ARGUMENTS]...`

[Read more](CLI.md)
