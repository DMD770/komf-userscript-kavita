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
    let pathTokens = window.location.pathname.split('/')
    if (settings.mediaServer == MediaServer.Komga) {
        return pathTokens[pathTokens.findIndex(el => el == 'libraries') + 1]
    } else {
        return pathTokens[pathTokens.findIndex(el => el == 'library') + 1]
    }
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
