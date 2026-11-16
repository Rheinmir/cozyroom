// Run: node --experimental-strip-types --test tests/playlistMatch.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchPlaylists } from '../src/playlistMatch.ts'

const L = (id: string, name: string) => ({ id, name, track_ids: [] })

test('accent-insensitive match', () => {
  assert.deepEqual(matchPlaylists([L('1', 'Nhạc buồn'), L('2', 'Rock')], 'nhac buon').map(p => p.id), ['1'])
})
test('prefix first, then shorter', () => {
  const r = matchPlaylists([L('a', 'My chill mix'), L('b', 'Chill evening'), L('c', 'Chill')], 'chill')
  assert.deepEqual(r.map(p => p.id), ['c', 'b', 'a'])
})
test('empty query and dedupe', () => {
  assert.deepEqual(matchPlaylists([L('1', 'x')], '  '), [])
  assert.equal(matchPlaylists([L('1', 'Jazz'), L('1', 'Jazz')], 'jazz').length, 1)
})
