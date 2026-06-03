const Board = require('../micropython.js')
const { MicroPythonError } = require('../micropython.js')
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const bigFilePath = path.join(__dirname, 'image.jpg')
const bigPyFilePath = path.join(__dirname, 'big_file.py')
const DOWNLOADS_DIR = path.join(__dirname, 'downloads')

const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v')
const portArg = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : null
const filter = process.argv.slice(portArg ? 3 : 2).filter(a => !a.startsWith('-'))

// Thrown by a test to signal "completed but board could not run the task".
// Runner shows 🟧 rather than 🟩 or 🟥.
class TestSkipped extends Error {
  constructor(reason) {
    super(reason)
    this.name = 'TestSkipped'
  }
}

// Tracks whether boardOutput wrote to stdout without a trailing newline.
// Used to ensure the next console.log always starts on a fresh line.
let pendingNewline = false

// Override console.log so any in-test log (e.g. skip messages) also gets a
// newline before it when boardOutput has written partial output to stdout.
const _origConsoleLog = console.log
console.log = (...args) => {
  if (pendingNewline) {
    process.stdout.write('\n')
    pendingNewline = false
  }
  _origConsoleLog(...args)
}

function boardOutput(data) {
  if (VERBOSE) {
    // Strip raw REPL framing characters that should not appear in terminal output:
    //   ^OK   — raw REPL execution-start prefix
    //   \x04  — raw REPL frame separator (ETX)
    //   >$    — raw REPL terminator character
    const clean = data.replace(/^OK/, '').replace(/\x04/g, '').replace(/>$/, '')
    if (clean) {
      process.stdout.write(clean)
      pendingNewline = !clean.endsWith('\n')
    }
  }
}

function formatElapsed(ms) {
  const h = Math.floor(ms / 3600000).toString().padStart(2, '0')
  const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0')
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function sleep(millis) {
  return new Promise((resolve) => setTimeout(resolve, millis))
}

function getBoardRoot(board) {
  return board._fsRoot
}

async function before(port, retries = 3, retryDelay = 1500) {
  const board = new Board()
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await board.open(port)
      board.chunkSize = 256
      board.writeDelay = await board.calibrateDelay()
      return board
    } catch (e) {
      if (attempt === retries) throw e
      console.log(`  board open failed (attempt ${attempt}/${retries}): ${e.message} — retrying in ${retryDelay}ms`)
      await sleep(retryDelay)
    }
  }
}

async function after(board) {
  await board.close()
}

// ---------------------------------------------------------------------------
// Test registry
// ---------------------------------------------------------------------------

const tests = []

