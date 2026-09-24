import { constants } from 'node:fs'
import { open, realpath } from 'node:fs/promises'
import { join, sep } from 'node:path'
import type { GeneratedImageResponse } from '@hapi/protocol/apiTypes'

const MAX_BYTES = 25 * 1024 * 1024
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

// Opt-in, same-machine fallback. The caller must resolve fileName from this
// authenticated session's stored image event, never from a request pathname.
export async function readLocalCodexImage(
    codexHome: string, threadId: string | undefined, fileName: string | undefined
): Promise<GeneratedImageResponse | undefined> {
    if (!threadId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(threadId)
        || !fileName || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.png$/i.test(fileName)) return
    try {
        const root = await realpath(join(codexHome, 'generated_images'))
        const directory = join(root, threadId)
        if (await realpath(directory) !== directory) return
        const path = join(directory, fileName)
        const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
        try {
            // Linux deployment: check the opened descriptor, including parent symlinks.
            const openedPath = await realpath(`/proc/self/fd/${file.fd}`)
            if (openedPath !== path || !openedPath.startsWith(directory + sep)) return
            const stat = await file.stat()
            if (!stat.isFile() || stat.size < PNG.length || stat.size > MAX_BYTES) return
            const content = Buffer.alloc(stat.size + 1)
            let count = 0
            while (count < content.length) {
                const { bytesRead } = await file.read(content, count, content.length - count, count)
                if (!bytesRead) break
                count += bytesRead
            }
            if (count !== stat.size || !content.subarray(0, PNG.length).equals(PNG)) return
            return { success: true, content: content.subarray(0, count).toString('base64'),
                mimeType: 'image/png', fileName }
        } finally {
            await file.close()
        }
    } catch {
        // Existing RPC remains the fallback for unsupported media / missing files.
        return
    }
}
