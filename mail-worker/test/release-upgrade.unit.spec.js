import {afterEach, describe, expect, it, vi} from 'vitest'
import {DatabaseSync} from 'node:sqlite'
import {dbInit} from '../src/init/init'

afterEach(() => vi.restoreAllMocks())

describe('v3.4.0 database compatibility', () => {
	it.each([false, true])('preserves mail and custom data across repeat upgrades (custom schema: %s)', async (hasCustomSchema) => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		const sqlite = new DatabaseSync(':memory:')
		try {
			sqlite.exec(`
				CREATE TABLE email (
					email_id INTEGER PRIMARY KEY, user_id INTEGER, is_del INTEGER,
					content TEXT, resend_email_id TEXT
				);
				INSERT INTO email VALUES (1, 2, 1, 'keep original body', 'resend_test');
			`)
			const context = {env: {db: {
				prepare(sql) {
					return {
						async first() {return sqlite.prepare(sql).get()},
						async run() {return sqlite.prepare(sql).run()}
					}
				}
			}}}
			if (hasCustomSchema) {
				await dbInit.engagementDB(context)
				await dbInit.trashDB(context)
				sqlite.exec(`
					UPDATE email SET open_count = 3, last_opened_at = '2026-10-20T12:00:00Z', deleted_at = '2026-10-01 00:00:00';
					INSERT INTO email_tracking_event (event_id, email_id, resend_email_id, event_type, occurred_at)
					VALUES ('event_test', 1, 'resend_test', 'email.opened', '2026-10-20T12:00:00Z');
				`)
			}
			for (let attempt = 0; attempt < 2; attempt++) {
				await dbInit.v3_4DB(context)
				await dbInit.engagementDB(context)
				await dbInit.trashDB(context)
			}
			const row = sqlite.prepare('SELECT * FROM email WHERE email_id = 1').get()
			expect(row.content).toBe('keep original body')
			expect(row.sender_email).toBe('')
			expect(row.open_count).toBe(hasCustomSchema ? 3 : 0)
			expect(row.click_count).toBe(0)
			expect(row.deleted_at).toBeTruthy()
			if (hasCustomSchema) {
				expect(row.deleted_at).toBe('2026-10-01 00:00:00')
				expect(row.last_opened_at).toBe('2026-10-20T12:00:00Z')
				expect(sqlite.prepare('SELECT count(*) AS total FROM email_tracking_event').get().total).toBe(1)
			}
		} finally {
			sqlite.close()
		}
	})
})
