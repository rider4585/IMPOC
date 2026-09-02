import { ZodError } from 'zod';

const errorMiddleware = (error, req, res, next) => {
    console.error(error);

    if (error instanceof ZodError) {
        const firstError = error.issues[0];
        return res.status(400).json({
            success: false,
            message: firstError ? firstError.message : 'Validation failed',
            errors: error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            })),
        });
    }

    // Handle errors with statusCode (custom application errors)
    if (error.statusCode && error.statusCode < 500) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message,
        });
    }

    // Handle 5xx errors - do not expose stack traces or internal details
    return res.status(error.statusCode || 500).json({
        success: false,
        message: 'Internal server error',
    });
};

export default errorMiddleware;