function register(name, fn, opts = {}) {
  tests.push({ name, fn, fnName: fn.name.replace(/^test_/, ''), skip: opts.skip ?? false })
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

// Verifies get_prompt() recovers the >>> prompt from three states:
// unknown state, already in raw REPL, and while code is running.
async function test_get_prompt(board) {
  let output = await board.get_prompt()
  assert.notEqual(output.indexOf('>>>'), -1)
  await board.enter_raw_repl()
  output = await board.get_prompt()
  assert.notEqual(output.indexOf('>>>'), -1)
  board.run(`from time import sleep\nwhile True:\n  print('.')\nsleep(1)\n`)
    .catch(() => null)
  output = await board.get_prompt()
  assert.notEqual(output.indexOf('>>>'), -1)
}


// Verifies eval() sends characters to the board in real time and the board
// echoes them back. Simulates interactive character-by-character typing.
async function test_real_time_repl(board) {
  let output = ''
  const fn = (o) => { output += o.toString() }
  board.serial.on('data', fn)
  board.serial.resume()
  await board.eval('pri')
  await sleep(10)
  await board.eval('nt(1')
  await sleep(10)
  await board.eval('23)')
  await board.eval('\r')
  await sleep(10)
  board.serial.removeListener('data', fn)
  board.serial.pause()
  assert.equal(output, 'print(123)\r\n123\r\n>>> ')
}


// Asserts a raw REPL response is well-formed and error-free.
// Works for both scripts with no output (OK\x04\x04>) and scripts that print.
// Pass `contains` to also assert specific stdout content is present.
function assertRawOutput(board, output, contains = null) {
  assert.ok(output.startsWith('OK'), `output should start with OK, got: ${JSON.stringify(output.slice(0, 40))}`)
  const err = board.exec_raw_err(output)
  assert.ok(err.trim() === '', `unexpected stderr: ${err.trim()}`)
  if (contains !== null) {
    assert.ok(output.includes(contains), `expected ${JSON.stringify(contains)} in output`)
  }
}


// Verifies enter_raw_repl() transitions to raw REPL mode and is idempotent
// (calling it again from raw REPL mode succeeds without hanging).
async function test_enter_raw_repl(board) {
  let output = await board.enter_raw_repl()
  assert.notEqual(output.indexOf('raw REPL; CTRL-B to exit'), -1)
  output = await board.enter_raw_repl()
  assert.notEqual(output.indexOf('raw REPL; CTRL-B to exit'), -1)
}


// Verifies exit_raw_repl() returns to the >>> prompt. Tests both calling it
// from raw REPL mode and from normal REPL (where it is a no-op recovery).
async function test_exit_raw_repl(board) {
  let output = await board.exit_raw_repl()
  assert.notEqual(output.indexOf('>>>'), -1)
  await board.enter_raw_repl()
  output = await board.exit_raw_repl()
  assert.notEqual(output.indexOf('>>>'), -1)
}


// Verifies exec_raw() executes a short Python statement and returns the
// expected raw REPL framing: OK<output>\x04<error>\x04>
async function test_execute_raw_small(board) {
  await board.enter_raw_repl()
  const output = await board.exec_raw('print(123)')
  await board.exit_raw_repl()
  assertRawOutput(board, output, '123\r\n')
}


// Verifies exec_raw() handles a large script requiring multiple serial write
// chunks. Skipped by default (long runner).
async function test_execute_raw_big(board) {
  board.execTimeout = null
  const bigFile = fs.readFileSync(bigPyFilePath)
  const needed = Math.ceil(bigFile.length * 1.8)
  const free = await board.mem_free()
  console.log(`  ram: ~${needed} needed, ${free} free`)
  if (free < needed) {
    throw new TestSkipped(`insufficient memory`)
  }
  await board.enter_raw_repl()
  try {
    const output = await board.exec_raw(bigFile.toString(), boardOutput)
    const err = board.exec_raw_err(output)
    if (err.includes('MemoryError')) {
      throw new TestSkipped(`MemoryError during execution — insufficient runtime RAM`)
    }
    assertRawOutput(board, output, 'ALL TESTS PASSED')
  } finally {
    board.execTimeout = null
    await board.exit_raw_repl()
  }
}


// Verifies run() executes code via the high-level API (handles raw REPL
// entry and exit internally) and returns the correct output.
async function test_run_small_code(board) {
  const output = await board.run('print(123)', boardOutput)
  assertRawOutput(board, output, '123\r\n')
}


// Verifies run() handles large code payloads. Skipped by default (long runner).
async function test_run_big_code(board) {
  board.execTimeout = null
  const bigFile = fs.readFileSync(bigPyFilePath)
  const needed = Math.ceil(bigFile.length * 1.8)
  const free = await board.mem_free()
  console.log(`  ram: ~${needed} needed, ${free} free`)
  let output
  try {
    output = await board.run(bigFile.toString(), boardOutput)
  } catch (e) {
    if (e instanceof MicroPythonError && e.code === MicroPythonError.INSUFFICIENT_SPACE) {
      throw new TestSkipped(`insufficient memory`)
    }
    throw e
  }
  const err = board.exec_raw_err(output)
  if (err.includes('MemoryError')) {
    throw new TestSkipped(`MemoryError during execution — insufficient runtime RAM`)
  }
  assertRawOutput(board, output, 'ALL TESTS PASSED')
}


// Verifies that stop() cancels an in-progress run() and the board can
// accept and execute a new run() call afterwards.
async function test_run_code_after_stop(board) {
  board.run(
    `from time import sleep\nfor i in range(0, 10):\n  print('.')\n  sleep(1)\n`
  ).catch(e => { })
  await new Promise((r) => setTimeout(r, 100))
  await board.stop()
  await new Promise((r) => setTimeout(r, 100))
  await board.get_prompt()
  const output = await board.run('print(123)')
  assert.equal(output, 'OK123\r\n\x04\x04>')
}


// Verifies that a second run() call cancels the first via reject_run and
// the board executes the new code correctly.
async function test_run_code_after_run(board) {
  board.run(
    `from time import sleep\nfor i in range(0, 10):\n  print('.')\n  sleep(1)\n`
  ).catch(e => { })
  await board.get_prompt()
  const output = await board.run('print(123)')
  assert.equal(output, 'OK123\r\n\x04\x04>')
}


// Verifies fs_put() uploads a file to the board and fs_get() downloads it
// back. Compares original and downloaded files byte-for-byte on disk.
async function test_upload_file(board) {
  const diskFilePath = path.join(__dirname, './test.py')
  const fileName = path.basename(diskFilePath)
  const fsRoot = getBoardRoot(board)
  const serialFilePath = path.join(fsRoot, fileName)
  const downloadPath = path.join(DOWNLOADS_DIR, fileName)
  console.log(`  upload:   ${diskFilePath} -> ${serialFilePath}`)
  await board.fs_put(diskFilePath, serialFilePath)
  console.log(`  download: ${serialFilePath} -> ${downloadPath}`)
  await board.fs_get(serialFilePath, downloadPath)
  const original = fs.readFileSync(diskFilePath)
  const downloaded = fs.readFileSync(downloadPath)
  await board.fs_rm(serialFilePath)
  assert.ok(original.equals(downloaded), 'uploaded file should match original on disk')
}


// Verifies fs_put() + fs_get() roundtrip for a large binary file.
// Uses bigFilePath (configurable at the top of this file).
// Skipped by default (long runner).
async function test_upload_big_file(board) {
  const diskFilePath = path.resolve(bigFilePath)
  const fileName = path.basename(diskFilePath)
  const fsRoot = getBoardRoot(board)
  const serialFilePath = path.join(fsRoot, fileName)
  const downloadPath = path.join(DOWNLOADS_DIR, fileName)
  console.log(`  upload:   ${diskFilePath} -> ${serialFilePath}`)
  await board.fs_put(diskFilePath, serialFilePath, boardOutput)
  console.log(`  download: ${serialFilePath} -> ${downloadPath}`)
  await board.fs_get(serialFilePath, downloadPath, boardOutput)
  const original = fs.readFileSync(diskFilePath)
  const downloaded = fs.readFileSync(downloadPath)
  await board.fs_rm(serialFilePath)
  assert.ok(original.equals(downloaded), 'uploaded binary content should match original on disk')
}


// Verifies fs_mkdir() creates a directory visible in fs_ils() and
// fs_rmdir() removes it.
async function test_create_folder(board) {
  const fsRoot = getBoardRoot(board)
  const folderPath = path.join(fsRoot, 'test_folder')
  console.log(`  mkdir:  ${folderPath}`)
  await board.fs_mkdir(folderPath)
  const ls = await board.fs_ils(fsRoot)
  const folder = ls.find(f => f[0] === 'test_folder' && f[1] === 16384)
  assert.ok(folder)
  console.log(`  rmdir:  ${folderPath}`)
  await board.fs_rmdir(folderPath)
}


// Verifies fs_ils() returns correct type flags for files (32768) and
// folders (16384) after creating both.
async function test_list_files_and_folders(board) {
  const file = ['test.py', 32768]
  const test_folder = 'test_folder'
  const diskFilePath = path.join(__dirname, './', file[0])
  const fsRoot = getBoardRoot(board)
  const serialFilePath = path.join(fsRoot, file[0])
  const folderPath = path.join(fsRoot, test_folder)
  console.log(`  upload: ${diskFilePath} -> ${serialFilePath}`)
  await board.fs_put(diskFilePath, serialFilePath)
  console.log(`  mkdir:  ${folderPath}`)
  await board.fs_mkdir(folderPath)
  const ls = await board.fs_ils(fsRoot)
  const createdFile = ls.find(f => f[0] === file[0] && f[1] === file[1])
  const createdFolder = ls.find(f => f[0] === test_folder && f[1] === 16384)
  assert.ok(createdFile)
  assert.ok(createdFolder)
  await board.fs_rm(serialFilePath)
  await board.fs_rmdir(folderPath)
}


// Verifies fs_exists() returns true for a file that exists and false for
// a path that does not.
async function test_check_if_file_exists(board) {
  const fsRoot = getBoardRoot(board)
  const filePath = path.join(fsRoot, 'test_exist' + parseInt(Math.random() * 99999))
  const missingPath = path.join(fsRoot, 'xxx' + parseInt(Math.random() * 99999))
  console.log(`  save:   ${filePath}`)
  await board.fs_save('.', filePath)
  console.log(`  exists: ${filePath}`)
  const fileExists = await board.fs_exists(filePath)
  assert(fileExists)
  console.log(`  exists: ${missingPath}`)
  const fileDoesNotExist = await board.fs_exists(missingPath)
  assert.ok(!fileDoesNotExist)
  await board.fs_rm(filePath)
}


// Verifies fs_save() writes string content to the board and fs_cat()
// reads it back correctly.
async function test_save_file_content(board) {
  const fsRoot = getBoardRoot(board)
  const filePath = path.join(fsRoot, 'test.py')
  const content = `.`
  console.log(`  save: ${filePath}`)
  await board.fs_save(content, filePath)
  console.log(`  cat:  ${filePath}`)
  const boardContent = await board.fs_cat(filePath)
  assert.equal(content, boardContent)
}


// Verifies fs_save() handles large string content without truncation.
// Skipped by default (long runner).
async function test_save_big_file_content(board) {
  const fsRoot = getBoardRoot(board)
  const filePath = path.join(fsRoot, 'test.py')
  const content = fs.readFileSync(bigPyFilePath)
  console.log(`  save: ${bigPyFilePath} -> ${filePath}`)
  await board.fs_save(content.toString(), filePath)
  console.log(`  cat:  ${filePath}`)
  const boardContent = await board.fs_cat(filePath)
  assert.equal(content, boardContent)
}


// Verifies fs_get() downloads a file from the board to disk and the
// content matches what was saved.
async function test_get_file(board) {
  const fsRoot = getBoardRoot(board)
  const filePath = path.join(fsRoot, 'test_get.py')
  const content = 'x = 1\n'
  const downloadPath = path.join(DOWNLOADS_DIR, 'test_get.py')
  console.log(`  save:     ${filePath}`)
  await board.fs_save(content, filePath)
  console.log(`  download: ${filePath} -> ${downloadPath}`)
  await board.fs_get(filePath, downloadPath)
  const downloaded = fs.readFileSync(downloadPath, 'utf-8')
  await board.fs_rm(filePath)
  assert.equal(content, downloaded)
}


// Verifies fs_rm() deletes a file. Checks existence before and after deletion.
async function test_remove_file(board) {
  const fsRoot = getBoardRoot(board)
  const filePath = path.join(fsRoot, 'test_remove' + parseInt(Math.random() * 99999))
  console.log(`  save: ${filePath}`)
  await board.fs_save('.', filePath)
  const fileExists = await board.fs_exists(filePath)
  assert(fileExists)
  console.log(`  rm:   ${filePath}`)
  await board.fs_rm(filePath)
  const fileDoesNotExist = await board.fs_exists(filePath)
  assert.ok(!fileDoesNotExist)
}


// Verifies fs_rmdir() removes a folder. Confirms presence in fs_ils()
// before and absence after deletion.
async function test_remove_folder(board) {
  const fsRoot = getBoardRoot(board)
  const folderPath = path.join(fsRoot, 'test_remove' + parseInt(Math.random() * 99999))
  const folderName = path.basename(folderPath)
  console.log(`  mkdir: ${folderPath}`)
  await board.fs_mkdir(folderPath)
  let ls = await board.fs_ils(fsRoot)
  const foundFolder = ls.find(f => f[0] === folderName && f[1] === 16384)
  assert.ok(foundFolder)
  console.log(`  rmdir: ${folderPath}`)
  await board.fs_rmdir(folderPath)
  ls = await board.fs_ils(fsRoot)
  const notFoundFolder = ls.find(f => f[0] === folderName && f[1] === 16384)
  assert.ok(!notFoundFolder)
}


// Verifies close() completes cleanly and the board can be reopened immediately.
// Also checks _closing is reset to false after close, confirming the flag
// lifecycle works correctly.
async function test_intentional_close_no_disconnect(board) {
  await board.close()
  assert.strictEqual(board._closing, false, '_closing should be false after close')
  await board.open(board.port)
}


// Verifies _checkUbinascii() queries the board and sets _hasUbinascii to
// a boolean (not null) after the check.
async function test_ubinascii_detection_sets_flag(board) {
  assert.strictEqual(board._hasUbinascii, null, '_hasUbinascii should start as null')
  await board.enter_raw_repl()
  await board._checkUbinascii()
  await board.exit_raw_repl()
  assert.ok(typeof board._hasUbinascii === 'boolean', '_hasUbinascii should be boolean after check')
}


// Verifies _hasUbinascii is not re-queried between transfers on the same
// connection — its value must remain stable across multiple fs_save calls.
async function test_ubinascii_detection_cached(board) {
  const fsRoot = getBoardRoot(board)
  const filePath = path.join(fsRoot, 'test_ubinascii_cache.py')
  console.log(`  save: ${filePath}`)
  await board.fs_save('.', filePath)
  const firstValue = board._hasUbinascii
  assert.ok(firstValue !== null, '_hasUbinascii should be set after first transfer')
  console.log(`  save: ${filePath}`)
  await board.fs_save('.', filePath)
  assert.strictEqual(board._hasUbinascii, firstValue, '_hasUbinascii should not change between transfers')
  await board.fs_rm(filePath)
}


// Verifies close() resets _hasUbinascii to null so a reconnect to a
// different board triggers a fresh capability check.
async function test_ubinascii_flag_resets_on_close(board) {
  const fsRoot = getBoardRoot(board)
  const filePath = path.join(fsRoot, 'test_ubinascii_close.py')
  console.log(`  save: ${filePath}`)
  await board.fs_save('.', filePath)
  assert.ok(board._hasUbinascii !== null, '_hasUbinascii should be set after transfer')
  await board.close()
  assert.strictEqual(board._hasUbinascii, null, '_hasUbinascii should be null after close')
  await board.open(board.port)
  await board.fs_rm(filePath)
}


// Verifies the full binary roundtrip for all 256 possible byte values
// (0x00–0xFF) via fs_put() + fs_get(). Compares files byte-for-byte on disk.
async function test_upload_binary_file(board) {
  const binaryContent = Buffer.alloc(256)
  for (let i = 0; i < 256; i++) binaryContent[i] = i
  const srcPath = path.join(DOWNLOADS_DIR, 'test_binary_src.bin')
  const downloadPath = path.join(DOWNLOADS_DIR, 'test_binary_downloaded.bin')
  const fsRoot = getBoardRoot(board)
  const boardPath = path.join(fsRoot, 'test_binary.bin')
  fs.writeFileSync(srcPath, binaryContent)
  console.log(`  upload:   ${srcPath} -> ${boardPath}`)
  await board.fs_put(srcPath, boardPath)
  console.log(`  download: ${boardPath} -> ${downloadPath}`)
  await board.fs_get(boardPath, downloadPath)
  const original = fs.readFileSync(srcPath)
  const downloaded = fs.readFileSync(downloadPath)
  await board.fs_rm(boardPath)
  assert.ok(original.equals(downloaded), 'all 256 byte values should roundtrip correctly')
}


// Verifies the base64 encoding path (ubinascii) produces a correct binary
// roundtrip for all 256 byte values by forcing _hasUbinascii = true.
async function test_upload_binary_base64_path(board) {
  const binaryContent = Buffer.alloc(256)
  for (let i = 0; i < 256; i++) binaryContent[i] = i
  const srcPath = path.join(DOWNLOADS_DIR, 'test_binary_b64_src.bin')
  const downloadPath = path.join(DOWNLOADS_DIR, 'test_binary_b64_dl.bin')
  const fsRoot = getBoardRoot(board)
  const boardPath = path.join(fsRoot, 'test_binary_b64.bin')
  fs.writeFileSync(srcPath, binaryContent)
  board._hasUbinascii = true
  console.log(`  upload: ${srcPath} -> ${boardPath}`)
  await board.fs_put(srcPath, boardPath)
  console.log(`  download: ${boardPath} -> ${downloadPath}`)
  await board.fs_get(boardPath, downloadPath)
  await board.fs_rm(boardPath)
  board._hasUbinascii = null
  const original = fs.readFileSync(srcPath)
  const downloaded = fs.readFileSync(downloadPath)
  assert.ok(original.equals(downloaded), 'all 256 byte values should roundtrip via base64 path')
}


// Verifies the hex encoding fallback path produces a correct binary roundtrip
// for all 256 byte values by forcing _hasUbinascii = false.
async function test_upload_binary_hex_path(board) {
  const binaryContent = Buffer.alloc(256)
  for (let i = 0; i < 256; i++) binaryContent[i] = i
  const srcPath = path.join(DOWNLOADS_DIR, 'test_binary_hex_src.bin')
  const downloadPath = path.join(DOWNLOADS_DIR, 'test_binary_hex_dl.bin')
  const fsRoot = getBoardRoot(board)
  const boardPath = path.join(fsRoot, 'test_binary_hex.bin')
  fs.writeFileSync(srcPath, binaryContent)
  board._hasUbinascii = false
  console.log(`  upload: ${srcPath} -> ${boardPath}`)
  await board.fs_put(srcPath, boardPath)
  console.log(`  download: ${boardPath} -> ${downloadPath}`)
  await board.fs_get(boardPath, downloadPath)
  await board.fs_rm(boardPath)
  board._hasUbinascii = null
  const original = fs.readFileSync(srcPath)
  const downloaded = fs.readFileSync(downloadPath)
  assert.ok(original.equals(downloaded), 'all 256 byte values should roundtrip via hex path')
}


// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function pickPort(ports) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    console.log('\nAvailable boards:')
    ports.forEach((p, i) => console.log(`  ${i + 1}) ${p}`))
    rl.question('\nSelect board (number): ', (answer) => {
      rl.close()
      const index = parseInt(answer, 10) - 1
      if (isNaN(index) || index < 0 || index >= ports.length) {
        console.log('Invalid selection.')
        process.exit(0)
      }
      resolve(ports[index])
    })
  })
}

