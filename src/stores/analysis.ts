import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AnalysisResult } from '@/types/analysis'

export const useAnalysisStore = defineStore('analysis', () => {
  const results = ref<AnalysisResult[]>([])
  const isAnalyzing = ref(false)

  function addResult(result: AnalysisResult) {
    results.value.push(result)
  }

  function clearResults() {
    results.value = []
  }

  return {
    results,
    isAnalyzing,
    addResult,
    clearResults
  }
})
