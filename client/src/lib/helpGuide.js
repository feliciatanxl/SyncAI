// The preview assistant's knowledge: fixed, accurate answers about SyncAI itself. No AI and no personal data
// yet, so it never makes anything up. Keywords cover all four languages so free-text questions still match;
// everyday words (today, when, access) are left out because they would send unrelated questions to a topic.

export const TOPICS = [
  {
    id: 'decides',
    action: 'decides',
    keywords: ['decide', 'priorit', 'first', 'rank', 'factor', 'order', 'important', 'urgent', '优先', '排序', '决定', '因素', '紧急', 'keutamaan', 'susun', 'faktor', 'penting', 'segera', 'முன்னுரிமை', 'காரணி', 'வரிசை', 'அவசர'],
  },
  {
    id: 'role',
    keywords: ['role', 'permission', 'manager', 'member', 'admin', '角色', '权限', '经理', '管理员', '成员', 'peranan', 'kebenaran', 'pengurus', 'ahli', 'pentadbir', 'பங்கு', 'அனுமதி', 'மேலாளர்', 'உறுப்பினர்', 'நிர்வாகி'],
  },
  {
    id: 'settings',
    action: 'settings',
    keywords: ['text', 'font', 'bigger', 'size', 'language', 'dark', 'light', 'read', 'setting', '字体', '文字', '语言', '放大', '设置', '深色', 'teks', 'saiz', 'bahasa', 'besar', 'tetapan', 'gelap', 'எழுத்து', 'மொழி', 'பெரி', 'அமைப்பு', 'இருண்ட'],
  },
  {
    id: 'privacy',
    keywords: ['record', 'privacy', 'pdpa', 'track', 'data', 'log', 'store', 'personal', 'watch', '记录', '隐私', '数据', '个人', 'rekod', 'privasi', 'peribadi', 'jejak', 'பதிவு', 'தனியுரிமை', 'தரவு', 'தனிப்பட்ட'],
  },
  {
    id: 'approve',
    adminOnly: true,
    action: 'people',
    keywords: ['approve', 'approval', 'invite', 'new person', 'add someone', 'turn off', 'remove', '批准', '邀请', '停用', 'lulus', 'jemput', 'matikan', 'ஒப்புதல்', 'அழை', 'நிறுத்து'],
  },
  {
    id: 'tasks',
    action: 'tasks',
    keywords: ['task', 'plan', 'schedule', 'calendar', 'outlook', '任务', '计划', '日历', 'tugasan', 'rancangan', 'jadual', 'kalendar', 'பணி', 'திட்டம்', 'நாட்காட்டி'],
  },
]

// Best-matching topic for a free-text question, or null. Admin-only topics are skipped for everyone else.
export function matchTopic(question, isAdmin) {
  const q = question.toLowerCase()
  let best = null
  let bestScore = 0
  for (const topic of TOPICS) {
    if (topic.adminOnly && !isAdmin) continue
    const score = topic.keywords.filter((k) => q.includes(k)).length
    if (score > bestScore) {
      best = topic
      bestScore = score
    }
  }
  return best
}
