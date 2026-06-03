const { SerialPort } = require('serialport')
const fs = require('fs')
const path = require('path')

class MicroPythonError extends Error {
  static INTERRUPTED_BY_RERUN  = 'INTERRUPTED_BY_RERUN'
  static INTERRUPTED_BY_STOP   = 'INTERRUPTED_BY_STOP'
  static INTERRUPTED_BY_RESET  = 'INTERRUPTED_BY_RESET'
  static TIMEOUT               = 'TIMEOUT'
  static NO_DEVICE             = 'NO_DEVICE'
  static INSUFFICIENT_SPACE    = 'INSUFFICIENT_SPACE'
  static INSUFFICIENT_MEMORY   = 'INSUFFICIENT_MEMORY'
  static BOARD_ERROR           = 'BOARD_ERROR'
  static UNEXPECTED_RESPONSE   = 'UNEXPECTED_RESPONSE'
  static MISSING_ARGUMENT      = 'MISSING_ARGUMENT'
  static DISCONNECTED          = 'DISCONNECTED'
  static PORT_ERROR            = 'PORT_ERROR'

  constructor(message, code, path = null) {
    super(message)
    this.name = 'MicroPythonError'
    this.code = code
    this.path = path
  }
}

function sleep(millis) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, millis)
  })
}

function fixLineBreak(str) {
  return str.replace(/\r\n/g, '\n')
}

function extract(out) {
  // Response format: "OK${stdout}\x04${stderr}\x04>"
  // exec_raw already throws on stderr — this just pulls stdout
  const body = out.slice(2)
  const stdoutEnd = body.indexOf('\x04')
  return stdoutEnd === -1 ? body : body.slice(0, stdoutEnd)
}

function extractBytes(out, cut_before = 2, cut_after = 3) {
  bytes = out.slice(cut_before, -cut_after)
  bytes = bytes.split(',').map(Number)
  return bytes
}

class MicroPythonBoard {
  constructor() {
    this.port = null
    this.serial = null
    this.reject_run = null
    this._hasUbinascii = null
    this._fsRoot = null
    this.chunkSize = 256
    this.writeDelay = 10
    this.execTimeout = null
    this._pendingReads = new Set()
    this._closing = false
    this._dataCallback = null
  }

  // Register a callback to receive bytes forwarded to the terminal consumer.
  setDataCallback(fn) {
    this._dataCallback = fn
  }

  list_ports() {
    return SerialPort.list()
  }

