import {describe, expect, it, vi} from 'vitest'
import emailService from '../src/service/email-service'

function createContext(results = []) {
	const state = {
		sql: '',
		binds: [],
	}

	return {
		state,
		context: {
			env: {
				db: {
					prepare: vi.fn((sql) => {
						state.sql = sql
						return {
							bind: (...binds) => {
								state.binds = binds
								return {
									all: vi.fn().mockResolvedValue({results}),
								}
							},
						}
					}),
				},
			},
		},
	}
}

describe('Email open-event history', () => {
	it('limits a regular user to their own email records', async () => {
		const rows = [{eventId: 'evt_2', occurredAt: '2026-10-15T02:00:00.000Z'}]
		const {context, state} = createContext(rows)

		await expect(emailService.openEvents(context, {emailId: '42'}, 7)).resolves.toEqual(rows)
		expect(state.sql).toContain('AND e.user_id = ?')
		expect(state.sql).toContain("te.event_type = 'email.opened'")
		expect(state.binds).toEqual([42, 7])
	})

	it('lets the administrator query through the permission-protected route', async () => {
		const {context, state} = createContext([])

		await expect(emailService.openEvents(context, {emailId: 42})).resolves.toEqual([])
		expect(state.sql).not.toContain('AND e.user_id = ?')
		expect(state.binds).toEqual([42])
	})

	it('does not query invalid email identifiers', async () => {
		const {context} = createContext([])

		await expect(emailService.openEvents(context, {emailId: 'invalid'}, 7)).resolves.toEqual([])
		expect(context.env.db.prepare).not.toHaveBeenCalled()
	})
})
