# =============================================================================
# MicroPython Board Test Suite
# =============================================================================
# Standalone test of baseline MicroPython functionality.
# No board-specific or external dependencies — runs on any MicroPython target.
# Requires sufficient free heap to compile (~128KB recommended).
#
# Sections:
#   1.  Test framework
#   2.  Integer arithmetic
#   3.  Float arithmetic
#   4.  Boolean and comparison operators
#   5.  Bitwise operators
#   6.  String operations
#   7.  List operations
#   8.  Dictionary operations
#   9.  Set operations
#   10. Tuple operations
#   11. Bytes and bytearray
#   12. Math module
#   13. Control flow
#   14. Exception handling
#   15. Functions and closures
#   16. Classes and OOP
#   17. Generators and iterators
#   18. Comprehensions
#   19. Sorting algorithms
#   20. Search algorithms
#   21. Data structures
#   22. Filesystem (os module)
#   23. GC and memory
#   24. Struct module
#   25. JSON module
#   26. Sys module
#   27. Re module
#   28. Time module
#   29. Algorithm showcase
#   30. Summary
# =============================================================================

import gc
import sys
import os
import math

# =============================================================================
# 1. TEST FRAMEWORK
# =============================================================================

_passed = 0
_failed = 0
_skipped = 0
_section = ''

def section(name):
    global _section
    _section = name
    gc.collect()
    print('--- ' + name + ' ---')

def ok(name):
    global _passed
    _passed += 1

def fail(name, msg=''):
    global _failed
    _failed += 1
    print('FAIL [' + _section + '] ' + name + (': ' + str(msg) if msg else ''))

def skip(name):
    global _skipped
    _skipped += 1
    print('SKIP [' + _section + '] ' + name)

def check(cond, name, msg=''):
    if cond:
        ok(name)
    else:
        fail(name, msg)

def check_eq(got, expected, name):
    if got == expected:
        ok(name)
    else:
        fail(name, 'got ' + repr(got) + ' expected ' + repr(expected))

def check_ne(got, unexpected, name):
    if got != unexpected:
        ok(name)
    else:
        fail(name, 'expected not ' + repr(unexpected))

def check_close(got, expected, tol, name):
    if abs(got - expected) <= tol:
        ok(name)
    else:
        fail(name, 'got ' + str(got) + ' expected ' + str(expected) + ' tol ' + str(tol))

def check_raises(exc_type, fn, name):
    types = exc_type if isinstance(exc_type, tuple) else (exc_type,)
    type_names = '/'.join(t.__name__ for t in types)
    try:
        fn()
        fail(name, 'expected ' + type_names + ' not raised')
    except Exception as e:
        if isinstance(e, types):
            ok(name)
        else:
            fail(name, 'got ' + type(e).__name__ + ' expected ' + type_names)

def summary():
    print('')
    print('=' * 40)
    print('PASSED:  ' + str(_passed))
    print('FAILED:  ' + str(_failed))
    print('SKIPPED: ' + str(_skipped))
    print('TOTAL:   ' + str(_passed + _failed + _skipped))
    print('=' * 40)
    if _failed == 0:
        print('ALL TESTS PASSED')
    else:
        print('SOME TESTS FAILED')
    return _failed == 0


# =============================================================================
# 2. INTEGER ARITHMETIC
# =============================================================================

section('integer arithmetic')

