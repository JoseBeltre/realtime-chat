import express from 'express'
import logger from 'morgan'

import { Server } from 'socket.io'
import { createServer } from 'node:http'
import mysql from 'mysql2/promise'

import dotenv from 'dotenv'
dotenv.config()

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME
}
const connection = await mysql.createConnection(config)

const PORT = process.env.PORT ?? 1234
const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*', // Aquí puedes especificar el origen si es necesario
    methods: ['GET', 'POST']
  }
})

io.on('connection', async (socket) => {
  console.log('Ha habido una conexion')

  socket.on('disconnect', () => {
    console.log('An user has disconnected')
  })

  socket.on('chat message', async (msg) => {
    const username = socket.handshake.auth.username ?? 'anonymous'
    await connection.query('INSERT INTO messages (content, username) values (?, ?)', [msg, username])
    const [message] = await connection.query('SELECT * FROM messages ORDER BY id DESC LIMIT 1')
    io.emit('chat message', message[0].content, message[0].id, username)
  })

  if (!socket.recovered) {
    try {
      const [messages] = await connection.query(
        'SELECT * FROM messages WHERE id > ?',
        [socket.handshake.auth.serverOffset ?? 0])

      messages.forEach((message) => {
        socket.emit('chat message', message.content, message.id, message.username)
      })
    } catch (err) {
      console.error('Error retrieving messages:', err)
    }
  }
})

app.use(express.json())
app.use(logger('dev'))

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(PORT, (req, res) => {
  console.log(`Server running on port ${PORT}`)
})
