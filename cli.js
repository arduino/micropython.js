const fs = require('fs')
const path = require('path')
const Board = require('./micropython.js')
const { MicroPythonError } = require('./micropython.js')

const log = console.log

const aliases = {
  '-p': '--port',
  '-v': '--verbose',
  '-h': '--help',
  '-L': '--listports',
  '-l': '--listfiles',
  '-i': '--ilistfiles',
  '-e': '--executestring',
  '-x': '--executefile',
  '-u': '--putfile',
  '-g': '--getfile',
  '-d': '--removefile',
  '-D': '--removefolder',
  '-m': '--makefolder',
  '-n': '--rename',
  '-r': '--reset',
  '-R': '--hardreset',
  '-f': '--free',
  '-M': '--mem',
  '-F': '--format',
  '-c': '--cat',
  '-E': '--exists',
  '-S': '--savefile',
}


const extractArguments = (args) => {
  return args.slice(2)
}

const normalizeFlag = (value) => {
  if (value.slice(0, 2) === '--') return value
  if (value.slice(0, 1) === '-' && aliases[value]) return aliases[value]
  return value
}

const extractCommands = (args) => {
  let commands = {}
  let currentCommand = null
  // TODO: Use reduce instead of forEach
  args.forEach((value) => {
    const normalized = normalizeFlag(value)
    // If it's a command, set it as the current one
    if (normalized.slice(0, 2) === '--') {
      currentCommand = normalized
    }
    // If there isn't a key initialized for that command, do so
    if (!commands[currentCommand]) {
      commands[currentCommand] = []
    } else {
      // Otherwise push the values to the current command key
      commands[currentCommand].push(value)
    }
  })
  return commands
}

function ensurePort(port) {
  if (!port) throw new Error('You must specify a port.')
}

const listPorts = (args) => {
  const board = new Board()
  return board.list_ports()
  .then((ports) => {
    const boards = ports.filter(p => p.vendorId && p.productId)
    log('available ports', boards)
    return Promise.resolve()
  })
}

const listFiles = (args, port) => {
  ensurePort(port)
  const board = new Board()
  return board.open(port)
  .then(async () => {
    const folder = args[0] || board._fsRoot
    try {
      const exists = await board.fs_exists(folder)
      if (!exists) {
        log(`error: path not found on board: "${folder}"`)
        board.close()
        return
      }
      const output = await board.fs_ls(folder)
      log(`files at "${folder}"`, output)
    } catch(e) {
      log('error', e)
    }
    board.close()
    return Promise.resolve()
  })
}

const ilistFiles = (args, port) => {
  ensurePort(port)
  const board = new Board()
  return board.open(port)
  .then(async () => {
    const folder = args[0] || board._fsRoot
    try {
      const exists = await board.fs_exists(folder)
      if (!exists) {
        log(`error: path not found on board: "${folder}"`)
        board.close()
        return
      }
      const output = await board.fs_ils(folder)
      log(`files at "${folder}"`, output)
    } catch(e) {
      log('error', e)
    }
    board.close()
    return Promise.resolve()
  })
}

const executeString = (args, port, dataConsumer) => {
  ensurePort(port)
  const board = new Board()
  const code = args[0] || ''
  return board.open(port)
  .then(() => board.enter_raw_repl())
  .then(() => board.exec_raw(code, dataConsumer))
  .then(async (out) => {
    await board.exit_raw_repl()
    await board.close()
    log(out)
    return Promise.resolve()
  })
  .catch((err) => {
    log('error', err)
    board.exit_raw_repl(true)
    board.close()
  })
}

const executeFile = (args, port, dataConsumer) => {
  ensurePort(port)
  const board = new Board()
  const filename = args[0] || ''
  const consumer = dataConsumer || function() {}
  return board.open(port)
  .then(async () => {
    try {
      const out = await board.execfile(filename, consumer)
      log(out)
    } catch(e) {
      log('error', e)
    }
    board.close()
    return Promise.resolve()
  })
}

const putFile = (args, port, dataConsumer) => {
  ensurePort(port)
  const board = new Board()
  const [ diskFilename, boardFilename ] = args
  const consumer = dataConsumer || function() {}
  return board.open(port)
  .then(async () => {
    try {
      await board.fs_put(diskFilename, boardFilename, consumer)
      log('uploaded', boardFilename)
    } catch(e) {
      log('error', e.message)
    }
    board.close()
    return Promise.resolve()
  })
}

const getFile = (args, port, dataConsumer) => {
  ensurePort(port)
  const board = new Board()
  const [ boardFilename, diskFilename ] = args
  const consumer = dataConsumer || function() {}
  return board.open(port)
  .then(async () => {
    try {
      await board.fs_get(boardFilename, diskFilename, consumer)
      log('saved', diskFilename)
    } catch(e) {
      log('error', e.message)
    }
    board.close()
    return Promise.resolve()
  })
}

