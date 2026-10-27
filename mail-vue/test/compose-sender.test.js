import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultComposeSender, mergeSenderAccounts, sameComposeSender, selectComposeSender} from '../src/utils/compose-sender.js'

const primary = {accountId: 1, email: 'admin@example.com', name: 'Admin'}
const alternate = {accountId: 2, email: 'jobs@example.com', name: 'Jobs'}
const user = {email: primary.email, name: primary.name, account: primary}

test('composer defaults to selected mailbox or login mailbox in All Mail', () => {
    assert.deepEqual(defaultComposeSender(user, alternate), alternate)
    assert.deepEqual(defaultComposeSender(user, {}), primary)
})

test('switching sender updates address and account together without changing the open message or mailbox defaults', () => {
    const form = {...primary, sendEmail: primary.email, name: 'Custom', subject: 'Subject', content: 'Body', receiveEmail: ['recipient@example.com'], attachments: [{filename: 'file.txt'}]}
    const message = {subject: form.subject, content: form.content, receiveEmail: form.receiveEmail, attachments: form.attachments}
    selectComposeSender(form, alternate)
    assert.equal(form.accountId, alternate.accountId)
    assert.equal(form.sendEmail, alternate.email)
    assert.equal(form.name, alternate.name)
    for (const [key, value] of Object.entries(message)) assert.equal(form[key], value)
    form.name = '临时名称'
    assert.equal(alternate.name, 'Jobs')
})

test('nameless mailboxes fall back to the address prefix', () => {
    const form = {}
    selectComposeSender(form, {accountId: 3, email: 'support@example.com', name: ''})
    assert.equal(form.name, 'support')
})

test('merging paginated options preserves defaults and a draft sender, while removing duplicates', () => {
    const options = mergeSenderAccounts([primary, alternate], [{...alternate, name: 'Updated'}], [{accountId: 2, email: alternate.email}], [null, {}])
    assert.equal(options.length, 2)
    assert.equal(options[1].name, 'Updated')
    const draft = {...alternate, name: '草稿名称', sendEmail: alternate.email}
    assert.equal(draft.name, '草稿名称')
    assert.equal(options[1].email, draft.sendEmail)
})

test('sender-only changes in replies and forwards count as edits', () => {
    const original = {accountId: 1, name: 'Admin'}
    assert.equal(sameComposeSender({...original}, original), true)
    assert.equal(sameComposeSender({...original, name: 'New name'}, original), false)
    assert.equal(sameComposeSender({...original, accountId: 2}, original), false)
})
