import axios, { type AxiosInstance } from 'axios'
import type {
    IdentifyRequest,
    LibraryApplyMode,
    LibraryRunControlStatus,
    LibraryRunResumeMode,
    LibraryRunSummary,
    MetadataJob,
    MetadataJobResponse,
    MetadataJobWaitResult,
    RetrySkippedSeriesResponse,
    SearchResult,
    SkippedSeriesEntry
} from '@/types/metadata'
import { useSettingsStore } from '@/stores/settings'

export default class KomfMetadataService {
    private static readonly JOB_POLL_INTERVAL_MS = 5000
    private http: AxiosInstance
    private settings = useSettingsStore()

    constructor(http: AxiosInstance) {
        this.http = http
    }

    private metadataUrls(path: string, baseUrl: string = this.settings.komfUrl): string[] {
        const base = baseUrl.replace(/\/+$/, '')
        const server = this.settings.mediaServer
        return [
            `${base}/api/${server}/metadata${path}`,
            `${base}/${server}${path}`
        ]
    }

    private metadataUrlsLegacyFirst(path: string, baseUrl: string = this.settings.komfUrl): string[] {
        const base = baseUrl.replace(/\/+$/, '')
        const server = this.settings.mediaServer
        return [
            `${base}/${server}${path}`,
            `${base}/api/${server}/metadata${path}`
        ]
    }

    private jobUrls(path: string, baseUrl: string = this.settings.komfUrl): string[] {
        const base = baseUrl.replace(/\/+$/, '')
        return [
            `${base}/api/jobs${path}`,
            `${base}/jobs${path}`
        ]
    }

    private async getWithFallback<T>(path: string, config?: any): Promise<T> {
        const urls = this.metadataUrls(path)
        let lastError: unknown
        for (const url of urls) {
            try {
                return (await this.http.get(url, config)).data
            } catch (e) {
                lastError = e
                if (!axios.isAxiosError(e) || e.response?.status !== 404) throw e
            }
        }
        throw lastError
    }

    private async postWithFallback(path: string, data?: any, config?: any): Promise<any> {
        const urls = this.metadataUrls(path)
        let lastError: unknown
        for (const url of urls) {
            try {
                return await this.http.post(url, data, config)
            } catch (e) {
                lastError = e
                if (!axios.isAxiosError(e) || e.response?.status !== 404) throw e
            }
        }
        throw lastError
    }

    private async postLegacyFirstWithFallback(path: string, data?: any, config?: any): Promise<any> {
        const urls = this.metadataUrlsLegacyFirst(path)
        let lastError: unknown
        for (const url of urls) {
            try {
                return await this.http.post(url, data, config)
            } catch (e) {
                lastError = e
                if (!axios.isAxiosError(e) || e.response?.status !== 404) throw e
            }
        }
        throw lastError
    }

    private async getJobWithFallback<T>(path: string, config?: any): Promise<T> {
        const urls = this.jobUrls(path)
        let lastError: unknown
        for (const url of urls) {
            try {
                return (await this.http.get(url, config)).data
            } catch (e) {
                lastError = e
                if (!axios.isAxiosError(e) || e.response?.status !== 404) throw e
            }
        }
        throw lastError
    }

