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

	it('rejects unsigned webhooks when no signing secret is configured', () => {
		const context = {
			env: {},
			req: { header: () => undefined }
		};

		expect(() => resendService.verifyWebhook(context, '{"type":"email.opened"}'))
			.toThrow('Resend webhook 签名密钥未配置');
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
