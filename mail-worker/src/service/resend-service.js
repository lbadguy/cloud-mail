import emailService from './email-service';
import { emailConst } from '../const/entity-const';
import BizError from '../error/biz-error';
import { Resend } from 'resend';

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

	verifyWebhook(c, payload) {
		const secrets = this.parseWebhookSecrets(c.env.resend_webhook_secrets);
		if (secrets.length === 0) {
			console.warn('未配置 Resend webhook 签名密钥，暂以兼容模式接收事件');
			return JSON.parse(payload);
		}

		const headers = {
			id: c.req.header('svix-id'),
			timestamp: c.req.header('svix-timestamp'),
			signature: c.req.header('svix-signature')
		};

		for (const webhookSecret of secrets) {
			try {
				return new Resend().webhooks.verify({ payload, headers, webhookSecret });
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
			await emailService.updateEmailEngagement(c, {
				eventId,
				eventType: body.type,
				resendEmailId,
				occurredAt
			});
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
