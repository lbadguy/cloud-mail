import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {commitNotes, historicalCommits, currentChangeSubject} from '../src/data/fork-history.js'

export const forkBase = 'ec7a2bb'

export function parseCommits(output) {
    return output.trim().split('\n').filter(Boolean).map(line => {
        const [sha, date, ...subject] = line.split('\t')
        if (!/^[a-f0-9]{40}$/.test(sha) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error('Invalid changelog commit metadata')
        }
        return {sha, date, subject: subject.join('\t').trim()}
    })
}

export function buildHistory(commits) {
    return commits.map(commit => ({
        ...commit,
        title: commitNotes[commit.sha.slice(0, 7)] || (commit.subject === currentChangeSubject ? ['增加附件预览与预览隐私保护', 'Add attachment previews and preview privacy'] : null) || [commit.subject, commit.subject],
    }))
}

export function loadHistory() {
    const cwd = fileURLToPath(new URL('../', import.meta.url))
    try {
        // First-parent excludes upstream's individual commits after a stable-release merge.
        const output = execFileSync('git', ['log', '--first-parent', '--format=%H%x09%cs%x09%s', `${forkBase}..HEAD`], {
            cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        })
        return buildHistory(parseCommits(output))
    } catch (error) {
        // Source archives and shallow checkouts still retain the reviewed fork history.
        console.warn('Full Git history unavailable; using the bundled fork changelog.')
        return buildHistory(historicalCommits)
    }
}
