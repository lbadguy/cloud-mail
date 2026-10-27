import test from 'node:test'
import assert from 'node:assert/strict'
import {buildHistory, loadHistory, parseCommits} from '../scripts/changelog.mjs'
import {features, historicalCommits, currentChangeSubject, commitNotes} from '../src/data/fork-history.js'

test('all fork commits and individual custom features have a history entry', () => {
    const commits = loadHistory()
    for (const commit of historicalCommits) {
        assert.ok(commits.some(item => item.sha === commit.sha), commit.subject)
        assert.ok(commitNotes[commit.sha.slice(0, 7)], commit.subject)
    }
    assert.equal(new Set(features.map(item => item[0])).size, features.length)
    for (const [, revision, title, description] of features) {
        if (revision !== currentChangeSubject) assert.ok(commits.some(commit => commit.sha.startsWith(revision)))
        assert.equal(title.length, 2)
        assert.equal(description.length, 2)
    }
})

test('future commits appear without curated notes and subjects remain plain text', () => {
    const sha = 'a'.repeat(40)
    const commits = buildHistory(parseCommits(`${sha}\t2026-10-27\tfix: <a> & special text\n`))
    assert.equal(commits[0].sha, sha)
    assert.deepEqual(commits[0].title, ['fix: <a> & special text', 'fix: <a> & special text'])
    assert.throws(() => parseCommits('not-a-commit\t2026-10-27\ttitle'))
})
