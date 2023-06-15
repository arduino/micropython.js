const Board = require('../micropython.js')

async function main() {
  const board = new Board()
  await board.open(process.env.PORT)
  console.log('removing file from board')
  await board.fs_rm('test.py')
  console.log('done')
  board.close()
}

main()
