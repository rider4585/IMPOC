/**
 * Ephemeral, in-memory POS-display channel store (R-35).
 *
 * Keyed by a short per-terminal display code. NOT backed by a database —
 * losing this on process restart is fine, the state is a live payment-step
 * mirror, never a record of anything. Kept minimal on purpose: status,
 * method, amountPaise, upiUri, and (R-42c, user-approved) an optional
 * customerFirstName — first name ONLY, for the spoken thank-you. No other
 * customer PII, no cart lines.
 */

export const IDLE_STATE = Object.freeze({
    status: 'idle',
    method: null,
    amountPaise: null,
    upiUri: null,
    customerFirstName: null,
    // R-54: Google review link rendered as a QR on the thank-you screen
    reviewUrl: null,
});

// R-54: the thank-you + review-QR screen stays up until the cashier clicks
// "Close transaction" on the POS (which publishes idle). This long timer is
// only a safety net so a forgotten display, or a guessed code, never keeps
// showing an old confirmation for good.
const RECEIVED_AUTO_RESET_MS = 15 * 60 * 1000;

// code -> { state, subscribers: Set<res>, resetTimer: Timeout|null }
const channels = new Map();

function getOrCreateChannel(code) {
    let channel = channels.get(code);
    if (!channel) {
        channel = { state: { ...IDLE_STATE }, subscribers: new Set(), resetTimer: null };
        channels.set(code, channel);
    }
    return channel;
}

function writeEvent(res, state) {
    res.write(`data: ${JSON.stringify(state)}\n\n`);
}

export function getState(code) {
    const channel = channels.get(code);
    return channel ? channel.state : { ...IDLE_STATE };
}

/**
 * Publish a new state for `code` and push it to every live subscriber.
 * Schedules an auto-reset to idle when the new status is 'received'.
 */
export function publish(code, nextState) {
    const channel = getOrCreateChannel(code);

    if (channel.resetTimer) {
        clearTimeout(channel.resetTimer);
        channel.resetTimer = null;
    }

    channel.state = { ...IDLE_STATE, ...nextState };

    for (const subscriber of channel.subscribers) {
        writeEvent(subscriber, channel.state);
    }

    if (channel.state.status === 'received') {
        channel.resetTimer = setTimeout(() => {
            channel.resetTimer = null;
            publish(code, { ...IDLE_STATE });
        }, RECEIVED_AUTO_RESET_MS);
        // Node test runners (--forceExit aside) shouldn't be kept alive by this.
        if (typeof channel.resetTimer.unref === 'function') {
            channel.resetTimer.unref();
        }
    }

    return channel.state;
}

/**
 * Subscribe `res` (an Express response used as an SSE sink) to `code`.
 * Sends the current state immediately (late-join) and returns an
 * unsubscribe function to call on connection close.
 */
export function subscribe(code, res) {
    const channel = getOrCreateChannel(code);
    channel.subscribers.add(res);
    writeEvent(res, channel.state);

    return function unsubscribe() {
        const existing = channels.get(code);
        if (existing) {
            existing.subscribers.delete(res);
        }
    };
}

/**
 * Test/diagnostic helper: number of live subscribers for a code.
 */
export function subscriberCount(code) {
    const channel = channels.get(code);
    return channel ? channel.subscribers.size : 0;
}

export const __testing = { RECEIVED_AUTO_RESET_MS, channels };