    async searchSeries(seriesName: string, libraryId?: string, seriesId?: string): Promise<SearchResult[]> {
        try {
            return await this.getWithFallback<SearchResult[]>('/search', {
                params: { name: seriesName, libraryId: libraryId, seriesId: seriesId },
                paramsSerializer: { indexes: null }
            })
        } catch (e: unknown) {
            let msg = 'Failed to retrieve search results'

            if (axios.isAxiosError(e)) {
                msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async identifySeries(request: IdentifyRequest): Promise<string | null> {
        try {
            const response = await this.postLegacyFirstWithFallback('/identify', request)
            const data = response.data as MetadataJobResponse
            if (!data?.jobId) return null
            return data.jobId
        } catch (e) {
            let msg = 'Failed to identify series'
            if (axios.isAxiosError(e)) {
                msg += `: ${e.message}`
            } else if (e instanceof Error) {
                msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async matchLibrary(libraryId: string, applyMode: LibraryApplyMode = 'CORE') {
        try {
            await this.postWithFallback(`/match/library/${libraryId}`, undefined, { params: { applyMode } })
        } catch (e) {
            let msg = 'Failed to match library'
            if (axios.isAxiosError(e)) {
                if (e.response?.status == 409) msg += ': Scan is already in progress'
                else msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async matchSeries(
        libraryId: string,
        seriesId: string,
        applyMode: LibraryApplyMode = 'CORE'
    ): Promise<string | null> {
        try {
            const response = await this.postLegacyFirstWithFallback(
                `/match/library/${libraryId}/series/${seriesId}`,
                undefined,
                { params: { applyMode } }
            )
            const data = response.data as MetadataJobResponse
            if (!data?.jobId) return null
            return data.jobId
        } catch (e) {
            let msg = 'Failed to match series'
            if (axios.isAxiosError(e)) {
                msg += `: ${e.message}`
            } else if (e instanceof Error) {
                msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async getJob(jobId: string): Promise<MetadataJob> {
        try {
            return await this.getJobWithFallback<MetadataJob>(`/${jobId}`)
        } catch (e) {
            let msg = `Failed to get job ${jobId}`
            if (axios.isAxiosError(e)) {
                msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async waitForJobCompletionOrBackground(
        jobId: string,
        timeoutMs: number = 90 * 1000
    ): Promise<MetadataJobWaitResult> {
        const startedAt = Date.now()
        let lastJob: MetadataJob | null = null
        while (Date.now() - startedAt < timeoutMs) {
            const job = await this.getJob(jobId)
            lastJob = job
            if (job.status == 'COMPLETED') return { job, completed: true }
            if (job.status == 'FAILED') {
                throw new Error(job.message ? `Job failed: ${job.message}` : 'Job failed')
            }
            await delay(KomfMetadataService.JOB_POLL_INTERVAL_MS)
        }
        return {
            job: lastJob ?? { id: jobId, status: 'RUNNING', message: null },
            completed: false
        }
    }

    async resetSeries(libraryId: string, seriesId: string) {
        try {
            await this.postWithFallback(`/reset/library/${libraryId}/series/${seriesId}`)
        } catch (e) {
            let msg = 'Failed to reset series'
            if (axios.isAxiosError(e)) {
                msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async resetLibrary(libraryId: string) {
        try {
            await this.postWithFallback(`/reset/library/${libraryId}`)
        } catch (e) {
            let msg = 'Failed to reset library'
            if (axios.isAxiosError(e)) {
                msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async getSkippedSeries(libraryId: string): Promise<SkippedSeriesEntry[]> {
        try {
            return await this.getWithFallback<SkippedSeriesEntry[]>(`/skipped/library/${libraryId}`)
        } catch (e) {
            let msg = 'Failed to get skipped series'
            if (axios.isAxiosError(e)) {
                msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async retrySkippedSeries(
        libraryId: string,
        dryRun: boolean = false
    ): Promise<RetrySkippedSeriesResponse> {
        try {
            return (
                await this.postWithFallback(`/retry-skipped/library/${libraryId}`, undefined, { params: { dryRun } })
            ).data
        } catch (e) {
            let msg = 'Failed to retry skipped series'
            if (axios.isAxiosError(e)) {
                msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async latestLibrarySummary(libraryId: string): Promise<LibraryRunSummary | null> {
        try {
            return await this.getWithFallback<LibraryRunSummary>(`/summary/library/${libraryId}/latest`)
        } catch (e) {
            if (axios.isAxiosError(e) && e.response?.status == 404) {
                return null
            }
            let msg = 'Failed to get latest library summary'
            if (axios.isAxiosError(e)) {
                msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async libraryRunControlStatus(libraryId: string): Promise<LibraryRunControlStatus> {
        try {
            return await this.getWithFallback<LibraryRunControlStatus>(`/control/library/${libraryId}/status`)
        } catch (e) {
            let msg = 'Failed to get library run status'
            if (axios.isAxiosError(e)) {
                msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async pauseLibraryRun(libraryId: string) {
        try {
            await this.postWithFallback(`/control/library/${libraryId}/pause`)
        } catch (e) {
            let msg = 'Failed to pause library run'
            if (axios.isAxiosError(e)) {
                msg += `: ${formatAxiosError(e)}`
            }
            throw new Error(msg)
        }
    }

    async resumeLibraryRun(libraryId: string, mode: LibraryRunResumeMode = 'CONTINUE') {
        try {
            await this.postWithFallback(`/control/library/${libraryId}/resume`, undefined, { params: { mode } })
        } catch (e) {
            let msg = 'Failed to resume library run'
            if (axios.isAxiosError(e)) {
                msg += `: ${formatAxiosError(e)}`
            }
            throw new Error(msg)
        }
    }

    async stopLibraryRun(libraryId: string) {
        try {
            await this.postWithFallback(`/control/library/${libraryId}/stop`)
        } catch (e) {
            let msg = 'Failed to stop library run'
            if (axios.isAxiosError(e)) {
                msg += `: ${formatAxiosError(e)}`
            }
            throw new Error(msg)
        }
    }

    async checkConnection(url: string) {
        let data
        try {
            const urls = this.metadataUrls('/providers', url)
            let lastError: unknown
            for (const target of urls) {
                try {
                    data = (await this.http.get(target)).data
                    lastError = null
                    break
                } catch (e) {
                    lastError = e
                    if (!axios.isAxiosError(e) || e.response?.status !== 404) throw e
                }
            }
            if (lastError) throw lastError
        } catch (e) {
            let msg = 'Connection Failed'
            if (axios.isAxiosError(e)) {
                msg = e.message
            }
            throw new Error(msg)
        }

        if (!Array.isArray(data)) {
            throw new Error('Connection Failed')
        }
    }
}

function formatAxiosError(e: any): string {
    const status = e.response?.status
    const statusText = e.response?.statusText
    const detail = e.response?.data?.message ?? e.response?.data?.error ?? e.message
    return [status, statusText, detail].filter((x) => x != null && x !== '').join(' ')
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
