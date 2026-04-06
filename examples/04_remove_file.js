const Board = require('../micropython.js')

async function main() {
  const board = new Board()
  await board.open(process.argv[2])
  console.log('removing file from board')
  await board.fs_rm('test_hello.py')
  console.log('done')
  await board.close()
}

main()
