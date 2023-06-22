const Board = require('../micropython.js')

async function main() {
  const board = new Board()
  await board.open(process.env.PORT)
  const output = await board.fs_cat('test.py')
  console.log('file contents:')
  console.log(output)
  await board.close()
}

main()
