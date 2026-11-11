<script setup lang="ts">
/**
 * 管理员内容编辑：新增/编辑共用。
 * 逻辑在 composables/useAdminContentEdit.ts，页面只负责表单渲染。
 */
import { useAdminContentEdit } from './composables/useAdminContentEdit'

const {
  isEdit,
  types,
  loading,
  saving,
  form,
  teawareMeta,
  originMeta,
  cultureMeta,
  brandMeta,
  knowledgeMeta,
  onSubmit,
  onCancel,
} = useAdminContentEdit()
</script>

<template>
  <div class="admin-content-edit">
    <h3 class="admin-content-edit__title">{{ isEdit ? '编辑内容' : '新增内容' }}</h3>

    <el-form v-if="!loading" :model="form" label-width="100px" style="max-width: 720px">
      <el-form-item label="板块类型" required>
        <el-select v-model="form.type_code" placeholder="请选择板块" :disabled="isEdit">
          <el-option
            v-for="t in types"
            :key="t.code"
            :value="t.code"
            :label="`${t.icon ?? ''} ${t.name}`"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="标题" required>
        <el-input v-model="form.title" maxlength="200" show-word-limit />
      </el-form-item>

      <el-form-item label="摘要">
        <el-input
          v-model="form.summary"
          type="textarea"
          :rows="2"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="封面图 URL">
        <el-input v-model="form.cover_image" placeholder="http(s):// 或 /uploads/ 路径" />
      </el-form-item>

      <!-- meta 特有字段（按板块渲染） -->
      <template v-if="form.type_code === 'teaware'">
        <el-divider content-position="left">茶具特有字段</el-divider>
        <el-form-item label="材质">
          <el-input v-model="teawareMeta.material" placeholder="如：紫砂 / 白瓷 / 玻璃" />
        </el-form-item>
        <el-form-item label="容量">
          <el-input v-model="teawareMeta.volume" placeholder="如：200ml" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="teawareMeta.category" placeholder="如：盖碗 / 茶壶 / 品茗杯 / 公道杯" />
        </el-form-item>
      </template>

      <template v-else-if="form.type_code === 'origin'">
        <el-divider content-position="left">产地特有字段</el-divider>
        <el-form-item label="省份">
          <el-input v-model="originMeta.province" placeholder="如：浙江" />
        </el-form-item>
        <el-form-item label="产区">
          <el-input v-model="originMeta.region" placeholder="如：杭州西湖" />
        </el-form-item>
      </template>

      <template v-else-if="form.type_code === 'culture'">
        <el-divider content-position="left">文化特有字段</el-divider>
        <el-form-item label="时期">
          <el-input v-model="cultureMeta.era" placeholder="如：唐代 / 宋代" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="cultureMeta.tags" placeholder="逗号分隔，如：陆羽,茶经,茶道" />
        </el-form-item>
      </template>

      <template v-else-if="form.type_code === 'brand'">
        <el-divider content-position="left">品牌特有字段</el-divider>
        <el-form-item label="创立年份">
          <el-input-number v-model="brandMeta.founded" :min="0" :max="2100" placeholder="如：1915" />
        </el-form-item>
        <el-form-item label="产地">
          <el-input v-model="brandMeta.brand_origin" placeholder="如：福建安溪" />
        </el-form-item>
        <el-form-item label="官网">
          <el-input v-model="brandMeta.website" placeholder="https://..." />
        </el-form-item>
      </template>

      <template v-else-if="form.type_code === 'knowledge'">
        <el-divider content-position="left">知识特有字段</el-divider>
        <el-form-item label="分类">
          <el-select v-model="knowledgeMeta.subtype" placeholder="请选择">
            <el-option value="standard" label="茶叶标准" />
            <el-option value="brewing" label="冲泡知识" />
          </el-select>
        </el-form-item>
        <el-form-item label="难度">
          <el-select v-model="knowledgeMeta.difficulty" placeholder="请选择">
            <el-option value="beginner" label="入门" />
            <el-option value="intermediate" label="进阶" />
            <el-option value="advanced" label="高级" />
          </el-select>
        </el-form-item>
      </template>

      <el-form-item label="正文">
        <el-input
          v-model="form.body"
          type="textarea"
          :rows="10"
          maxlength="20000"
          show-word-limit
          placeholder="纯文本正文，段落间空行自动保留。MVP 暂不支持富文本。"
        />
      </el-form-item>

      <el-form-item label="排序">
        <el-input-number v-model="form.sort_order" :step="1" />
        <span style="margin-left: 12px; font-size: 12px; color: var(--color-text-muted)">
          同板块内数字越小越靠前
        </span>
      </el-form-item>

      <el-form-item label="状态">
        <el-switch v-model="form.is_active" active-text="上架" inactive-text="下架" />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :loading="saving" @click="onSubmit">
          {{ isEdit ? '保存' : '创建' }}
        </el-button>
        <el-button @click="onCancel">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.admin-content-edit__title {
  font-size: var(--text-h2);
  margin: 0 0 24px;
  color: var(--color-primary-dark);
}
</style>
