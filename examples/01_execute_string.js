const Board = require('../micropython.js')

const command = `from time import sleep
from machine import Pin
pin = Pin(2, Pin.OUT)
print("start OK \\r\\n")
for i in range(0, 10):
  print('duh')
  pin.on()
  sleep(0.1)
  pin.off()
  sleep(0.1)
`

async function main() {
  const board = new Board()
  await board.open(process.env.PORT)
  await board.enter_raw_repl()
  console.log('exec raw:')
  console.log(command)
  const output = await board.exec_raw({ command })
  console.log('output:')
  console.log(output)
  await board.exit_raw_repl()
  await board.close()
}

main()
