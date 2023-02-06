const fs = require('fs')
const path = require('path')
const Board = require('./micropython.js')

const extractArguments = (args) => {
    return args.slice(2)
}

const extractCommands = (args) => {
    let commands = {}
    let currentCommand = null
    // TODO: Use reduce instead of forEach
    args.forEach((value) => {
        // If it's a command, turn set is as the current one
        if (value.slice(0, 2) === '--') {
            currentCommand = value
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

const extractFileArray = (output) => {
    output = output.replace(/'/g, '"');
    output = output.split('OK')
    let files = output[2] || ''
    files = files.slice(0, files.indexOf(']')+1)
    files = JSON.parse(files)
    return files
}

function ensurePort(port) {
    if (!port) throw new Error('You must specify a port.')
}

const listPorts = (args) => {
    const board = new Board()
    board.listPorts()
        .then((ports) => {
            console.log('available ports', ports)
        })
}

const listFiles = (args, port) => {
    ensurePort(port)
    const board = new Board()
    board.open(port)
        .then(async () => {
            const folder = args[0] || '/'
            try {
                let output = await board.fs_ls(folder)
                let files = extractFileArray(output)
                console.log(`files at "${folder}"`, files)
            } catch(e) {
                console.log('error', e)
            }
            board.close()
        })
}

const executeString = (args, port) => {
    ensurePort(port)
    const board = new Board()
    const code = args[0] || ''
    board.open(port)
        .then(() => board.enter_raw_repl())
        .then(() => board.exec_raw({ command: code }))
        .then((out) => {
            console.log(out)
            return board.exit_raw_repl()
        })
        .then(() => board.close())
        .catch((err) => {
            console.log('error')
            console.log(err)
            board.exit_raw_repl(true)
            board.close()
        })
}

const executeFile = (args, port) => {
    ensurePort(port)
    let board = new Board()
    const filename = args[0] || ''
    board.open(port)
        .then(async () => {
            try {
                await board.execfile(filename)
            } catch(e) {
                console.log('error', e)
            }
            board.close()
        })
}

const putFile = (args, port) => {
    ensurePort(port)
    const board = new Board()
    const [ diskFilename, boardFilename ] = args
    board.open(port)
        .then(async () => {
            try {
                await board.fs_put(diskFilename, boardFilename)
            } catch(e) {
                console.log('error', e)
            }
            board.close()
        })
}

const getFile = (args, port) => {
    ensurePort(port)
    const board = new Board()
    const [ boardFilename, diskFilename ] = args
    board.open(port)
        .then(async () => {
            try {
                let output = await board.fs_cat(boardFilename)
                output = output.split('OK')
                console.log(output[2])
                fs.writeFileSync(diskFilename, output[2])
            } catch(e) {
                console.log('error', e)
            }
            board.close()
        })

}

const operations = {
    '--listports': listPorts,
    '--listfiles': listFiles,
    '--executestring': executeString,
    '--executefile': executeFile,
    '--putfile': putFile,
    '--getfile': getFile
}

let args = extractArguments(process.argv)
let commands = extractCommands(args)
let port = commands['--port'] ? commands['--port'][0] : null

Object.keys(commands)
    .filter((command) => command !== '--port')
    .forEach((command) => {
        operations[command](commands[command], port)
    })

