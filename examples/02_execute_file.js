const Board = require('../micropython.js')

async function main() {
  const board = new Board()
  await board.open(process.env.PORT)
  console.log('executing file')
  const output = await board.execfile('./test.py')
  console.log('output')
  console.log(output)
  board.close()
}

main()
