// Precondition: board must already be running a script (e.g. a while True loop in main.py).
// This verifies open() can interrupt running code and connect successfully.
//
// Usage: node 10_connect_while_running.js <port>

const Board = require('../micropython.js')

async function main() {
  const board = new Board()
  await board.open(process.argv[2])
  console.log('connected, fs root:', board._fsRoot)
  console.log('file list:', await board.fs_ls())
  await board.close()
}

main().catch(e => { console.error(e); process.exit(1) })
