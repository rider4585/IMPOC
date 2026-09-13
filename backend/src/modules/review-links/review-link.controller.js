import { createReviewLinkSchema, reviewLinkUuidParamSchema, updateReviewLinkSchema } from './review-link.validation.js';
import {
    getReviewLinks as getReviewLinksList,
    createReviewLink as createReviewLinkService,
    getReviewLinkByUuid as getReviewLinkByUuidService,
    updateReviewLink as updateReviewLinkService,
} from './review-link.service.js';

function mapReviewLinkDTO(reviewLink) {
    return {
        uuid: reviewLink.uuid,
        label: reviewLink.label,
        url: reviewLink.url,
        isActive: reviewLink.isActive,
        createdAt: reviewLink.createdAt,
        updatedAt: reviewLink.updatedAt,
    };
}

export const getReviewLinks = async (req, res, next) => {
    try {
        const reviewLinks = await getReviewLinksList();

        return res.status(200).json({
            success: true,
            data: reviewLinks.map(mapReviewLinkDTO),
        });
    } catch (error) {
        next(error);
    }
};

export const createReviewLink = async (req, res, next) => {
    try {
        const data = createReviewLinkSchema.parse(req.body);

        const reviewLink = await createReviewLinkService(data);

        return res.status(201).json({
            success: true,
            data: mapReviewLinkDTO(reviewLink),
        });
    } catch (error) {
        next(error);
    }
};

export const getReviewLinkByUuid = async (req, res, next) => {
    try {
        const { uuid } = reviewLinkUuidParamSchema.parse(req.params);

        const reviewLink = await getReviewLinkByUuidService(uuid);

        return res.status(200).json({
            success: true,
            data: mapReviewLinkDTO(reviewLink),
        });
    } catch (error) {
        next(error);
    }
};

export const updateReviewLink = async (req, res, next) => {
    try {
        const { uuid } = reviewLinkUuidParamSchema.parse(req.params);
        const data = updateReviewLinkSchema.parse(req.body);

        const reviewLink = await updateReviewLinkService(uuid, data);

        return res.status(200).json({
            success: true,
            data: mapReviewLinkDTO(reviewLink),
        });
    } catch (error) {
        next(error);
    }
};
