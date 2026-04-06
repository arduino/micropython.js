def format_pyb():
  import os, vfs, pyb

  vfs.umount('/flash')
  vfs.VfsFat.mkfs(pyb.Flash(start=0))   # or VfsFat
  vfs.mount(pyb.Flash(start=0), '/flash')
  os.chdir('/flash')

def format_esp():
    import vfs, flashbdev

    vfs.umount('/')
    vfs.VfsLfs2.mkfs(flashbdev.bdev)
    vfs.mount(flashbdev.bdev, '/')

def format_rp2():
  import os, vfs, rp2

  bdev = rp2.Flash()
  vfs.umount('/')
  vfs.VfsLfs2.mkfs(bdev, progsize=256)  # progsize=256 is recommended for RP2
  vfs.mount(bdev, '/')
  os.chdir('/')