async function main() {
  const toRun = filter.length
    ? tests.filter(t => filter.includes(t.fnName))
    : tests.filter(t => !t.skip)

  if (toRun.length === 0) {
    console.log('No matching tests found.')
    process.exit(0)
  }

  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })

  const board = new Board()
  let port = portArg
  if (!port) {
    let ports = await board.list_ports()
    ports = ports.filter(p => p.vendorId && p.productId).map(p => p.path)
    if (ports.length === 0) {
      console.log('No board found. Connect a MicroPython board and try again.')
      process.exit(0)
    }
    port = ports.length === 1 ? ports[0] : await pickPort(ports)
  }

  const errors = []
  const skipped = []
  console.log('')
  console.log('🔊 Running', toRun.length, 'test(s) on', port)

  for (const { name, fn } of toRun) {
    console.log('\n' + '='.repeat(50))
    console.log('>', name)
    pendingNewline = false
    const board = await before(port)
    const t0 = Date.now()
    try {
      await fn(board)
      if (pendingNewline) process.stdout.write('\n')
      console.log(`🟩 success (${formatElapsed(Date.now() - t0)})`)
    } catch (e) {
      if (pendingNewline) process.stdout.write('\n')
      if (e instanceof TestSkipped) {
        console.log(`🟧 skipped: ${e.message} (${formatElapsed(Date.now() - t0)})`)
        skipped.push(name)
      } else {
        console.log(`🟥 error (${formatElapsed(Date.now() - t0)})`, e)
        errors.push(name)
      }
    }
    await after(board)
  }

  console.log('')
  if (skipped.length) {
    console.log('Skipped:', skipped.length)
    for (const name of skipped) {
      console.log(' ', name)
    }
  }
  console.log('Errors:', errors.length)
  for (const name of errors) {
    console.log(' ', name)
  }
}

