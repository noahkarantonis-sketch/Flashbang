import type { StudyApi } from '../electron/preload'

declare global {
  interface Window {
    study: StudyApi
  }
}

export {}
