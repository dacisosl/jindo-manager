const KEY = 'jindo.data.v1'

export const defaultData = () => ({
  setupDone: false,
  semStart: '',
  semEnd: '',
  classes: [],
  pattern: {}, // {'dow-period': '2-1'}  dow: 1(월)~5(금), period: 1~7
  events: [], // {id, start, end, name, type: '휴업일'|'행사'|'고사'|'개인', period?, cls?}
  cancels: {}, // {'iso|p': {reason}}
  memos: {}, // {'iso|p': '...'}
  cfg: {
    examReset: false,
    examId: null,
    target: 17,
    anim: true,
    widgets: { week: false, loss: false, forecast: false },
  },
})

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultData()
    const d = JSON.parse(raw)
    const base = defaultData()
    return {
      ...base,
      ...d,
      cfg: { ...base.cfg, ...(d.cfg || {}), widgets: { ...base.cfg.widgets, ...((d.cfg || {}).widgets || {}) } },
    }
  } catch {
    return defaultData()
  }
}

export function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export const getApiKey = () => localStorage.getItem('jindo.apiKey') || ''
export const setApiKey = v => localStorage.setItem('jindo.apiKey', v)
export const getModel = () => localStorage.getItem('jindo.model') || 'google/gemini-2.5-flash'
export const setModel = v => localStorage.setItem('jindo.model', v)
