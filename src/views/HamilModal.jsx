import React, { useState } from 'react'
import { GREEN, FAINT, LINE, SUB, WARN } from '../logic.js'
import { coerceData } from '../storage.js'
import Modal from './Modal.jsx'

// 해밀고 교사 프리셋: 이름으로 검색해 미리 준비된 시간표·일정 데이터를 통째로 적용한다.
// 데이터 파일: public/teachers.json — {"teachers":[{"name":"홍길동","data":{...}}]}
export default function HamilModal({ data, setData, setSnack, onClose }) {
  const [name, setName] = useState('')
  const [state, setState] = useState('idle') // idle | loading | found | error
  const [error, setError] = useState('')
  const [found, setFound] = useState(null) // {name, normalized}

  const search = async () => {
    const q = name.trim()
    if (!q) return
    setState('loading')
    setError('')
    setFound(null)
    try {
      const res = await fetch(import.meta.env.BASE_URL + 'teachers.json', { cache: 'no-store' })
      if (!res.ok) throw new Error('교사 데이터 파일을 찾을 수 없습니다.')
      const json = await res.json()
      const list = Array.isArray(json.teachers) ? json.teachers : []
      if (!list.length) throw new Error('아직 등록된 교사 데이터가 없습니다.')
      const t = list.find(x => x.name === q) || list.find(x => x.name && x.name.includes(q))
      if (!t) throw new Error('"' + q + '" 이름의 데이터가 없습니다.')
      const normalized = coerceData(t.data)
      normalized.setupDone = true
      setFound({ name: t.name, normalized })
      setState('found')
    } catch (e) {
      setError(e.message || '불러오지 못했습니다.')
      setState('error')
    }
  }

  const apply = () => {
    const prev = data
    setData(found.normalized)
    setSnack({ text: found.name + ' 데이터를 적용했습니다.', kind: 'all', prev })
    onClose()
  }

  const d = found ? found.normalized : null
  const hours = d ? Object.keys(d.pattern).length : 0

  return (
    <Modal title="해밀고 데이터 불러오기" onClose={onClose} width={440}>
      <div style={{ marginTop: 6, fontSize: 13, color: SUB }}>
        교사 이름을 검색하면 미리 등록된 시간표로 바로 시작합니다.
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', marginTop: 18 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') search() }}
          placeholder="교사 이름"
          autoFocus
          style={{ flex: 1, border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 14, padding: '5px 0' }}
        />
        <button onClick={search} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: GREEN }}>
          검색
        </button>
      </div>
      {state === 'loading' && <div style={{ marginTop: 16, fontSize: 13, color: SUB }}>찾는 중…</div>}
      {state === 'error' && <div style={{ marginTop: 16, fontSize: 13, color: WARN }}>{error}</div>}
      {state === 'found' && d && (
        <div style={{ marginTop: 18, borderTop: '1px solid ' + LINE, paddingTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{found.name}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: SUB }}>
            반 {d.classes.length}개 ({d.classes.join(', ')}) · 주당 {hours}시간 · 일정 {d.events.length}건
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: FAINT }}>적용하면 현재 데이터를 대체합니다. 적용 후 되돌리기가 가능합니다.</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={apply} style={{ border: 'none', borderRadius: 6, padding: '7px 18px', background: GREEN, color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              적용
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
