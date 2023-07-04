const Board = require('./micropython.js')
const assert = require('assert')
const fs = require('fs')

function sleep(millis) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, millis)
  })
}

async function before(port) {
  const board = new Board()
  await board.open(port)
  return Promise.resolve(board)
}

async function after(board) {
  await board.close()
  return Promise.resolve()
}

const testCases = {
  "get prompt": async (board) => {
    // From unknown state
    let output = await board.get_prompt()
    assert.notEqual(output.indexOf('>>>'), -1)
    // From raw repl
    await board.enter_raw_repl()
    output = await board.get_prompt()
    assert.notEqual(output.indexOf('>>>'), -1)
    // Running code
    board.run(`from time import sleep\nwhile True:\n  print('.')\nsleep(1)\n`)
      .catch(() => null)
    output = await board.get_prompt()
    assert.notEqual(output.indexOf('>>>'), -1)

    return Promise.resolve()
  },
  "real time repl": async (board) => {
    let output = ''
    const fn = async () =>  {
      let o = await board.serial.read()
      output += o.toString()
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
    assert(output, 'print(123)\r\n123\r\n>>> ')
    return Promise.resolve()
  },
  "enter raw repl": async (board) => {
    let output = await board.enter_raw_repl()
    assert.notEqual(output.indexOf('raw REPL; CTRL-B to exit'), -1)
    // reenter raw repl
    output = await board.enter_raw_repl()
    assert.notEqual(output.indexOf('raw REPL; CTRL-B to exit'), -1)

    return Promise.resolve()
  },
  "exit raw repl": async (board) => {
    let output = await board.exit_raw_repl()
    assert.notEqual(output.indexOf('>>>'), -1)

    await board.enter_raw_repl()
    output = await board.exit_raw_repl()
    assert.notEqual(output.indexOf('>>>'), -1)

    return Promise.resolve()
  },
  "execute raw small": async (board) => {
    await board.enter_raw_repl()
    const output = await board.exec_raw('print(123)')
    await board.exit_raw_repl()
    assert.equal(output, 'OK123\r\n\x04\x04>')
    return Promise.resolve()
  },
  "execute raw big": async (board) => {
    let bigFile = fs.readFileSync('./examples/big_file.py')
    await board.enter_raw_repl()
    const output = await board.exec_raw(bigFile.toString())
    assert.equal(output, 'OK\x04\x04>')
    await board.exit_raw_repl()
    return Promise.resolve()
  },
  "run small code": async (board) => {
    const output = await board.run('print(123)')
    assert.equal(output, 'OK123\r\n\x04\x04>')
    return Promise.resolve()
  },
  "run big code": async (board) => {
    let bigFile = fs.readFileSync('./examples/big_file.py')
    const output = await board.run(bigFile.toString())
    assert.equal(output, 'OK\x04\x04>')
    return Promise.resolve()
  },
  "run code after stop": async (board) => {
    board.run(
      `from time import sleep\nfor i in range(0, 10):\n  print('.')\n  sleep(1)\n`
    ).catch(e => {
      // console.log('stopped')
    })
    await (new Promise((r) => setTimeout(r, 100)))
    await board.stop()
    await (new Promise((r) => setTimeout(r, 100)))

    const output = await board.run('print(123)')
    assert.equal(output, 'OK123\r\n\x04\x04>')

  },
  "run code after run": async (board) => {
    board.run(
      `from time import sleep\nfor i in range(0, 10):\n  print('.')\n  sleep(1)\n`,
      // (o) => console.log('board run outputs', o)
    ).catch(e => {
      // console.log('stopped')
    })
    await board.get_prompt()
    const output = await board.run('print(123)')
    assert.equal(output, 'OK123\r\n\x04\x04>')

  },
  // "foo": async (board) => Promise.reject()
}

// SKIP LONG RUNNERS
delete testCases['execute raw big']
delete testCases['run big code']

async function main() {
  let errors = []
  const board = new Board()
  let ports = await board.list_ports()
  ports = ports.filter(p => p.vendorId && p.productId).map(p => p.path)
  for (port of ports) {
    console.log('')
    console.log('🔊 Running test for', port)
    for (const [name, test] of Object.entries(testCases)) {
      console.log('>', name)
      const board = await before(port)
      try {
        const result = await test(board)
        console.log("🟩 success")
      } catch(e) {
        console.log('💔 error', e)
        errors.push([port, name])
      }
      await after(board)
    }
  }
  console.log('')
  console.log('Errors:', errors.length)
  if (errors.length > 0) {
    for (const [port, name] of errors) {
      console.log(name, 'failed on', port)
    }
  }
}



  // REFERENCE OF A FULL FEATURE TEST:
  // async function main() {
  //   const board = new Board()
  //   await board.open(process.env.PORT || '/dev/ttyACM0')
  //   console.log('connected')
  //
  //   await board.get_prompt()
  //   console.log('has prompt')
  //
  //   const fn = async () =>  {
  //     let o = await board.serial.read()
  //     console.log('DATA', o.toString())
  //   }
  //   board.serial.on('readable', fn)
  //   await board.eval('pri')
  //   await sleep(10)
  //   await board.eval('nt(1')
  //   await sleep(10)
  //   await board.eval('23)')
  //   await board.eval('\r')
  //   await sleep(10)
  //   board.serial.removeListener('readable', fn)
  //
  //   await board.enter_raw_repl()
  //   console.log('in raw repl')
  //
  //   const code = `from time import sleep\nfor i in range(0, 10):\n  print('.')\n  sleep(0.1)\n`
  //   let i = 0
  //   out = await board.exec_raw(code, async (d) => {
  //     console.log('->', d)
  //     // i += 1; if (i > 3) await board.stop()
  //   })
  //   console.log('executed', out)
  //
  //   await board.exit_raw_repl()
  //   console.log('out raw repl')
  //
  //   out = await board.fs_exists('boot.py')
  //   console.log('boot.py exists', out)
  //   out = await board.fs_exists('this_is_not_a_file.py')
  //   console.log('nope.py exists', out)
  //
  //   out = await board.fs_ls('./')
  //   console.log('root files', out)
  //   out = await board.fs_ls('./lib')
  //   console.log('lib files', out)
  //
  //   out = await board.fs_ils('./')
  //   console.log('root files', out)
  //   out = await board.fs_ils('./lib')
  //   console.log('lib files', out)
  //
  //   out = await board.fs_put(
  //     './examples/big_file.py', 'test.py', (d) => console.log('progress', d)
  //   )
  //   console.log('send file to board', out)
  //
  //   out = await board.fs_cat('test.py')
  //   console.log('get test.py content', out)
  //
  //   out = await board.fs_save(
  //     '# overrides test file', 'test.py', (d) => console.log('progress', d)
  //   )
  //   console.log('save test.py content', out)
  //
  //   out = await board.fs_cat('test.py')
  //   console.log('get test.py content', out)
  //
  //   out = await board.fs_rm('test.py')
  //   console.log('removing test.py', out)
  //
  //   out = await board.fs_mkdir('test_dir')
  //   console.log('created test_dir', out)
  //   out = await board.fs_ils()
  //   console.log('files at ./', out)
  //
  //   out = await board.fs_rmdir('test_dir')
  //   console.log('removed test_dir', out)
  //   out = await board.fs_ils()
  //   console.log('files at ./', out)
  //
  //   board.close()
  // }

main()
