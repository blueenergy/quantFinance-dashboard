import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  createFactorBacktestJob: vi.fn(),
  listFactorCatalog: vi.fn(),
}))

vi.mock('../../api/factorBacktest', () => api)

import { useFactorBacktestForm } from '../useFactorBacktestForm'

const ALPHA8 = [
  { name: 'alpha1', family: 'K线形态', description: '实体涨跌幅' },
  { name: 'alpha4', family: 'K线形态', description: '上下影线' },
  { name: 'alpha6', family: '量价关系', description: '量价背离' },
]

function mountForm(options = {}) {
  let form
  const Host = defineComponent({
    setup() {
      form = useFactorBacktestForm(options)
      return () => null
    },
  })
  const wrapper = mount(Host)
  return { wrapper, get formApi() { return form } }
}

function catalogResponse(factorSet, factors) {
  return { data: [{ factor_set: factorSet, factors, factor_count: factors.length }] }
}

describe('useFactorBacktestForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listFactorCatalog.mockResolvedValue(catalogResponse('alpha8', ALPHA8))
    api.createFactorBacktestJob.mockResolvedValue({ data: { job_id: 'job-9' } })
  })

  it('loads the catalog for the default set when the drawer opens', async () => {
    const host = mountForm()

    host.formApi.openCreateDrawer()
    await vi.waitFor(() => expect(host.formApi.catalogAvailable.value).toBe(true))

    expect(api.listFactorCatalog).toHaveBeenCalledWith({ factor_set: 'alpha8' })
    expect(host.formApi.factorGroups.value.map((group) => group.family))
      .toEqual(['K线形态', '量价关系'])
    host.wrapper.unmount()
  })

  it('fetches each catalog once and reuses it', async () => {
    const host = mountForm()

    host.formApi.openCreateDrawer()
    await vi.waitFor(() => expect(host.formApi.catalogAvailable.value).toBe(true))
    host.formApi.closeDrawer()
    host.formApi.openCreateDrawer()
    await nextTick()

    expect(api.listFactorCatalog).toHaveBeenCalledTimes(1)
    host.wrapper.unmount()
  })

  it('explains a catalog the worker has not published yet without blocking submit', async () => {
    api.listFactorCatalog.mockRejectedValue({ response: { status: 503 } })
    const host = mountForm()

    host.formApi.openCreateDrawer()
    await vi.waitFor(() => expect(host.formApi.catalogError.value).not.toBe(''))

    expect(host.formApi.catalogError.value).toContain('因子目录尚未发布')
    expect(host.formApi.catalogAvailable.value).toBe(false)

    await host.formApi.submit()
    expect(api.createFactorBacktestJob).toHaveBeenCalledWith(
      expect.objectContaining({ factors: null, factor_set: 'alpha8' }),
    )
    host.wrapper.unmount()
  })

  it('drops the picks and loads the other catalog when the user switches sets', async () => {
    const host = mountForm()
    host.formApi.openCreateDrawer()
    await vi.waitFor(() => expect(host.formApi.catalogAvailable.value).toBe(true))
    host.formApi.toggleFactor('alpha1')
    expect(host.formApi.selectedFactorCount.value).toBe(1)

    api.listFactorCatalog.mockResolvedValue(catalogResponse('alpha158', [{ name: 'MA5', family: '趋势' }]))
    host.formApi.onFormUpdate({ ...host.formApi.form.value, factor_set: 'alpha158' })
    await vi.waitFor(() => expect(host.formApi.catalogAvailable.value).toBe(true))

    expect(host.formApi.selectedFactorCount.value).toBe(0)
    expect(api.listFactorCatalog).toHaveBeenLastCalledWith({ factor_set: 'alpha158' })
    host.wrapper.unmount()
  })

  it('keeps the picks when an edit leaves the factor set alone', async () => {
    const host = mountForm()
    host.formApi.openCreateDrawer()
    await vi.waitFor(() => expect(host.formApi.catalogAvailable.value).toBe(true))
    host.formApi.toggleFactor('alpha1')

    host.formApi.onFormUpdate({ ...host.formApi.form.value, quantiles: 10 })

    expect(host.formApi.form.value.factors).toEqual(['alpha1'])
    expect(host.formApi.form.value.quantiles).toBe(10)
    host.wrapper.unmount()
  })

  it('keeps the factors of a rerun whose set differs from the default', async () => {
    api.listFactorCatalog.mockResolvedValue(catalogResponse('alpha158', [{ name: 'MA5', family: '趋势' }]))
    const host = mountForm()

    host.formApi.openRerunDrawer({
      name: 'alpha158 全集',
      params: { factor_set: 'alpha158', factors: ['MA5'], start_date: '20230101', end_date: '20231231' },
    })
    await vi.waitFor(() => expect(host.formApi.catalogAvailable.value).toBe(true))

    expect(host.formApi.form.value.factor_set).toBe('alpha158')
    expect(host.formApi.form.value.factors).toEqual(['MA5'])
    host.wrapper.unmount()
  })

  it('toggles, family-selects and clears factor picks', async () => {
    const host = mountForm()
    host.formApi.openCreateDrawer()
    await vi.waitFor(() => expect(host.formApi.catalogAvailable.value).toBe(true))

    host.formApi.toggleFactor('alpha1')
    host.formApi.toggleFactor('alpha1')
    expect(host.formApi.form.value.factors).toEqual([])

    host.formApi.selectFamily('K线形态')
    expect(host.formApi.form.value.factors).toEqual(['alpha1', 'alpha4'])

    host.formApi.clearFactors()
    expect(host.formApi.form.value.factors).toEqual([])
    host.wrapper.unmount()
  })

  it('only selects the factors the current search leaves visible', async () => {
    const host = mountForm()
    host.formApi.openCreateDrawer()
    await vi.waitFor(() => expect(host.formApi.catalogAvailable.value).toBe(true))

    host.formApi.factorSearch.value = '量价'
    host.formApi.selectVisibleFactors()

    expect(host.formApi.form.value.factors).toEqual(['alpha6'])
    host.wrapper.unmount()
  })

  it('submits the picked factors and opens the new job', async () => {
    const loadJobs = vi.fn().mockResolvedValue(undefined)
    const selectJob = vi.fn().mockResolvedValue(undefined)
    const setMessage = vi.fn()
    const host = mountForm({ loadJobs, selectJob, setMessage })

    host.formApi.openCreateDrawer()
    await vi.waitFor(() => expect(host.formApi.catalogAvailable.value).toBe(true))
    host.formApi.toggleFactor('alpha1')
    await host.formApi.submit()

    expect(api.createFactorBacktestJob).toHaveBeenCalledWith(
      expect.objectContaining({ factors: ['alpha1'], horizons: [1, 5, 10, 20], top_k: [20, 50] }),
    )
    expect(setMessage).toHaveBeenCalledWith('已提交因子回测 job-9')
    expect(host.formApi.drawerOpen.value).toBe(false)
    expect(loadJobs).toHaveBeenCalled()
    expect(selectJob).toHaveBeenCalledWith('job-9', { resetResult: true })
    host.wrapper.unmount()
  })

  it('reports a bad form without calling the API and keeps the drawer open', async () => {
    const host = mountForm()
    host.formApi.openCreateDrawer()
    host.formApi.form.value.horizons = ''

    await host.formApi.submit()

    expect(api.createFactorBacktestJob).not.toHaveBeenCalled()
    expect(host.formApi.formError.value).toContain('horizons')
    expect(host.formApi.drawerOpen.value).toBe(true)
    host.wrapper.unmount()
  })

  it('shows a rejection from the API in the drawer', async () => {
    api.createFactorBacktestJob.mockRejectedValue({
      response: { data: { detail: 'unknown alpha8 factors: alpha9' } },
    })
    const host = mountForm()
    host.formApi.openCreateDrawer()

    await host.formApi.submit()

    expect(host.formApi.formError.value).toBe('unknown alpha8 factors: alpha9')
    expect(host.formApi.drawerOpen.value).toBe(true)
    expect(host.formApi.submitting.value).toBe(false)
    host.wrapper.unmount()
  })

  it('prefills the drawer from an existing job for a rerun', async () => {
    const host = mountForm()

    host.formApi.openRerunDrawer({
      name: 'csi1000 alpha8',
      params: {
        index_code: 'hs300',
        start_date: '20220104',
        end_date: '20221230',
        factor_set: 'alpha8',
        factors: ['alpha1'],
        horizons: [1, 10],
        top_k: [30],
      },
    })
    await nextTick()

    expect(host.formApi.form.value).toMatchObject({
      name: 'csi1000 alpha8 重跑',
      index_code: 'hs300',
      start_date: '2022-01-04',
      end_date: '2022-12-30',
      factors: ['alpha1'],
      horizons: '1,10',
      top_k: '30',
    })
    expect(host.formApi.drawerOpen.value).toBe(true)
    host.wrapper.unmount()
  })
})