check_eq(1 + 1, 2, 'add')
check_eq(10 - 3, 7, 'sub')
check_eq(3 * 4, 12, 'mul')
check_eq(10 // 3, 3, 'floordiv')
check_eq(10 % 3, 1, 'mod')
check_eq(2 ** 10, 1024, 'pow')
check_eq(-5, -5, 'neg')
check_eq(abs(-7), 7, 'abs neg')
check_eq(abs(7), 7, 'abs pos')
check_eq(divmod(17, 5), (3, 2), 'divmod')
check_eq(divmod(-17, 5), (-4, 3), 'divmod neg')
check_eq(2 ** 32, 4294967296, 'big pow 32')
check_eq(2 ** 64, 18446744073709551616, 'big pow 64')

fact = 1
for i in range(1, 13):
    fact *= i
check_eq(fact, 479001600, 'factorial 12')

check_eq(max(1, 2, 3), 3, 'max')
check_eq(min(1, 2, 3), 1, 'min')
check_eq(max([5, 2, 8, 1, 9, 3]), 9, 'max list')
check_eq(min([5, 2, 8, 1, 9, 3]), 1, 'min list')
check_eq(sum([1, 2, 3, 4, 5]), 15, 'sum')
check_eq(sum(range(101)), 5050, 'sum range gauss')

check_eq(int('42'), 42, 'int from str')
check_eq(int('0xff', 16), 255, 'int hex str')
check_eq(int('0b1010', 2), 10, 'int bin str')
check_eq(int('0o17', 8), 15, 'int oct str')
check_eq(int(3.9), 3, 'int from float truncate pos')
check_eq(int(-3.9), -3, 'int from float truncate neg')
check_eq(round(3.4), 3, 'round down')
check_eq(round(3.6), 4, 'round up')
check_eq(round(3.14159, 2), 3.14, 'round decimal')
check_eq(hex(255), '0xff', 'hex repr')
check_eq(bin(10), '0b1010', 'bin repr')
check_eq(oct(8), '0o10', 'oct repr')
check_eq((2 + 3) * (4 - 1), 15, 'chained ops')
check_eq(100 // 7 * 7 + 100 % 7, 100, 'div identity')

check_eq(2 ** 0, 1, 'pow zero')
check_eq(0 ** 0, 1, 'zero pow zero')
check_eq((-1) ** 2, 1, 'neg pow even')
check_eq((-1) ** 3, -1, 'neg pow odd')

for n in range(1, 20):
    check_eq(n * (n + 1) // 2, sum(range(n + 1)), 'gauss n=' + str(n))


# =============================================================================
# 3. FLOAT ARITHMETIC
# =============================================================================

section('float arithmetic')

check_close(1.1 + 2.2, 3.3, 1e-6, 'float add')
check_close(3.0 - 1.5, 1.5, 1e-9, 'float sub')
check_close(2.5 * 4.0, 10.0, 1e-9, 'float mul')
check_close(7.0 / 2.0, 3.5, 1e-9, 'float div')
check_close(2.0 ** 0.5, 1.4142135623730951, 1e-6, 'sqrt via pow')
check_close(1.0 / 3.0 * 3.0, 1.0, 1e-9, 'float thirds roundtrip')
check_eq(math.isinf(float('inf')) and float('inf') > 0, True, 'inf gt')
check_eq(math.isinf(float('-inf')) and float('-inf') < 0, True, '-inf lt')
check_eq(float('nan') != float('nan'), True, 'nan ne nan')
check_eq(float(42), 42.0, 'int to float')
check_eq(float('3.14'), 3.14, 'str to float')

for v in [0.0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 10.0]:
    check_close(float(int(v * 4)) / 4, v, 1e-9, 'float roundtrip ' + str(v))

check_close(1e10 + 1e-10, 1e10, 1e-5, 'float magnitude diff')
check_close((0.1 + 0.2 + 0.3 + 0.4) * 10, 10.0, 1e-4, 'float accumulation')


# =============================================================================
# 4. BOOLEAN AND COMPARISON
# =============================================================================

section('boolean and comparison')

check_eq(True and True, True, 'and TT')
check_eq(True and False, False, 'and TF')
check_eq(False and True, False, 'and FT')
check_eq(False and False, False, 'and FF')
check_eq(True or False, True, 'or TF')
check_eq(False or True, True, 'or FT')
check_eq(False or False, False, 'or FF')
check_eq(not True, False, 'not T')
check_eq(not False, True, 'not F')

check_eq(1 < 2, True, 'lt')
check_eq(1 <= 1, True, 'le eq')
check_eq(2 > 1, True, 'gt')
check_eq(2 >= 2, True, 'ge eq')
check_eq(1 == 1, True, 'eq')
check_eq(1 != 2, True, 'ne')
check_eq(1 < 2 < 3, True, 'chain lt')
check_eq(1 <= 1 <= 2, True, 'chain le le')
check_eq(1 < 2 > 3, False, 'chain lt gt false')

check_eq(bool(0), False, 'bool 0')
check_eq(bool(1), True, 'bool 1')
check_eq(bool(''), False, 'bool empty str')
check_eq(bool('a'), True, 'bool nonempty str')
check_eq(bool([]), False, 'bool empty list')
check_eq(bool([0]), True, 'bool list with 0')
check_eq(bool({}), False, 'bool empty dict')
check_eq(bool(None), False, 'bool None')
check_eq(bool(0.0), False, 'bool 0.0')
check_eq(bool(0.1), True, 'bool 0.1')

side = []
result = True or side.append(1)
check_eq(len(side), 0, 'or short circuit')

side = []
result = False and side.append(1)
check_eq(len(side), 0, 'and short circuit')

check_eq(None is None, True, 'is None')
check_eq(1 is not None, True, 'is not None')
a = [1, 2, 3]
b = a
c = [1, 2, 3]
check_eq(a is b, True, 'is same')
check_eq(a is c, False, 'is different')
check_eq(a == c, True, 'eq different objects')


# =============================================================================
# 5. BITWISE OPERATORS
# =============================================================================

section('bitwise operators')

check_eq(0b1010 & 0b1100, 0b1000, 'bitand')
check_eq(0b1010 | 0b1100, 0b1110, 'bitor')
check_eq(0b1010 ^ 0b1100, 0b0110, 'bitxor')
check_eq(~0b1010, -11, 'bitnot')
check_eq(1 << 4, 16, 'lshift')
check_eq(256 >> 4, 16, 'rshift')
check_eq(0xFF & 0x0F, 0x0F, 'mask low nibble')
check_eq(0xFF & 0xF0, 0xF0, 'mask high nibble')

def set_bit(val, bit): return val | (1 << bit)
def clear_bit(val, bit): return val & ~(1 << bit)
def toggle_bit(val, bit): return val ^ (1 << bit)
def test_bit(val, bit): return bool(val & (1 << bit))

v = 0b00000000
v = set_bit(v, 3)
check_eq(v, 0b00001000, 'set bit 3')
v = set_bit(v, 7)
check_eq(v, 0b10001000, 'set bit 7')
v = clear_bit(v, 3)
check_eq(v, 0b10000000, 'clear bit 3')
v = toggle_bit(v, 7)
check_eq(v, 0b00000000, 'toggle bit 7')
check_eq(test_bit(0b10100, 2), True, 'test bit 2 set')
check_eq(test_bit(0b10100, 3), False, 'test bit 3 clear')

def popcount(n):
    count = 0
    while n:
        count += n & 1
        n >>= 1
    return count

check_eq(popcount(0), 0, 'popcount 0')
check_eq(popcount(0xFF), 8, 'popcount 0xff')
check_eq(popcount(0b10110), 3, 'popcount 0b10110')
check_eq(popcount(0b11111111), 8, 'popcount all ones byte')

def parity(n):
    p = 0
    while n:
        p ^= n & 1
        n >>= 1
    return p

check_eq(parity(0b1110), 1, 'parity odd bits')
check_eq(parity(0b1010), 0, 'parity even bits')
check_eq(parity(0xFF), 0, 'parity 0xff even')

for i in range(256):
    pc = popcount(i)
    check_eq(parity(i), pc % 2, 'parity=popcount%2 i=' + str(i))


# =============================================================================
# 6. STRING OPERATIONS
# =============================================================================

section('string operations')

s = 'Hello, MicroPython!'
check_eq(len(s), 19, 'str len')
check_eq(s[0], 'H', 'str index 0')
check_eq(s[-1], '!', 'str index -1')
check_eq(s[7:18], 'MicroPython', 'str slice mid')
check_eq(s[:5], 'Hello', 'str slice start')
check_eq(s[7:], 'MicroPython!', 'str slice end')
check_eq(''.join(reversed(s)), '!nohtyPorciM ,olleH', 'str reverse')
check_eq(s.upper(), 'HELLO, MICROPYTHON!', 'upper')
check_eq(s.lower(), 'hello, micropython!', 'lower')
check_eq(s.count('o'), 3, 'count o')
check_eq(s.find('Micro'), 7, 'find')
check_eq(s.find('xyz'), -1, 'find missing')
check_eq(s.startswith('Hello'), True, 'startswith')
check_eq(s.endswith('!'), True, 'endswith')
check_eq(s.replace('Hello', 'Hi'), 'Hi, MicroPython!', 'replace')
check_eq('  hello  '.strip(), 'hello', 'strip')
check_eq('  hello  '.lstrip(), 'hello  ', 'lstrip')
check_eq('  hello  '.rstrip(), '  hello', 'rstrip')
check_eq('a,b,c'.split(','), ['a', 'b', 'c'], 'split')
check_eq('hello world foo'.split(), ['hello', 'world', 'foo'], 'split ws')
check_eq('a,b,c'.split(',', 1), ['a', 'b,c'], 'split maxsplit')
check_eq(','.join(['a', 'b', 'c']), 'a,b,c', 'join')
try:
    check_eq('hello'.center(11), '   hello   ', 'center')
    check_eq('hello'.ljust(10), 'hello     ', 'ljust')
    check_eq('hello'.rjust(10), '     hello', 'rjust')
    check_eq('hello'.ljust(10, '-'), 'hello-----', 'ljust fill')
except AttributeError:
    skip('str.center/ljust/rjust')
try:
    check_eq('42'.zfill(5), '00042', 'zfill')
    check_eq('-42'.zfill(5), '-0042', 'zfill neg')
except AttributeError:
    skip('str.zfill')
try:
    check_eq('abc'.isalpha(), True, 'isalpha')
    check_eq('abc1'.isalpha(), False, 'isalpha false')
    check_eq('123'.isdigit(), True, 'isdigit')
    check_eq('abc123'.isalnum(), True, 'isalnum')
    check_eq('   '.isspace(), True, 'isspace')
    check_eq('HELLO'.isupper(), True, 'isupper')
    check_eq('hello'.islower(), True, 'islower')
except AttributeError:
    skip('str.is* methods')
try:
    check_eq('hello world'.title(), 'Hello World', 'title')
    check_eq('Hello World'.swapcase(), 'hELLO wORLD', 'swapcase')
except AttributeError:
    skip('str.title/swapcase')

check_eq('{} + {} = {}'.format(1, 2, 3), '1 + 2 = 3', 'format basic')
check_eq('{0} {1} {0}'.format('a', 'b'), 'a b a', 'format index repeat')
check_eq('{name}'.format(name='world'), 'world', 'format kw')
check_eq('{:05d}'.format(42), '00042', 'format zero pad')
check_eq('{:.2f}'.format(3.14159), '3.14', 'format float 2dp')
try:
    check_eq('{:>10}'.format('hi'), '        hi', 'format right')
    check_eq('{:<10}'.format('hi'), 'hi        ', 'format left')
    check_eq('{:^10}'.format('hi'), '    hi    ', 'format center')
except (ValueError, NotImplementedError):
    skip('str.format alignment')
check_eq('{:b}'.format(10), '1010', 'format bin')
check_eq('{:x}'.format(255), 'ff', 'format hex lower')
check_eq('{:X}'.format(255), 'FF', 'format hex upper')
check_eq('{:o}'.format(8), '10', 'format oct')

check_eq('ab' * 3, 'ababab', 'str mul')
check_eq('hello' + ' ' + 'world', 'hello world', 'str concat')
check_eq(ord('A'), 65, 'ord A')
check_eq(ord('a'), 97, 'ord a')
check_eq(ord('0'), 48, 'ord 0')
check_eq(chr(65), 'A', 'chr 65')
check_eq(chr(97), 'a', 'chr 97')
check_eq(chr(48), '0', 'chr 48')
check_eq('Micro' in s, True, 'in str')
check_eq('xyz' in s, False, 'not in str')
check_eq('hello'.encode(), b'hello', 'encode utf8')
check_eq(b'hello'.decode(), 'hello', 'decode utf8')

ml = 'line one\nline two\nline three'
lines = ml.split('\n')
check_eq(len(lines), 3, 'multiline count')
check_eq(lines[0], 'line one', 'multiline 0')
check_eq(lines[2], 'line three', 'multiline 2')

try:
    check_eq('hello=world'.partition('='), ('hello', '=', 'world'), 'partition')
    check_eq('hello'.partition('='), ('hello', '', ''), 'partition missing')
except AttributeError:
    skip('str.partition')
check_eq('\n', chr(10), 'newline escape')
check_eq('\t', chr(9), 'tab escape')
check_eq('\x41', 'A', 'hex escape')

for i in range(26):
    check_eq(chr(ord('a') + i).upper(), chr(ord('A') + i), 'upper alpha ' + chr(ord('a') + i))
    check_eq(chr(ord('A') + i).lower(), chr(ord('a') + i), 'lower alpha ' + chr(ord('A') + i))


# =============================================================================
# 7. LIST OPERATIONS
# =============================================================================

section('list operations')

lst = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5]
check_eq(len(lst), 11, 'list len')
check_eq(lst[0], 3, 'list idx 0')
check_eq(lst[-1], 5, 'list idx -1')
check_eq(lst[2:5], [4, 1, 5], 'list slice')
check_eq(lst[::-1], [5, 3, 5, 6, 2, 9, 5, 1, 4, 1, 3], 'list reverse slice')
check_eq(lst.count(5), 3, 'list count 5')
check_eq(lst.index(9), 5, 'list index of 9')

a = [1, 2, 3]
a.append(4)
check_eq(a, [1, 2, 3, 4], 'append')
a.insert(1, 10)
check_eq(a, [1, 10, 2, 3, 4], 'insert')
a.remove(10)
check_eq(a, [1, 2, 3, 4], 'remove')
check_eq(a.pop(), 4, 'pop tail')
check_eq(a.pop(0), 1, 'pop head')
a.extend([4, 5, 6])
check_eq(a, [2, 3, 4, 5, 6], 'extend')

b = a.copy()
b.append(7)
check_eq(a[-1], 6, 'copy independent')

a.reverse()
check_eq(a, [6, 5, 4, 3, 2], 'reverse in place')

c = [3, 1, 4, 1, 5, 9, 2, 6]
c.sort()
check_eq(c, [1, 1, 2, 3, 4, 5, 6, 9], 'sort asc')
c.sort(reverse=True)
check_eq(c, [9, 6, 5, 4, 3, 2, 1, 1], 'sort desc')

words = ['banana', 'apple', 'cherry', 'date']
words.sort(key=len)
check_eq(words[0], 'date', 'sort by len shortest first')

orig = [3, 1, 2]
srt = sorted(orig)
check_eq(orig, [3, 1, 2], 'sorted non-mutating')
check_eq(srt, [1, 2, 3], 'sorted result')

check_eq([1, 2] + [3, 4], [1, 2, 3, 4], 'list concat')
check_eq([0] * 5, [0, 0, 0, 0, 0], 'list mul')

matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
check_eq(matrix[1][2], 6, 'nested list access')
flat = [x for row in matrix for x in row]
check_eq(flat, [1, 2, 3, 4, 5, 6, 7, 8, 9], 'nested list flatten')

pairs = list(zip([1, 2, 3], ['a', 'b', 'c']))
check_eq(pairs, [(1, 'a'), (2, 'b'), (3, 'c')], 'zip pairs')

result = list(enumerate(['a', 'b', 'c'], start=1))
check_eq(result, [(1, 'a'), (2, 'b'), (3, 'c')], 'enumerate start=1')

doubled = list(map(lambda x: x * 2, [1, 2, 3, 4]))
check_eq(doubled, [2, 4, 6, 8], 'map double')
evens = list(filter(lambda x: x % 2 == 0, range(10)))
check_eq(evens, [0, 2, 4, 6, 8], 'filter evens')

check_eq(any([False, False, True]), True, 'any true')
check_eq(any([False, False, False]), False, 'any all false')
check_eq(all([True, True, True]), True, 'all true')
check_eq(all([True, False, True]), False, 'all with false')

d = [1, 2, 3]
d.clear()
check_eq(d, [], 'list clear')


# =============================================================================
# 8. DICTIONARY OPERATIONS
# =============================================================================

section('dictionary operations')

d = {'a': 1, 'b': 2, 'c': 3}
check_eq(len(d), 3, 'dict len')
check_eq(d['a'], 1, 'dict access')
check_eq(d.get('b'), 2, 'dict get')
check_eq(d.get('z', 99), 99, 'dict get default')
check_eq('a' in d, True, 'dict in')
check_eq('z' in d, False, 'dict not in')

d['d'] = 4
check_eq(d['d'], 4, 'dict set new key')
d['a'] = 10
check_eq(d['a'], 10, 'dict overwrite')
del d['a']
check_eq('a' in d, False, 'dict del')

check_eq(sorted(d.keys()), ['b', 'c', 'd'], 'dict keys')
check_eq(sorted(d.values()), [2, 3, 4], 'dict values')
check_eq(sorted(d.items()), [('b', 2), ('c', 3), ('d', 4)], 'dict items')

popped = d.pop('b')
check_eq(popped, 2, 'dict pop val')
check_eq('b' in d, False, 'dict pop removed')

d.update({'x': 100, 'y': 200})
check_eq(d['x'], 100, 'dict update x')

e = d.copy()
e['z'] = 999
check_eq('z' not in d, True, 'dict copy independent')
d.clear()
check_eq(len(d), 0, 'dict clear')

d = {}
d.setdefault('key', 42)
check_eq(d['key'], 42, 'setdefault new')
d.setdefault('key', 99)
check_eq(d['key'], 42, 'setdefault no overwrite')

nested = {'outer': {'inner': {'value': 42}}}
check_eq(nested['outer']['inner']['value'], 42, 'nested dict')

d2 = dict.fromkeys(['a', 'b', 'c'], 0)
check_eq(d2, {'a': 0, 'b': 0, 'c': 0}, 'fromkeys')

d3 = {'only': 1}
k, v = d3.popitem()
check_eq(k, 'only', 'popitem key')
check_eq(v, 1, 'popitem val')


# =============================================================================
# 9. SET OPERATIONS
# =============================================================================

section('set operations')

a = {1, 2, 3, 4, 5}
b = {3, 4, 5, 6, 7}

check_eq(len(a), 5, 'set len')
check_eq(3 in a, True, 'set in')
check_eq(6 in a, False, 'set not in')
check_eq(a | b, {1, 2, 3, 4, 5, 6, 7}, 'union')
check_eq(a & b, {3, 4, 5}, 'intersection')
check_eq(a - b, {1, 2}, 'difference')
check_eq(a ^ b, {1, 2, 6, 7}, 'sym diff')
check_eq({1, 2}.issubset({1, 2, 3}), True, 'issubset')
check_eq({1, 2, 3}.issuperset({1, 2}), True, 'issuperset')
check_eq({1, 2}.isdisjoint({3, 4}), True, 'isdisjoint')
check_eq({1, 2}.isdisjoint({2, 3}), False, 'not disjoint')

c = a.copy()
c.add(10)
check_eq(10 in c, True, 'set add')
check_eq(10 not in a, True, 'add copy independent')
c.discard(10)
check_eq(10 not in c, True, 'discard')
c.discard(999)  # no raise
c.remove(1)
check_eq(1 not in c, True, 'remove')
check_raises(KeyError, lambda: c.remove(999), 'remove missing raises')

fs = frozenset([1, 2, 3])
check_eq(2 in fs, True, 'frozenset in')
check_raises(AttributeError, lambda: fs.add(4), 'frozenset immutable')

dupes = [1, 2, 2, 3, 3, 3, 4]
check_eq(sorted(set(dupes)), [1, 2, 3, 4], 'set dedup')


# =============================================================================
# 10. TUPLE OPERATIONS
# =============================================================================

section('tuple operations')

t = (1, 2, 3, 4, 5)
check_eq(len(t), 5, 'tuple len')
check_eq(t[0], 1, 'tuple idx 0')
check_eq(t[-1], 5, 'tuple idx -1')
check_eq(t[1:3], (2, 3), 'tuple slice')
check_eq(t.count(3), 1, 'tuple count')
check_eq(t.index(4), 3, 'tuple index of 4')
check_eq(3 in t, True, 'tuple in')

a, b, c = (10, 20, 30)
check_eq(a, 10, 'unpack a')
check_eq(b, 20, 'unpack b')
check_eq(c, 30, 'unpack c')

first, *rest = (1, 2, 3, 4)
check_eq(first, 1, 'star unpack first')
check_eq(rest, [2, 3, 4], 'star unpack rest')

*init, last = (1, 2, 3, 4)
check_eq(init, [1, 2, 3], 'star unpack init')
check_eq(last, 4, 'star unpack last')

check_raises((TypeError, AttributeError), lambda: t.__setitem__(0, 99), 'tuple immutable')

single = (42,)
check_eq(type(single), tuple, 'single elem tuple type')
check_eq(single[0], 42, 'single elem access')

check_eq((1, 2) + (3, 4), (1, 2, 3, 4), 'tuple concat')
check_eq((1, 2) * 3, (1, 2, 1, 2, 1, 2), 'tuple mul')

nested = ((1, 2), (3, 4), (5, 6))
check_eq(nested[1][0], 3, 'nested tuple access')


# =============================================================================
# 11. BYTES AND BYTEARRAY
# =============================================================================

section('bytes and bytearray')

b = b'hello'
check_eq(len(b), 5, 'bytes len')
check_eq(b[0], 104, 'bytes h=104')
check_eq(b[1:3], b'el', 'bytes slice')
check_eq(b + b' world', b'hello world', 'bytes concat')
check_eq(b * 2, b'hellohello', 'bytes mul')
check_eq(b'l' in b, True, 'bytes in')
check_eq(b.count(b'l'), 2, 'bytes count l')
check_eq(b.find(b'lo'), 3, 'bytes find lo')
check_eq(b.upper(), b'HELLO', 'bytes upper')
check_eq(b.lower(), b'hello', 'bytes lower')
check_eq(b.hex(), '68656c6c6f', 'bytes hex')
check_eq(bytes.fromhex('68656c6c6f'), b'hello', 'bytes fromhex')

ba = bytearray(b'hello')
check_eq(ba[0], 104, 'bytearray index')
ba[0] = 72
check_eq(ba[0], 72, 'bytearray mutate h->H')
ba.append(33)
check_eq(ba[-1], 33, 'bytearray append !')
check_eq(bytes(ba), b'Hello!', 'bytearray to bytes')

ba2 = bytearray(5)
check_eq(len(ba2), 5, 'bytearray zeros len')
check_eq(ba2[0], 0, 'bytearray zero val')

all_bytes = bytes(range(256))
check_eq(len(all_bytes), 256, 'all bytes len')
check_eq(all_bytes[0], 0, 'all bytes[0]')
check_eq(all_bytes[127], 127, 'all bytes[127]')
check_eq(all_bytes[255], 255, 'all bytes[255]')
check_eq(bytes.fromhex(all_bytes.hex()), all_bytes, 'bytes hex roundtrip')

mv = memoryview(bytearray(b'hello'))
check_eq(mv[0], 104, 'memoryview index')
check_eq(bytes(mv[1:3]), b'el', 'memoryview slice')


# =============================================================================
# 12. MATH MODULE
# =============================================================================

section('math module')

TOL = 1e-6

check_close(math.pi, 3.141592653589793, TOL, 'pi')
check_close(math.e, 2.718281828459045, TOL, 'e')
check_close(math.sqrt(4), 2.0, TOL, 'sqrt 4')
check_close(math.sqrt(2), 1.4142135623730951, TOL, 'sqrt 2')
check_close(math.pow(2, 10), 1024.0, TOL, 'pow 2^10')
check_close(math.exp(0), 1.0, TOL, 'exp 0')
check_close(math.exp(1), math.e, TOL, 'exp 1')
check_close(math.log(1), 0.0, TOL, 'log 1')
check_close(math.log(math.e), 1.0, TOL, 'log e')
check_close(math.log(100, 10), 2.0, TOL, 'log base 10')
check_close(math.log2(8), 3.0, TOL, 'log2 8')
check_close(math.log10(1000), 3.0, TOL, 'log10 1000')
check_close(math.sin(0), 0.0, TOL, 'sin 0')
check_close(math.sin(math.pi / 2), 1.0, TOL, 'sin pi/2')
check_close(math.sin(math.pi), 0.0, 1e-6, 'sin pi')
check_close(math.cos(0), 1.0, TOL, 'cos 0')
check_close(math.cos(math.pi), -1.0, TOL, 'cos pi')
check_close(math.cos(math.pi / 2), 0.0, 1e-6, 'cos pi/2')
check_close(math.tan(0), 0.0, TOL, 'tan 0')
check_close(math.tan(math.pi / 4), 1.0, TOL, 'tan pi/4')
check_close(math.asin(1), math.pi / 2, TOL, 'asin 1')
check_close(math.acos(1), 0.0, TOL, 'acos 1')
check_close(math.atan(1), math.pi / 4, TOL, 'atan 1')
check_close(math.atan2(1, 1), math.pi / 4, TOL, 'atan2 1,1')
check_close(math.atan2(0, -1), math.pi, TOL, 'atan2 0,-1')
check_close(math.degrees(math.pi), 180.0, TOL, 'degrees pi')
check_close(math.radians(180), math.pi, TOL, 'radians 180')
check_close(math.degrees(math.radians(45)), 45.0, TOL, 'deg/rad roundtrip')
check_close(math.sinh(0), 0.0, TOL, 'sinh 0')
check_close(math.cosh(0), 1.0, TOL, 'cosh 0')
check_close(math.tanh(0), 0.0, TOL, 'tanh 0')
check_eq(math.floor(3.7), 3, 'floor 3.7')
check_eq(math.ceil(3.2), 4, 'ceil 3.2')
check_eq(math.trunc(3.9), 3, 'trunc pos')
check_eq(math.trunc(-3.9), -3, 'trunc neg')
check_close(math.fabs(-3.5), 3.5, TOL, 'fabs neg')
check_close(math.copysign(3, -1), -3.0, TOL, 'copysign neg')
check_close(math.copysign(3, 1), 3.0, TOL, 'copysign pos')
check_eq(math.isnan(float('nan')), True, 'isnan')
check_eq(math.isnan(0.0), False, 'isnan false')
check_eq(math.isinf(float('inf')), True, 'isinf')
check_eq(math.isfinite(1.0), True, 'isfinite')
check_eq(math.isfinite(float('inf')), False, 'isfinite inf false')
try:
    check_close(math.hypot(3, 4), 5.0, TOL, 'hypot 3-4-5')
    check_close(math.hypot(5, 12), 13.0, TOL, 'hypot 5-12-13')
    for a_val, b_val, c_val in [(3,4,5),(5,12,13),(8,15,17),(7,24,25),(20,21,29)]:
        check_close(math.hypot(a_val, b_val), c_val, 0.001,
                    'pythagorean {},{},{}'.format(a_val, b_val, c_val))
except AttributeError:
    skip('math.hypot')

check_close(math.modf(3.75)[0], 0.75, TOL, 'modf frac')
check_close(math.modf(3.75)[1], 3.0, TOL, 'modf int')

try:
    check_eq(math.factorial(10), 3628800, 'factorial 10')
    check_eq(math.factorial(0), 1, 'factorial 0')
except AttributeError:
    skip('math.factorial')

try:
    check_eq(math.gcd(48, 18), 6, 'gcd 48 18')
    check_eq(math.gcd(17, 13), 1, 'gcd coprime')
except AttributeError:
    skip('math.gcd')

# Verify trig identity sin^2 + cos^2 = 1
for deg in range(0, 360, 15):
    r = math.radians(deg)
    check_close(math.sin(r)**2 + math.cos(r)**2, 1.0, 1e-6, 'sin2+cos2=1 deg=' + str(deg))


# =============================================================================
# 13. CONTROL FLOW
# =============================================================================

section('control flow')

result = []
i = 0
while True:
    i += 1
    if i % 2 == 0:
        continue
    if i > 10:
        break
    result.append(i)
check_eq(result, [1, 3, 5, 7, 9], 'while break continue')

for_else_hit = False
for x in range(10):
    if x == 5:
        for_else_hit = True
        break
else:
    for_else_hit = False
check_eq(for_else_hit, True, 'for break prevents else')

for_else_result = None
for x in range(5):
    if x == 20:
        break
else:
    for_else_result = 'completed'
check_eq(for_else_result, 'completed', 'for else runs when no break')

def classify(n):
    if n < 0:
        return 'negative'
    elif n == 0:
        return 'zero'
    elif n < 10:
        return 'small'
    elif n < 100:
        return 'medium'
    else:
        return 'large'

check_eq(classify(-5), 'negative', 'classify neg')
check_eq(classify(0), 'zero', 'classify zero')
check_eq(classify(5), 'small', 'classify small')
check_eq(classify(50), 'medium', 'classify medium')
check_eq(classify(500), 'large', 'classify large')

check_eq('even' if 42 % 2 == 0 else 'odd', 'even', 'ternary even')
check_eq('even' if 7 % 2 == 0 else 'odd', 'odd', 'ternary odd')

check_eq(list(range(5)), [0, 1, 2, 3, 4], 'range 5')
check_eq(list(range(2, 8)), [2, 3, 4, 5, 6, 7], 'range 2..8')
check_eq(list(range(0, 10, 2)), [0, 2, 4, 6, 8], 'range step 2')
check_eq(list(range(10, 0, -2)), [10, 8, 6, 4, 2], 'range neg step')
check_eq(list(range(5, 5)), [], 'range empty')

outer_i = outer_j = 0
for i in range(5):
    for j in range(5):
        if i == 2 and j == 3:
            outer_i, outer_j = i, j
            break
    if outer_i == 2:
        break
check_eq(outer_i, 2, 'nested break i')
check_eq(outer_j, 3, 'nested break j')


# =============================================================================
# 14. EXCEPTION HANDLING
# =============================================================================

section('exception handling')

try:
    result = 1 / 0
    fail('zerodiv not raised')
except ZeroDivisionError:
    ok('zerodiv caught')

def parse_int(s):
    try:
        return int(s)
    except ValueError:
        return 'value error'
    except TypeError:
        return 'type error'

check_eq(parse_int('42'), 42, 'parse int ok')
check_eq(parse_int('abc'), 'value error', 'parse value error')
check_eq(parse_int(None), 'type error', 'parse type error')

try:
    int('oops')
except ValueError as e:
    check_eq(len(str(e)) > 0, True, 'exception has message')

def safe_divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        return None
    else:
        pass  # only reached if no exception — already returned above

check_close(safe_divide(10, 4), 2.5, 1e-9, 'safe divide ok')
check_eq(safe_divide(10, 0), None, 'safe divide zero')

cleanup_log = []
def with_finally():
    try:
        return 42
    finally:
        cleanup_log.append('cleanup')

check_eq(with_finally(), 42, 'finally return value preserved')
check_eq(cleanup_log, ['cleanup'], 'finally executed')

cleanup_log = []
try:
    try:
        raise ValueError('test error')
    finally:
        cleanup_log.append('inner finally')
except ValueError:
    pass
check_eq(cleanup_log, ['inner finally'], 'finally on exception path')

class AppError(Exception):
    def __init__(self, msg, code=0):
        super().__init__(msg)
        self.code = code

class ConnError(AppError):
    pass

try:
    raise ConnError('disconnected', 1)
except AppError as e:
    check_eq(str(e), 'disconnected', 'custom exc msg')
    check_eq(e.code, 1, 'custom exc code')
    check_eq(isinstance(e, AppError), True, 'isinstance parent')
    check_eq(isinstance(e, ConnError), True, 'isinstance child')

check_raises(IndexError, lambda: [][5], 'IndexError')
check_raises(KeyError, lambda: {}['x'], 'KeyError')
check_raises(ValueError, lambda: int('x'), 'ValueError')
check_raises(TypeError, lambda: None + 1, 'TypeError')
check_raises(ZeroDivisionError, lambda: 1 // 0, 'ZeroDivisionError')
check_raises(OSError, lambda: open('/no/such/file/xyz'), 'OSError')
check_raises(AttributeError, lambda: (1).no_such_attr, 'AttributeError')
check_raises(StopIteration, lambda: next(iter([])), 'StopIteration')


# =============================================================================
# 15. FUNCTIONS AND CLOSURES
# =============================================================================

section('functions and closures')

def greet(name, greeting='Hello'):
    return '{}, {}!'.format(greeting, name)

check_eq(greet('World'), 'Hello, World!', 'default arg')
check_eq(greet('World', 'Hi'), 'Hi, World!', 'override default')

def sum_all(*args):
    return sum(args)

check_eq(sum_all(1, 2, 3), 6, 'varargs sum')
check_eq(sum_all(*range(5)), 10, 'unpack into varargs')

def describe(**kwargs):
    return sorted(kwargs.items())

check_eq(describe(a=1, b=2), [('a', 1), ('b', 2)], 'kwargs')

def mixed(a, b, *args, **kwargs):
    return a + b + sum(args) + sum(kwargs.values())

check_eq(mixed(1, 2, 3, 4, x=5, y=6), 21, 'mixed all arg types')

square = lambda x: x * x
check_eq(square(7), 49, 'lambda square')
check_eq(sorted([3, 1, 4, 1, 5], key=lambda x: -x), [5, 4, 3, 1, 1], 'lambda sort key')

def make_counter(start=0):
    count = [start]
    def increment(step=1):
        count[0] += step
        return count[0]
    def reset():
        count[0] = start
    return increment, reset

counter, counter_reset = make_counter()
check_eq(counter(), 1, 'counter 1')
check_eq(counter(), 2, 'counter 2')
check_eq(counter(5), 7, 'counter step 5')
counter_reset()
check_eq(counter(), 1, 'counter after reset')

def make_adder(n):
    return lambda x: x + n

add5 = make_adder(5)
add10 = make_adder(10)
check_eq(add5(3), 8, 'closure adder 5+3')
check_eq(add10(3), 13, 'closure adder 10+3')
check_eq(add5(add10(1)), 16, 'closure compose adders')

def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

fib_seq = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377]
for i, expected in enumerate(fib_seq):
    check_eq(fib(i), expected, 'fib({})'.format(i))

def memoize(fn):
    cache = {}
    def wrapper(*args):
        if args not in cache:
            cache[args] = fn(*args)
        return cache[args]
    return wrapper

fib_m = memoize(fib)
check_eq(fib_m(14), 377, 'memoized fib 14')

def compose(f, g):
    return lambda x: f(g(x))

double_then_inc = compose(lambda x: x + 1, lambda x: x * 2)
inc_then_double = compose(lambda x: x * 2, lambda x: x + 1)
check_eq(double_then_inc(5), 11, 'compose double+inc')
check_eq(inc_then_double(5), 12, 'compose inc+double')


# =============================================================================
# 16. CLASSES AND OOP
# =============================================================================

section('classes and oop')

class Animal:
    count = 0
    def __init__(self, name, sound):
        self.name = name
        self.sound = sound
        Animal.count += 1
    def speak(self):
        return '{} says {}'.format(self.name, self.sound)
    def __repr__(self):
        return 'Animal({})'.format(self.name)
    def __str__(self):
        return self.name
    def __eq__(self, other):
        return isinstance(other, Animal) and self.name == other.name
    def __hash__(self):
        return hash(self.name)

cat = Animal('Cat', 'meow')
dog = Animal('Dog', 'woof')
check_eq(cat.speak(), 'Cat says meow', 'speak')
check_eq(str(cat), 'Cat', '__str__')
check_eq(repr(cat), 'Animal(Cat)', '__repr__')
check_eq(cat == Animal('Cat', 'meow'), True, '__eq__ true')
check_eq(cat == dog, False, '__eq__ false')
check_eq(Animal.count, 3, 'class var')

class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name, 'woof')
        self.breed = breed
    def describe(self):
        return '{} is a {}'.format(self.name, self.breed)
    def speak(self):
        return super().speak() + '!'

fido = Dog('Fido', 'Labrador')
check_eq(fido.speak(), 'Fido says woof!', 'override and super')
check_eq(fido.describe(), 'Fido is a Labrador', 'subclass new method')
check_eq(isinstance(fido, Dog), True, 'isinstance child')
check_eq(isinstance(fido, Animal), True, 'isinstance parent')
check_eq(Animal.count, 4, 'class var incremented by subclass')

class Flyable:
    def fly(self):
        return '{} is flying'.format(self.name)

class FlyingDog(Dog, Flyable):
    pass

superdog = FlyingDog('Rex', 'Superpoodle')
check_eq(superdog.fly(), 'Rex is flying', 'multiple inheritance method')
check_eq(superdog.speak(), 'Rex says woof!', 'multiple inheritance chain')

class Temperature:
    def __init__(self, celsius):
        if celsius < -273.15:
            raise ValueError('Below absolute zero')
        self._c = celsius
    @property
    def celsius(self):
        return self._c
    @celsius.setter
    def celsius(self, v):
        if v < -273.15:
            raise ValueError('Below absolute zero')
        self._c = v
    @property
    def fahrenheit(self):
        return self._c * 9 / 5 + 32
    @property
    def kelvin(self):
        return self._c + 273.15

t = Temperature(100)
check_close(t.fahrenheit, 212.0, 1e-6, 'boiling F')
check_close(t.kelvin, 373.15, 1e-6, 'boiling K')
t.celsius = 0
check_close(t.fahrenheit, 32.0, 1e-6, 'freezing F')
check_raises(ValueError, lambda: Temperature(-300), 'temp below abs zero')

class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y
    def __add__(self, o): return Vector(self.x+o.x, self.y+o.y)
    def __sub__(self, o): return Vector(self.x-o.x, self.y-o.y)
    def __mul__(self, s): return Vector(self.x*s, self.y*s)
    def __rmul__(self, s): return self.__mul__(s)
    def __neg__(self): return Vector(-self.x, -self.y)
    def __abs__(self): return math.sqrt(self.x**2 + self.y**2)
    def __eq__(self, o): return isinstance(o, Vector) and self.x==o.x and self.y==o.y
    def __repr__(self): return 'Vector({},{})'.format(self.x, self.y)
    def dot(self, o): return self.x*o.x + self.y*o.y

v1 = Vector(1, 2)
v2 = Vector(3, 4)
check_eq(v1 + v2, Vector(4, 6), 'vector add')
check_eq(v2 - v1, Vector(2, 2), 'vector sub')
check_eq(v1 * 3, Vector(3, 6), 'vector scalar mul')
check_eq(2 * v1, Vector(2, 4), 'vector rmul')
check_eq(-v1, Vector(-1, -2), 'vector neg')
check_close(abs(v2), 5.0, 1e-6, 'vector abs 3-4-5')
check_eq(v1.dot(v2), 11, 'dot product')

class Stack:
    def __init__(self):
        self._d = []
    def push(self, x): self._d.append(x)
    def pop(self): return self._d.pop()
    def peek(self): return self._d[-1]
    def __len__(self): return len(self._d)
    def __contains__(self, x): return x in self._d
    def __iter__(self): return reversed(self._d)

s = Stack()
s.push(1); s.push(2); s.push(3)
check_eq(len(s), 3, 'stack len')
check_eq(s.peek(), 3, 'stack peek')
check_eq(2 in s, True, 'stack contains')
check_eq(s.pop(), 3, 'stack pop')
check_eq(list(s), [2, 1], 'stack iter reversed')


# =============================================================================
# 17. GENERATORS AND ITERATORS
# =============================================================================

section('generators and iterators')

def countdown(n):
    while n > 0:
        yield n
        n -= 1

check_eq(list(countdown(5)), [5, 4, 3, 2, 1], 'countdown generator')

def naturals(start=1):
    n = start
    while True:
        yield n
        n += 1

gen = naturals()
check_eq([next(gen) for _ in range(5)], [1, 2, 3, 4, 5], 'infinite naturals')

def take(n, it):
    count = 0
    for x in it:
        if count >= n: break
        yield x
        count += 1

primes_gen = (n for n in naturals(2)
              if all(n % i != 0 for i in range(2, int(math.sqrt(n)) + 1)))
check_eq(list(take(10, primes_gen)),
         [2, 3, 5, 7, 11, 13, 17, 19, 23, 29], 'first 10 primes gen')

def chain_iters(*iterables):
    for it in iterables:
        yield from it

check_eq(list(chain_iters([1,2],[3,4],[5,6])), [1,2,3,4,5,6], 'yield from chain')

def fib_gen():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

fib_vals = list(take(10, fib_gen()))
check_eq(fib_vals, [0,1,1,2,3,5,8,13,21,34], 'fib generator')

class CountDown:
    def __init__(self, n):
        self.n = n
    def __iter__(self):
        n = self.n
        while n >= 0:
            yield n
            n -= 1
    def __len__(self):
        return self.n + 1

cd = CountDown(4)
check_eq(list(cd), [4, 3, 2, 1, 0], 'custom iterator class')
check_eq(len(cd), 5, 'custom iterator len')


# =============================================================================
# 18. COMPREHENSIONS
# =============================================================================

section('comprehensions')

squares = [x**2 for x in range(10)]
check_eq(squares, [0,1,4,9,16,25,36,49,64,81], 'list comp squares')

evens = [x for x in range(20) if x % 2 == 0]
check_eq(evens, [0,2,4,6,8,10,12,14,16,18], 'list comp filter evens')

flat = [x for row in [[1,2],[3,4],[5,6]] for x in row]
check_eq(flat, [1,2,3,4,5,6], 'nested list comp flatten')

matrix = [[i*j for j in range(1,4)] for i in range(1,4)]
check_eq(matrix, [[1,2,3],[2,4,6],[3,6,9]], 'matrix comprehension')

word_lens = {w: len(w) for w in ['hello','world','python']}
check_eq(word_lens, {'hello':5,'world':5,'python':6}, 'dict comp')

inverted = {v: k for k, v in {'a':1,'b':2,'c':3}.items()}
check_eq(inverted, {1:'a',2:'b',3:'c'}, 'dict comp invert')

unique_lens = {len(w) for w in ['hi','hello','hey','world','python']}
check_eq(unique_lens, {2, 3, 5, 6}, 'set comp')

check_eq(sum(x**2 for x in range(10)), 285, 'gen expr sum squares')
check_eq(any(x > 50 for x in range(100)), True, 'gen expr any')
check_eq(all(x >= 0 for x in range(10)), True, 'gen expr all non-neg')

fizzbuzz = [
    'fizzbuzz' if x%15==0 else 'fizz' if x%3==0 else 'buzz' if x%5==0 else str(x)
    for x in range(1, 16)
]
check_eq(fizzbuzz[0], '1', 'fizzbuzz 1')
check_eq(fizzbuzz[2], 'fizz', 'fizzbuzz 3')
check_eq(fizzbuzz[4], 'buzz', 'fizzbuzz 5')
check_eq(fizzbuzz[14], 'fizzbuzz', 'fizzbuzz 15')


# =============================================================================
# 19. SORTING ALGORITHMS
# =============================================================================

section('sorting algorithms')

def is_sorted(lst):
    return all(lst[i] <= lst[i+1] for i in range(len(lst)-1))

def bubble_sort(arr):
    a = list(arr)
    n = len(a)
    for i in range(n):
        for j in range(0, n-i-1):
            if a[j] > a[j+1]:
                a[j], a[j+1] = a[j+1], a[j]
    return a

def insertion_sort(arr):
    a = list(arr)
    for i in range(1, len(a)):
        key = a[i]
        j = i - 1
        while j >= 0 and a[j] > key:
            a[j+1] = a[j]
            j -= 1
        a[j+1] = key
    return a

def merge_sort(arr):
    if len(arr) <= 1:
        return list(arr)
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result

def quick_sort(arr):
    if len(arr) <= 1:
        return list(arr)
    pivot = arr[len(arr)//2]
    left = [x for x in arr if x < pivot]
    mid = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + mid + quick_sort(right)

test_cases = [
    [64, 34, 25, 12, 22, 11, 90],
    [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
    [1],
    [],
    list(range(20, 0, -1)),
    list(range(20)),
]

for tc in test_cases:
    expected = sorted(tc)
    label = str(len(tc)) + ' elems'
    check_eq(bubble_sort(tc), expected, 'bubble ' + label)
    check_eq(insertion_sort(tc), expected, 'insertion ' + label)
    check_eq(merge_sort(tc), expected, 'merge ' + label)
    check_eq(quick_sort(tc), expected, 'quick ' + label)


# =============================================================================
# 20. SEARCH ALGORITHMS
# =============================================================================

section('search algorithms')

def linear_search(arr, target):
    for i, val in enumerate(arr):
        if val == target:
            return i
    return -1

def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1

sorted_data = list(range(0, 100, 2))

check_eq(linear_search([3,1,4,1,5,9], 5), 4, 'linear found')
check_eq(linear_search([3,1,4,1,5,9], 7), -1, 'linear not found')
check_eq(linear_search([], 1), -1, 'linear empty')

check_eq(binary_search(sorted_data, 50), 25, 'binary found 50')
check_eq(binary_search(sorted_data, 0), 0, 'binary found 0')
check_eq(binary_search(sorted_data, 98), 49, 'binary found 98')
check_eq(binary_search(sorted_data, 51), -1, 'binary odd not found')
check_eq(binary_search([], 1), -1, 'binary empty')

for val in range(0, 100, 2):
    idx = binary_search(sorted_data, val)
    check_eq(sorted_data[idx], val, 'binary all evens val=' + str(val))


# =============================================================================
# 21. DATA STRUCTURES
# =============================================================================

section('data structures')

class Node:
    def __init__(self, val, nxt=None):
        self.val = val
        self.next = nxt

class LinkedList:
    def __init__(self):
        self.head = None
        self._len = 0
    def append(self, val):
        node = Node(val)
        if not self.head:
            self.head = node
        else:
            curr = self.head
            while curr.next:
                curr = curr.next
            curr.next = node
        self._len += 1
    def prepend(self, val):
        self.head = Node(val, self.head)
        self._len += 1
    def __len__(self): return self._len
    def to_list(self):
        r, curr = [], self.head
        while curr:
            r.append(curr.val)
            curr = curr.next
        return r
    def reverse(self):
        prev, curr = None, self.head
        while curr:
            nxt = curr.next
            curr.next = prev
            prev = curr
            curr = nxt
        self.head = prev

ll = LinkedList()
for v in [1, 2, 3]:
    ll.append(v)
ll.prepend(0)
check_eq(ll.to_list(), [0, 1, 2, 3], 'linked list append/prepend')
check_eq(len(ll), 4, 'linked list len')
ll.reverse()
check_eq(ll.to_list(), [3, 2, 1, 0], 'linked list reverse')

class Queue:
    def __init__(self): self._d = []
    def enqueue(self, x): self._d.append(x)
    def dequeue(self):
        if not self._d: raise IndexError('empty')
        return self._d.pop(0)
    def peek(self):
        if not self._d: raise IndexError('empty')
        return self._d[0]
    def __len__(self): return len(self._d)
    def is_empty(self): return not self._d

q = Queue()
q.enqueue('a'); q.enqueue('b'); q.enqueue('c')
check_eq(len(q), 3, 'queue len')
check_eq(q.peek(), 'a', 'queue peek')
check_eq(q.dequeue(), 'a', 'queue dequeue FIFO')
check_eq(q.dequeue(), 'b', 'queue dequeue 2nd')
check_raises(IndexError, lambda: Queue().dequeue(), 'queue empty raises')

class BST:
    class _N:
        def __init__(self, v): self.v=v; self.l=self.r=None
    def __init__(self): self.root = None
    def insert(self, v):
        def _ins(n, v):
            if n is None: return self._N(v)
            if v < n.v: n.l = _ins(n.l, v)
            elif v > n.v: n.r = _ins(n.r, v)
            return n
        self.root = _ins(self.root, v)
    def contains(self, v):
        n = self.root
        while n:
            if v == n.v: return True
            n = n.l if v < n.v else n.r
        return False
    def inorder(self):
        res = []
        def _io(n):
            if n: _io(n.l); res.append(n.v); _io(n.r)
        _io(self.root)
        return res

bst = BST()
for v in [5, 3, 7, 1, 4, 6, 8]:
    bst.insert(v)
check_eq(bst.inorder(), [1, 3, 4, 5, 6, 7, 8], 'bst inorder sorted')
check_eq(bst.contains(4), True, 'bst contains 4')
check_eq(bst.contains(2), False, 'bst not contains 2')


# =============================================================================
# 22. FILESYSTEM
# =============================================================================

section('filesystem')

try:
    os.listdir('/')
    _tmp = '/test_mpy_suite'
except OSError:
    _tmp = 'test_mpy_suite'

def fs_cleanup():
    for name in ['a.txt', 'b.txt', 'c.bin', 'sub/d.txt']:
        try: os.remove(_tmp + '/' + name)
        except OSError: pass
    try: os.rmdir(_tmp + '/sub')
    except OSError: pass
    try: os.rmdir(_tmp)
    except OSError: pass

fs_cleanup()

try:
    os.mkdir(_tmp)
    ok('mkdir test dir')
except OSError as e:
    fail('mkdir test dir', e)

path_a = _tmp + '/a.txt'
with open(path_a, 'w') as f:
    f.write('hello micropython\n')
    f.write('second line\n')

with open(path_a, 'r') as f:
    content = f.read()
check_eq(content, 'hello micropython\nsecond line\n', 'text write/read')

with open(path_a, 'r') as f:
    lines = f.readlines()
check_eq(len(lines), 2, 'readlines count')
check_eq(lines[0].strip(), 'hello micropython', 'readlines line 0')

path_c = _tmp + '/c.bin'
data = bytes(range(256))
with open(path_c, 'wb') as f:
    f.write(data)
with open(path_c, 'rb') as f:
    readback = f.read()
check_eq(len(readback), 256, 'binary len')
check_eq(readback[0], 0, 'binary byte 0')
check_eq(readback[255], 255, 'binary byte 255')
check_eq(readback, data, 'binary roundtrip all 256 values')

path_b = _tmp + '/b.txt'
with open(path_b, 'w') as f:
    f.write('line1\n')
with open(path_b, 'a') as f:
    f.write('line2\n')
with open(path_b, 'r') as f:
    content = f.read()
check_eq(content, 'line1\nline2\n', 'append mode')

stat = os.stat(path_a)
check_eq(stat[6] > 0, True, 'stat size positive')
check_eq(stat[6], len('hello micropython\nsecond line\n'), 'stat size matches')

files = os.listdir(_tmp)
check_eq('a.txt' in files, True, 'listdir a.txt')
check_eq('b.txt' in files, True, 'listdir b.txt')
check_eq('c.bin' in files, True, 'listdir c.bin')

sub = _tmp + '/sub'
os.mkdir(sub)
check_eq('sub' in os.listdir(_tmp), True, 'mkdir subdir')

with open(sub + '/d.txt', 'w') as f:
    f.write('subdir content')
check_eq('d.txt' in os.listdir(sub), True, 'write to subdir')
os.remove(sub + '/d.txt')
os.rmdir(sub)
check_eq('sub' not in os.listdir(_tmp), True, 'rmdir subdir')

os.rename(path_b, _tmp + '/b_ren.txt')
check_eq('b.txt' not in os.listdir(_tmp), True, 'rename: old gone')
check_eq('b_ren.txt' in os.listdir(_tmp), True, 'rename: new exists')
os.rename(_tmp + '/b_ren.txt', path_b)

with open(path_a, 'rb') as f:
    f.seek(6)
    partial = f.read(11)
    check_eq(partial, b'micropython', 'seek read')
    check_eq(f.tell(), 17, 'tell after read')
    f.seek(0)
    check_eq(f.tell(), 0, 'seek to 0')

try:
    sv = os.statvfs(_tmp)
    check_eq(sv[0] > 0, True, 'statvfs block_size')
    check_eq(sv[3] >= 0, True, 'statvfs free_blocks')
    check_eq(sv[3] <= sv[2], True, 'statvfs free <= total')
except OSError:
    skip('statvfs')

fs_cleanup()
try:
    os.listdir(_tmp)
    fail('fs_cleanup did not remove dir')
except OSError:
    ok('fs_cleanup complete')


# =============================================================================
# 23. GC AND MEMORY
# =============================================================================

section('gc and memory')

gc.collect()
free0 = gc.mem_free()
alloc0 = gc.mem_alloc()

check_eq(type(free0), int, 'mem_free is int')
check_eq(type(alloc0), int, 'mem_alloc is int')
check_eq(free0 > 0, True, 'mem_free positive')
check_eq(alloc0 > 0, True, 'mem_alloc positive')

big = list(range(500))
gc.collect()
check_eq(gc.mem_free() < free0, True, 'mem used after alloc')

del big
gc.collect()
check_eq(gc.mem_free() > 0, True, 'mem recovered after del+gc')

gc.disable()
gc.enable()
ok('gc disable/enable')

for _ in range(20):
    tmp = [0] * 200
    del tmp
    gc.collect()
ok('gc loop alloc/free 20x')


# =============================================================================
# 24. STRUCT MODULE
# =============================================================================

section('struct module')

try:
    import struct

    check_eq(struct.pack('>I', 0xDEADBEEF), b'\xde\xad\xbe\xef', 'pack BE uint32')
    check_eq(struct.unpack('>I', b'\xde\xad\xbe\xef')[0], 0xDEADBEEF, 'unpack BE uint32')
    check_eq(struct.pack('<I', 0xDEADBEEF), b'\xef\xbe\xad\xde', 'pack LE uint32')
    check_eq(struct.unpack('<I', b'\xef\xbe\xad\xde')[0], 0xDEADBEEF, 'unpack LE uint32')
    check_eq(struct.pack('>i', -1), b'\xff\xff\xff\xff', 'pack signed -1')
    check_eq(struct.unpack('>i', b'\xff\xff\xff\xff')[0], -1, 'unpack signed -1')
    check_eq(struct.pack('>HHH', 1, 2, 3), b'\x00\x01\x00\x02\x00\x03', 'pack 3 shorts')
    check_eq(struct.unpack('>HHH', b'\x00\x01\x00\x02\x00\x03'), (1, 2, 3), 'unpack 3 shorts')
    check_eq(struct.pack('B', 255), b'\xff', 'pack byte 255')
    check_eq(struct.pack('b', -128), b'\x80', 'pack signed byte -128')
    check_close(struct.unpack('>f', struct.pack('>f', 1.0))[0], 1.0, 1e-6, 'float roundtrip')
    check_close(struct.unpack('>d', struct.pack('>d', math.pi))[0], math.pi, 1e-12, 'double pi')
    check_eq(struct.calcsize('>IHB'), 7, 'calcsize IHB')

    buf = bytearray(8)
    struct.pack_into('>HH', buf, 0, 0x1234, 0x5678)
    struct.pack_into('>HH', buf, 4, 0xABCD, 0xEF01)
    check_eq(struct.unpack_from('>HH', buf, 0), (0x1234, 0x5678), 'pack_into/unpack_from 0')
    check_eq(struct.unpack_from('>HH', buf, 4), (0xABCD, 0xEF01), 'pack_into/unpack_from 4')

    for val in [0, 1, 127, 128, 254, 255]:
        check_eq(struct.unpack('B', struct.pack('B', val))[0], val, 'byte roundtrip ' + str(val))

except ImportError:
    skip('struct not available')


# =============================================================================
# 25. JSON MODULE
# =============================================================================

section('json module')

try:
    import json

    check_eq(json.dumps(42), '42', 'dumps int')
    check_eq(json.dumps(True), 'true', 'dumps true')
    check_eq(json.dumps(False), 'false', 'dumps false')
    check_eq(json.dumps(None), 'null', 'dumps null')
    check_eq(json.dumps('hello'), '"hello"', 'dumps str')
    check_eq(json.loads('42'), 42, 'loads int')
    check_eq(json.loads('true'), True, 'loads true')
    check_eq(json.loads('false'), False, 'loads false')
    check_eq(json.loads('null'), None, 'loads null')
    check_eq(json.loads('"hello"'), 'hello', 'loads str')
    check_eq(json.loads('[1,2,3]'), [1, 2, 3], 'loads list')

    obj = {'name': 'Alice', 'age': 30, 'active': True, 'tags': ['a', 'b']}
    rt = json.loads(json.dumps(obj))
    check_eq(rt['name'], 'Alice', 'json roundtrip name')
    check_eq(rt['age'], 30, 'json roundtrip int')
    check_eq(rt['active'], True, 'json roundtrip bool')
    check_eq(rt['tags'], ['a', 'b'], 'json roundtrip list')

    deep = {'a': {'b': {'c': [1, 2, 3]}}}
    check_eq(json.loads(json.dumps(deep))['a']['b']['c'], [1, 2, 3], 'json deep nested')

    records = [{'id': i, 'sq': i*i} for i in range(5)]
    rt2 = json.loads(json.dumps(records))
    check_eq(len(rt2), 5, 'json array len')
    check_eq(rt2[4]['sq'], 16, 'json array last sq')

    check_raises(ValueError, lambda: json.loads('{invalid}'), 'json invalid raises')

except ImportError:
    skip('json not available')


# =============================================================================
# 26. SYS MODULE
# =============================================================================

section('sys module')

check_eq(type(sys.version), str, 'version is str')
check_eq(len(sys.version) > 0, True, 'version not empty')
check_eq(type(sys.platform), str, 'platform is str')
check_eq(type(sys.path), list, 'path is list')
check_eq(isinstance(sys.modules, dict), True, 'sys.modules is dict')
check_eq(sys.maxsize > 0, True, 'maxsize positive')
check_eq(sys.maxsize >= 2**30, True, 'maxsize >= 31bit')

try:
    check_eq(sys.implementation.name, 'micropython', 'impl name')
    check_eq(len(sys.implementation.version) >= 3, True, 'impl version tuple')
except AttributeError:
    skip('sys.implementation')

try:
    check_eq(sys.byteorder in ('little', 'big'), True, 'byteorder valid')
except AttributeError:
    skip('sys.byteorder')


# =============================================================================
# 27. RE MODULE
# =============================================================================

section('re module')

try:
    import re

    m = re.match(r'\d+', '123abc')
    check_eq(m is not None, True, 're match found')
    check_eq(m.group(0), '123', 're match group 0')
    check_eq(re.match(r'\d+', 'abc'), None, 're match not at start')

    m = re.search(r'\d+', 'abc123def')
    check_eq(m is not None, True, 're search found')
    check_eq(m.group(0), '123', 're search group')

    if hasattr(re, 'findall'):
        nums = re.findall(r'\d+', 'a12 b34 c56')
        check_eq(nums, ['12', '34', '56'], 're findall')
    else:
        skip('re.findall')

    if hasattr(re, 'sub'):
        check_eq(re.sub(r'\d+', 'N', 'a12 b34'), 'aN bN', 're sub')
    else:
        skip('re.sub')

    m = re.match(r'(\w+)@(\w+)\.(\w+)', 'user@host.com')
    check_eq(m is not None, True, 're email match')
    check_eq(m.group(1), 'user', 're group user')
    check_eq(m.group(2), 'host', 're group host')
    check_eq(m.group(3), 'com', 're group tld')

    if hasattr(re, 'split'):
        parts = re.split(r'\s+', 'one  two   three')
        check_eq(parts, ['one', 'two', 'three'], 're split whitespace')
    else:
        skip('re.split')

except ImportError:
    skip('re not available')


# =============================================================================
# 28. TIME MODULE
# =============================================================================

section('time module')

try:
    import time

    t1 = time.time()
    check_eq(t1 >= 0, True, 'time() non-negative')

    try:
        t_start = time.ticks_ms()
        time.sleep_ms(10)
        t_end = time.ticks_ms()
        elapsed = time.ticks_diff(t_end, t_start)
        check_eq(elapsed >= 9, True, 'sleep_ms >= 9ms')
        check_eq(elapsed < 200, True, 'sleep_ms < 200ms')
        ok('ticks_ms / sleep_ms / ticks_diff')
    except AttributeError:
        time.sleep(0.01)
        skip('ticks_ms (posix port — sleep used instead)')

    try:
        check_eq(type(time.ticks_us()), int, 'ticks_us is int')
    except AttributeError:
        skip('ticks_us')

    try:
        lt = time.localtime()
        check_eq(len(lt) >= 8, True, 'localtime tuple len')
        check_eq(lt[0] >= 2000, True, 'localtime year >= 2000')
    except (AttributeError, OSError):
        skip('localtime')

except ImportError:
    skip('time module not available')


# =============================================================================
# 29. ALGORITHM SHOWCASE
# =============================================================================

section('algorithms')

def gcd(a, b):
    while b:
        a, b = b, a % b
    return a

def lcm(a, b):
    return a * b // gcd(a, b)

check_eq(gcd(48, 18), 6, 'gcd 48,18')
check_eq(gcd(100, 75), 25, 'gcd 100,75')
check_eq(gcd(17, 13), 1, 'gcd coprime')
check_eq(lcm(4, 6), 12, 'lcm 4,6')
check_eq(lcm(3, 5), 15, 'lcm coprime')

def sieve(n):
    c = bytearray(n + 1)
    c[0] = c[1] = 1
    for i in range(2, int(math.sqrt(n)) + 1):
        if not c[i]:
            for j in range(i*i, n+1, i):
                c[j] = 1
    return [i for i in range(n+1) if not c[i]]

primes = sieve(100)
check_eq(primes[:10], [2,3,5,7,11,13,17,19,23,29], 'sieve first 10')
check_eq(len(primes), 25, 'sieve count to 100')
check_eq(97 in primes, True, 'sieve 97 prime')
check_eq(91 in primes, False, 'sieve 91 not prime (7*13)')

def rle_encode(s):
    if not s: return []
    res, count = [], 1
    for i in range(1, len(s)):
        if s[i] == s[i-1]:
            count += 1
        else:
            res.append((s[i-1], count))
            count = 1
    res.append((s[-1], count))
    return res

def rle_decode(enc):
    return ''.join(ch * n for ch, n in enc)

enc = rle_encode('aaabbbccdddde')
check_eq(enc, [('a',3),('b',3),('c',2),('d',4),('e',1)], 'rle encode')
check_eq(rle_decode(enc), 'aaabbbccdddde', 'rle decode')
check_eq(rle_decode(rle_encode('abcde')), 'abcde', 'rle no repeats roundtrip')

def caesar(text, shift):
    res = []
    for ch in text:
        if 'a' <= ch <= 'z':
            res.append(chr((ord(ch) - ord('a') + shift) % 26 + ord('a')))
        elif 'A' <= ch <= 'Z':
            res.append(chr((ord(ch) - ord('A') + shift) % 26 + ord('A')))
        else:
            res.append(ch)
    return ''.join(res)

check_eq(caesar('hello', 3), 'khoor', 'caesar encode')
check_eq(caesar('khoor', -3), 'hello', 'caesar decode')
check_eq(caesar(caesar('MicroPython!', 13), 13), 'MicroPython!', 'rot13 roundtrip')

def mat_mul(A, B):
    rA, cA, cB = len(A), len(A[0]), len(B[0])
    C = [[0]*cB for _ in range(rA)]
    for i in range(rA):
        for j in range(cB):
            for k in range(cA):
                C[i][j] += A[i][k] * B[k][j]
    return C

I2 = [[1,0],[0,1]]
A = [[1,2],[3,4]]
check_eq(mat_mul(A, I2), A, 'matmul identity right')
check_eq(mat_mul(I2, A), A, 'matmul identity left')
check_eq(mat_mul(A, [[5,6],[7,8]]), [[19,22],[43,50]], 'matmul 2x2')

def mat_transpose(A):
    return [[A[j][i] for j in range(len(A))] for i in range(len(A[0]))]

check_eq(mat_transpose([[1,2,3],[4,5,6]]), [[1,4],[2,5],[3,6]], 'transpose 2x3->3x2')

def flatten(obj):
    if isinstance(obj, (list, tuple)):
        for item in obj:
            yield from flatten(item)
    else:
        yield obj

check_eq(list(flatten([1,[2,[3,[4]]]])), [1,2,3,4], 'flatten deep')
check_eq(list(flatten([[1,2],[3,[4,5]],[[6,[7,8]],9]])), [1,2,3,4,5,6,7,8,9], 'flatten mixed')

def word_freq(text):
    freq = {}
    for w in text.lower().split():
        freq[w] = freq.get(w, 0) + 1
    return freq

freq = word_freq('the quick brown fox jumps over the lazy dog the')
check_eq(freq['the'], 3, 'word freq the=3')
check_eq(freq['fox'], 1, 'word freq fox=1')
check_eq(freq.get('cat', 0), 0, 'word freq cat=0')

def is_palindrome(s):
    s = s.lower().replace(' ', '')
    return s == ''.join(reversed(s))

check_eq(is_palindrome('racecar'), True, 'palindrome racecar')
check_eq(is_palindrome('amanaplanacanalpanama'), True, 'palindrome panama')
check_eq(is_palindrome('hello'), False, 'palindrome hello false')

# Integer square root (no float)
def isqrt(n):
    if n < 0: raise ValueError('negative')
    if n == 0: return 0
    x = n
    y = (x + 1) // 2
    while y < x:
        x = y
        y = (x + n // x) // 2
    return x

for n in range(200):
    r = isqrt(n)
    check_eq(r * r <= n < (r+1)*(r+1), True, 'isqrt n=' + str(n))

# Base conversion
def to_base(n, base):
    if n == 0: return '0'
    digits = '0123456789abcdef'
    res = []
    while n:
        res.append(digits[n % base])
        n //= base
    return ''.join(reversed(res))

check_eq(to_base(255, 16), 'ff', 'to_base 255 hex')
check_eq(to_base(10, 2), '1010', 'to_base 10 bin')
check_eq(to_base(8, 8), '10', 'to_base 8 oct')
check_eq(to_base(0, 2), '0', 'to_base 0')

for n in range(1, 256):
    check_eq(int(to_base(n, 16), 16), n, 'to_base hex roundtrip n=' + str(n))
    check_eq(int(to_base(n, 2), 2), n, 'to_base bin roundtrip n=' + str(n))


# =============================================================================
# 30. SUMMARY
# =============================================================================

# =============================================================================
# 31. NUMBER THEORY AND COMBINATORICS
# =============================================================================

section('number theory')

def is_prime(n):
    if n < 2: return False
    if n == 2: return True
    if n % 2 == 0: return False
    i = 3
    while i * i <= n:
        if n % i == 0: return False
        i += 2
    return True

for p in [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47]:
    check_eq(is_prime(p), True, 'is_prime ' + str(p))

for c in [1,4,6,8,9,10,12,14,15,16,18,20,21,22,24,25]:
    check_eq(is_prime(c), False, 'not prime ' + str(c))

def prime_factors(n):
    factors = []
    d = 2
    while d * d <= n:
        while n % d == 0:
            factors.append(d)
            n //= d
        d += 1
    if n > 1:
        factors.append(n)
    return factors

check_eq(prime_factors(12), [2, 2, 3], 'factors 12')
check_eq(prime_factors(100), [2, 2, 5, 5], 'factors 100')
check_eq(prime_factors(97), [97], 'factors 97 prime')
check_eq(prime_factors(360), [2, 2, 2, 3, 3, 5], 'factors 360')

for n in [12, 30, 60, 100, 360]:
    factors = prime_factors(n)
    product = 1
    for f in factors:
        product *= f
    check_eq(product, n, 'factors product n=' + str(n))

def euler_totient(n):
    result = n
    p = 2
    temp = n
    while p * p <= temp:
        if temp % p == 0:
            while temp % p == 0:
                temp //= p
            result -= result // p
        p += 1
    if temp > 1:
        result -= result // temp
    return result

check_eq(euler_totient(1), 1, 'totient 1')
check_eq(euler_totient(2), 1, 'totient 2')
check_eq(euler_totient(6), 2, 'totient 6')
check_eq(euler_totient(9), 6, 'totient 9')
check_eq(euler_totient(10), 4, 'totient 10')
check_eq(euler_totient(12), 4, 'totient 12')

def factorial(n):
    r = 1
    for i in range(2, n+1):
        r *= i
    return r

factorials = [1,1,2,6,24,120,720,5040,40320,362880,3628800]
for i, expected in enumerate(factorials):
    check_eq(factorial(i), expected, 'factorial ' + str(i))

def combinations(n, k):
    if k > n or k < 0: return 0
    if k == 0 or k == n: return 1
    k = min(k, n - k)
    result = 1
    for i in range(k):
        result = result * (n - i) // (i + 1)
    return result

# Pascal's triangle row sums = 2^n
for n in range(10):
    row_sum = sum(combinations(n, k) for k in range(n+1))
    check_eq(row_sum, 2**n, 'pascal row sum n=' + str(n))

check_eq(combinations(5, 2), 10, 'C(5,2)')
check_eq(combinations(10, 3), 120, 'C(10,3)')
check_eq(combinations(6, 0), 1, 'C(6,0)')
check_eq(combinations(6, 6), 1, 'C(6,6)')

# Modular arithmetic
def mod_pow(base, exp, mod):
    result = 1
    base %= mod
    while exp > 0:
        if exp % 2 == 1:
            result = result * base % mod
        exp //= 2
        base = base * base % mod
    return result

check_eq(mod_pow(2, 10, 1000), 24, 'mod_pow 2^10 mod 1000')
check_eq(mod_pow(3, 100, 97), mod_pow(3, 100 % 96, 97), 'fermat little theorem')
check_eq(mod_pow(7, 0, 13), 1, 'mod_pow exp 0')
check_eq(mod_pow(0, 5, 7), 0, 'mod_pow base 0')

# Luhn algorithm (credit card check)
def luhn_check(number):
    digits = [int(d) for d in str(number)]
    digits.reverse()
    total = 0
    for i, d in enumerate(digits):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0

check_eq(luhn_check(4532015112830366), True, 'luhn valid visa')
check_eq(luhn_check(4532015112830367), False, 'luhn invalid')
check_eq(luhn_check(79927398713), True, 'luhn valid example')
check_eq(luhn_check(79927398714), False, 'luhn invalid example')


# =============================================================================
# 32. STRING ALGORITHMS
# =============================================================================

section('string algorithms')

# KMP string search
def kmp_search(text, pattern):
    if not pattern: return 0
    n, m = len(text), len(pattern)
    lps = [0] * m
    length = 0
    i = 1
    while i < m:
        if pattern[i] == pattern[length]:
            length += 1
            lps[i] = length
            i += 1
        elif length:
            length = lps[length - 1]
        else:
            lps[i] = 0
            i += 1
    matches = []
    i = j = 0
    while i < n:
        if text[i] == pattern[j]:
            i += 1
            j += 1
        if j == m:
            matches.append(i - j)
            j = lps[j - 1]
        elif i < n and text[i] != pattern[j]:
            if j:
                j = lps[j - 1]
            else:
                i += 1
    return matches

check_eq(kmp_search('abcabcabc', 'abc'), [0, 3, 6], 'kmp abc')
check_eq(kmp_search('hello world', 'world'), [6], 'kmp world')
check_eq(kmp_search('aaaaaa', 'aaa'), [0, 1, 2, 3], 'kmp overlapping')
check_eq(kmp_search('hello', 'xyz'), [], 'kmp not found')
check_eq(kmp_search('', 'a'), [], 'kmp empty text')

# Edit distance (Levenshtein)
def edit_distance(a, b):
    m, n = len(a), len(b)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev = dp[0]
        dp[0] = i
        for j in range(1, n + 1):
            temp = dp[j]
            if a[i-1] == b[j-1]:
                dp[j] = prev
            else:
                dp[j] = 1 + min(prev, dp[j], dp[j-1])
            prev = temp
    return dp[n]

check_eq(edit_distance('', ''), 0, 'edit dist empty')
check_eq(edit_distance('abc', 'abc'), 0, 'edit dist same')
check_eq(edit_distance('abc', 'ab'), 1, 'edit dist delete')
check_eq(edit_distance('ab', 'abc'), 1, 'edit dist insert')
check_eq(edit_distance('abc', 'axc'), 1, 'edit dist replace')
check_eq(edit_distance('kitten', 'sitting'), 3, 'edit dist kitten->sitting')
check_eq(edit_distance('saturday', 'sunday'), 3, 'edit dist saturday->sunday')

# Longest common subsequence
def lcs_length(a, b):
    m, n = len(a), len(b)
    dp = [[0] * (n+1) for _ in range(m+1)]
    for i in range(1, m+1):
        for j in range(1, n+1):
            if a[i-1] == b[j-1]:
                dp[i][j] = dp[i-1][j-1] + 1
            else:
                dp[i][j] = max(dp[i-1][j], dp[i][j-1])
    return dp[m][n]

check_eq(lcs_length('ABCBDAB', 'BDCAB'), 4, 'lcs ABCBDAB BDCAB')
check_eq(lcs_length('abc', 'abc'), 3, 'lcs same')
check_eq(lcs_length('abc', 'def'), 0, 'lcs disjoint')
check_eq(lcs_length('', 'abc'), 0, 'lcs empty')

# Anagram check
def is_anagram(a, b):
    if len(a) != len(b): return False
    freq = {}
    for ch in a:
        freq[ch] = freq.get(ch, 0) + 1
    for ch in b:
        freq[ch] = freq.get(ch, 0) - 1
        if freq[ch] < 0: return False
    return True

check_eq(is_anagram('listen', 'silent'), True, 'anagram listen/silent')
check_eq(is_anagram('hello', 'world'), False, 'anagram hello/world false')
check_eq(is_anagram('anagram', 'nagaram'), True, 'anagram nagaram')
check_eq(is_anagram('ab', 'a'), False, 'anagram diff len')

# Word reversal preserving spaces
def reverse_words(s):
    return ' '.join(s.split()[::-1])

check_eq(reverse_words('hello world'), 'world hello', 'reverse words')
check_eq(reverse_words('one two three four'), 'four three two one', 'reverse 4 words')

# Count vowels and consonants
def vowel_count(s):
    return sum(1 for c in s.lower() if c in 'aeiou')

def consonant_count(s):
    return sum(1 for c in s.lower() if c in 'bcdfghjklmnpqrstvwxyz')

check_eq(vowel_count('Hello World'), 3, 'vowels Hello World')
check_eq(consonant_count('Hello World'), 7, 'consonants Hello World')
check_eq(vowel_count('MicroPython'), 3, 'vowels MicroPython')


# =============================================================================
# 33. CHECKSUMS AND ENCODING
# =============================================================================

section('checksums and encoding')

# XOR checksum
def xor_checksum(data):
    cs = 0
    for b in data:
        cs ^= b
    return cs

check_eq(xor_checksum(b'\x00'), 0, 'xor cs 0')
check_eq(xor_checksum(b'\xff'), 0xff, 'xor cs ff')
check_eq(xor_checksum(b'\xAA\x55'), 0xFF, 'xor cs AA^55=FF')
check_eq(xor_checksum(b'\x01\x02\x03\x04'), 0x04, 'xor cs 1234')

# Sum checksum (8-bit modular)
def sum8_checksum(data):
    return sum(data) & 0xFF

check_eq(sum8_checksum(b'\x01\x02\x03'), 6, 'sum8 1+2+3')
check_eq(sum8_checksum(b'\xff\x01'), 0, 'sum8 overflow')

# CRC-8 (polynomial 0x07)
def crc8(data, poly=0x07, init=0x00):
    crc = init
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 0x80:
                crc = ((crc << 1) ^ poly) & 0xFF
            else:
                crc = (crc << 1) & 0xFF
    return crc

check_eq(crc8(b''), 0, 'crc8 empty')
check_eq(crc8(b'\x00'), 0, 'crc8 zero')
check_eq(crc8(b'123456789'), 0xF4, 'crc8 123456789')

# CRC-16/CCITT (polynomial 0x1021, init 0xFFFF)
def crc16(data, poly=0x1021, init=0xFFFF):
    crc = init
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ poly) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return crc

check_eq(crc16(b'123456789'), 0x29B1, 'crc16 ccitt 123456789')

# Simple base64-like encoding (without ubinascii)
_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
_B64_INV = {c: i for i, c in enumerate(_B64)}

def b64_encode(data):
    out = []
    for i in range(0, len(data), 3):
        chunk = data[i:i+3]
        b = 0
        for byte in chunk:
            b = (b << 8) | byte
        pad = 3 - len(chunk)
        b <<= pad * 8
        for j in range(4 - pad):
            out.append(_B64[(b >> (18 - j*6)) & 0x3F])
        out.extend('=' * pad)
    return ''.join(out)

def b64_decode(s):
    s = s.rstrip('=')
    out = []
    b = 0
    bits = 0
    for c in s:
        b = (b << 6) | _B64_INV[c]
        bits += 6
        if bits >= 8:
            bits -= 8
            out.append((b >> bits) & 0xFF)
    return bytes(out)

test_vectors = [
    (b'', ''),
    (b'f', 'Zg=='),
    (b'fo', 'Zm8='),
    (b'foo', 'Zm9v'),
    (b'hello', 'aGVsbG8='),
    (b'MicroPython', 'TWljcm9QeXRob24='),
]
for raw, encoded in test_vectors:
    check_eq(b64_encode(raw), encoded, 'b64_encode ' + repr(raw))
    check_eq(b64_decode(encoded), raw, 'b64_decode ' + repr(raw))

# Roundtrip all single bytes
for i in range(256):
    b = bytes([i])
    check_eq(b64_decode(b64_encode(b)), b, 'b64 roundtrip byte ' + str(i))


# =============================================================================
# 34. DYNAMIC PROGRAMMING
# =============================================================================

section('dynamic programming')

# 0/1 Knapsack
def knapsack(weights, values, capacity):
    n = len(weights)
    dp = [0] * (capacity + 1)
    for i in range(n):
        for w in range(capacity, weights[i]-1, -1):
            dp[w] = max(dp[w], dp[w - weights[i]] + values[i])
    return dp[capacity]

check_eq(knapsack([1,3,4,5], [1,4,5,7], 7), 9, 'knapsack 7 cap')
check_eq(knapsack([2,3,4,5], [3,4,5,6], 5), 7, 'knapsack 5 cap')
check_eq(knapsack([], [], 10), 0, 'knapsack empty')

# Coin change (minimum coins)
def coin_change(coins, amount):
    dp = [amount + 1] * (amount + 1)
    dp[0] = 0
    for i in range(1, amount + 1):
        for c in coins:
            if c <= i:
                dp[i] = min(dp[i], dp[i - c] + 1)
    return dp[amount] if dp[amount] <= amount else -1

check_eq(coin_change([1,5,10,25], 30), 2, 'coins 30 cents')
check_eq(coin_change([1,5,10,25], 41), 4, 'coins 41 cents')
check_eq(coin_change([2], 3), -1, 'coins impossible')
check_eq(coin_change([1,2,5], 11), 3, 'coins 11')

# Longest increasing subsequence
def lis_length(arr):
    if not arr: return 0
    dp = [1] * len(arr)
    for i in range(1, len(arr)):
        for j in range(i):
            if arr[j] < arr[i]:
                dp[i] = max(dp[i], dp[j] + 1)
    return max(dp)

check_eq(lis_length([10,9,2,5,3,7,101,18]), 4, 'lis 4')
check_eq(lis_length([0,1,0,3,2,3]), 4, 'lis 4b')
check_eq(lis_length([7,7,7,7]), 1, 'lis all same')
check_eq(lis_length([1,2,3,4,5]), 5, 'lis sorted')
check_eq(lis_length([5,4,3,2,1]), 1, 'lis reverse sorted')

# Maximum subarray (Kadane's)
def max_subarray(arr):
    best = curr = arr[0]
    for x in arr[1:]:
        curr = max(x, curr + x)
        best = max(best, curr)
    return best

check_eq(max_subarray([-2,1,-3,4,-1,2,1,-5,4]), 6, 'kadane classic')
check_eq(max_subarray([1]), 1, 'kadane single')
check_eq(max_subarray([-1,-2,-3]), -1, 'kadane all neg')
check_eq(max_subarray([1,2,3,4,5]), 15, 'kadane all pos')


# =============================================================================
# 35. FUNCTIONAL PATTERNS
# =============================================================================

section('functional patterns')

# Reduce
def reduce(fn, iterable, initial=None):
    it = iter(iterable)
    if initial is None:
        acc = next(it)
    else:
        acc = initial
    for x in it:
        acc = fn(acc, x)
    return acc

check_eq(reduce(lambda a, b: a + b, [1,2,3,4,5]), 15, 'reduce sum')
check_eq(reduce(lambda a, b: a * b, [1,2,3,4,5]), 120, 'reduce product')
check_eq(reduce(lambda a, b: max(a, b), [3,1,4,1,5,9,2,6]), 9, 'reduce max')
check_eq(reduce(lambda a, b: a + b, [], 0), 0, 'reduce empty with initial')

# Flatten using reduce
check_eq(reduce(lambda a, b: a + b, [[1,2],[3,4],[5,6]]), [1,2,3,4,5,6], 'reduce flatten')

# curry
def curry(fn, arity=2):
    def curried(*args):
        if len(args) >= arity:
            return fn(*args[:arity])
        return lambda *more: curried(*(args + more))
    return curried

add = curry(lambda a, b: a + b)
check_eq(add(3)(4), 7, 'curry add')
check_eq(add(3, 4), 7, 'curry add direct')

mul = curry(lambda a, b: a * b)
triple = mul(3)
check_eq(triple(5), 15, 'curry triple')
check_eq(list(map(triple, [1,2,3,4])), [3,6,9,12], 'curry map')

# Pipeline
def pipeline(*fns):
    def apply(x):
        for fn in fns:
            x = fn(x)
        return x
    return apply

process = pipeline(
    lambda x: x * 2,
    lambda x: x + 10,
    lambda x: x ** 2,
)
check_eq(process(5), 400, 'pipeline 5->10->20->400')
check_eq(process(0), 100, 'pipeline 0->0->10->100')

# Memoization with LRU-like cache (size 8)
def lru_cache(maxsize=8):
    def decorator(fn):
        keys = []
        cache = {}
        def wrapper(*args):
            if args in cache:
                keys.remove(args)
                keys.append(args)
                return cache[args]
            result = fn(*args)
            if len(keys) >= maxsize:
                oldest = keys.pop(0)
                del cache[oldest]
            cache[args] = result
            keys.append(args)
            return result
        return wrapper
    return decorator

call_count = [0]

@lru_cache(maxsize=4)
def expensive(n):
    call_count[0] += 1
    return n * n

for _ in range(3):
    check_eq(expensive(5), 25, 'lru cache 5')
check_eq(call_count[0], 1, 'lru cache hit (computed once)')

for i in range(10):
    check_eq(expensive(i), i*i, 'lru result correct i=' + str(i))


# =============================================================================
# FINAL SUMMARY
# =============================================================================

print('')
print('MicroPython Board Test Suite — all sections complete.')
summary()
