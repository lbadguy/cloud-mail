// Each feature is kept separate; commits retain fixes and operational changes too.
// Text pairs are [Chinese, English]. Keep future feature additions in this list.
export const commitNotes = {
    '2518ee8': ['撰写邮件时选择发件邮箱和名字', 'Choose the sender mailbox and name when composing'],
    'b50d168': ['精简隐私提示，调整邮件工具栏和来源弹窗', 'Simplify privacy controls and source details'],
    '262d6d7': ['增加阅读隐私保护和邮件来源信息', 'Add reading privacy and source headers'],
    'd357e40': ['合并上游 v3.4.0，保留本仓库功能', 'Merge upstream v3.4.0 and preserve fork features'],
    'e318de4': ['恢复关于页面的原版按钮排布', 'Restore the upstream About button layout'],
    'fc4cc68': ['管理员可将无人收件邮件归入对应邮箱', 'Manually assign no-recipient mail to its mailbox'],
    'b5c675e': ['修正关于页面按钮的间距和对齐', 'Keep About actions compact and aligned'],
    'af3564c': ['增加每次打开时间，修复全部邮件刷新和信息对齐', 'Add open history and fix mail filters and alignment'],
    'ab9d30d': ['修正主题图标，调整回收站位置并显示剩余天数', 'Fix theme indicators and show trash retention'],
    'def0415': ['让系统主题随系统颜色变化生效', 'Follow operating system theme changes'],
    '2f0ca44': ['增加回收站，保留邮件 30 天并支持恢复', 'Add 30-day trash and message restoration'],
    'af7cc45': ['改为点击检查更新，取消定时检查', 'Check updates on demand and remove scheduled checks'],
    '133b167': ['让更新后的版本号与稳定版标签一致', 'Align the displayed version with the stable release'],
    '5bba2d7': ['说明更新令牌所需的最小权限', 'Document minimal update-token permissions'],
    '4945be4': ['只从上游稳定版发布更新', 'Update only from stable upstream releases'],
    'bc22850': ['增加管理员更新、忽略版本和项目交接文档', 'Add guarded admin updates and project documentation'],
    '4dd7ebf': ['使用 Web Crypto 验证 Resend 回调签名', 'Verify Resend webhooks with Web Crypto'],
    'dd03d21': ['重试过早到达的回执，补齐部署检查', 'Retry early tracking events and improve CI checks'],
    'f53dfb7': ['要求 Resend 回调携带有效签名', 'Require signed Resend webhooks'],
    'bec883a': ['部署时保留自定义域名', 'Preserve the custom domain during deployment'],
    'b1d1206': ['将数据库备份保留在 Cloudflare 内', 'Keep database recovery within Cloudflare'],
    '7a1bda5': ['替换继承的部署流程，增加发布前检查', 'Replace inherited deployment with guarded releases'],
    'b3374f6': ['首次加入打开和点击回执，以及部署、同步流程', 'Add engagement tracking and guarded cloud workflows'],
}

export const currentChangeSubject = 'feat: add fork changelog and email click history'