  async open(port) {
    if (port) {
      this.port = port
    } else {
      return Promise.reject(
        new MicroPythonError(`No device specified`, MicroPythonError.NO_DEVICE)
      )
    }
    if (this.serial && this.serial.isOpen) {
      await new Promise((resolve, reject) => {
        this.serial.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      this.serial = null
    }

    this.serial = new SerialPort({
      path: this.port,
			baudRate: 115200,
      lock: false,
			autoOpen: false
		})
    this.serial.pause()

    return new Promise((resolve, reject) => {
      this.serial.open(async (err) => {
        if (err) {
          reject(err)
        } else {
          this.serial.on('error', (serialErr) => {
            this._cancelPendingReads(
              new MicroPythonError(serialErr.message, MicroPythonError.PORT_ERROR)
            )
          })
          this.serial.on('close', () => {
            if (this._closing) return
            this._cancelPendingReads(
              new MicroPythonError('Serial port closed unexpectedly', MicroPythonError.DISCONNECTED)
            )
          })
          this.serial.on('data', (chunk) => {
            if (this._pendingReads.size === 0 && this._dataCallback && !this.serial.isPaused()) {
              this._dataCallback(chunk)
            }
          })
          await this.enter_raw_repl()
          await this._getRoot()
          await this.exit_raw_repl()
          resolve()
        }
      })
    })
  }

  close() {
    this._hasUbinascii = null
    this._fsRoot = null
    this._pendingReads.clear()
    if (this.serial && this.serial.isOpen) {
      this._closing = true
      return new Promise((resolve, reject) => {
        this.serial.close((err) => {
          this._closing = false
          if (err) reject(err)
          else resolve()
        })
      })
    } else {
      return Promise.resolve()
    }
  }

  read_until(ending, data_consumer, timeout = 10000, passThrough = false) {
    return new Promise((resolve, reject) => {
      let buff = ''
      let timer = null

      const cleanup = () => {
        clearTimeout(timer)
        this.serial.removeListener('data', fn)
        this.serial.pause()
        this._pendingReads.delete(cancelFn)
      }

      const cancelFn = (err) => {
        cleanup()
        reject(err)
      }

      const resetTimer = () => {
        if (!timeout) return
        clearTimeout(timer)
        timer = setTimeout(() => {
          cleanup()
          reject(new MicroPythonError(`read_until timed out waiting for '${ending}' — board may have crashed or reset`, MicroPythonError.TIMEOUT))
        }, timeout)
      }

      const fn = (o) => {
        resetTimer()
        buff += o.toString()
        if (data_consumer) {
          data_consumer(o.toString())
        }
        if (passThrough && this._dataCallback) {
          this._dataCallback(o)
        }
        if (buff.indexOf(ending) !== -1) {
          cleanup()
          resolve(buff)
        }
      }

      this._pendingReads.add(cancelFn)
      this.serial.on('data', fn)
      this.serial.resume()
      resetTimer()
    })
  }

  _cancelPendingReads(err) {
    const pending = [...this._pendingReads]
    this._pendingReads.clear()
    for (const cancel of pending) {
      cancel(err)
    }
  }

  async _drain() {
    return Promise.race([
      new Promise((resolve, reject) => this.serial.drain(err => err ? reject(err) : resolve())),
      new Promise(resolve => setTimeout(resolve, 500))
    ])
  }

  async write_and_read_until(cmd, expect, data_consumer, timeout = 10000, passThrough = false, resumeAfter = true) {
    this.serial.pause()
    for (let i = 0; i < cmd.length; i+=this.chunkSize) {
      const s = cmd.slice(i, i+this.chunkSize)
      await this.serial.write(Buffer.from(s))
      await this._drain()
      await sleep(this.writeDelay)
    }
    let o
    if(expect) {
      o = await this.read_until(expect, data_consumer, timeout, passThrough)
    }
    await this.serial.flush()
    await sleep(10)
    if (resumeAfter) {
      this.serial.resume()
    }
    return o
  }

  async get_prompt(captureInterrupt = false) {
    await sleep(150)
    await this.stop()
    await sleep(150)
    if (captureInterrupt) {
      // Capture KeyboardInterrupt output with passThrough so _dataCallback (and the terminal stop-buffer) sees the traceback.
      // Board in raw REPL exec sends the interrupt response ending with \x04> (EOT + raw REPL prompt).
      // Interactive/idle boards don't, therefore we timeout and continue — nothing to capture.
      try {
        await this.write_and_read_until(`\r\x03`, '\x04>', null, 1500, true, false)
      } catch (_) {}
    }
    // Normalise board state: Ctrl+B exits raw REPL if needed (->interactive), Ctrl+A enters raw REPL.
    // This guarantees we can exit raw REPL next and always get the MicroPython banner + >>> prompt,
    // regardless of whether the board started in interactive or raw REPL mode.
    await this.write_and_read_until(`\r\x03\x02\x01`, 'raw REPL; CTRL-B to exit\r\n>', null, 10000, false, false)
    // Exit raw REPL → board always emits the MicroPython banner + \r\n>>>
    const banner = await this.write_and_read_until(`\x02`, '\r\n>>>')
    return Promise.resolve(banner)
  }

  async enter_raw_repl() {
    const out = await this.write_and_read_until(`\x01`, `raw REPL; CTRL-B to exit\r\n>`)
    return Promise.resolve(out)
  }

  async exit_raw_repl(passThrough = false) {
    const out = await this.write_and_read_until(`\x02`, '\r\n>>>', null, 10000, passThrough)
    return Promise.resolve(out)
  }

  async exec_raw(cmd, data_consumer, passThrough = false) {
    await this.write_and_read_until(cmd)
    const out = await this.write_and_read_until('\x04', '\x04>', data_consumer, this.execTimeout, passThrough)
    return Promise.resolve(out)
  }

  exec_raw_err(out) {
    // Extracts stderr from an exec_raw response buffer.
    // Use this when the caller needs to detect Python-side errors.
    const body = out.slice(2)
    const stdoutEnd = body.indexOf('\x04')
    return stdoutEnd === -1 ? '' : body.slice(stdoutEnd + 1, body.lastIndexOf('\x04'))
  }


  async _checkRam(code) {
    const needed = Math.ceil(code.length * 1.8)
    const free = await this._freeMemory()
    if (free < needed) {
      throw new MicroPythonError(
        `Not enough memory to run script: need ~${needed} bytes, ${free} available`,
        MicroPythonError.INSUFFICIENT_MEMORY
      )
    }
  }

  async execfile(filePath, data_consumer) {
    data_consumer = data_consumer || function() {}
    if (filePath) {
      const code = fs.readFileSync(path.resolve(filePath)).toString()
      await this.enter_raw_repl()
      await this._checkRam(code)
      const output = await this.exec_raw(code, data_consumer)
      await this.exit_raw_repl()
      return Promise.resolve(extract(output))
    }
    return Promise.reject(new MicroPythonError(`Path to file was not specified`, MicroPythonError.MISSING_ARGUMENT))
  }

  async run(code, data_consumer, onBeforeExec) {
    data_consumer = data_consumer || function() {}
    return new Promise(async (resolve, reject) => {
      if (this.reject_run) {
        this.reject_run(new MicroPythonError('re-run', MicroPythonError.INTERRUPTED_BY_RERUN))
        this.reject_run = null
      }
      this.reject_run = reject
      try {
        await this.enter_raw_repl()
        await this._checkRam(code || '#')
        if (onBeforeExec) await onBeforeExec()
        const output = await this.exec_raw(code || '#', data_consumer, true)
        await this.exit_raw_repl()
        return resolve(output)
      } catch (e) {
        // For interrupt errors (stop/reset/rerun) the caller's recovery flow
        // (getPrompt / reset) already normalises the board state.  Calling
        // exit_raw_repl() here would create a pending read that silently
        // consumes the board's KeyboardInterrupt response, preventing it from
        // reaching _dataCallback and the terminal.  Only call it for genuine
        // errors (e.g. INSUFFICIENT_MEMORY) where the board is sitting idle in
        // raw REPL and no external recovery is in progress.
        const isInterrupt = e?.code === MicroPythonError.INTERRUPTED_BY_STOP  ||
                            e?.code === MicroPythonError.INTERRUPTED_BY_RESET  ||
                            e?.code === MicroPythonError.INTERRUPTED_BY_RERUN
        if (!isInterrupt) {
          try { await this.exit_raw_repl() } catch (_) {}
        }
        reject(e)
        this.reject_run = null
      }
    })
  }

  async eval(k) {
    await this.serial.write(Buffer.from(k))
    return Promise.resolve()
  }

  async stop() {
    const err = new MicroPythonError('pre stop', MicroPythonError.INTERRUPTED_BY_STOP)
    if (this.reject_run) {
      this.reject_run(err)
      this.reject_run = null
    }
    this._cancelPendingReads(err)
    // Dismiss any data with ctrl-C
    await this.serial.write(Buffer.from(`\x03`))
    return Promise.resolve()
  }

/*  DEPRECATED: use soft_reset() or hard_reset() instead
it is currently still available as a transition in consumers such as Arduino Lab for MicroPython Editor
*/
  
  async reset() {
    const err = new MicroPythonError('pre reset', MicroPythonError.INTERRUPTED_BY_RESET)
    if (this.reject_run) {
      this.reject_run(err)
      this.reject_run = null
    }
    this._cancelPendingReads(err)
    // Dismiss any data with ctrl-C
    await this.serial.write(Buffer.from(`\x03`))
    // Soft reboot
    await this.serial.write(Buffer.from(`\x04`))
    return Promise.resolve()
  }

  async soft_reset(onBeforeReset) {
    const err = new MicroPythonError('pre reset', MicroPythonError.INTERRUPTED_BY_RESET)
    if (this.reject_run) {
      this.reject_run(err)
      this.reject_run = null
    }
    this._cancelPendingReads(err)
    await this.enter_raw_repl()
    // machine.soft_reset() resets the Python interpreter without reinitialising
    // hardware peripherals. Board resets immediately — no \x04> response expected.
    await this.write_and_read_until(`import machine\nmachine.soft_reset()\n`)
    // Fire before sending \x04 so consumers can switch to reset mode before reboot
    // bytes arrive, while enter_raw_repl() protocol bytes are still suppressed.
    if (onBeforeReset) onBeforeReset()
    await this.serial.write(Buffer.from('\x04'))
  }

  async hard_reset() {
    const err = new MicroPythonError('pre reset', MicroPythonError.INTERRUPTED_BY_RESET)
    if (this.reject_run) {
      this.reject_run(err)
      this.reject_run = null
    }
    this._cancelPendingReads(err)
    await this.enter_raw_repl()
    // Full microcontroller reset — equivalent to pressing the reset button.
    // Board resets immediately — no \x04> response expected.
    await this.write_and_read_until(`import machine\nmachine.reset()\n`)
    await this.serial.write(Buffer.from('\x04'))
  }

  async fs_exists(filePath) {
    filePath = filePath || ''
    let command = `import os\ntry:\n`
        command += `  os.stat("${filePath}")\n`
        command += `  print(1)\n`
        command += `except OSError:\n`
        command += `  print(0)\n`
    await this.enter_raw_repl()
    let output = await this.exec_raw(command)
    await this.exit_raw_repl()
    const exists = extract(output).trim() === '1'
    return Promise.resolve(exists)
  }

  async fs_ls(folderPath) {
    folderPath = folderPath || ''
    let command = `import os\n`
        command += `try:\n`
        command += `  print(os.listdir("${folderPath}"))\n`
        command += `except OSError:\n`
        command += `  print([])\n`
    await this.enter_raw_repl()
    let output = await this.exec_raw(command)
    await this.exit_raw_repl()
    output = extract(output)
    output = output.replace(/'/g, '"')
    const files = JSON.parse(output)
    return Promise.resolve(files)
  }

  async fs_ils(folderPath) {
    folderPath = folderPath || ''
    let command = `import os\n`
        command += `try:\n`
        command += `  l=[]\n`
        command += `  f=None\n`
        command += `  for f in os.ilistdir("${folderPath}"):\n`
        command += `    l.append(list(f))\n`
        command += `  print(l)\n`
        command += `except OSError:\n`
        command += `  print([])\n`
        command += `del l\n`
        command += `if f:del f\n`
    await this.enter_raw_repl()
    let output = await this.exec_raw(command)
    await this.exit_raw_repl()
    output = extract(output)
    output = output.replace(/'/g, '"')
    let files = JSON.parse(output)
    return Promise.resolve(files)
  }

  async fs_cat_binary(filePath, data_consumer) {
    data_consumer = data_consumer || function() {}
    if (filePath) {
      await this.enter_raw_repl()
      await this._checkUbinascii()

      const sizeOut = await this.exec_raw(`import os\nprint(os.stat('${filePath}')[6])\n`)
      const fileSize = parseInt(extract(sizeOut).trim())

      let command
      if (this._hasUbinascii) {
        command =  `with open('${filePath}','rb') as f:\n`
        command += `  while 1:\n`
        command += `    b=f.read(256)\n`
        command += `    if not b:break\n`
        command += `    print(ubinascii.b2a_base64(b).decode(),end='')\n`
        command += `del b\n`
      } else {
        command =  `with open('${filePath}','rb') as f:\n`
        command += `  while 1:\n`
        command += `    b=f.read(256)\n`
        command += `    if not b:break\n`
        command += `    print(b.hex(),end='')\n`
        command += `del b\n`
      }

      let streamConsumer = null
      if (fileSize > 0) {
        let bytesReceived = 0
        let lineBuf = ''
        let prefixSkipped = false
        const hasUbinascii = this._hasUbinascii

        streamConsumer = (chunk) => {
          if (!prefixSkipped) {
            lineBuf += chunk
            const okIdx = lineBuf.indexOf('OK')
            if (okIdx === -1) return
            prefixSkipped = true
            lineBuf = lineBuf.slice(okIdx + 2)
          } else {
            lineBuf += chunk
          }
          const eotIdx = lineBuf.indexOf('\x04')
          if (eotIdx !== -1) lineBuf = lineBuf.slice(0, eotIdx)

          if (hasUbinascii) {
            let nlIdx
            while ((nlIdx = lineBuf.indexOf('\n')) !== -1) {
              const line = lineBuf.slice(0, nlIdx)
              lineBuf = lineBuf.slice(nlIdx + 1)
              if (line.length > 0) {
                bytesReceived += Buffer.from(line.trim(), 'base64').length
                data_consumer(Math.min(99, Math.round(bytesReceived / fileSize * 100)) + '%')
              }
            }
          } else {
            const hexLen = lineBuf.replace(/[^0-9a-fA-F]/g, '').length
            bytesReceived = Math.floor(hexLen / 2)
            data_consumer(Math.min(99, Math.round(bytesReceived / fileSize * 100)) + '%')
          }
        }
      }

      data_consumer('0%')
      let output = await this.exec_raw(command, streamConsumer)
      await this.exit_raw_repl()
      output = extract(output)
      data_consumer('100%')
      let result
      if (this._hasUbinascii) {
        result = Buffer.concat(
          output.split('\n').filter(s => s.length > 0).map(s => Buffer.from(s, 'base64'))
        )
      } else {
        result = Buffer.from(output.trim(), 'hex')
      }
      return Promise.resolve(result)
    }
    return Promise.reject(new MicroPythonError(`Path to file was not specified`, MicroPythonError.MISSING_ARGUMENT))
  }

  async fs_cat(filePath) {
    if (filePath) {
      await this.enter_raw_repl()
      let output = await this.exec_raw(
        `with open('${filePath}','r') as f:\n while 1:\n  b=f.read(256)\n  if not b:break\n  print(b,end='')\ndel f\ndel b\n`
      )
      await this.exit_raw_repl()
      output = extract(output)
      return Promise.resolve(fixLineBreak(output))
    }
    return Promise.reject(new MicroPythonError(`Path to file was not specified`, MicroPythonError.MISSING_ARGUMENT))
  }

  async _getRoot() {
    if (this._fsRoot !== null) {
      return
    }
    const out = await this.exec_raw(
      `import sys\nprint('/flash' if '/flash' in sys.path else '/')\n`
    )
    this._fsRoot = extract(out).trim()
  }
  async _freeMemory() {
    const out = await this.exec_raw(`import gc\ngc.collect()\ngc.collect()\nprint(gc.mem_free())\n`)
    const err = this.exec_raw_err(out)
    if (err.trim()) throw new MicroPythonError(err.trim(), MicroPythonError.BOARD_ERROR)
    const value = parseInt(extract(out).trim(), 10)
    if (isNaN(value)) {
      throw new MicroPythonError(`_freeMemory: unexpected output from board: ${JSON.stringify(out)}`, MicroPythonError.UNEXPECTED_RESPONSE)
    }
    return value
  }

  async mem_free() {
    await this.enter_raw_repl()
    const free = await this._freeMemory()
    await this.exit_raw_repl()
    return free
  }

  async calibrateDelay(upperBound = 100, margin = 5) {
    const testScript = '#'.repeat(this.chunkSize * 4) + '\nprint("ok")\n'
    let lo = 0, hi = upperBound, lastGood = upperBound

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      this.writeDelay = mid
      try {
        await this.enter_raw_repl()
        const out = await this.exec_raw(testScript)
        await this.exit_raw_repl()
        if (extract(out).trim() === 'ok' && !this.exec_raw_err(out).trim()) {
          lastGood = mid
          hi = mid - 1
        } else {
          lo = mid + 1
        }
      } catch (_) {
        try { await this.get_prompt() } catch (_) {}
        lo = mid + 1
      }
    }

    this.writeDelay = Math.ceil(Math.min(upperBound, lastGood + margin) / 10) * 10
    return this.writeDelay
  }

  async _freeBytes(dirPath) {
    const out = await this.exec_raw(
      `import os\ns=os.statvfs('${dirPath}')\nprint(s[0]*s[3])\n`
    )
    const err = this.exec_raw_err(out)
    if (err.trim()) throw new MicroPythonError(err.trim(), MicroPythonError.BOARD_ERROR)
    const value = parseInt(extract(out).trim(), 10)
    if (isNaN(value)) {
      throw new MicroPythonError(`_freeBytes: unexpected output from board: ${JSON.stringify(out)}`, MicroPythonError.UNEXPECTED_RESPONSE)
    }
    return value
  }

  async fs_free(dirPath) {
    dirPath = dirPath || this._fsRoot || '/'
    await this.enter_raw_repl()
    const free = await this._freeBytes(dirPath)
    await this.exit_raw_repl()
    return free
  }

  async _cleanupFile(path) {
    try {
      await this.exec_raw(
        `import os\ntry:\n os.remove('${path}')\nexcept:pass\n`
      )
    } catch (_) {}
  }

  async _checkUbinascii() {
    if (this._hasUbinascii !== null) {
      if (this._hasUbinascii) {
        await this.exec_raw(`import ubinascii\n`)
      }
      return
    }
    const out = await this.exec_raw(
      `try:\n import ubinascii\n print(1)\nexcept ImportError:\n print(0)\n`
    )
    this._hasUbinascii = extract(out).trim() === '1'
  }

  async fs_put(src, dest, data_consumer) {
    data_consumer = data_consumer || function() {}
    if (src && dest) {
      const fileContent = fs.readFileSync(path.resolve(src), 'binary')
      const contentBuffer =  Buffer.from(fileContent, 'binary')
      let out = ''
      out += await this.enter_raw_repl()
      await this._checkUbinascii()
      const destDir = path.dirname(dest)
      const free = await this._freeBytes(destDir)
      if (contentBuffer.length > free) {
        await this.exit_raw_repl()
        return Promise.reject(new MicroPythonError(
          `Not enough space on '${destDir}': need ${contentBuffer.length} bytes, ${free} available`,
          MicroPythonError.INSUFFICIENT_SPACE,
          destDir
        ))
      }
      try {
        if (this._hasUbinascii) {
          out += await this.exec_raw(`f=open('${dest}','wb')\nw=f.write\nu=ubinascii.a2b_base64`)
        } else {
          out += await this.exec_raw(`f=open('${dest}','wb')\nw=f.write\nh=bytes.fromhex`)
        }
        for (let i = 0; i < contentBuffer.length; i += this.chunkSize) {
          const slice = contentBuffer.subarray(i, i + this.chunkSize)
          const line = this._hasUbinascii
            ? `w(u('${slice.toString('base64')}'))`
            : `w(h('${slice.toString('hex')}'))`
          out += await this.exec_raw(line)
          data_consumer(parseInt((i / contentBuffer.length) * 100))
        }
        out += await this.exec_raw(this._hasUbinascii
          ? `f.close()\ndel f\ndel w\ndel u\n`
          : `f.close()\ndel f\ndel w\ndel h\n`
        )
        out += await this.exit_raw_repl()
        return Promise.resolve(out)
      } catch (e) {
        await this._cleanupFile(dest)
        await this.exit_raw_repl()
        throw e
      }
    }
    return Promise.reject(new MicroPythonError(`Must specify source and destination paths`, MicroPythonError.MISSING_ARGUMENT))
  }

  async fs_get(src, dest, data_consumer) {
    data_consumer = data_consumer || function() {}
    if (src && dest) {
      const content = await this.fs_cat_binary(src, data_consumer)
      fs.writeFileSync(path.resolve(dest), content)
      return Promise.resolve()
    }
    return Promise.reject(new MicroPythonError(`Must specify source and destination paths`, MicroPythonError.MISSING_ARGUMENT))
  }

  async fs_save(content, dest, data_consumer) {
    data_consumer = data_consumer || function() {}
    if (content && dest) {
      const contentBuffer = Buffer.from(content, 'utf-8')
      let out = ''
      out += await this.enter_raw_repl()
      await this._checkUbinascii()
      const destDir = path.dirname(dest)
      const free = await this._freeBytes(destDir)
      if (contentBuffer.length > free) {
        await this.exit_raw_repl()
        return Promise.reject(new MicroPythonError(
          `Not enough space on '${destDir}': need ${contentBuffer.length} bytes, ${free} available`,
          MicroPythonError.INSUFFICIENT_SPACE,
          destDir
        ))
      }
      try {
        if (this._hasUbinascii) {
          out += await this.exec_raw(`f=open('${dest}','wb')\nw=f.write\nu=ubinascii.a2b_base64`)
        } else {
          out += await this.exec_raw(`f=open('${dest}','wb')\nw=f.write\nh=bytes.fromhex`)
        }
        for (let i = 0; i < contentBuffer.length; i += this.chunkSize) {
          const slice = contentBuffer.subarray(i, i + this.chunkSize)
          const line = this._hasUbinascii
            ? `w(u('${slice.toString('base64')}'))`
            : `w(h('${slice.toString('hex')}'))`
          out += await this.exec_raw(line)
          data_consumer(parseInt((i / contentBuffer.length) * 100) + '%')
        }
        out += await this.exec_raw(this._hasUbinascii
          ? `f.close()\ndel f\ndel w\ndel u\n`
          : `f.close()\ndel f\ndel w\ndel h\n`
        )
        out += await this.exit_raw_repl()
        return Promise.resolve(out)
      } catch (e) {
        await this._cleanupFile(dest)
        await this.exit_raw_repl()
        throw e
      }
    } else {
      return Promise.reject(new MicroPythonError(`Must specify content and destination path`, MicroPythonError.MISSING_ARGUMENT))
    }
  }

  async fs_mkdir(dirPath) {
    if (dirPath) {
      await this.enter_raw_repl()
      const output = await this.exec_raw(`import os\nos.mkdir('${dirPath}')\n`)
      const err = this.exec_raw_err(output)
      await this.exit_raw_repl()
      if (err.trim()) throw new MicroPythonError(err.trim(), MicroPythonError.BOARD_ERROR)
      return Promise.resolve()
    }
    return Promise.reject(new MicroPythonError(`Path to folder was not specified`, MicroPythonError.MISSING_ARGUMENT))
  }

  async fs_rmdir(dirPath) {
    if (dirPath) {
      await this.enter_raw_repl()
      const output = await this.exec_raw(`import os\nos.rmdir('${dirPath}')\n`)
      const err = this.exec_raw_err(output)
      await this.exit_raw_repl()
      if (err.trim()) throw new MicroPythonError(err.trim(), MicroPythonError.BOARD_ERROR)
      return Promise.resolve()
    }
    return Promise.reject(new MicroPythonError(`Path to folder was not specified`, MicroPythonError.MISSING_ARGUMENT))
  }

  async fs_rm(filePath) {
    if (filePath) {
      await this.enter_raw_repl()
      const output = await this.exec_raw(`import os\nos.remove('${filePath}')\n`)
      const err = this.exec_raw_err(output)
      await this.exit_raw_repl()
      if (err.trim()) throw new MicroPythonError(err.trim(), MicroPythonError.BOARD_ERROR)
      return Promise.resolve()
    }
    return Promise.reject(new MicroPythonError(`Path to file was not specified`, MicroPythonError.MISSING_ARGUMENT))
  }

  async fs_rename(oldFilePath, newFilePath) {
    if (oldFilePath && newFilePath) {
      await this.enter_raw_repl()
      const output = await this.exec_raw(`import os\nos.rename('${oldFilePath}', '${newFilePath}')\n`)
      const err = this.exec_raw_err(output)
      await this.exit_raw_repl()
      if (err.trim()) throw new MicroPythonError(err.trim(), MicroPythonError.BOARD_ERROR)
      return Promise.resolve()
    }
    return Promise.reject(new MicroPythonError(`Must specify old and new paths`, MicroPythonError.MISSING_ARGUMENT))
  }
}

module.exports = MicroPythonBoard
module.exports.MicroPythonError = MicroPythonError