register('get prompt', test_get_prompt)
register('real time repl', test_real_time_repl)
register('enter raw repl', test_enter_raw_repl)
register('exit raw repl', test_exit_raw_repl)
register('execute raw small', test_execute_raw_small)
register('execute raw big', test_execute_raw_big)
register('run small code', test_run_small_code)
register('run big code', test_run_big_code)
register('run code after stop', test_run_code_after_stop)
register('run code after run', test_run_code_after_run)
register('upload file', test_upload_file)
register('upload big file', test_upload_big_file)
register('create folder', test_create_folder)
register('list files and folders', test_list_files_and_folders)
register('check if file exists', test_check_if_file_exists)
register('save file content', test_save_file_content)
register('save big file content', test_save_big_file_content)
register('get file', test_get_file)
register('remove file', test_remove_file)
register('remove folder', test_remove_folder)
register('intentional close no disconnect', test_intentional_close_no_disconnect)
register('ubinascii detection sets flag', test_ubinascii_detection_sets_flag)
register('ubinascii detection cached across transfers', test_ubinascii_detection_cached)
register('ubinascii flag resets on close', test_ubinascii_flag_resets_on_close)
register('upload binary file', test_upload_binary_file)
register('upload binary file base64 path', test_upload_binary_base64_path)
register('upload binary file hex path', test_upload_binary_hex_path)

main()
