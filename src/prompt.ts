import type { ReadStream, WriteStream } from 'node:tty'

/** Read a masked password or OTP without assuming one character per stream chunk. */
export function promptSecret(
  question: string,
  stdin: ReadStream = process.stdin,
  output: Pick<WriteStream, 'write'> = process.stderr,
): Promise<string> {
  if (!stdin.isTTY) {
    return Promise.reject(
      new Error(
        'Interactive sign-in requires a terminal. Run rivian in a terminal to enter your password or verification code.',
      ),
    )
  }

  return new Promise((resolve, reject) => {
    output.write(question)
    const wasRaw = stdin.isRaw ?? false
    const input: string[] = []
    const cleanup = () => {
      stdin.removeListener('data', onData)
      stdin.removeListener('end', onEnd)
      stdin.removeListener('error', onError)
      stdin.setRawMode(wasRaw)
      stdin.pause()
      output.write('\n')
    }
    const onEnd = () => {
      cleanup()
      reject(new Error('Input closed before sign-in was completed.'))
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\n' || ch === '\r' || ch === '\u0004') {
          cleanup()
          resolve(input.join(''))
          return
        }
        if (ch === '\u0003') {
          cleanup()
          reject(Object.assign(new Error('Sign-in cancelled.'), { code: 'ABORT_ERR' }))
          return
        }
        if (ch === '\u007f' || ch === '\b') {
          if (input.length > 0) {
            input.pop()
            output.write('\b \b')
          }
        } else {
          input.push(ch)
          output.write('*')
        }
      }
    }
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.on('data', onData)
    stdin.on('end', onEnd)
    stdin.on('error', onError)
    stdin.resume()
  })
}
