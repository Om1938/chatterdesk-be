export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR',
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class WebhookValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'WEBHOOK_VALIDATION_ERROR')
  }
}

export class WebhookSignatureError extends AppError {
  constructor() {
    super('Invalid webhook signature', 401, 'INVALID_SIGNATURE')
  }
}

export class KafkaPublishError extends AppError {
  constructor(topic: string, cause?: unknown) {
    super(`Failed to publish to Kafka topic: ${topic}`, 503, 'KAFKA_PUBLISH_ERROR')
    if (cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`
    }
  }
}
