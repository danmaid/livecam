import { SerialPort, ReadlineParser } from 'serialport'
import fetch from 'node-fetch'

// https://wings.twelite.info/how-to-use/parent-mode/receive-message/app_aria

function parseTemperature(v: string): number {
  return parseInt(v, 16) / 100
}

function parseMagnet(v: string): 'open' | 'N' | 'S' {
  return v[1] === '1' ? 'N' : v[1] === '2' ? 'S' : 'open'
}

SerialPort.list().then((v) => {
  for (const info of v) {
    console.log(info)
    const port = new SerialPort({ path: info.path, baudRate: 115200 })
    const parser = port.pipe(new ReadlineParser())
    parser.on('data', async (chunk: string) => {
      const id = chunk.slice(15, 23)
      const data = {
        type: 'sensed',
        date: new Date(),
        temperature: parseTemperature(chunk.slice(103, 107)),
        humidity: parseTemperature(chunk.slice(115, 119)),
        magnet: parseMagnet(chunk.slice(93, 95)),
        raw: chunk,
      }
      fetch(`https://labo.danmaid.com/sensors/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      console.log(data)
    })
  }
})
