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

export type LibraryApplyMode = 'CORE' | 'CHAPTERS' | 'FULL'

export interface LibraryRunSummary {
    libraryId: string,
    startedAtEpochMs: number,
    finishedAtEpochMs: number,
    dryRun: boolean,
    applyMode?: LibraryApplyMode,
    applyModeSource?: string,
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

export interface LibraryRunCheckpoint {
    pageNumber: number,
    startIndexInPage: number,
    dryRun: boolean,
    applyMode?: LibraryApplyMode,
    updatedAtEpochMs: number,
}

export interface LibraryRunControlStatus {
    active: boolean,
    paused: boolean,
    stopRequested: boolean,
    hasCheckpoint: boolean,
    checkpoint?: LibraryRunCheckpoint | null,
}

export type LibraryRunResumeMode = 'CONTINUE' | 'NEW'

export interface MetadataJobResponse {
    jobId: string
}

export type MetadataJobStatus = 'RUNNING' | 'FAILED' | 'COMPLETED'

export interface MetadataJob {
    id: string,
    status: MetadataJobStatus,
    message?: string | null,
}

export interface MetadataJobWaitResult {
    job: MetadataJob,
    completed: boolean,
}
