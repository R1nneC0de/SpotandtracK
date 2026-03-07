import { z } from 'zod';
export declare const AddWatchlistSchema: z.ZodObject<{
    rawQuery: z.ZodString;
    artistHint: z.ZodOptional<z.ZodString>;
    titleHint: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    rawQuery: string;
    artistHint?: string | undefined;
    titleHint?: string | undefined;
}, {
    rawQuery: string;
    artistHint?: string | undefined;
    titleHint?: string | undefined;
}>;
export declare const PaginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type AddWatchlistInput = z.infer<typeof AddWatchlistSchema>;
//# sourceMappingURL=schemas.d.ts.map