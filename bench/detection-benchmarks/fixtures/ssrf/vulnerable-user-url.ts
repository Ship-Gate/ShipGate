import { Request, Response } from 'express';
import axios from 'axios';

interface WebhookConfig {
  url: string;
  secret?: string;
  events: string[];
}

export async function proxyRequest(req: Request, res: Response) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'AppProxy/1.0' },
    });

    return res.json({
      status: response.status,
      contentType: response.headers['content-type'],
      data: response.data,
    });
  } catch (error) {
    console.error('Proxy request failed:', error);
    return res.status(502).json({ error: 'Upstream request failed' });
  }
}

export async function fetchUrlPreview(req: Request, res: Response) {
  const { targetUrl } = req.body;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing targetUrl' });
  }

  try {
    const response = await fetch(targetUrl);
    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    );
    const imageMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    );

    return res.json({
      title: titleMatch?.[1] ?? null,
      description: descMatch?.[1] ?? null,
      image: imageMatch?.[1] ?? null,
      url: targetUrl,
    });
  } catch (error) {
    console.error('URL preview failed:', error);
    return res.status(400).json({ error: 'Could not fetch URL' });
  }
}

export async function registerWebhook(req: Request, res: Response) {
  const config = req.body as WebhookConfig;

  if (!config.url) {
    return res.status(400).json({ error: 'Webhook URL is required' });
  }

  try {
    const verification = await axios.post(config.url, {
      type: 'webhook.verification',
      challenge: crypto.randomUUID(),
    });

    if (verification.status !== 200) {
      return res.status(400).json({ error: 'Webhook verification failed' });
    }

    return res.json({
      success: true,
      webhookId: crypto.randomUUID(),
      url: config.url,
      events: config.events,
    });
  } catch (error) {
    console.error('Webhook registration failed:', error);
    return res.status(400).json({ error: 'Could not reach webhook URL' });
  }
}

export async function importFromUrl(req: Request, res: Response) {
  const { fileUrl } = req.body;

  try {
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      maxContentLength: 10 * 1024 * 1024,
    });

    const contentType = response.headers['content-type'];
    const buffer = Buffer.from(response.data);

    return res.json({
      success: true,
      size: buffer.length,
      contentType,
    });
  } catch (error) {
    console.error('Import failed:', error);
    return res.status(400).json({ error: 'Could not import from URL' });
  }
}
