import axios, { type AxiosInstance } from 'axios'
import type {
    IdentifyRequest,
    LibraryRunControlStatus,
    LibraryRunResumeMode,
    LibraryRunSummary,
    RetrySkippedSeriesResponse,
    SearchResult,
    SkippedSeriesEntry
} from '@/types/metadata'
import { useSettingsStore } from '@/stores/settings'

export default class KomfMetadataService {
    private http: AxiosInstance
    private settings = useSettingsStore()

    constructor(http: AxiosInstance) {
        this.http = http
    }

    private metadataUrls(path: string): string[] {
        const base = this.settings.komfUrl.replace(/\/+$/, '')
        const server = this.settings.mediaServer
        return [
            `${base}/api/${server}/metadata${path}`,
            `${base}/${server}${path}`
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

    async searchSeries(seriesName: string, libraryId?: string, seriesId?: string): Promise<SearchResult[]> {
        try {
            return (
                await this.http.get(`${this.settings.komfUrl}/${this.settings.mediaServer}/search`, {
                    params: { name: seriesName, libraryId: libraryId, seriesId: seriesId },
                    paramsSerializer: { indexes: null }
                })
            ).data
        } catch (e: unknown) {
            let msg = 'Failed to retrieve search results'

            if (axios.isAxiosError(e)) {
                msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async identifySeries(request: IdentifyRequest) {
        try {
            await this.http.post(`${this.settings.komfUrl}/${this.settings.mediaServer}/identify`, request)
        } catch (e) {
            let msg = 'Failed to identify series'
            if (axios.isAxiosError(e)) {
                msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async matchLibrary(libraryId: string) {
        try {
            await this.http.post(
                `${this.settings.komfUrl}/${this.settings.mediaServer}/match/library/${libraryId}`
            )
        } catch (e) {
            let msg = 'Failed to match library'
            if (axios.isAxiosError(e)) {
                if (e.response?.status == 409) msg += ': Scan is already in progress'
                else msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async matchSeries(libraryId: string, seriesId: string) {
        try {
            await this.http.post(
                `${this.settings.komfUrl}/${this.settings.mediaServer}/match/library/${libraryId}/series/${seriesId}`
            )
        } catch (e) {
            let msg = 'Failed to match series'
            if (axios.isAxiosError(e)) {
                msg += `: ${e.message}`
            }
            throw new Error(msg)
        }
    }

    async resetSeries(libraryId: string, seriesId: string) {
        try {
            await this.http.post(
                `${this.settings.komfUrl}/${this.settings.mediaServer}/reset/library/${libraryId}/series/${seriesId}`
            )
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
            await this.http.post(
                `${this.settings.komfUrl}/${this.settings.mediaServer}/reset/library/${libraryId}`
            )
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
            data = (await this.http.get(`${url}/${this.settings.mediaServer}/providers`)).data
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
