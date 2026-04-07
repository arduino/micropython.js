// Interactive example: streams board output to the terminal in real time.
// Press Ctrl+C to stop the running script gracefully.

const Board = require('../micropython.js')
const { MicroPythonError } = require('../micropython.js')

const code = `
from time import sleep
i = 0
while True:
    print('tick', i)
    i += 1
    sleep(0.5)
`.trim()

async function main() {
  const board = new Board()
  await board.open(process.argv[2])

  process.once('SIGINT', () => board.stop())

  try {
    await board.run(code, (chunk) => process.stdout.write(chunk))
    console.log('\ndone')
  } catch (e) {
    if (e instanceof MicroPythonError && e.code === MicroPythonError.INTERRUPTED_BY_STOP) {
      console.log('\nstopped by user')
    } else {
      throw e
    }
  } finally {
    await board.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
