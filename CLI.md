# Command Line Interface

## Usage

```sh
node cli.js [--port <port>] [--verbose] <command> [arguments]
```

`--port` / `-p` is required for all commands except `--listports` and `--help`.
`--verbose` / `-v` prints the resolved command, arguments, and port before executing.

---

## Commands

### Board info

| Command | Short | Arguments | Description |
|---------|-------|-----------|-------------|
| `--listports` | `-L` | | List available serial ports with vendorId/productId |
| `--mem` | `-M` | | Show free heap memory (runs `gc.collect()` first) |
| `--free` | `-f` | `[board-path]` | Show free bytes on the filesystem (defaults to fs root) |

### Execution

| Command | Short | Arguments | Description |
|---------|-------|-----------|-------------|
| `--executestring` | `-e` | `"<code>"` | Execute a Python string on the board |
| `--executefile` | `-x` | `<local.py>` | Execute a local Python file on the board |

### File system

| Command | Short | Arguments | Description |
|---------|-------|-----------|-------------|
| `--listfiles` | `-l` | `[folder]` | List filenames on the board (defaults to fs root) |
| `--ilistfiles` | `-i` | `[folder]` | List files with type, inode, and size (defaults to fs root) |
| `--exists` | `-E` | `<board-path>` | Check whether a file or folder exists on the board |
| `--cat` | `-c` | `<board-path>` | Print the text content of a file on the board |
| `--putfile` | `-u` | `<local> <board>` | Upload a file from disk to the board |
| `--getfile` | `-g` | `<board> <local>` | Download a file from the board to disk |
| `--savefile` | `-S` | `"<content>" <board-path>` | Save a string directly as a file on the board |
| `--makefolder` | `-m` | `<board-path>` | Create a folder on the board |
| `--removefile` | `-d` | `<board-path>` | Remove a file from the board |
| `--removefolder` | `-D` | `<board-path>` | Remove a folder from the board |
| `--rename` | `-n` | `<old-path> <new-path>` | Rename or move a file on the board |
| `--format` | `-F` | `<pyb\|esp\|rp2>` | Format the board filesystem |

### Board control

| Command | Short | Arguments | Description |
|---------|-------|-----------|-------------|
| `--reset` | `-r` | | Soft reset (re-runs `boot.py` and `main.py`) |
| `--hardreset` | `-R` | | Hard reset via `machine.reset()` |

---

## Examples

### List available ports

```sh
node cli.js --listports
```

```
available ports [
  {
    path: '/dev/ttyACM0',
    manufacturer: 'MicroPython',
    serialNumber: '5031503337360009',
    vendorId: '2341',
    productId: '025e'
  }
]
```

### List files on the board

```sh
node cli.js -p /dev/ttyACM0 --listfiles
node cli.js -p /dev/ttyACM0 --listfiles /lib
```

```
files at "/" [ 'boot.py', 'main.py', 'lib' ]
```

Returns an error if the path does not exist on the board.

### List files with details

```sh
node cli.js -p /dev/ttyACM0 --ilistfiles
```

```
files at "/" [
  [ 'boot.py', 32768, 0, 1714 ],
  [ 'lib',     16384, 0, 0    ]
]
```

Second element: `32768` = file, `16384` = directory.

### Execute a Python string

```sh
node cli.js -p /dev/ttyACM0 --executestring "print('hello')"
```

### Execute a local file

```sh
node cli.js -p /dev/ttyACM0 --executefile script.py
```

### Upload a file to the board

```sh
node cli.js -p /dev/ttyACM0 --putfile local.py remote.py
```

### Download a file from the board

```sh
node cli.js -p /dev/ttyACM0 --getfile remote.py local.py
```

### Save a string as a file on the board

```sh
node cli.js -p /dev/ttyACM0 --savefile "print('hello')" hello.py
```

### Print a file from the board

```sh
node cli.js -p /dev/ttyACM0 --cat boot.py
```

### Check if a file exists

```sh
node cli.js -p /dev/ttyACM0 --exists main.py
```

### Create and remove a folder

```sh
node cli.js -p /dev/ttyACM0 --makefolder /lib
node cli.js -p /dev/ttyACM0 --removefolder /lib
```

### Rename or move a file

```sh
node cli.js -p /dev/ttyACM0 --rename old.py new.py
```

### Check free memory and storage

```sh
node cli.js -p /dev/ttyACM0 --mem
node cli.js -p /dev/ttyACM0 --free
```

### Reset the board

```sh
node cli.js -p /dev/ttyACM0 --reset
node cli.js -p /dev/ttyACM0 --hardreset
```

### Verbose output

`--verbose` prints the resolved command, arguments, and port before executing.

```sh
node cli.js --verbose -p /dev/ttyACM0 --putfile local.py remote.py
```

```
VERBOSE
executing command:
command --putfile
arguments [ 'local.py', 'remote.py' ]
port /dev/ttyACM0
...
command executed --putfile
```
