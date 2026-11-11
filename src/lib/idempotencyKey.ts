/** An idempotency key: the client makes one per request and repeats it if the answer got lost. */
export const KEY = /^[A-Za-z0-9_-]{8,64}$/;
