<script setup lang="ts">
/**
 * 后台茶品编辑（工程优化）：页面只负责表单装配，
 * 逻辑在 composables/useAdminTeaEdit.ts，区块在 views/admin/components/ 下。
 */
import TeaBasicSection from './components/TeaBasicSection.vue'
import TeaGallerySection from './components/TeaGallerySection.vue'
import TeaSensesSection from './components/TeaSensesSection.vue'
import TeaBrewSection from './components/TeaBrewSection.vue'
import TeaTipsSection from './components/TeaTipsSection.vue'
import { useAdminTeaEdit } from './composables/useAdminTeaEdit'

const {
  isEdit,
  teaId,
  loading,
  saving,
  uploading,
  uploadingVideo,
  formRef,
  teaForm,
  rules,
  router,
  submit,
  handleToggle,
  onImageFile,
  onVideoFile,
  clearVideo,
} = useAdminTeaEdit()
</script>

<template>
  <div v-loading="loading">
    <div class="page-head">
      <div>
        <h2 class="text-h2">{{ isEdit ? '编辑茶品' : '新增茶品' }}</h2>
        <p class="text-small text-secondary">
          {{ isEdit ? 'PUT 全量保存；小贴士留空表示清空，不做审核流程。' : '保存后立即上架生效。' }}
        </p>
      </div>
      <div class="head-actions">
        <el-tag v-if="isEdit" :type="teaForm.is_active ? 'success' : 'info'">
          {{ teaForm.is_active ? '已上架' : '已下架' }}
        </el-tag>
        <el-button v-if="isEdit" type="warning" plain @click="handleToggle">
          {{ teaForm.is_active ? '下架' : '上架' }}
        </el-button>
        <el-button @click="router.push({ name: 'admin-teas' })">返回列表</el-button>
      </div>
    </div>

    <el-form ref="formRef" :model="teaForm" :rules="rules" label-width="96px" class="tea-form">
      <TeaBasicSection
        v-model:name="teaForm.name"
        v-model:category="teaForm.category"
        v-model:origin="teaForm.origin"
        v-model:season="teaForm.season"
        v-model:fermentation="teaForm.fermentation"
        v-model:price-range="teaForm.price_range"
        v-model:representative-variety="teaForm.representative_variety"
        v-model:main-image-url="teaForm.main_image_url"
        v-model:video-url="teaForm.video_url"
        v-model:video-duration="teaForm.video_duration"
        :uploading="uploading"
        :uploading-video="uploadingVideo"
        @upload-image="onImageFile"
        @upload-video="onVideoFile"
        @clear-video="clearVideo"
      />

      <TeaGallerySection v-if="isEdit" :tea-id="teaId" />

      <TeaSensesSection
        v-model:shape-desc="teaForm.shape_desc"
        v-model:soup-desc="teaForm.soup_desc"
        v-model:aroma-desc="teaForm.aroma_desc"
        v-model:taste-desc="teaForm.taste_desc"
      />

      <TeaBrewSection
        v-model:water-temp="teaForm.water_temp"
        v-model:tea-amount="teaForm.tea_amount"
        v-model:brew-time="teaForm.brew_time"
      />

      <TeaTipsSection
        v-model:tips-history="teaForm.tips_history"
        v-model:tips-suitable="teaForm.tips_suitable"
        v-model:tips-misconception="teaForm.tips_misconception"
        v-model:tips-official-note="teaForm.tips_official_note"
      />

      <div class="form-actions">
        <el-button @click="router.push({ name: 'admin-teas' })">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">
          {{ isEdit ? '保存修改' : '创建茶品' }}
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}
.page-head h2 {
  margin: 0 0 4px;
}
.page-head p {
  margin: 0;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tea-form {
  max-width: 1100px;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 4px 0 24px;
}

/* 各区块（基本信息 / 图片集 / 感官 / 冲泡 / 小贴士）样式分别在各子组件内 */
</style>
