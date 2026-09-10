import { displayCodeParamSchema, publishStateSchema } from './pos-display.validation.js';
import { publish, subscribe } from './pos-display.state.js';

/**
 * POST /api/pos-display/:code — AUTHENTICATED (SALES.CREATE). The POS
 * publishes its current payment step; nobody else can inject a state (which
 * would otherwise let a stranger fake a QR/amount on someone else's display).
 */
export const publishState = async (req, res, next) => {
    try {
        const { code } = displayCodeParamSchema.parse(req.params);
        const data = publishStateSchema.parse(req.body);

        const state = publish(code, data);

        return res.status(200).json({
            success: true,
            data: state,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/pos-display/:code/stream — PUBLIC, no auth. Server-Sent Events;
 * the customer-facing display subscribes here. Sends the current state
 * immediately (late-join), then every subsequent publish. Only ever exposes
 * {status, method, amountPaise, upiUri} for the code the viewer already has.
 */
export const streamState = async (req, res, next) => {
    let code;
    try {
        ({ code } = displayCodeParamSchema.parse(req.params));
    } catch (error) {
        return next(error);
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const unsubscribe = subscribe(code, res);

    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 15000);
    heartbeat.unref?.();

    const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
};