export const features = [
    ['changelog', currentChangeSubject, ['站内更新日志', 'In-app changelog'], ['分别查看本仓库的功能和历次提交，可跳转到具体改动。', 'Browse fork features and commits, with links to each change.']],
    ['repository', currentChangeSubject, ['本仓库入口', 'Fork repository links'], ['登录页 GitHub 按钮指向本仓库，顶部 GitHub 图标打开更新日志。', 'The login link opens this fork; the header icon opens its changelog.']],
    ['click-history', currentChangeSubject, ['每次链接点击时间', 'Link-click history'], ['点击“已点击邮件链接”标签或列表图标，查看每次记录的时间。', 'Click a link-click badge or list icon to see recorded timestamps.']],
    ['sender-mailbox', '2518ee8', ['撰写时切换发件邮箱', 'Choose a sender mailbox'], ['直接从撰写窗口选择自己的邮箱，不用切换侧栏。', 'Select one of your mailboxes inside the composer.']],
    ['sender-name', '2518ee8', ['单封邮件发件人名字', 'Per-message sender name'], ['可为当前邮件改名字，不修改邮箱的默认名称。', 'Edit the display name for one message without renaming the mailbox.']],
    ['sender-draft', '2518ee8', ['草稿保留发件人', 'Save the sender in drafts'], ['所选邮箱和临时名字随草稿保存；回复和转发也会提醒保存。', 'Drafts retain the chosen mailbox and name, including reply and forward edits.']],
    ['privacy-help', 'b50d168', ['收起阅读隐私说明', 'Compact privacy help'], ['个人设置里的说明收到帮助图标中，邮件内只保留盾牌。', 'Settings use a help tooltip; the mail toolbar uses a shield icon.']],
    ['privacy-override', 'b50d168', ['单封邮件临时隐私开关', 'Temporary per-message privacy'], ['在邮件工具栏临时开关保护，离开后恢复个人设置。', 'Toggle protection for the current message without changing your preference.']],
    ['source-summary', 'b50d168', ['邮件来源摘要弹窗', 'Mail source summary'], ['来源按钮放在邮件工具栏，弹窗先显示服务器、候选 IP 和认证结果。', 'A toolbar button opens server, candidate IP and authentication details.']],
    ['reading-privacy', '262d6d7', ['阅读隐私保护', 'Reading privacy'], ['个人设置可阻止邮件正文加载外部图片等远程内容，默认开启。', 'Block remote content in the main mail viewer; enabled by default in personal settings.']],
    ['source-headers', '262d6d7', ['邮件头与候选 IP', 'Source headers and candidate IPs'], ['保留新收到邮件的投递链和认证邮件头，可展开查看原文。', 'Retain delivery and authentication headers for newly received messages.']],
    ['editor-privacy', '262d6d7', ['回复与转发编辑器保护', 'Reply and forward editor protection'], ['编辑器跟随阅读隐私设置，处理引用内容中的远程资源。', 'The editor follows reading privacy when handling quoted remote content.']],
    ['upstream-340', 'd357e40', ['上游 v3.4.0 兼容', 'Upstream v3.4.0 compatibility'], ['合并稳定版并保留回执、回收站和其他定制功能。', 'Integrate the stable release while preserving fork customizations.']],
    ['about-layout', 'e318de4', ['关于页面按钮对齐', 'About action alignment'], ['沿用原版按钮位置和样式，将检查更新放在版本旁。', 'Keep upstream button styling and place the update check beside the version.']],
    ['claim', 'fc4cc68', ['无人收件手动归入', 'Claim no-recipient mail'], ['管理员最多选 50 封，按原始地址匹配启用的邮箱，邮件与附件一起归入。', 'Admins can assign up to 50 messages and their attachments to matching active mailboxes.']],
    ['open-history', 'af3564c', ['每次打开时间', 'Email-open history'], ['“已打开”可点开查看各次时间，列表与详情页都支持。', 'Open badges in lists and details show every recorded open timestamp.']],
    ['open-wording', 'af3564c', ['回执显示改为“已打开”', 'Clearer open receipt label'], ['去掉标签里的“可能”，在记录中说明预览和代理也可能触发。', 'Use “Opened” and explain preview and proxy events inside the history.']],
    ['all-mail-refresh', 'af3564c', ['全部邮件刷新保留筛选', 'Keep All Mail filters on refresh'], ['刷新后留在当前分类，不再固定跳到已接收。', 'Refresh preserves the selected category instead of returning to received mail.']],
    ['mail-alignment', 'af3564c', ['邮件详情信息对齐', 'Mail detail alignment'], ['调整发件人、收件人、日期和回执标签的排布。', 'Align sender, recipient, date and receipt labels.']],
    ['trash-countdown', 'ab9d30d', ['回收站剩余天数', 'Trash retention countdown'], ['邮件显示“剩 X 天”，回收站放在草稿箱上方。', 'Show days until permanent deletion and place Trash above Drafts.']],
    ['theme-indicator', 'ab9d30d', ['主题图标同步', 'Synchronize the theme icon'], ['图标跟随当前实际生效的颜色方案。', 'The icon reflects the theme currently in effect.']],
    ['system-theme', 'def0415', ['跟随系统主题', 'Follow the system theme'], ['日间、夜间之外可选择系统，并跟随系统颜色变化。', 'Choose System alongside Light and Dark and follow OS changes.']],
    ['trash', '2f0ca44', ['邮件回收站', 'Email trash'], ['删除后先保留 30 天，可恢复，也可提前彻底删除。', 'Keep deleted mail for 30 days, restore it, or delete it permanently.']],
    ['manual-update', 'af7cc45', ['点击检查更新', 'On-demand update checks'], ['由管理员点击按钮检查，取消定时更新检查。', 'Admins check for updates with a button; scheduled checks are removed.']],
    ['release-version', '133b167', ['更新后版本号同步', 'Synchronize the release version'], ['页面版本号使用实际合并的稳定版标签。', 'Display the stable release tag actually merged.']],
    ['stable-updates', '4945be4', ['只更新稳定发布版', 'Stable-release updates'], ['更新目标取自上游 Release，不直接跟随开发分支。', 'Target upstream stable releases rather than unreleased development commits.']],
    ['admin-update', 'bc22850', ['管理员点击更新', 'Admin-triggered updates'], ['检查合并、测试、构建通过后才部署；冲突时停止。', 'Deploy only after merge checks, tests and builds succeed; stop on conflicts.']],
    ['ignore-version', 'bc22850', ['忽略本次版本', 'Ignore a release'], ['只忽略所选版本，后续版本仍可提示。', 'Ignore the selected release while allowing later version notices.']],
    ['handoff', 'bc22850', ['项目交接概览', 'Project handoff overview'], ['仓库内记录部署关系、功能、维护方法和验证要求。', 'Document deployment, customizations, maintenance and verification in the repository.']],
    ['signed-webhooks', '4dd7ebf', ['回执签名校验', 'Signed engagement webhooks'], ['使用 Web Crypto 校验 Resend 签名，拒绝无效回调。', 'Verify Resend signatures with Web Crypto and reject invalid webhooks.']],
    ['tracking-retry', 'dd03d21', ['回执重试与去重', 'Receipt retries and deduplication'], ['邮件尚未入库时允许重试，同一事件不重复计数。', 'Retry events that arrive before persistence and count each event once.']],
    ['custom-domain', 'bec883a', ['部署保留自定义域名', 'Preserve the custom domain'], ['更新部署时保留 mymail 的域名绑定。', 'Keep the mymail domain binding across deployments.']],
    ['recovery', 'b1d1206', ['云端数据库恢复点', 'Cloud database recovery points'], ['发布前检查 Cloudflare 内的数据库恢复条件。', 'Check database recovery within Cloudflare before deployment.']],
    ['guarded-deploy', '7a1bda5', ['部署前检查与回退', 'Deployment checks and rollback'], ['生产发布包含测试、构建、健康检查和失败回退流程。', 'Production releases include tests, builds, health checks and rollback.']],
    ['open-receipt', 'b3374f6', ['发送邮件打开回执', 'Sent-email open receipts'], ['显示 Resend 记录的打开次数与最近时间。', 'Show recorded open counts and the latest open time.']],
    ['click-receipt', 'b3374f6', ['发送邮件链接点击回执', 'Sent-email link-click receipts'], ['显示 Resend 记录的点击次数与最近时间。', 'Show recorded link-click counts and the latest click time.']],
]

