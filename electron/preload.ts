import { contextBridge, ipcRenderer } from 'electron'

// The ONLY surface the renderer can touch. No key, no SDK — just verbs.
const api = {
  key: {
    status: (): Promise<boolean> => ipcRenderer.invoke('key:status'),
    set: (key: string): Promise<boolean> => ipcRenderer.invoke('key:set', key)
  },
  ai: {
    cardsFromText: (text: string) => ipcRenderer.invoke('ai:cardsFromText', text),
    cardsFromImage: (base64: string, mime: string) =>
      ipcRenderer.invoke('ai:cardsFromImage', base64, mime),
    cardsFromPdf: (base64: string) => ipcRenderer.invoke('ai:cardsFromPdf', base64),
    hint: (input: {
      question: string
      answer: string
      topic: string
      history?: string
    }) => ipcRenderer.invoke('ai:hint', input),
    explain: (input: {
      question: string
      answer: string
      topic: string
      context?: string
    }) => ipcRenderer.invoke('ai:explain', input)
  }
}

contextBridge.exposeInMainWorld('study', api)

export type StudyApi = typeof api
