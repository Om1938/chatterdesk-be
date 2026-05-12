import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../utils/errors.js'

export type WaMessageType = 'text' | 'image' | 'audio' | 'video' | 'document'

export interface SendTextPayload {
  type: 'text'
  body: string
}

export interface SendMediaPayload {
  type: 'image' | 'audio' | 'video' | 'document'
  mediaId?: string
  mediaUrl?: string
  caption?: string
}

export type SendMessagePayload = SendTextPayload | SendMediaPayload

export interface WaMessageResponse {
  messaging_product: 'whatsapp'
  contacts: Array<{ input: string; wa_id: string }>
  messages: Array<{ id: string; message_status: string }>
}

export class WhatsAppCloudService {
  private readonly base: string

  constructor() {
    this.base = `${config.WA_GRAPH_API_BASE}/${config.WA_GRAPH_API_VERSION}`
  }

  async sendMessage(
    phoneNumberId: string,
    accessToken: string,
    toWaId: string,
    payload: SendMessagePayload,
  ): Promise<WaMessageResponse> {
    const url = `${this.base}/${phoneNumberId}/messages`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, any> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toWaId,
      type: payload.type,
    }

    if (payload.type === 'text') {
      body['text'] = { preview_url: false, body: payload.body }
    } else {
      const media: Record<string, string> = {}
      if (payload.mediaId) media['id'] = payload.mediaId
      if (payload.mediaUrl) media['link'] = payload.mediaUrl
      if (payload.caption) media['caption'] = payload.caption
      body[payload.type] = media
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errBody = await res.text()
      logger.error({ status: res.status, body: errBody, phoneNumberId }, 'WA Cloud API error')
      throw new AppError(
        `WhatsApp API error: ${res.status}`,
        502,
        'WA_API_ERROR',
      )
    }

    return res.json() as Promise<WaMessageResponse>
  }

  async markMessageRead(
    phoneNumberId: string,
    accessToken: string,
    waMessageId: string,
  ): Promise<void> {
    const url = `${this.base}/${phoneNumberId}/messages`

    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: waMessageId,
      }),
    }).catch((err) => {
      // Non-fatal — best effort
      logger.warn({ err, waMessageId }, 'Failed to mark message as read')
    })
  }
}

export const waCloudService = new WhatsAppCloudService()
