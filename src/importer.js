// 파일에서 가져오기: 엑셀/CSV/PDF/이미지 → OpenRouter(BYOK) → 구조화 초안.
// AI는 초안만 만들고, 최종 확정은 항상 사용자가 검토 화면에서 한다.
import { getApiKey, getModel } from './storage.js'

const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'

export async function checkKey(key) {
  const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
    headers: { Authorization: 'Bearer ' + key },
  })
  if (!res.ok) throw new Error('키를 확인할 수 없습니다')
  return res.json()
}

// 파일을 모델 입력으로 변환: 텍스트(엑셀/CSV/텍스트 PDF) 또는 이미지 목록(이미지/스캔 PDF)
async function fileToParts(file) {
  const name = file.name.toLowerCase()
  if (/\.(xlsx|xls|csv)$/.test(name)) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await file.arrayBuffer())
    const text = wb.SheetNames.map(sn => XLSX.utils.sheet_to_csv(wb.Sheets[sn])).join('\n---\n')
    return { text, preview: { kind: 'text', text } }
  }
  if (/\.pdf$/.test(name)) {
    const pdfjs = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    let text = ''
    const n = Math.min(doc.numPages, 5)
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i)
      const tc = await page.getTextContent()
      text += tc.items.map(it => it.str).join(' ') + '\n'
    }
    if (text.trim().length > 80) return { text, preview: { kind: 'text', text } }
    // 스캔 PDF: 페이지를 이미지로 렌더링
    const images = []
    for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
      const page = await doc.getPage(i)
      const vp = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = vp.width
      canvas.height = vp.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
      images.push(canvas.toDataURL('image/png'))
    }
    return { images, preview: { kind: 'image', src: images[0] } }
  }
  if (/\.(png|jpg|jpeg|webp|gif|bmp)$/.test(name) || file.type.startsWith('image/')) {
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(r.result)
      r.onerror = rej
      r.readAsDataURL(file)
    })
    return { images: [dataUrl], preview: { kind: 'image', src: dataUrl } }
  }
  throw new Error('지원하지 않는 형식입니다. 엑셀·CSV·PDF·이미지 파일을 올려주세요.')
}

async function callModel(parts, instruction) {
  const key = getApiKey()
  if (!key) throw new Error('설정에서 API 키를 먼저 등록해주세요.')
  const content = []
  content.push({ type: 'text', text: instruction + (parts.text ? '\n\n원본 내용:\n' + parts.text.slice(0, 30000) : '') })
  for (const src of parts.images || []) content.push({ type: 'image_url', image_url: { url: src } })
  const res = await fetch(OR_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + getApiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: getModel(),
      messages: [{ role: 'user', content }],
      temperature: 0,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 401) throw new Error('API 키가 올바르지 않습니다. 설정에서 확인해주세요.')
    throw new Error('인식 요청이 실패했습니다 (' + res.status + '). ' + body.slice(0, 200))
  }
  const json = await res.json()
  const raw = json.choices?.[0]?.message?.content || ''
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('결과를 해석할 수 없습니다. 다시 시도해주세요.')
  return JSON.parse(m[0])
}

const DOW_MAP = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 }

// 시간표 인식 → {rec: {'dow-p': cls}, unc: {'dow-p': true}, preview}
export async function importTimetable(file, classes) {
  const parts = await fileToParts(file)
  const out = await callModel(
    parts,
    [
      '다음은 교사 한 명의 주간 시간표입니다. 이 교사가 수업하는 반만 추출하세요.',
      '반 이름은 "2-1"(학년-반) 형태로 정규화합니다.' +
        (classes.length ? ' 기존 반 목록: ' + classes.join(', ') + ' — 가능하면 이 표기와 맞춰주세요.' : ''),
      '교시는 1~7, 요일은 월~금입니다. 과목명·교사명 등 반이 아닌 텍스트는 무시하세요.',
      '확신이 없는 칸은 "uncertain": true 로 표시하세요.',
      'JSON만 출력: {"cells":[{"day":"월","period":1,"class":"2-1","uncertain":false}]}',
    ].join('\n')
  )
  const rec = {}
  const unc = {}
  for (const c of out.cells || []) {
    const dow = DOW_MAP[c.day]
    const p = Number(c.period)
    if (!dow || !(p >= 1 && p <= 7) || !c.class) continue
    const k = dow + '-' + p
    rec[k] = String(c.class).trim()
    if (c.uncertain) unc[k] = true
  }
  if (!Object.keys(rec).length) throw new Error('시간표를 찾지 못했습니다. 다른 파일로 시도해주세요.')
  return { rec, unc, preview: parts.preview }
}

// 학사일정 인식 → {rows: [{start,end,name,type,uncertain,checked}], preview}
export async function importSchedule(file, year) {
  const parts = await fileToParts(file)
  const out = await callModel(
    parts,
    [
      '다음은 학교 학사일정입니다. 수업에 영향을 주는 일정을 추출하세요.',
      '유형은 휴업일(공휴일·방학·재량휴업), 행사(체육대회·수학여행 등 수업 결손 행사), 고사(중간·기말·회고사) 중 하나로 추정하세요.',
      '날짜는 YYYY-MM-DD. 연도가 없으면 ' + year + '년으로 간주하세요. 기간 일정은 start/end로 표현하세요.',
      '확신이 없는 항목은 "uncertain": true 로 표시하세요.',
      'JSON만 출력: {"events":[{"start":"2026-08-12","end":"2026-08-12","name":"체육대회","type":"행사","uncertain":false}]}',
    ].join('\n')
  )
  const rows = (out.events || [])
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.start || ''))
    .map(e => ({
      start: e.start,
      end: /^\d{4}-\d{2}-\d{2}$/.test(e.end || '') ? e.end : e.start,
      name: String(e.name || '').trim() || '일정',
      type: ['휴업일', '행사', '고사'].includes(e.type) ? e.type : '행사',
      uncertain: !!e.uncertain,
      checked: true,
    }))
  if (!rows.length) throw new Error('일정을 찾지 못했습니다. 다른 파일로 시도해주세요.')
  return { rows, preview: parts.preview }
}
