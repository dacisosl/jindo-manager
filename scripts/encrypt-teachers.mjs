// 교사 프리셋을 암호화해 public/teachers.enc.json 으로 저장한다.
//   node scripts/encrypt-teachers.mjs "<암호>"
// 평문 원본은 data/teachers.json 에 둔다 — public/ 에 두면 빌드 결과물로 그대로 복사되므로
// 반드시 이 위치를 지킬 것. data/ 는 .gitignore 로 저장소에서도 제외된다.
import { readFileSync, writeFileSync } from 'node:fs'
import { encryptPreset } from '../src/preset.js'

const password = process.argv[2]
if (!password) {
  console.error('사용법: node scripts/encrypt-teachers.mjs "<암호>"')
  process.exit(1)
}

const src = JSON.parse(readFileSync('data/teachers.json', 'utf8'))
const pkg = await encryptPreset(src, password)
writeFileSync('public/teachers.enc.json', JSON.stringify(pkg), 'utf8')

console.log('교사', src.teachers.length + '명 암호화 완료 → public/teachers.enc.json')
console.log('원본 크기', readFileSync('data/teachers.json').length, '→ 암호문', pkg.data.length)
