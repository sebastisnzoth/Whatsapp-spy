import makeWASocket, {
  DisconnectReason,
  Browsers,
  useMultiFileAuthState,
  getContentType
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const AUTH_DIR = path.join(__dirname, 'auth_info')
const LOG_DIR = path.join(__dirname, 'logs')
const LOG_FILE = path.join(LOG_DIR, 'events.jsonl')

fs.mkdirSync(LOG_DIR, { recursive: true })

let socket = null
let reconnectTimer = null
let stopping = false
let connected = false
let accountJid = null

function now() {
  return new Date().toISOString()
}

function appendEvent(event) {
  const record = { at: now(), ...event }
  fs.appendFileSync(LOG_FILE, JSON.stringify(record) + '\n', 'utf8')
}

function safeJid(jid) {
  if (!jid) return null
  const [user, server] = jid.split('@')
  if (!user) return jid
  const tail = user.slice(-4)
  return `***${tail}@${server || ''}`
}

function extractText(message) {
  if (!message) return null
  const type = getContentType(message)
  if (!type) return null
  const content = message[type]
  if (type === 'conversation') return String(content || '')
  if (content && typeof content === 'object') {
    return content.text || content.caption || content.contentText || null
  }
  return null
}

function printHelp() {
  console.log('\nCommands:')
  console.log('  status          show connection status')
  console.log('  help            show this help')
  console.log('  logout          unlink this local linked device')
  console.log('  delete-session  delete local auth files after logout')
  console.log('  quit            close the program\n')
}

async function deleteLocalSession() {
  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true })
    console.log('Local session files deleted.')
    appendEvent({ event: 'local_session_deleted' })
  } catch (error) {
    console.error('Could not delete local session:', error.message)
  }
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  socket = makeWASocket({
    auth: state,
    browser: Browsers.macOS('WhatsApp Self Audit'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false
  })

  socket.ev.on('creds.update', saveCreds)

  socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\nScan this QR only with a WhatsApp account you own or are authorized to test:\n')
      qrcode.generate(qr, { small: true })
      appendEvent({ event: 'qr_generated' })
    }

    if (connection === 'open') {
      connected = true
      accountJid = socket.user?.id || null
      console.log(`\nConnected${accountJid ? ` as ${safeJid(accountJid)}` : ''}. Read-only monitor active.`)
      console.log(`Events are stored locally in ${LOG_FILE}`)
      appendEvent({ event: 'connected', account: safeJid(accountJid) })
    }

    if (connection === 'close') {
      connected = false
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const loggedOut = statusCode === DisconnectReason.loggedOut
      appendEvent({ event: 'disconnected', statusCode: statusCode ?? null, loggedOut })

      if (loggedOut) {
        console.log('\nThis linked-device session was logged out. Delete auth_info and scan again to reconnect.')
        return
      }

      if (!stopping) {
        clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(() => connect().catch(reportFatal), 2000)
      }
    }
  })

  socket.ev.on('messages.upsert', ({ messages, type }) => {
    for (const msg of messages || []) {
      const jid = msg.key?.remoteJid || null
      const fromMe = Boolean(msg.key?.fromMe)
      const messageType = getContentType(msg.message || {}) || 'unknown'
      const text = extractText(msg.message)

      const event = {
        event: 'message_event',
        upsertType: type,
        chat: safeJid(jid),
        fromMe,
        messageType,
        textLength: typeof text === 'string' ? text.length : 0,
        messageId: msg.key?.id || null
      }
      appendEvent(event)
      console.log(`[message] ${fromMe ? 'sent/self' : 'received'} ${safeJid(jid)} ${messageType}${text ? ` (${text.length} chars)` : ''}`)
    }
  })

  socket.ev.on('chats.upsert', chats => {
    appendEvent({ event: 'chats_upsert', count: Array.isArray(chats) ? chats.length : 0 })
  })

  socket.ev.on('contacts.upsert', contacts => {
    appendEvent({ event: 'contacts_upsert', count: Array.isArray(contacts) ? contacts.length : 0 })
  })
}

function reportFatal(error) {
  console.error('Fatal error:', error?.message || error)
  appendEvent({ event: 'fatal_error', message: String(error?.message || error) })
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.on('line', async line => {
  const command = line.trim().toLowerCase()
  try {
    if (command === 'status') {
      console.log(`Connection: ${connected ? 'connected' : 'disconnected'}${accountJid ? ` | account ${safeJid(accountJid)}` : ''}`)
    } else if (command === 'help') {
      printHelp()
    } else if (command === 'logout') {
      if (!socket) return console.log('No active socket.')
      stopping = true
      await socket.logout()
      console.log('Linked device logged out.')
      appendEvent({ event: 'logout_requested' })
    } else if (command === 'delete-session') {
      if (connected) {
        console.log('Run "logout" first so the linked device is properly unlinked, then run "delete-session".')
      } else {
        await deleteLocalSession()
      }
    } else if (command === 'quit' || command === 'exit') {
      stopping = true
      clearTimeout(reconnectTimer)
      try { socket?.end?.(new Error('User exit')) } catch {}
      rl.close()
      process.exit(0)
    } else if (command) {
      console.log('Unknown command. Type "help".')
    }
  } catch (error) {
    console.error('Command failed:', error.message)
  }
})

process.on('SIGINT', () => {
  stopping = true
  console.log('\nClosing. Your linked-device session remains stored locally unless you use "logout".')
  process.exit(0)
})

console.log('WhatsApp Self Audit — read-only local monitor')
console.log('No sending, bulk messaging, presence stalking, or remote exfiltration is implemented.')
printHelp()
connect().catch(reportFatal)
