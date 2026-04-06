const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const port = process.argv[2]

function formatElapsed(ms) {
  const h = Math.floor(ms / 3600000).toString().padStart(2, '0')
  const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0')
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function runExample(file) {
  return new Promise((resolve) => {
    const args = port ? [file, port] : [file]
    const child = spawn('node', args, { cwd: __dirname })
    child.stdout.on('data', d => process.stdout.write('  ' + d.toString().replace(/\n(?=.)/g, '\n  ')))
    child.stderr.on('data', d => process.stderr.write('  ' + d.toString().replace(/\n(?=.)/g, '\n  ')))
    child.on('close', code => resolve(code === 0))
  })
}

async function main() {
  const examples = fs.readdirSync(__dirname)
    .filter(f => /^\d+.*\.js$/.test(f))
    .sort()

  if (!port) {
    console.log('Usage: node run_all.js <port>')
    console.log('       node run_all.js /dev/cu.usbmodem2101\n')
  }

  const errors = []
  console.log(`Running ${examples.length} example(s)${port ? ' on ' + port : ''}\n`)

  for (const file of examples) {
    console.log('='.repeat(50))
    console.log('>', file)
    const t0 = Date.now()
    const ok = await runExample(file)
    if (ok) {
      console.log(`🟩 success (${formatElapsed(Date.now() - t0)})`)
    } else {
      console.log('🟥 error (${formatElapsed(Date.now() - t0)})`)
      errors.push(file)
    }
  }

  console.log('\nErrors:', errors.length)
  for (const name of errors) {
    console.log(' ', name)
  }
}

main()
