# WhatsApp Self Audit (safe replacement)

This is a transparent, read-only replacement for the encrypted payload that was bundled with the original project.

## Intended use

Use it only with a WhatsApp account that you own or have explicit authorization to test. It links as a WhatsApp Web / multi-device client and keeps its credentials **only in the local `auth_info/` folder**.

It deliberately does **not** implement:

- sending messages
- bulk messaging
- contacting arbitrary numbers
- presence/online stalking
- profile-photo harvesting
- exporting contacts/messages
- uploading credentials or logs to a remote server

## What it does

- Displays a WhatsApp linked-device QR in the terminal.
- Saves the linked-device session locally in `auth_info/`.
- Reconnects after ordinary network disconnects.
- Records privacy-minimized event metadata in `logs/events.jsonl`.
- Does not save message bodies; only message type and text length are logged.
- Provides commands to inspect status, unlink the linked device, delete local credentials, or quit.

## Requirements

- Node.js 18+ (Node.js 20 recommended)
- npm
- Internet access to WhatsApp and npm during installation

## Install / run

### macOS / Linux

```bash
chmod +x install.sh
./install.sh
```

Or manually:

```bash
npm install
npm start
```

You can also launch an already-installed project with:

```bash
python3 main.py
```

## Linking

When the QR appears, on the phone that owns the WhatsApp account open **WhatsApp → Linked devices → Link a device** and scan the QR.

## Commands

- `status` — connection state
- `help` — commands
- `logout` — properly unlink this linked device
- `delete-session` — remove local auth files after logout
- `quit` — close the program without unlinking

## Local sensitive files

`auth_info/` contains long-lived cryptographic credentials. Treat it like a password. Never upload or share that directory. It is included in `.gitignore`.

## Notes

Baileys is an unofficial WhatsApp Web client library and can break when WhatsApp changes its protocol. Use it responsibly and in accordance with WhatsApp's terms.
