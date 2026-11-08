import { describe, expect, it } from 'vitest'
import { matchTopic } from './helpGuide.js'

describe('matchTopic', () => {
  it('matches free-text questions in any of the four languages', () => {
    expect(matchTopic('How does SyncAI decide what comes first?', false)?.id).toBe('decides')
    expect(matchTopic('怎样放大文字？', false)?.id).toBe('settings')
    expect(matchTopic('Apakah rekod yang disimpan tentang saya?', false)?.id).toBe('privacy')
    expect(matchTopic('என் பங்கு என்ன செய்யலாம்?', false)?.id).toBe('role')
  })
  it('keeps admin-only answers from everyone else', () => {
    expect(matchTopic('How do I approve someone?', true)?.id).toBe('approve')
    expect(matchTopic('How do I approve someone?', false)?.id).not.toBe('approve')
  })
  it('returns null when nothing matches', () => {
    expect(matchTopic('What is the weather like?', false)).toBe(null)
    expect(matchTopic('What is the weather today?', false)).toBe(null)
    expect(matchTopic('When is lunch?', false)).toBe(null)
  })
})
