export const requireSpaHeader = (req, res, next) => {
    const header = req.get('X-Requested-With');
    if (!header || header.toLowerCase().trim() !== 'impoc-spa') {
        return res.status(403).json({
            success: false,
            message: 'Missing required X-Requested-With header',
        });
    }
    next();
};
