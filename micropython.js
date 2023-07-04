const { SerialPort } = require('serialport')
const fs = require('fs')
const path = require('path')

function sleep(millis) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, millis)
  })
}

function fixLineBreak(str) {
  // All line breaks must be converted to \n
  // https://stackoverflow.com/questions/4025760/python-file-write-creating-extra-carriage-return
  return str.replace(/\r\n/g, '\n')
}

function extract(out) {
  /*
   * Message ($msg) will come out following this template:
   * "OK${msg}\x04\x04>"
   */
  return out.slice(2, -3).trim()
}

class MicroPythonBoard {
  constructor() {
    this.port = null
    this.serial = null
    this.reject_run = null
  }

  list_ports() {
    return SerialPort.list()
  }

  async open(port) {
    if (port) {
      this.port = port
    } else {
      return Promise.reject(
        new Error(`No device specified`)
      )
    }
    if (this.serial && this.serial.isOpen) {
      await this.serial.close()
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
          resolve()
        }
      })
    })
  }

  close() {
    if (this.serial.isOpen) {
      return this.serial.close()
    } else {
      return Promise.resolve()
    }
  }

  read_until(ending, data_consumer) {
    return new Promise((resolve, reject) => {
      let buff = ''
      const fn = async () => {
        const o = await this.serial.read()
        if (o) {
          buff += o.toString()
          if (data_consumer) {
            data_consumer(o.toString())
          }
        }
        if (buff.indexOf(ending) !== -1) {
          this.serial.removeListener('readable', fn)
          resolve(buff)
        }
      }
      this.serial.on('readable', fn)
    })
  }

  async write_and_read_until(cmd, expect, data_consumer) {
    this.serial.pause()
    const chunkSize = 128
    for (let i = 0; i < cmd.length; i+=chunkSize) {
      const s = cmd.slice(i, i+chunkSize)
      await this.serial.write(Buffer.from(s))
      await sleep(10)
    }
    let o
    if(expect) {
      o = await this.read_until(expect, data_consumer)
    }
    await this.serial.flush()
    await sleep(10)
    this.serial.resume()
    return o
  }

  async get_prompt() {
    await sleep(100)
    await this.stop()
    await sleep(100)
    const out = await this.write_and_read_until(`\r\x03\x02`, '\r\n>>>')
    return Promise.resolve(out)
  }

  async enter_raw_repl() {
    const out = await this.write_and_read_until(`\x01`, `raw REPL; CTRL-B to exit`)
    return Promise.resolve(out)
  }

  async exit_raw_repl() {
    const out = await this.write_and_read_until(`\x02`, '\r\n>>>')
    return Promise.resolve(out)
  }

  async exec_raw(cmd, data_consumer) {
    await this.write_and_read_until(cmd)
    const out = await this.write_and_read_until('\x04', '\x04>', data_consumer)
    return Promise.resolve(out)
  }

  async execfile(filePath, data_consumer) {
    data_consumer = data_consumer || function() {}
    if (filePath) {
      const content = fs.readFileSync(path.resolve(filePath))
      await this.enter_raw_repl()
      const output = await this.exec_raw(content.toString(), data_consumer)
      await this.exit_raw_repl()
      return Promise.resolve(output)
    }
    return Promise.reject()
  }

  async run(code, data_consumer) {
    data_consumer = data_consumer || function() {}
    return new Promise(async (resolve, reject) => {
      if (this.reject_run) {
        this.reject_run('re run')
        this.reject_run = null
      }
      this.reject_run = reject
      try {
        await this.enter_raw_repl()
        const output = await this.exec_raw(code || '#', data_consumer)
        await this.exit_raw_repl()
        return resolve(output)
      } catch (e) {
        reject(e)
      }
    })
  }

  async eval(k) {
    await this.serial.write(Buffer.from(k))
    return Promise.resolve()
  }

  async stop() {
    if (this.reject_run) {
      this.reject_run('pre stop')
      this.reject_run = null
    }
    // Dismiss any data with ctrl-C
    await this.serial.write(Buffer.from(`\x03`))
    return Promise.resolve()
  }

  async reset() {
    if (this.reject_run) {
      this.reject_run('pre reset')
      this.reject_run = null
    }
    // Dismiss any data with ctrl-C
    await this.serial.write(Buffer.from(`\x03`))
    // Soft reboot
    await this.serial.write(Buffer.from(`\x04`))
    return Promise.resolve()
  }

  async fs_exists(filePath) {
    filePath = filePath || ''
    let command = `try:\n`
        command += `  f = open("${filePath}", "r")\n`
        command += `  print(1)\n`
        command += `except OSError:\n`
        command += `  print(0)\n`
    await this.enter_raw_repl()
    let output = await this.exec_raw(command)
    await this.exit_raw_repl()
    const exists = extract(output) == '1'
    return Promise.resolve(exists)
  }

  async fs_ls(folderPath) {
    folderPath = folderPath || ''
    let command = `import uos\n`
        command += `try:\n`
        command += `  print(uos.listdir("${folderPath}"))\n`
        command += `except OSError:\n`
        command += `  print([])\n`
    await this.enter_raw_repl()
    let output = await this.exec_raw(command)
    await this.exit_raw_repl()
    output = extract(output)
    // Convert text output to js array
    output = output.replace(/'/g, '"')
    const files = JSON.parse(output)
    return Promise.resolve(files)
  }

  async fs_ils(folderPath) {
    folderPath = folderPath || ''
    folderPath = folderPath || ''
    let command = `import uos\n`
        command += `try:\n`
        command += `  l=[]\n`
        command += `  for file in uos.ilistdir("${folderPath}"):\n`
        command += `    l.append(list(file))\n`
        command += `  print(l)\n`
        command += `except OSError:\n`
        command += `  print([])\n`
    await this.enter_raw_repl()
    let output = await this.exec_raw(command)
    await this.exit_raw_repl()
    // Convert text output to js array
    output = extract(output)
    output = output.replace(/'/g, '"')
    output = output.split('OK')
    let files = JSON.parse(output)
    return Promise.resolve(files)
  }

  async fs_cat(filePath) {
    if (filePath) {
      await this.enter_raw_repl()
      let output = await this.exec_raw(
        `with open('${filePath}','r') as f:\n while 1:\n  b=f.read(256)\n  if not b:break\n  print(b,end='')`
      )
      await this.exit_raw_repl()
      output = extract(output)
      return Promise.resolve(output)
    }
    return Promise.reject(new Error(`Path to file was not specified`))
  }

  async fs_put(src, dest, data_consumer) {
    data_consumer = data_consumer || function() {}
    if (src && dest) {
      const contentBuffer = fs.readFileSync(path.resolve(src))
      let contentString = contentBuffer.toString()
      contentString = fixLineBreak(contentString)
      const hexArray = contentString.split('').map(
        c => c.charCodeAt(0).toString(16).padStart(2, '0')
      )
      let out = ''
      out += await this.enter_raw_repl()
      out += await this.exec_raw(`f=open('${dest}','w')\nw=f.write`)
      const chunkSize = 48
      for (let i = 0; i < hexArray.length; i+= chunkSize) {
        let slice = hexArray.slice(i, i+chunkSize)
        let bytes = slice.map(h => `0x${h}`)
        let line = `w(bytes([${bytes.join(',')}]))`
        out += await this.exec_raw(line)
        data_consumer( parseInt((i / hexArray.length) * 100) + '%')
      }
      out += await this.exec_raw(`f.close()`)
      out += await this.exit_raw_repl()
      return Promise.resolve(out)
    }
    return Promise.reject(new Error(`Must specify source and destination paths`))
  }

  async fs_save(content, dest, data_consumer) {
    data_consumer = data_consumer || function() {}
    if (content && dest) {
      let contentString = fixLineBreak(content)
      const hexArray = contentString.split('').map(
        c => c.charCodeAt(0).toString(16).padStart(2, '0')
      )
      let out = ''
      out += await this.enter_raw_repl()
      out += await this.exec_raw(`f=open('${dest}','w')\nw=f.write`)
      const chunkSize = 48
      for (let i = 0; i < hexArray.length; i+= chunkSize) {
        let slice = hexArray.slice(i, i+chunkSize)
        let bytes = slice.map(h => `0x${h}`)
        let line = `w(bytes([${bytes.join(',')}]))`
        out += await this.exec_raw(line)
        data_consumer( parseInt((i / hexArray.length) * 100) + '%')
      }
      out += await this.exec_raw(`f.close()`)
      out += await this.exit_raw_repl()
      return Promise.resolve(out)
    } else {
      return Promise.reject(new Error(`Must specify content and destination path`))
    }
  }

  async fs_mkdir(filePath) {
    if (filePath) {
      await this.enter_raw_repl()
      const output = await this.exec_raw(
        `import uos\nuos.mkdir('${filePath}')`
      )
      await this.exit_raw_repl()
      return Promise.resolve(output)
    }
    return Promise.reject()
  }

  async fs_rmdir(filePath) {
    if (filePath) {
      let command = `import uos\n`
          command += `try:\n`
          command += `  uos.rmdir("${filePath}")\n`
          command += `except OSError:\n`
          command += `  print(0)\n`
      await this.enter_raw_repl()
      const output = await this.exec_raw(command)
      await this.exit_raw_repl()
      return Promise.resolve(output)
    }
    return Promise.reject()
  }

  async fs_rm(filePath) {
    if (filePath) {
      let command = `import uos\n`
          command += `try:\n`
          command += `  uos.remove("${filePath}")\n`
          command += `except OSError:\n`
          command += `  print(0)\n`
      await this.enter_raw_repl()
      const output = await this.exec_raw(command)
      return this.exit_raw_repl()
    }
    return Promise.reject()
  }

  async fs_rename(oldFilePath, newFilePath) {
    if (oldFilePath && newFilePath) {
      await this.enter_raw_repl()
      const output = await this.exec_raw(
        `import uos\nuos.rename('${oldFilePath}', '${newFilePath}')`
      )
      return this.exit_raw_repl()
    }
    return Promise.reject()
  }
}

module.exports = MicroPythonBoard
