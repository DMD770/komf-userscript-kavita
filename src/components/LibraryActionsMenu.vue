<template>
  <q-menu class="text-body2 text-weight-medium">
    <q-item clickable v-close-popup @click="autoIdentify">
      <q-item-section class="text-body2 text-weight-medium" no-wrap>Auto-Identify Library</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="viewSkippedSeries">
      <q-item-section class="text-body2 text-weight-medium" no-wrap>View Skipped Series</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="retrySkippedSeries">
      <q-item-section class="text-body2 text-weight-medium" no-wrap>Retry Skipped Series</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="viewLatestSummary">
      <q-item-section class="text-body2 text-weight-medium" no-wrap>View Latest Summary</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="viewRunControlStatus">
      <q-item-section class="text-body2 text-weight-medium" no-wrap>Run Control Status</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="pauseRun">
      <q-item-section class="text-body2 text-weight-medium" no-wrap>Pause Run</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="resumeRunContinue">
      <q-item-section class="text-body2 text-weight-medium" no-wrap>Resume Run (Continue)</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="resumeRunNew">
      <q-item-section class="text-body2 text-weight-medium" no-wrap>Resume Run (New)</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="stopRun">
      <q-item-section class="text-body2 text-weight-medium" no-wrap>Safe Stop Run</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="promptResetLibrary">
      <q-item-section class="text-body2 text-weight-medium" no-wrap>Reset Metadata</q-item-section>
    </q-item>
  </q-menu>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import type KomfMetadataService from '../services/komf-metadata.service'
import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
import { komfMetadataKey } from '@/injection-keys'
import { errorNotification } from '@/errorNotification'
import { useQuasar } from 'quasar'
import { useSettingsStore } from '@/stores/settings'
import MediaServer from '@/types/mediaServer'

const $q = useQuasar()
const metadataService = inject<KomfMetadataService>(komfMetadataKey) as KomfMetadataService
const settings = useSettingsStore()

function libraryId() {
    const pathname = window.location.pathname
    const routeSegment = settings.mediaServer == MediaServer.Komga ? 'libraries' : 'library'
    const routeMatch = pathname.match(new RegExp(`/${routeSegment}/([^/?#]+)`))
    if (routeMatch?.[1]) return routeMatch[1]

    const queryId = new URL(window.location.href).searchParams.get('libraryId')
    if (queryId) return queryId

    if (settings.mediaServer == MediaServer.Kavita) {
        const activeHref = document
            .querySelector('app-side-nav a.side-nav-item.active')
            ?.getAttribute('href')
        if (activeHref) {
            const parts = activeHref.split('/')
            const index = parts.findIndex((el) => el == 'library')
            if (index >= 0 && parts[index + 1]) return parts[index + 1]
        }
    }

    throw new Error(`Unable to determine library id from URL: ${window.location.href}`)
}

