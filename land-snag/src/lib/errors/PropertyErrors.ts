export class PropertyError extends Error {
    constructor(message: string, public readonly code: string, public readonly details?: any) {
        super(message);
        this.name = 'PropertyError';
    }
}

export class ProviderError extends PropertyError {
    constructor(message: string, public readonly providerName: string, details?: any) {
        super(message, 'PROVIDER_ERROR', { providerName, ...details });
        this.name = 'ProviderError';
    }
}

export class ValidationError extends PropertyError {
    constructor(message: string, details?: any) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

export class DatabaseError extends PropertyError {
    constructor(message: string, details?: any) {
        super(message, 'DATABASE_ERROR', details);
        this.name = 'DatabaseError';
    }
}

export class RateLimitError extends PropertyError {
    constructor(message: string, public readonly retryAfter?: number, details?: any) {
        super(message, 'RATE_LIMIT_ERROR', { retryAfter, ...details });
        this.name = 'RateLimitError';
    }
}

export class CacheError extends PropertyError {
    constructor(message: string, details?: any) {
        super(message, 'CACHE_ERROR', details);
        this.name = 'CacheError';
    }
}