const removeFile = (args, port) => {
  ensurePort(port)
  const board = new Board()
  const [ boardFilename ] = args

  return board.open(port)
  .then(async () => {
    try {
      await board.fs_rm(boardFilename)
      log('removed', boardFilename)
    } catch(e) {
      log('error', e.message)
    }
    board.close()
    return Promise.resolve()
  })
}

const removeFolder = (args, port) => {
  ensurePort(port)
  const board = new Board()
  const [ boardDirname ] = args

  return board.open(port)
  .then(async () => {
    try {
      await board.fs_rmdir(boardDirname)
      log('removed', boardDirname)
    } catch(e) {
      log('error', e.message)
    }
    board.close()
    return Promise.resolve()
  })
}

const makeFolder = (args, port) => {
  ensurePort(port)
  const board = new Board()
  const [ boardDirname ] = args

  return board.open(port)
  .then(async () => {
    try {
      await board.fs_mkdir(boardDirname)
      log('created', boardDirname)
    } catch(e) {
      log('error', e.message)
    }
    board.close()
    return Promise.resolve()
  })
}

const renameFile = (args, port) => {
  ensurePort(port)
  const board = new Board()
  const [ oldPath, newPath ] = args

  return board.open(port)
  .then(async () => {
    try {
      await board.fs_rename(oldPath, newPath)
      log('renamed', oldPath, '->', newPath)
    } catch(e) {
      log('error', e)
    }
    board.close()
    return Promise.resolve()
  })
}

const softReset = (args, port) => {
  ensurePort(port)
  const board = new Board()
  return board.open(port)
  .then(async () => {
    try {
      await board.soft_reset()
      log('soft reset sent')
    } catch(e) {
      log('error', e.message)
    }
    board.close()
    return Promise.resolve()
  })
}

const hardReset = (args, port) => {
  ensurePort(port)
  const board = new Board()
  return board.open(port)
  .then(async () => {
    try {
      await board.hard_reset()
      log('hard reset sent')
    } catch(e) {
      log('error', e.message)
    }
    board.close()
    return Promise.resolve()
  })
}

const freeSpace = (args, port) => {
  ensurePort(port)
  const board = new Board()
  return board.open(port)
  .then(async () => {
    const target = args[0] || board._fsRoot
    try {
      const free = await board.fs_free(target)
      log(`free bytes at "${target}":`, free)
    } catch(e) {
      log('error', e.message)
    }
    board.close()
    return Promise.resolve()
  })
}

const freeMemory = (args, port) => {
  ensurePort(port)
  const board = new Board()
  return board.open(port)
  .then(async () => {
    try {
      const free = await board.mem_free()
      log('free memory (bytes):', free)
    } catch(e) {
      log('error', e.message)
    }
    board.close()
    return Promise.resolve()
  })
}

const formatPartition = (args, port) => {
  ensurePort(port)
  const target = args[0] || ''
  if (!target) {
    log('error: --format requires a board type (pyb, esp, rp2)')
    return Promise.resolve()
  }
  const helpersPath = path.join(__dirname, 'mpy_helpers.py')
  if (!fs.existsSync(helpersPath)) {
    log('error: mpy_helpers.py not found next to cli.js')
    return Promise.resolve()
  }
  const helpers = fs.readFileSync(helpersPath, 'utf-8')
  const board = new Board()
  return board.open(port)
  .then(async () => {
    try {
      await board.enter_raw_repl()
      await board.exec_raw(helpers)
      const out = await board.exec_raw(`format_${target}()`)
      await board.exit_raw_repl()
      const err = board.exec_raw_err(out)
      if (err.trim()) throw new MicroPythonError(err.trim(), MicroPythonError.BOARD_ERROR)
      log('format complete')
    } catch(e) {
      log('error', e.message)
    }
    board.close()
    return Promise.resolve()
  })
}

const catFile = (args, port) => {
  ensurePort(port)
  const board = new Board()
  const [ boardFilename ] = args

  return board.open(port)
  .then(async () => {
    try {
      const out = await board.fs_cat(boardFilename)
      log(out)
    } catch(e) {
      log('error', e.message)
    }
    board.close()
    return Promise.resolve()
  })
}

const fileExists = (args, port) => {
  ensurePort(port)
  const board = new Board()
  const [ boardFilename ] = args

  return board.open(port)
  .then(async () => {
    try {
      const exists = await board.fs_exists(boardFilename)
      log(exists ? 'exists' : 'not found', boardFilename)
    } catch(e) {
      log('error', e.message)
    }
    board.close()
    return Promise.resolve()
  })
}

const saveFile = (args, port) => {
  ensurePort(port)
  const board = new Board()
  const [ content, boardFilename ] = args

  return board.open(port)
  .then(async () => {
    try {
      await board.fs_save(content, boardFilename)
      log('saved', boardFilename)
    } catch(e) {
      log('error', e.message)
    }
    board.close()
    return Promise.resolve()
  })
}

