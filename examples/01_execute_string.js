const Board = require('../micropython.js')

let board = new Board({
  device: '/dev/tty.usbmodem141101'
})

board.open()
  .then(() => {
    console.log('connected')
    console.log('entering raw repl')
    return board.enter_raw_repl()
  })
  .then(async () => {
    console.log('executing raw')
    return board.exec_raw({
      command: `
from machine import Pin
from time import sleep
pin = Pin(6, Pin.OUT)
for i in range(0, 10):
    pin.on()
    sleep(0.1)
    pin.off()
    sleep(0.1)
    print('duh')
`
    })
  })
  .then((out) => {
    console.log('output', out)
    console.log('exiting raw repl')
    return board.exit_raw_repl()
  })
  .then(() => {
    console.log('closing connection')
    return board.close()
  })
  .then(() => {
    console.log('disconnected')
  })
  .catch((err) => {
    console.log('error')
    console.log(err)
    board.exit_raw_repl(true)
    board.close()
  })
