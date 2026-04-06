# Testing

## Examples — `examples/run_all.js`

Runs all numbered examples in sequence against a connected board.
Each example uses a single API feature end-to-end.

```sh
node examples/run_all.js <port>
# e.g.
node examples/run_all.js /dev/cu.usbmodem2101
node examples/run_all.js COM4
```

| File | What it does |
|------|-------------|
| `00_list_ports.js` | Lists available serial ports (use it to get the port)|
| `01_execute_string.js` | Executes a Python string via raw REPL |
| `02_execute_file.js` | Executes a local `.py` file on the board |
| `03_put_file.js` | Uploads `hello.py` to the board as `test_hello.py` |
| `04_remove_file.js` | Removes `test_hello.py` from the board |
| `05_list_files.js` | Lists files at `/` and `/lib` |
| `06_save_file.js` | Saves a Python string as `saved_example.py` on the board |
| `07_get_file_contents.js` | Reads back `saved_example.py` from the board |
| `08_file_exists.js` | Checks existence of a known and an unknown file |

Results are shown as `🟩 success` or `🟥 error` per example.

---

## Test suite — `tests/test.js`

Full integration test suite. Each test opens a fresh board connection, runs an isolated scenario, and closes the connection.

```sh
# Run all tests
node tests/test.js <port>

# Run with verbose board output
node tests/test.js <port> -v

# Run a subset by test name (omit `test_`)
node tests/test.js <port> upload_binary
```

Results are shown as
- `🟩 success`: the test went through
- `🟧 skipped`: the host to board operation succeeded, board might have thrown an error 
- `🟥 error`: the board may have crashed/frozen.

### Test list

| Test | What it covers |
|------|---------------|
| `get_prompt` | `get_prompt()` recovers `>>>` from unknown state, raw REPL, and while code is running |
| `real_time_repl` | `eval()` sends characters one at a time and the board echoes them back |
| `enter_raw_repl` | `enter_raw_repl()` transitions to raw REPL; idempotent when called again |
| `exit_raw_repl` | `exit_raw_repl()` returns to `>>>` from both raw REPL and normal REPL |
| `execute_raw_small` | `exec_raw()` executes a short script and returns correct raw REPL framing |
| `execute_raw_big` | `exec_raw()` with a large multi-chunk script; skipped if board has insufficient RAM |
| `run_small_code` | `run()` executes a short script via the high-level API |
| `run_big_code` | `run()` with a large script; skipped if board has insufficient RAM |
| `run_code_after_stop` | `stop()` cancels an in-progress `run()` and the board accepts a new `run()` immediately after |
| `run_code_after_run` | A second `run()` cancels the first and executes correctly |
| `upload_file` | `fs_put()` uploads a text file; `fs_get()` downloads it; byte-for-byte comparison |
| `upload_big_file` | Same roundtrip with a large binary file (JPEG) |
| `create_folder` | `fs_mkdir()` creates a directory; confirmed with `fs_ils()` |
| `list_files_and_folders` | `fs_ils()` returns correct type flags (32768 = file, 16384 = folder) |
| `check_if_file_exists` | `fs_exists()` returns `true` for a known file and `false` for a missing one |
| `save_file_content` | `fs_save()` writes a string to a file; `fs_cat()` reads it back |
| `save_big_file_content` | Same with a large content payload |
| `get_file` | `fs_cat()` returns the correct file contents |
| `remove_file` | `fs_rm()` removes a file; `fs_exists()` confirms it is gone |
| `remove_folder` | `fs_rmdir()` removes a directory; `fs_ils()` confirms it is gone |
| `ubinascii_detection_sets_flag` | `_hasUbinascii` starts as `null` and is set to `true` or `false` after `_checkUbinascii()` |
| `ubinascii_detection_cached_across_transfers` | `_hasUbinascii` is set after first `fs_save` and unchanged after a second |
| `ubinascii_flag_resets_on_close` | `_hasUbinascii` returns to `null` after `close()` |
| `upload_binary_file` | All 256 byte values (0x00–0xFF) transfer without corruption |
| `upload_binary_file_base64_path` | Binary roundtrip forced through the base64 (`ubinascii`) encoding path |
| `upload_binary_file_hex_path` | Binary roundtrip forced through the hex fallback encoding path |
