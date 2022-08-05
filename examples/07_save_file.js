const Board = require('../micropython.js')

let content = `
"""
Blinky
"""
from machine import Pin
from time import sleep
# Nano Connect rp2040 internal LED
led = Pin(6, Pin.OUT)
while True:
 print('on')
 led.on()
 sleep(0.25)
 print('off')
 led.off()
 sleep(0.25)
`

console.log('connect')
let board = new Board()
board.open(process.env.PORT || '/dev/tty.usbmodem141101')
  .then(async () => {
    try {
      await board.fs_save(content, 'test.py')
      console.log('disconnect')
    } catch(e) {
      console.log('error', e)
    }
    board.close()
  })