async function autoIdentify() {
    try {
        await metadataService.matchLibrary(libraryId())
    } catch (e) {
        errorNotification(e, $q)
        return
    }
    $q.notify({
        message: 'Launched library scan',
        color: 'secondary',
        closeBtn: true,
        timeout: 5000
    })
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

async function viewSkippedSeries() {
    try {
        const skipped = await metadataService.getSkippedSeries(libraryId())
        if (skipped.length === 0) {
            $q.notify({
                message: 'No skipped series found',
                color: 'secondary',
                closeBtn: true,
                timeout: 5000
            })
            return
        }
        const lines = skipped
            .slice(0, 30)
            .map((entry) => {
                const label = entry.hintedName || entry.hintedSortName || '(unknown title)'
                return `<li><b>${escapeHtml(label)}</b> [${escapeHtml(entry.oldSeriesId)}] - ${escapeHtml(entry.reason)}</li>`
            })
            .join('')
        const more = skipped.length > 30 ? `<p>...and ${skipped.length - 30} more</p>` : ''
        $q.dialog({
            title: `Skipped Series (${skipped.length})`,
            message: `<ul>${lines}</ul>${more}`,
            html: true
        })
    } catch (e) {
        errorNotification(e, $q)
    }
}

async function retrySkippedSeries() {
    let skippedCount = 0
    try {
        skippedCount = (await metadataService.getSkippedSeries(libraryId())).length
        if (skippedCount === 0) {
            $q.notify({
                message: 'No skipped series to retry',
                color: 'secondary',
                closeBtn: true,
                timeout: 5000
            })
            return
        }
    } catch (e) {
        errorNotification(e, $q)
        return
    }

    $q.dialog({
        component: ConfirmationDialog,
        componentProps: {
            title: 'Retry Skipped Series',
            bodyHtml: `Retry ${skippedCount} skipped entries with ID remap?<br/>This queues only resolved series and defers scan.`,
            confirmText: 'Yes, retry skipped',
            buttonConfirm: 'Retry',
            buttonConfirmColor: 'secondary'
        }
    }).onOk(async () => {
        try {
            const result = await metadataService.retrySkippedSeries(libraryId(), false)
            $q.notify({
                message: `Retry queued: ${result.retried}/${result.totalSkipped} (unresolved: ${result.unresolved})`,
                color: result.unresolved > 0 ? 'warning' : 'secondary',
                closeBtn: true,
                timeout: 7000
            })
        } catch (e) {
            errorNotification(e, $q)
        }
    })
}

function formatDurationMs(startedAtEpochMs: number, finishedAtEpochMs: number): string {
    const totalSeconds = Math.max(0, Math.floor((finishedAtEpochMs - startedAtEpochMs) / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${seconds}s`
}

async function viewLatestSummary() {
    try {
        const summary = await metadataService.latestLibrarySummary(libraryId())
        if (!summary) {
            $q.notify({
                message: 'No library summary available yet',
                color: 'secondary',
                closeBtn: true,
                timeout: 5000
            })
            return
        }
        const started = new Date(summary.startedAtEpochMs).toLocaleString()
        const duration = formatDurationMs(summary.startedAtEpochMs, summary.finishedAtEpochMs)
        const message = `
          <p><b>Started:</b> ${escapeHtml(started)} (${escapeHtml(duration)})</p>
          <p><b>Series:</b> total ${summary.totalSeries}, processed ${summary.processedSeries}, updated ${summary.updatedSeries}</p>
          <p><b>Skipped:</b> ${summary.skippedSeries}, <b>Unmatched:</b> ${summary.unmatchedSeries}</p>
          <p><b>Errors:</b> provider ${summary.providerErrors}, processing ${summary.processingErrors}, unexpected ${summary.unexpectedErrors}</p>
          <p><b>Dry run:</b> ${summary.dryRun ? 'yes' : 'no'}</p>
        `
        $q.dialog({
            title: 'Latest Library Summary',
            message,
            html: true
        })
    } catch (e) {
        errorNotification(e, $q)
    }
}

async function viewRunControlStatus() {
    try {
        const status = await metadataService.libraryRunControlStatus(libraryId())
        const checkpoint = status.checkpoint
            ? `<p><b>Checkpoint:</b> page ${status.checkpoint.pageNumber}, index ${status.checkpoint.startIndexInPage}, dryRun=${status.checkpoint.dryRun}</p>`
            : '<p><b>Checkpoint:</b> none</p>'
        $q.dialog({
            title: 'Run Control Status',
            message: `
              <p><b>Active:</b> ${status.active}</p>
              <p><b>Paused:</b> ${status.paused}</p>
              <p><b>Stop requested:</b> ${status.stopRequested}</p>
              <p><b>Has checkpoint:</b> ${status.hasCheckpoint}</p>
              ${checkpoint}
            `,
            html: true
        })
    } catch (e) {
        errorNotification(e, $q)
    }
}

async function pauseRun() {
    try {
        await metadataService.pauseLibraryRun(libraryId())
        $q.notify({
            message: 'Pause requested for current library run',
            color: 'secondary',
            closeBtn: true,
            timeout: 5000
        })
    } catch (e) {
        errorNotification(e, $q)
    }
}

async function resumeRunContinue() {
    try {
        await metadataService.resumeLibraryRun(libraryId(), 'CONTINUE')
        $q.notify({
            message: 'Resume requested (continue from checkpoint)',
            color: 'secondary',
            closeBtn: true,
            timeout: 5000
        })
    } catch (e) {
        errorNotification(e, $q)
    }
}

async function resumeRunNew() {
    $q.dialog({
        component: ConfirmationDialog,
        componentProps: {
            title: 'Resume Run (New)',
            bodyHtml: 'Start a new library run from the beginning? Existing checkpoint will be discarded.',
            confirmText: 'Yes, start new run',
            buttonConfirm: 'Start New',
            buttonConfirmColor: 'warning'
        }
    }).onOk(async () => {
        try {
            await metadataService.resumeLibraryRun(libraryId(), 'NEW')
            $q.notify({
                message: 'Resume requested (new run from start)',
                color: 'secondary',
                closeBtn: true,
                timeout: 5000
            })
        } catch (e) {
            errorNotification(e, $q)
        }
    })
}

async function stopRun() {
    $q.dialog({
        component: ConfirmationDialog,
        componentProps: {
            title: 'Safe Stop Run',
            bodyHtml: 'Request a safe stop? KOMF will finish the current series, then stop and save a checkpoint for resume.',
            confirmText: 'Yes, safe stop',
            buttonConfirm: 'Safe Stop',
            buttonConfirmColor: 'negative'
        }
    }).onOk(async () => {
        try {
            await metadataService.stopLibraryRun(libraryId())
            $q.notify({
                message: 'Safe stop requested. Current series will finish, then run stops with a checkpoint.',
                color: 'warning',
                closeBtn: true,
                timeout: 6000
            })
        } catch (e) {
            errorNotification(e, $q)
        }
    })
}

function promptResetLibrary() {
    $q.dialog({
        component: ConfirmationDialog,

        componentProps: {
            title: 'Reset Library',
            bodyHtml: 'All metadata of all series inside this library  will be reset including field locks and thumbnails uploaded by Komf. No files will be modified. Continue?',
            confirmText: 'Yes, reset library',
            buttonConfirm: 'Reset',
            buttonConfirmColor: 'negative'
        }
    }).onOk(() => {
        resetLibrary()
    })
}

async function resetLibrary() {
    try {
        await metadataService?.resetLibrary(libraryId())
    } catch (e) {
        errorNotification(e, $q)
    }
}
</script>

<style scoped lang="scss">
@import '../styles/scoped.scss';
</style>
