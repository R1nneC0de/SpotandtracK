"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationSchema = exports.AddWatchlistSchema = void 0;
const zod_1 = require("zod");
exports.AddWatchlistSchema = zod_1.z.object({
    rawQuery: zod_1.z.string().min(1).max(500),
    artistHint: zod_1.z.string().max(200).optional(),
    titleHint: zod_1.z.string().max(200).optional(),
});
exports.PaginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
//# sourceMappingURL=schemas.js.map