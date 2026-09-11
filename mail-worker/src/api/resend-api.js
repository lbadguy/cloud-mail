import resendService from '../service/resend-service';
import app from '../hono/hono';
app.post('/webhooks',async (c) => {
	try {
		const payload = await c.req.text();
		const body = resendService.verifyWebhook(c, payload);
		await resendService.webhooks(c, body);
		return c.text('success', 200)
	} catch (e) {
		return  c.text(e.message, 500)
	}
})
