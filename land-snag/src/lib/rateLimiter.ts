import { RateLimitError } from './errors/PropertyErrors';

export interface RateLimiter {
    waitForToken(): Promise<void>;
}

export class TokenBucketLimiter implements RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private readonly capacity: number;
    private readonly refillRate: number; // tokens per millisecond

    constructor(capacity: number, refillRate: number) {
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.tokens = capacity;
        this.lastRefill = Date.now();
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const tokensToAdd = elapsed * this.refillRate;
        
        if (tokensToAdd > 0) {
            this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
            this.lastRefill = now;
        }
    }

    async waitForToken(): Promise<void> {
        this.refill();
        
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return;
        }

        // Calculate wait time needed to get a token
        const tokensNeeded = 1 - this.tokens;
        const waitTime = Math.ceil(tokensNeeded / this.refillRate);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // After waiting, we should have at least one token
        this.refill();
        this.tokens -= 1;
    }
}

class ProviderRateLimiter {
    private limiters: Map<string, TokenBucketLimiter> = new Map();
    private readonly defaultCapacity: number;
    private readonly defaultRefillRate: number;

    constructor(defaultCapacity: number, defaultRefillRate: number) {
        this.defaultCapacity = defaultCapacity;
        this.defaultRefillRate = defaultRefillRate;
    }

    getLimiter(providerName: string): RateLimiter {
        if (!this.limiters.has(providerName)) {
            this.limiters.set(providerName, new TokenBucketLimiter(this.defaultCapacity, this.defaultRefillRate));
        }
        return this.limiters.get(providerName)!;
    }
}

// Global rate limiter instance
const providerRateLimiter = new ProviderRateLimiter(
    parseInt(process.env.PROVIDER_RATE_LIMIT_CAPACITY || '30', 10),
    parseFloat(process.env.PROVIDER_RATE_LIMIT_REFILL_RATE || '0.5', 10) // tokens per second
);

export function getRateLimiter(providerName: string): RateLimiter {
    return providerRateLimiter.getLimiter(providerName);
}

export class ProviderRateLimitError extends RateLimitError {
    public readonly providerName: string;

    constructor(message: string, providerName: string, retryAfter?: number) {
        super(message, retryAfter);
        this.name = 'ProviderRateLimitError';
        this.providerName = providerName;
    }
}
