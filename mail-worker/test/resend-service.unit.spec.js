import { afterEach, describe, expect, it, vi } from 'vitest';
import resendService from '../src/service/resend-service';
import emailService from '../src/service/email-service';

function createContext(eventId = 'evt_test') {
	return {
		req: {
			header(name) {
				return name === 'svix-id' ? eventId : undefined;
			}
		}
	};
}

describe('Resend engagement webhooks', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('parses multiple signing secrets', () => {
		expect(resendService.parseWebhookSecrets('["whsec_a","whsec_b"]')).toEqual(['whsec_a', 'whsec_b']);
		expect(resendService.parseWebhookSecrets('whsec_a, whsec_b')).toEqual(['whsec_a', 'whsec_b']);
	});

	it('rejects unsigned webhooks when no signing secret is configured', async () => {
		const context = {
			env: {},
			req: { header: () => undefined }
		};

		await expect(resendService.verifyWebhook(context, '{"type":"email.opened"}'))
			.rejects.toThrow('Resend webhook 签名密钥未配置');
	});

	it('rejects webhooks with missing signature headers', async () => {
		const context = {
			env: { resend_webhook_secrets: 'whsec_test' },
			req: { header: () => undefined }
		};

		await expect(resendService.verifyWebhook(context, '{"type":"email.opened"}'))
			.rejects.toThrow('Resend webhook 缺少签名请求头');
	});

	it('accepts a valid Svix signature', async () => {
		const secretBytes = new TextEncoder().encode('test-signing-secret');
		const secret = `whsec_${btoa(String.fromCharCode(...secretBytes))}`;
		const payload = '{"type":"email.opened","data":{"email_id":"email_test"}}';
		const id = 'msg_test';
		const timestamp = Math.floor(Date.now() / 1000).toString();
		const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
		const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${payload}`));
		const signature = btoa(String.fromCharCode(...new Uint8Array(digest)));
		const context = {
			env: { resend_webhook_secrets: secret },
			req: {
				header(name) {
					return { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` }[name];
				}
			}
		};

		await expect(resendService.verifyWebhook(context, payload))
			.resolves.toEqual({ type: 'email.opened', data: { email_id: 'email_test' } });
	});

	it('records opened events without replacing delivery status', async () => {
		const engagement = vi.spyOn(emailService, 'updateEmailEngagement').mockResolvedValue({ emailId: 1 });
		const status = vi.spyOn(emailService, 'updateEmailStatus').mockResolvedValue({ emailId: 1 });

		await resendService.webhooks(createContext(), {
			type: 'email.opened',
			created_at: '2026-09-11T12:00:00.000Z',
			data: { email_id: 'email_test' }
		});

		expect(engagement).toHaveBeenCalledWith(expect.anything(), {
			eventId: 'evt_test',
			eventType: 'email.opened',
			resendEmailId: 'email_test',
			occurredAt: '2026-09-11T12:00:00.000Z'
		});
		expect(status).not.toHaveBeenCalled();
	});

	it('retries engagement events that arrive before the email is stored', async () => {
		vi.spyOn(emailService, 'updateEmailEngagement').mockResolvedValue(null);

		await expect(resendService.webhooks(createContext(), {
			type: 'email.clicked',
			created_at: '2026-09-11T12:00:00.000Z',
			data: { email_id: 'email_not_stored_yet' }
		})).rejects.toThrow('未找到 Resend webhook 对应的邮件');
	});

	it('keeps delivery status handling intact', async () => {
		const status = vi.spyOn(emailService, 'updateEmailStatus').mockResolvedValue({ emailId: 1 });

		await resendService.webhooks(createContext(), {
			type: 'email.delivered',
			data: { email_id: 'email_test' }
		});

		expect(status).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
			resendEmailId: 'email_test',
			status: 2
		}));
	});
});
