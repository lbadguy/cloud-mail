import app from '../hono/hono';
import result from '../model/result';
import BizError from '../error/biz-error';
import userContext from '../security/user-context';

const DEFAULT_FORK_REPOSITORY = 'lbadguy/cloud-mail';
const DEFAULT_RELEASE_REPOSITORY = 'maillab/cloud-mail';
const DEFAULT_WORKFLOW = 'sync-upstream.yml';
const githubHeaders = (token) => ({
	'Accept': 'application/vnd.github+json',
	'User-Agent': 'lc7c-cloud-mail-update-check',
	...(token ? { 'Authorization': `Bearer ${token}` } : {})
});

function assertAdmin(c) {
	const user = userContext.getUser(c);
	if (!user || user.email !== c.env.admin) {
		throw new BizError('Only the administrator can manage updates.', 403);
	}
}

function repository(c) {
	return c.env.UPDATE_REPOSITORY || DEFAULT_FORK_REPOSITORY;
}

app.get('/update/status', async (c) => {
	assertAdmin(c);
	const repo = c.env.UPDATE_RELEASE_REPOSITORY || DEFAULT_RELEASE_REPOSITORY;
	const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
		headers: githubHeaders()
	});
	if (!response.ok) {
		throw new BizError(`GitHub release check failed: HTTP ${response.status}`, 502);
	}
	const release = await response.json();
	return c.json(result.ok({
		repository: repo,
		tagName: release.tag_name || release.name || '',
		name: release.name || release.tag_name || '',
		url: release.html_url || `https://github.com/${repo}/releases`,
		body: release.body || '',
		publishedAt: release.published_at || null
	}));
});

app.post('/update/apply', async (c) => {
	assertAdmin(c);
	const token = c.env.GITHUB_UPDATE_TOKEN;
	if (!token) {
		throw new BizError('GITHUB_UPDATE_TOKEN is not configured.', 503);
	}

	const repo = repository(c);
	const workflow = c.env.UPDATE_WORKFLOW || DEFAULT_WORKFLOW;
	const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
		method: 'POST',
		headers: {
			...githubHeaders(token),
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			ref: 'main',
			inputs: { apply: 'true' }
		})
	});
	if (!response.ok) {
		const detail = await response.text();
		console.error('GitHub update dispatch failed:', response.status, detail.slice(0, 500));
		throw new BizError(`GitHub update dispatch failed: HTTP ${response.status}`, 502);
	}

	return c.json(result.ok({ accepted: true, repository: repo, workflow }));
});
