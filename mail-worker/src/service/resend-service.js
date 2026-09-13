import emailService from './email-service';
import { emailConst } from '../const/entity-const';
import BizError from '../error/biz-error';

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function decodeWebhookSecret(secret) {
	const encoded = secret.startsWith('whsec_') ? secret.slice(6) : secret;
	const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
	const binary = atob(normalized);
	return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function constantTimeEqual(left, right) {
	const leftBytes = new TextEncoder().encode(left);
	const rightBytes = new TextEncoder().encode(right);
	if (leftBytes.length !== rightBytes.length) return false;
	let difference = 0;
	for (let index = 0; index < leftBytes.length; index++) {
		difference |= leftBytes[index] ^ rightBytes[index];
	}
	return difference === 0;
}

const resendService = {
	parseWebhookSecrets(value) {
		if (!value) return [];
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) return parsed.filter(Boolean);
			if (typeof parsed === 'string') return [parsed];
		} catch (_) {
			return value.split(',').map(item => item.trim()).filter(Boolean);
		}
		return [];
	},

	async verifyWebhook(c, payload) {
		const secrets = this.parseWebhookSecrets(c.env.resend_webhook_secrets);
		if (secrets.length === 0) {
			throw new BizError('Resend webhook 签名密钥未配置');
		}

		const headers = {
			id: c.req.header('svix-id'),
			timestamp: c.req.header('svix-timestamp'),
			signature: c.req.header('svix-signature')
		};
		if (!headers.id || !headers.timestamp || !headers.signature) {
			throw new BizError('Resend webhook 缺少签名请求头');
		}
		const timestamp = Number(headers.timestamp);
		if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
			throw new BizError('Resend webhook 签名已过期');
		}

		const signatures = headers.signature.split(' ').map(item => item.trim()).filter(Boolean);
		const signedContent = new TextEncoder().encode(`${headers.id}.${headers.timestamp}.${payload}`);
		for (const webhookSecret of secrets) {
			try {
				const key = await crypto.subtle.importKey(
					'raw',
					decodeWebhookSecret(webhookSecret),
					{ name: 'HMAC', hash: 'SHA-256' },
					false,
					['sign']
				);
				const digest = await crypto.subtle.sign('HMAC', key, signedContent);
				const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
				if (signatures.some(signature => {
					const [version, value] = signature.split(',', 2);
					return version === 'v1' && value && constantTimeEqual(value, expected);
				})) {
					return JSON.parse(payload);
				}
			} catch (_) {
				// A deployment can use multiple Resend accounts, so try every configured secret.
			}
		}

		throw new BizError('Resend webhook 签名验证失败');
	},

	async webhooks(c, body) {
		const resendEmailId = body?.data?.email_id;
		if (!resendEmailId) {
			throw new BizError('Resend webhook 缺少 email_id');
		}

		if (body.type === 'email.opened' || body.type === 'email.clicked') {
			const occurredAt = body.created_at || new Date().toISOString();
			const eventId = c.req.header('svix-id') || `${body.type}:${resendEmailId}:${occurredAt}`;
			const emailRow = await emailService.updateEmailEngagement(c, {
				eventId,
				eventType: body.type,
				resendEmailId,
				occurredAt
			});
			if (!emailRow) {
				throw new BizError('未找到 Resend webhook 对应的邮件');
			}
			return;
		}

		const params = {
			resendEmailId,
			status: emailConst.status.SENT
		}
		let supported = false;

		if (body.type === 'email.delivered') {
			supported = true;
			params.status = emailConst.status.DELIVERED
			params.message = null
		}

		if (body.type === 'email.complained') {
			supported = true;
			params.status = emailConst.status.COMPLAINED
			params.message = null
		}

		if (body.type === 'email.bounced') {
			supported = true;
			let bounce = body.data.bounce
			bounce = JSON.stringify(bounce);
			params.status = emailConst.status.BOUNCED
			params.message = bounce
		}

		if (body.type === 'email.delivery_delayed') {
			supported = true;
			params.status = emailConst.status.DELAYED
			params.message = null
		}

		if (body.type === 'email.failed') {
			supported = true;
			params.status = emailConst.status.FAILED
			params.message = body.data.failed.reason
		}

		if (!supported) return;

		const emailRow = await emailService.updateEmailStatus(c, params)

		if (!emailRow) {
			throw new BizError('更新邮件状态记录失败');
		}

	}
}

export default resendService
