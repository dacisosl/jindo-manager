// 학교 프리셋 암호화 — 브라우저와 Node(암호화 스크립트)가 같은 코드를 쓴다.
// 공개 주소로 파일을 받아도 암호 없이는 내용을 볼 수 없다.
const PBKDF2_ITER = 200000

const enc = new TextEncoder()
const dec = new TextDecoder()

// 큰 파일에서도 스택이 넘치지 않도록 나눠서 변환한다
function toB64(buf) {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192))
  }
  return btoa(s)
}

function fromB64(str) {
  const bin = atob(str)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(password, salt) {
  // 한글은 기기마다 조합 방식(NFC/NFD)이 달라 같은 글자라도 바이트가 달라진다.
  // 양쪽에서 NFC 로 맞추고, 앞뒤 공백과 대소문자 차이는 무시한다.
  const normalized = password.trim().toLowerCase().normalize('NFC')
  const base = await crypto.subtle.importKey('raw', enc.encode(normalized), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptPreset(obj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)))
  return { v: 1, alg: 'AES-GCM', iter: PBKDF2_ITER, salt: toB64(salt), iv: toB64(iv), data: toB64(data) }
}

export async function decryptPreset(pkg, password) {
  const key = await deriveKey(password, fromB64(pkg.salt))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(pkg.iv) }, key, fromB64(pkg.data))
  return JSON.parse(dec.decode(plain))
}