const commandHelp = [
  { cmd: '--listports',     short: '-L', args: '',                          desc: 'List available serial ports with a vendorId/productId' },
  { cmd: '--listfiles',     short: '-l', args: '[folder]',                  desc: 'List files on the board (defaults to fs root)' },
  { cmd: '--ilistfiles',    short: '-i', args: '[folder]',                  desc: 'List files with type and size (defaults to fs root)' },
  { cmd: '--executestring', short: '-e', args: '"code"',                    desc: 'Execute a Python string on the board' },
  { cmd: '--executefile',   short: '-x', args: '<local.py>',                desc: 'Execute a local Python file on the board' },
  { cmd: '--putfile',       short: '-u', args: '<local> <board>',           desc: 'Upload a file from disk to the board' },
  { cmd: '--getfile',       short: '-g', args: '<board> <local>',           desc: 'Download a file from the board to disk' },
  { cmd: '--removefile',    short: '-d', args: '<board-path>',              desc: 'Remove a file from the board' },
  { cmd: '--removefolder',  short: '-D', args: '<board-path>',              desc: 'Remove a folder from the board' },
  { cmd: '--makefolder',    short: '-m', args: '<board-path>',              desc: 'Create a folder on the board' },
  { cmd: '--rename',        short: '-n', args: '<old-path> <new-path>',     desc: 'Rename or move a file on the board' },
  { cmd: '--reset',         short: '-r', args: '',                          desc: 'Soft reset the board (re-runs boot.py and main.py)' },
  { cmd: '--hardreset',     short: '-R', args: '',                          desc: 'Hard reset the board via machine.reset()' },
  { cmd: '--free',          short: '-f', args: '[board-path]',              desc: 'Show free bytes on the board filesystem (defaults to fs root)' },
  { cmd: '--mem',           short: '-M', args: '',                          desc: 'Show free heap memory on the board (runs gc.collect() first)' },
  { cmd: '--format',        short: '-F', args: '<pyb|esp|rp2>',             desc: 'Format the board filesystem using a helper from mpy_helpers.py' },
  { cmd: '--cat',           short: '-c', args: '<board-path>',              desc: 'Print the text content of a file on the board' },
  { cmd: '--exists',        short: '-E', args: '<board-path>',              desc: 'Check whether a file exists on the board' },
  { cmd: '--savefile',      short: '-S', args: '"<content>" <board-path>', desc: 'Save a string directly as a file on the board' },
  { cmd: '--port',          short: '-p', args: '<port>',                    desc: 'Serial port to connect to (required for most commands)' },
  { cmd: '--verbose',       short: '-v', args: '',                          desc: 'Enable verbose output and stream board data to console' },
  { cmd: '--help',          short: '-h', args: '',                          desc: 'Show this help message' },
]

const showHelp = () => {
  log('Usage: node cli.js --port <port> <command> [args]\n')
  log('Commands:')
  const pad = Math.max(...commandHelp.map(h => h.cmd.length + h.args.length)) + 2
  commandHelp.forEach(({ cmd, short, args, desc }) => {
    const flags = `${short}, ${cmd}`
    const left = args ? `${flags} ${args}` : flags
    log(`  ${left.padEnd(pad + 5)}  ${desc}`)
  })
}

const operations = {
  '--listports': listPorts,
  '--listfiles': listFiles,
  '--ilistfiles': ilistFiles,
  '--executestring': executeString,
  '--executefile': executeFile,
  '--putfile': putFile,
  '--getfile': getFile,
  '--removefile': removeFile,
  '--removefolder': removeFolder,
  '--makefolder': makeFolder,
  '--rename': renameFile,
  '--reset': softReset,
  '--hardreset': hardReset,
  '--free': freeSpace,
  '--mem': freeMemory,
  '--format': formatPartition,
  '--cat': catFile,
  '--exists': fileExists,
  '--savefile': saveFile,
  '--verbose': () => false,
  '--help': showHelp,
}

let args = extractArguments(process.argv)
let commands = extractCommands(args)
let port = commands['--port'] ? commands['--port'][0] : null

const actionableCommands = Object.keys(commands).filter(c => c !== '--port' && c !== '--verbose')

if (actionableCommands.length === 0) {
  showHelp()
} else if (commands['--verbose']) {
  log('VERBOSE')
  actionableCommands.forEach((command) => {
    log('executing command:')
    log('command', command)
    log('arguments', commands[command])
    log('port', port)
    operations[command](commands[command], port, log)
    .then(() => log('command executed', command, `\r\n`))
    .catch((e) => log('error', e, `\r\n`))
  })
} else {
  actionableCommands.forEach((command) => {
    operations[command](commands[command], port)
  })
}
