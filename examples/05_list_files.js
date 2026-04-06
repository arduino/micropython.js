const Board = require('../micropython.js')

async function main() {
  const board = new Board()
  await board.open(process.argv[2])
  const rootFiles = await board.fs_ils()
  console.log('files at /')
  console.log(rootFiles)
  const libFiles = await board.fs_ils('lib')
  console.log('files at /lib')
  console.log(libFiles)
  await board.close()
}

main()
