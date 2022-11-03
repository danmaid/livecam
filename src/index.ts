import { spawn, ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import EventSource from 'eventsource'
import fetch from 'node-fetch'
import { v4 as uuid } from 'uuid'

const endpoint = 'https://labo.danmaid.com'
// const endpoint = 'http://localhost:8520'
const events = new EventSource(endpoint)

events.onerror = (ev) => console.error('Error: ', ev)
events.onopen = (ev) => console.log('Connected.', ev)
events.onmessage = (ev) => {
  const { event } = JSON.parse(ev.data)
  if (event.camera !== 'labo1') return
  if (event.type === 'start' && typeof event.url === 'string') start(event)
  if (event.type === 'stop') stop()
}

const procs = new Set<ChildProcess>()

function post(event: unknown) {
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  })
}

function start({ url }: { url: string }) {
  const proc = spawn(
    '/usr/bin/ffmpeg',
    '-f lavfi -i anullsrc -f v4l2 -input_format h264 -s 1920x1080 -thread_queue_size 8192 -i /dev/video0 -c:v copy -b:v 6000k -f flv'
      .split(' ')
      .concat([url])
  )
  const id = uuid()
  const procInfo = () => ({
    id,
    connected: proc.connected,
    signalCode: proc.signalCode,
    exitCode: proc.exitCode,
    killed: proc.killed,
    spawnfile: proc.spawnfile,
    spawnargs: proc.spawnargs,
    pid: proc.pid,
  })

  proc.on('exit', (code, siangl) => {
    const event = { type: 'exited', ...procInfo(), code, siangl }
    post(event)
    console.log(event)
  })
  proc.on('spawn', () => {
    const event = { type: 'spawned', ...procInfo() }
    post(event)
    console.log(event)
  })

  const stdout = createInterface(proc.stdout)
  stdout.on('line', (line) => {
    const event = { type: 'stdout', id, line }
    post(event)
    console.log(event)
  })

  const stderr = createInterface(proc.stderr)
  stderr.on('line', (line) => {
    const event = { type: 'stderr', id, line }
    post(event)
    console.log(event)
  })

  procs.add(proc)
}

function stop() {
  procs.forEach((proc) => proc.kill())
}

process.on('SIGINT', () => {
  console.log('SIGINT')
  events.close()
})
process.on('exit', () => {
  console.log('exit')
  events.close()
})

console.log('start')
