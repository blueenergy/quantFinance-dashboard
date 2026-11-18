import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ModelTrainingRetrainDialog from '../ModelTrainingRetrainDialog.vue'

const job = {
  job_id: 'source-job',
  name: 'clean-csi1000-raw5-live-20261108',
  params: {
    model_id: 'research-csi1000-clean-raw5',
    family_id: 'csi1000-clean-raw5',
  },
}

function mountDialog(overrides = {}) {
  return mount(ModelTrainingRetrainDialog, {
    props: {
      open: true,
      job,
      submitting: false,
      error: '',
      ...overrides,
    },
  })
}

describe('ModelTrainingRetrainDialog', () => {
  it('prefills a versioned model id from the source job', async () => {
    const wrapper = mountDialog()
    const inputs = wrapper.findAll('input')
    expect(inputs[0].element.value).toMatch(/^research-csi1000-clean-raw5-\d{6}$/)
    expect(inputs[1].element.value).toBe('csi1000-clean-raw5')
  })

  it('emits a retrain payload', async () => {
    const wrapper = mountDialog()
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('csi1000-clean-raw5-202611')
    await inputs[2].setValue('20261118')
    await wrapper.findAll('.retrain-foot button').at(-1).trigger('click')
    expect(wrapper.emitted('submit')).toEqual([
      [
        {
          model_id: 'csi1000-clean-raw5-202611',
          family_id: 'csi1000-clean-raw5',
          end_date: '20261118',
        },
      ],
    ])
  })

  it('rejects an empty model id', async () => {
    const wrapper = mountDialog()
    await wrapper.findAll('input')[0].setValue('')
    await wrapper.findAll('.retrain-foot button').at(-1).trigger('click')
    expect(wrapper.text()).toContain('新 model_id 必填')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
