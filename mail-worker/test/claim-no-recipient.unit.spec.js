import {describe, expect, it, vi} from 'vitest'
import {DatabaseSync} from 'node:sqlite'
import emailService from '../src/service/email-service'

function createContext(matches = [], claimedChanges = []) {
	const prepared = []
	const batches = []
	const db = {
		prepare: vi.fn((sql) => {
			const statement = {
				sql,
				binds: [],
				bind(...binds) {
					this.binds = binds
					prepared.push(this)
					return this
				},
				all: vi.fn().mockResolvedValue({results: matches})
			}
			return statement
		}),
		batch: vi.fn(async (statements) => {
			batches.push(statements)
			return statements.map((_, index) => ({
				meta: {changes: index % 2 === 1 ? (claimedChanges[(index - 1) / 2] ?? 1) : 0}
			}))
		})
	}

	return {
		context: {env: {admin: 'admin@example.com', db}},
		prepared,
		batches,
		db
	}
}

function createSqliteContext() {
	const sqlite = new DatabaseSync(':memory:')
	sqlite.exec(`
		CREATE TABLE user (
			user_id INTEGER PRIMARY KEY,
			email TEXT NOT NULL,
			status INTEGER NOT NULL DEFAULT 0,
			is_del INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE account (
			account_id INTEGER PRIMARY KEY,
			email TEXT NOT NULL,
			user_id INTEGER NOT NULL,
			is_del INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE email (
			email_id INTEGER PRIMARY KEY,
			to_email TEXT NOT NULL,
			user_id INTEGER NOT NULL,
			account_id INTEGER NOT NULL,
			status INTEGER NOT NULL,
			type INTEGER NOT NULL,
			is_del INTEGER NOT NULL,
			deleted_at TEXT
		);
		CREATE TABLE attachments (
			att_id INTEGER PRIMARY KEY,
			email_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			account_id INTEGER NOT NULL
		);
	`)

	const db = {
		prepare(sql) {
			return {
				sql,
				binds: [],
				bind(...binds) {
					this.binds = binds
					return this
				},
				async all() {
					return {results: sqlite.prepare(this.sql).all(...this.binds)}
				}
			}
		},
		async batch(statements) {
			sqlite.exec('BEGIN')
			try {
				const results = statements.map(statement => {
					const result = sqlite.prepare(statement.sql).run(...statement.binds)
					return {meta: {changes: Number(result.changes)}}
				})
				sqlite.exec('COMMIT')
				return results
			} catch (error) {
				sqlite.exec('ROLLBACK')
				throw error
			}
		}
	}

	return {sqlite, context: {env: {admin: 'admin@example.com', db}}}
}

describe('Claim no-recipient email', () => {
	it('moves a real SQLite row and its attachment while keeping plus aliases unmatched', async () => {
		const {sqlite, context} = createSqliteContext()
		sqlite.exec(`
			INSERT INTO user (user_id, email) VALUES (31, 'owner@example.com');
			INSERT INTO account (account_id, email, user_id) VALUES (21, 'LGC@LC7C.COM', 31);
			INSERT INTO email (email_id, to_email, user_id, account_id, status, type, is_del, deleted_at)
			VALUES (11, 'lgc@lc7c.com', 0, 0, 7, 0, 1, '2026-10-01 00:00:00');
			INSERT INTO email (email_id, to_email, user_id, account_id, status, type, is_del)
			VALUES (12, 'lgc+tag@lc7c.com', 0, 0, 7, 0, 0);
			INSERT INTO attachments (att_id, email_id, user_id, account_id) VALUES (41, 11, 0, 0);
		`)

		await expect(emailService.claimNoRecipient(
			context,
			{emailIds: [11, 12]},
			{email: 'admin@example.com'}
		)).resolves.toEqual({claimedCount: 1, skippedCount: 1})

		expect(sqlite.prepare('SELECT user_id, account_id, status, is_del, deleted_at FROM email WHERE email_id = 11').get())
			.toEqual({user_id: 31, account_id: 21, status: 0, is_del: 0, deleted_at: null})
		expect(sqlite.prepare('SELECT user_id, account_id FROM attachments WHERE att_id = 41').get())
			.toEqual({user_id: 31, account_id: 21})
		expect(sqlite.prepare('SELECT user_id, account_id, status FROM email WHERE email_id = 12').get())
			.toEqual({user_id: 0, account_id: 0, status: 7})
	})

	it('claims exact case-insensitive matches and updates attachments in one batch', async () => {
		const matches = [
			{emailId: 11, accountId: 21, userId: 31},
			{emailId: 12, accountId: 22, userId: 32}
		]
		const {context, prepared, batches} = createContext(matches)

		await expect(emailService.claimNoRecipient(
			context,
			{emailIds: [11, 12]},
			{email: 'admin@example.com'}
		)).resolves.toEqual({claimedCount: 2, skippedCount: 0})

		expect(prepared[0].sql).toContain('a.email COLLATE NOCASE = e.to_email')
		expect(prepared[0].sql).not.toContain('LIKE')
		expect(prepared[0].binds.slice(0, 2)).toEqual([11, 12])
		expect(batches).toHaveLength(1)
		expect(batches[0]).toHaveLength(4)
		expect(batches[0][0].sql).toContain('UPDATE attachments')
		expect(batches[0][1].sql).toContain('UPDATE email')
		expect(batches[0][1].sql).toContain('deleted_at = NULL')
	})

	it('skips messages without an existing matching account', async () => {
		const {context, db} = createContext([])

		await expect(emailService.claimNoRecipient(
			context,
			{emailIds: [11, 12]},
			{email: 'admin@example.com'}
		)).resolves.toEqual({claimedCount: 0, skippedCount: 2})
		expect(db.batch).not.toHaveBeenCalled()
	})

	it('reports messages that were already claimed during the operation as skipped', async () => {
		const {context} = createContext([
			{emailId: 11, accountId: 21, userId: 31},
			{emailId: 12, accountId: 22, userId: 32}
		], [1, 0])

		await expect(emailService.claimNoRecipient(
			context,
			{emailIds: [11, 12]},
			{email: 'admin@example.com'}
		)).resolves.toEqual({claimedCount: 1, skippedCount: 1})
	})

	it('rejects non-admin users before querying the database', async () => {
		const {context, db} = createContext([])

		await expect(emailService.claimNoRecipient(
			context,
			{emailIds: [11]},
			{email: 'user@example.com'}
		)).rejects.toMatchObject({code: 403})
		expect(db.prepare).not.toHaveBeenCalled()
	})

	it('rejects more than 50 unique messages', async () => {
		const {context, db} = createContext([])
		const emailIds = Array.from({length: 51}, (_, index) => index + 1)

		await expect(emailService.claimNoRecipient(
			context,
			{emailIds},
			{email: 'admin@example.com'}
		)).rejects.toMatchObject({code: 400})
		expect(db.prepare).not.toHaveBeenCalled()
	})
})