// Reviewed snapshot for builds from source archives without a .git directory.
export const historicalCommits = [
    {
        "sha": "2518ee8cc399e27f64b1fc0d9835390b9d975e50",
        "date": "2026-10-27",
        "subject": "feat: choose mailbox and sender name when composing"
    },
    {
        "sha": "b50d168432672ae1f3a9f2ac0040b49bf0726cc4",
        "date": "2026-10-24",
        "subject": "feat: simplify mail privacy controls and source details"
    },
    {
        "sha": "262d6d7ee75ac6e5e2210c2fe4ce5bd3c8e52a0d",
        "date": "2026-10-24",
        "subject": "feat: protect email reading and expose source headers"
    },
    {
        "sha": "d357e4017369cfbbc8c64a5e5e0dd6e2cd206d03",
        "date": "2026-10-23",
        "subject": "chore: merge upstream v3.4.0 preserving mail customizations"
    },
    {
        "sha": "e318de423437eac6fc5c4ab30317664dde7c90a5",
        "date": "2026-10-23",
        "subject": "fix: restore upstream about button layout"
    },
    {
        "sha": "fc4cc6854f76e7ab70dd06708a40f0d8ddb7bcd3",
        "date": "2026-10-23",
        "subject": "feat: claim no-recipient mail manually"
    },
    {
        "sha": "b5c675eca9fa89ca3b2cde40ca6c5dd7457b4571",
        "date": "2026-10-15",
        "subject": "fix: keep about actions compact"
    },
    {
        "sha": "af3564ce47bf34d41467d2b40f71c251aca35a33",
        "date": "2026-10-15",
        "subject": "feat: add email open history and preserve filters"
    },
    {
        "sha": "ab9d30dadbad66430b51a44a8e8b3bd74a8f7ff0",
        "date": "2026-09-24",
        "subject": "fix: clarify theme state and trash retention"
    },
    {
        "sha": "def04153c433f3cc6efab5ac24be370dd0a54703",
        "date": "2026-09-24",
        "subject": "fix: make system theme follow OS preference"
    },
    {
        "sha": "2f0ca44ec162d7d258c282bb911c24f4976bb51f",
        "date": "2026-09-23",
        "subject": "feat: add 30-day email trash"
    },
    {
        "sha": "af7cc45844c50043a4c7136d602a068f09c7b99b",
        "date": "2026-09-14",
        "subject": "fix: make update checks manual"
    },
    {
        "sha": "133b167e757dc1635f93c533715193b0cc0a08ab",
        "date": "2026-09-13",
        "subject": "fix: align updates with stable release version"
    },
    {
        "sha": "5bba2d737f99a3e11d06a29babbd144d7c563927",
        "date": "2026-09-13",
        "subject": "docs: narrow update token permissions"
    },
    {
        "sha": "4945be44e9399fb0154b4b7577ac1a7d538d18f0",
        "date": "2026-09-13",
        "subject": "fix: update only from stable upstream releases"
    },
    {
        "sha": "bc22850555427154a20a5d79b0b101471e4ebef7",
        "date": "2026-09-13",
        "subject": "feat: add guarded admin upstream updates"
    },
    {
        "sha": "4dd7ebff21ecd0e5726843baff847c675fefeec3",
        "date": "2026-09-13",
        "subject": "fix: verify Resend webhooks with Web Crypto"
    },
    {
        "sha": "dd03d21b3e947b62867110c76faa7d205968384c",
        "date": "2026-09-13",
        "subject": "fix: retry early tracking events and expose CI gaps"
    },
    {
        "sha": "f53dfb7938cca5b9bd6496ad7c12fd4ac2489305",
        "date": "2026-09-13",
        "subject": "fix: require signed Resend webhooks"
    },
    {
        "sha": "bec883a21e381678caf5ff36137fb7fb5f4d209f",
        "date": "2026-09-11",
        "subject": "ci: preserve mymail custom domain on deployment"
    },
    {
        "sha": "b1d120643401ccce930b13479b5e79f3ebc3bad8",
        "date": "2026-09-11",
        "subject": "ci: keep mail database backups within Cloudflare"
    },
    {
        "sha": "7a1bda58860ace34c4d5537d646681806a11e629",
        "date": "2026-09-11",
        "subject": "ci: replace inherited deploy workflow with guarded release"
    },
    {
        "sha": "b3374f6c00864f977058a2261bc10c4af24e18d5",
        "date": "2026-09-11",
        "subject": "feat: add Resend engagement tracking and safe cloud updates"
    }
]
