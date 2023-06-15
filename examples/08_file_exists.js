const Board = require('../micropython.js')

async function main() {
  const board = new Board()
  await board.open(process.env.PORT)

  const testFileExists = await board.fs_exists('test.py')
  if (testFileExists) {
    console.log('test.py exists')
  } else {
    console.log('test.py does not exists')
  }

  const fakeFileExists = await board.fs_exists('xxxxxxxxxxx')
  if (fakeFileExists) {
    console.log('xxxxxxxxxxx exists')
  } else {
    console.log('xxxxxxxxxxx does not exists')
  }

  board.close()
}

main()
