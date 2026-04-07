const Board = require('../micropython.js')

let content = `
"""
Test
"""

from time import sleep
from machine import Pin
pin = Pin(2, Pin.OUT)
emoji_string = '🐈‍⬛ 🐕 🐓'
print("start OK \r\n")
for i in range(0, 10):
  print('duh')
  pin.on()
  sleep(0.1)
  pin.off()
  sleep(0.1)
print(emoji_string)
`

async function main() {
  const board = new Board()
  await board.open(process.argv[2])
  console.log('saving content to file')
  await board.fs_save(content, 'saved_example.py')
  console.log('done')
  await board.close()
}

main()
