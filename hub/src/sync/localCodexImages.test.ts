import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, mkdir, writeFile, symlink, rm, truncate } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readLocalCodexImage } from './localCodexImages'
import { Store } from '../store'

const thread = '5e183d30-0ae6-43f5-b366-7f00686b3113'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY4cAAAAASUVORK5CYII=', 'base64')
let home: string
async function fixture() {
    home = await mkdtemp(join(tmpdir(), 'hapi-media-'))
    const dir = join(home, 'generated_images', thread)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'portrait.png'), png)
    return dir
}
afterEach(async () => { if (home) await rm(home, { recursive: true, force: true }) })

test('reads exact PNG without a live session or image cache', async () => {
    await fixture()
    const result = await readLocalCodexImage(home, thread, 'portrait.png')
    expect(result?.success).toBe(true)
    expect(Buffer.from(result!.content!, 'base64')).toEqual(png)
})

test('rejects traversal, wrong thread, symlinks, directories and invalid PNG', async () => {
    const dir = await fixture()
    expect(await readLocalCodexImage(home, '../escape', 'portrait.png')).toBeUndefined()
    expect(await readLocalCodexImage(home, thread, '../portrait.png')).toBeUndefined()
    expect(await readLocalCodexImage(home, '11fc0c17-7c59-44f5-888d-4bcdd5b1d4aa', 'portrait.png')).toBeUndefined()
    await symlink(join(dir, 'portrait.png'), join(dir, 'link.png'))
    expect(await readLocalCodexImage(home, thread, 'link.png')).toBeUndefined()
    await mkdir(join(dir, 'directory.png'))
    expect(await readLocalCodexImage(home, thread, 'directory.png')).toBeUndefined()
    await writeFile(join(dir, 'text.png'), 'not an image')
    expect(await readLocalCodexImage(home, thread, 'text.png')).toBeUndefined()
    await truncate(join(dir, 'portrait.png'), 25 * 1024 * 1024 + 1)
    expect(await readLocalCodexImage(home, thread, 'portrait.png')).toBeUndefined()
})

test('rejects a thread directory redirected by symlink', async () => {
    const dir = await fixture()
    const other = '11fc0c17-7c59-44f5-888d-4bcdd5b1d4aa'
    await symlink(dir, join(home, 'generated_images', other))
    expect(await readLocalCodexImage(home, other, 'portrait.png')).toBeUndefined()
})

test('image reference is persisted and scoped to its session, including compressed envelopes', () => {
    const store = new Store(':memory:')
    const a = store.sessions.getOrCreateSession('a', { path: '/tmp' }, null, 'default')
    const b = store.sessions.getOrCreateSession('b', { path: '/tmp' }, null, 'default')
    store.messages.addMessage(a.id, { role: 'agent', content: { type: 'codex', data: {
        type: 'generated-image', imageId: 'a'.repeat(64), fileName: 'portrait.png',
        mimeType: 'image/png', extra: 'x'.repeat(300)
    }}}, 'codex:test:generated_image')
    expect(store.messages.findGeneratedImageFile(a.id, 'a'.repeat(64))).toBe('portrait.png')
    expect(store.messages.findGeneratedImageFile(b.id, 'a'.repeat(64))).toBeUndefined()
    expect(store.messages.findGeneratedImageFile(a.id, 'b'.repeat(64))).toBeUndefined()
})

test('resolves imported image references without a live-event local ID', () => {
    const store = new Store(':memory:')
    const session = store.sessions.getOrCreateSession('imported-media', {}, {}, 'default')
    store.messages.addMessage(session.id, { role: 'agent', content: { type: 'codex', data: {
        type: 'generated-image', imageId: 'b'.repeat(64), fileName: 'exec-import.png',
    } } })
    expect(store.messages.findGeneratedImageFile(session.id, 'b'.repeat(64))).toBe('exec-import.png')
    expect(store.messages.findGeneratedImageFile(session.id, 'c'.repeat(64))).toBeUndefined()
})
