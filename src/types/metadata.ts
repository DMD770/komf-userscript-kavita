export interface SearchResult {
    imageUrl: string,
    title: string,
    provider: string
    resultId: string,
}

export interface IdentifyRequest {
    libraryId?: string,
    seriesId: string,
    provider: string,
    providerSeriesId: string,
    edition?: string
}

export interface SkippedSeriesEntry {
    oldSeriesId: string,
    hintedName?: string,
    hintedSortName?: string,
    reason: string,
    observedAtEpochMs: number,
}

export interface RetrySkippedSeriesResponse {
    totalSkipped: number,
    resolved: number,
    retried: number,
    unresolved: number,
    unresolvedSeriesIds: string[],
    retryJobIds: string[],
}

export interface LibraryRunSummary {
    libraryId: string,
    startedAtEpochMs: number,
    finishedAtEpochMs: number,
    dryRun: boolean,
    totalSeries: number,
    processedSeries: number,
    updatedSeries: number,
    skippedSeries: number,
    unmatchedSeries: number,
    providerErrors: number,
    processingErrors: number,
    unexpectedErrors: number,
    skippedSeriesIds: string[],
}
