const Board = require('./micropython.js')

let out

function sleep(millis) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, millis)
  })
}


async function main() {
  const board = new Board()
  await board.open(process.env.PORT || '/dev/ttyACM0')
  console.log('connected')

  await board.get_prompt()
  console.log('has prompt')

  const fn = async () =>  {
    let o = await board.serial.read()
    console.log('DATA', o.toString())
  }
  board.serial.on('readable', fn)
  await board.eval('pri')
  await sleep(10)
  await board.eval('nt(1')
  await sleep(10)
  await board.eval('23)')
  await board.eval('\r')
  await sleep(10)
  board.serial.removeListener('readable', fn)

  await board.enter_raw_repl()
  console.log('in raw repl')

  const code = `from time import sleep\nfor i in range(0, 10):\n  print('.')\n  sleep(0.1)\n`
  let i = 0
  out = await board.exec_raw(code, async (d) => {
    console.log('->', d)
    // i += 1; if (i > 3) await board.stop()
  })
  console.log('executed', out)

  await board.exit_raw_repl()
  console.log('out raw repl')

  out = await board.fs_exists('boot.py')
  console.log('boot.py exists', out)
  out = await board.fs_exists('this_is_not_a_file.py')
  console.log('nope.py exists', out)

  out = await board.fs_ls('./')
  console.log('root files', out)
  out = await board.fs_ls('./lib')
  console.log('lib files', out)

  out = await board.fs_ils('./')
  console.log('root files', out)
  out = await board.fs_ils('./lib')
  console.log('lib files', out)

  out = await board.fs_put(
    './examples/test.py', 'test.py', (d) => console.log('progress', d)
  )
  console.log('send file to board', out)

  out = await board.fs_cat('test.py')
  console.log('get test.py content', out)

  out = await board.fs_save(
    '# overrides test file', 'test.py', (d) => console.log('progress', d)
  )
  console.log('save test.py content', out)

  out = await board.fs_cat('test.py')
  console.log('get test.py content', out)

  out = await board.fs_rm('test.py')
  console.log('removing test.py', out)

  out = await board.fs_mkdir('test_dir')
  console.log('created test_dir', out)
  out = await board.fs_ils()
  console.log('files at ./', out)

  out = await board.fs_rmdir('test_dir')
  console.log('removed test_dir', out)
  out = await board.fs_ils()
  console.log('files at ./', out)

  board.close()
}

main()
